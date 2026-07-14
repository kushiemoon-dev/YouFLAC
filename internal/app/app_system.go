package app

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os/exec"
	"strconv"
	"strings"
	"time"

	core "github.com/kushiemoon-dev/youflac-core/v4"
	"github.com/kushiemoon-dev/youflac-core/v4/system"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// appVersion mirrors internal/api/handlers_system.go's AppVersion constant.
// Kept as a separate, unexported copy here since app_system.go lives in
// package app (not internal/api) and the two are not meant to share state.
// A var (not const) so release builds can set it via
// -ldflags "-X youflac/internal/app.appVersion=...".
var appVersion = "4.3.0"

// Health is kept for parity with the HTTP server's /health endpoint, even
// though it's of limited use in a desktop app: by the time any Wails-bound
// method can be called, OnStartup has already run, so this can never
// observe an "unhealthy" app. Retained anyway in case the frontend wants a
// cheap liveness ping mirroring the web build.
func (a *App) Health() map[string]any {
	return map[string]any{"status": "ok", "version": appVersion}
}

func (a *App) GetVersion() map[string]any {
	return map[string]any{"version": appVersion}
}

func (a *App) ServicesStatus() map[string]core.ServiceStatus {
	proxyURL := ""
	if a.config != nil {
		proxyURL = a.config.ProxyURL
	}
	return core.CheckServiceStatus(proxyURL)
}

func (a *App) FFmpegStatus() core.FFmpegInfo {
	return core.DetectFFmpeg()
}

// FFmpegInstall runs the FFmpeg installer, emitting progress via the
// "ffmpeg_install" Wails event. This mirrors handleFFmpegInstall's two
// broadcast points: one for each progress update (including the final
// "done" stage), and one for the terminal error case. Unlike the HTTP
// handler (which launches a goroutine and returns immediately), this
// method blocks until installation finishes so the frontend's promise
// resolves/rejects with the outcome.
func (a *App) FFmpegInstall() error {
	err := core.InstallFFmpeg(a.ctx, func(p core.FFmpegProgress) {
		runtime.EventsEmit(a.ctx, "ffmpeg_install", p)
	})
	if err != nil {
		runtime.EventsEmit(a.ctx, "ffmpeg_install", core.FFmpegProgress{Stage: "error", Error: err.Error()})
	}
	return err
}

func (a *App) OpenConfigFolder() error {
	return system.OpenConfigFolder()
}

func (a *App) GetLogs(since int64) []core.LogEntry {
	entries := core.GetLogs(since)
	if entries == nil {
		entries = []core.LogEntry{}
	}
	return entries
}

// UpdateCheckResult mirrors the JSON shape returned by handleUpdateCheck.
type UpdateCheckResult struct {
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	HasUpdate      bool   `json:"hasUpdate"`
	ReleaseURL     string `json:"releaseUrl"`
}

// UpdateCheck calls the GitHub releases API and compares the latest tag to
// appVersion. On any error it degrades gracefully (returns the zero-update
// result instead of an error), same as the HTTP handler.
func (a *App) UpdateCheck() UpdateCheckResult {
	graceful := UpdateCheckResult{CurrentVersion: appVersion}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://api.github.com/repos/kushiemoon-dev/YouFLAC/releases/latest", nil)
	if err != nil {
		return graceful
	}
	req.Header.Set("User-Agent", "YouFLAC/"+appVersion+" update-checker")
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return graceful
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return graceful
	}

	var payload struct {
		TagName string `json:"tag_name"`
		HTMLURL string `json:"html_url"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 64*1024)).Decode(&payload); err != nil {
		return graceful
	}

	latest := strings.TrimPrefix(payload.TagName, "v")
	hasUpdate := latest != "" && semverGreater(latest, appVersion)

	return UpdateCheckResult{
		CurrentVersion: appVersion,
		LatestVersion:  latest,
		HasUpdate:      hasUpdate,
		ReleaseURL:     payload.HTMLURL,
	}
}

// semverGreater returns true if a > b using simple X.Y.Z integer comparison.
func semverGreater(a, b string) bool {
	pa := strings.SplitN(a, ".", 3)
	pb := strings.SplitN(b, ".", 3)
	for i := 0; i < 3; i++ {
		var x, y int
		if i < len(pa) {
			x, _ = strconv.Atoi(pa[i])
		}
		if i < len(pb) {
			y, _ = strconv.Atoi(pb[i])
		}
		if x != y {
			return x > y
		}
	}
	return false
}

// ── Sources ────────────────────────────────────────────────────────────────

func (a *App) GetSources() []core.SourceInfo {
	if a.sourceMgr == nil {
		return []core.SourceInfo{}
	}
	return a.sourceMgr.GetSourcesInfoOrdered(a.config.SourceOrder)
}

func (a *App) SetSourcePriority(priority []string) error {
	if len(priority) == 0 {
		return fmt.Errorf("priority list is empty")
	}

	a.config.SourceOrder = priority
	a.config.AudioSourcePriority = priority
	if a.orchestrator != nil {
		a.orchestrator.SetPriority(priority)
	}
	return core.SaveConfig(a.config)
}

// ── Qobuz providers ────────────────────────────────────────────────────────

// GetQobuzProviders reports the providers actually configured at runtime
// (Config.QobuzProxyProviders / env QOBUZ_PROXY_PROVIDERS), not a hardcoded
// registry — "available" is empty unless the operator opted in. Limitation:
// this is config state, not live per-provider health; the core does not
// currently expose whether an enabled provider is actually reachable (see
// QobuzSource.IsAvailable, which is source-wide, not per-provider).
func (a *App) GetQobuzProviders() map[string]any {
	available := a.config.QobuzProxyProviders
	if available == nil {
		available = []string{}
	}
	disabled := a.config.QobuzProvidersDisabled
	if disabled == nil {
		disabled = []string{}
	}
	return map[string]any{
		"available": available,
		"disabled":  disabled,
	}
}

func (a *App) SetQobuzProviders(disabled []string) error {
	a.config.QobuzProvidersDisabled = disabled
	return core.SaveConfig(a.config)
}

// ── Soulseek ───────────────────────────────────────────────────────────────

func (a *App) GetSoulseekStatus() map[string]any {
	return a.soulseekStatusMap()
}

func (a *App) SoulseekLoginTest(username, password string) map[string]any {
	st := a.soulseekStatusMap()

	// Use provided credentials if any, fall back to saved config.
	if username == "" {
		username = a.config.SoulseekUsername
	}
	if password == "" {
		password = a.config.SoulseekPassword
	}

	// Quick pre-checks before attempting a real network connection.
	if st["binaryFound"] != true {
		return map[string]any{"ok": false, "details": st, "error": "sldl binary not found"}
	}
	if username == "" || password == "" {
		return map[string]any{"ok": false, "details": st, "error": "credentials not configured"}
	}

	binaryPath := core.ResolveSldlPath(a.config.SoulseekBinaryPath)
	src := core.NewSoulseekSource(binaryPath, username, password)
	if err := src.TestLogin(20 * time.Second); err != nil {
		return map[string]any{"ok": false, "details": st, "error": err.Error()}
	}
	return map[string]any{"ok": true, "details": st}
}

func (a *App) soulseekStatusMap() map[string]any {
	binaryPath := core.ResolveSldlPath(a.config.SoulseekBinaryPath)
	if binaryPath == "" {
		binaryPath = "sldl"
	}
	st := map[string]any{
		"available":      false,
		"binaryFound":    false,
		"credentialsSet": a.config.SoulseekUsername != "" && a.config.SoulseekPassword != "",
		"binaryPath":     binaryPath,
		"version":        "",
	}
	if ver := sldlVersion(binaryPath); ver != "" {
		st["binaryFound"] = true
		st["version"] = ver
		if a.config.SoulseekUsername != "" && a.config.SoulseekPassword != "" {
			st["available"] = true
		}
	}
	return st
}

func sldlVersion(binaryPath string) string {
	out, err := exec.Command(binaryPath, "--version").Output()
	if err != nil {
		return ""
	}
	return strings.SplitN(strings.TrimSpace(string(out)), "\n", 2)[0]
}
