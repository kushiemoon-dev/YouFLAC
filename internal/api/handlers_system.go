package api

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	core "github.com/kushiemoon-dev/youflac-core/v4"
	"github.com/kushiemoon-dev/youflac-core/v4/system"
)

const AppVersion = "4.3.0"

// Health check
func (s *Server) handleHealth(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"status":  "ok",
		"version": AppVersion,
	})
}

func (s *Server) handleGetVersion(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"version": AppVersion})
}

func (s *Server) handleServicesStatus(c *fiber.Ctx) error {
	proxyURL := ""
	if s.config != nil {
		proxyURL = s.config.ProxyURL
	}
	statuses := core.CheckServiceStatus(proxyURL)
	return c.JSON(statuses)
}

// FFmpeg status
func (s *Server) handleFFmpegStatus(c *fiber.Ctx) error {
	return c.JSON(core.DetectFFmpeg())
}

// FFmpeg install (async, progress broadcast via WebSocket)
func (s *Server) handleFFmpegInstall(c *fiber.Ctx) error {
	go func() {
		ctx := context.Background()
		err := core.InstallFFmpeg(ctx, func(p core.FFmpegProgress) {
			s.wsHub.Broadcast(fiber.Map{"type": "ffmpeg_install", "progress": p})
		})
		if err != nil {
			s.wsHub.Broadcast(fiber.Map{"type": "ffmpeg_install", "progress": core.FFmpegProgress{Stage: "error", Error: err.Error()}})
		}
	}()
	return c.JSON(fiber.Map{"started": true})
}

func (s *Server) handleOpenConfigFolder(c *fiber.Ctx) error {
	if err := system.OpenConfigFolder(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"success": true})
}

// ============== Logs Handler ==============

func (s *Server) handleGetLogs(c *fiber.Ctx) error {
	sinceID := c.QueryInt("since", 0)
	entries := core.GetLogs(int64(sinceID))
	if entries == nil {
		entries = []core.LogEntry{}
	}
	return c.JSON(entries)
}

// handleUpdateCheck calls the GitHub releases API and compares the latest tag to AppVersion.
// On any error it degrades gracefully (no 5xx).
func (s *Server) handleUpdateCheck(c *fiber.Ctx) error {
	graceful := fiber.Map{
		"currentVersion": AppVersion,
		"latestVersion":  "",
		"hasUpdate":      false,
		"releaseUrl":     "",
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://api.github.com/repos/kushiemoon-dev/YouFLAC/releases/latest", nil)
	if err != nil {
		return c.JSON(graceful)
	}
	req.Header.Set("User-Agent", "YouFLAC/"+AppVersion+" update-checker")
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return c.JSON(graceful)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.JSON(graceful)
	}

	var payload struct {
		TagName string `json:"tag_name"`
		HTMLURL string `json:"html_url"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 64*1024)).Decode(&payload); err != nil {
		return c.JSON(graceful)
	}

	latest := strings.TrimPrefix(payload.TagName, "v")
	hasUpdate := latest != "" && semverGreater(latest, AppVersion)

	return c.JSON(fiber.Map{
		"currentVersion": AppVersion,
		"latestVersion":  latest,
		"hasUpdate":      hasUpdate,
		"releaseUrl":     payload.HTMLURL,
	})
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
