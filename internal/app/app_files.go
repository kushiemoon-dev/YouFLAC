package app

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	core "github.com/kushiemoon-dev/youflac-core/v4"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ============== Files ==============
// Mirrors internal/api/handlers_files.go, minus Fiber.

type FileInfo struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	IsDir     bool   `json:"isDir"`
	Size      int64  `json:"size"`
	Extension string `json:"extension"`
	Type      string `json:"type"` // "video", "audio", "cover", "nfo", "other"
}

// getFileType determines the type of file based on its extension
func getFileType(ext string) string {
	ext = strings.ToLower(ext)
	switch ext {
	case ".mkv", ".mp4", ".webm", ".avi", ".mov":
		return "video"
	case ".flac", ".mp3", ".m4a", ".aac", ".ogg", ".opus", ".wav":
		return "audio"
	case ".jpg", ".jpeg", ".png", ".webp", ".gif":
		return "cover"
	case ".nfo":
		return "nfo"
	case ".lrc":
		return "lyrics"
	default:
		return "other"
	}
}

// ListFiles lists files in dir (defaults to the configured/default output
// directory when empty), optionally filtered by comma-separated extensions
// (e.g. ".mkv,.flac"). Directories always pass the filter.
func (a *App) ListFiles(dir string, filter string) ([]FileInfo, error) {
	if dir == "" {
		dir = a.config.OutputDirectory
		if dir == "" {
			dir = core.GetDefaultOutputDirectory()
		}
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	files := []FileInfo{}
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}

		ext := strings.ToLower(filepath.Ext(entry.Name()))

		if filter != "" {
			filters := strings.Split(filter, ",")
			matched := entry.IsDir() // Always include directories
			for _, f := range filters {
				if strings.ToLower(strings.TrimSpace(f)) == ext {
					matched = true
					break
				}
			}
			if !matched {
				continue
			}
		}

		files = append(files, FileInfo{
			Name:      entry.Name(),
			Path:      filepath.Join(dir, entry.Name()),
			IsDir:     entry.IsDir(),
			Size:      info.Size(),
			Extension: ext,
			Type:      getFileType(ext),
		})
	}

	return files, nil
}

// playlistTrackDirRe matches the leading track-number prefix that
// GeneratePlaylistFilePath gives each track's own subfolder, e.g.
// "01 - Artist - Title" -> track "01".
var playlistTrackDirRe = regexp.MustCompile(`^(\d+)\s*-\s*`)

// GetPlaylistFolders returns the names of top-level output directories whose
// immediate children look like playlist track subfolders.
func (a *App) GetPlaylistFolders() []string {
	outputDir := a.config.OutputDirectory
	if outputDir == "" {
		outputDir = core.GetDefaultOutputDirectory()
	}

	folders := []string{}

	entries, err := os.ReadDir(outputDir)
	if err != nil {
		return folders // Return empty if can't read
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		// A playlist folder's immediate children are per-track subfolders
		// named "01 - Artist - Title" (see GeneratePlaylistFilePath).
		subPath := filepath.Join(outputDir, entry.Name())
		subEntries, _ := os.ReadDir(subPath)
		for _, sub := range subEntries {
			if sub.IsDir() && playlistTrackDirRe.MatchString(sub.Name()) {
				folders = append(folders, entry.Name())
				break
			}
		}
	}

	return folders
}

type ReorganizeResult struct {
	Success   bool     `json:"success"`
	Renamed   int      `json:"renamed"`
	Errors    []string `json:"errors,omitempty"`
	NewFolder string   `json:"newFolder,omitempty"`
}

type FlattenResult struct {
	Success bool     `json:"success"`
	Moved   int      `json:"moved"`
	Errors  []string `json:"errors,omitempty"`
}

// metadataFromPlaylistTrack builds naming metadata for a single track that
// was downloaded as part of a playlist. It prefers the tags ffmpeg embedded
// in the file at download time, falling back to the "NN - Artist - Title"
// track subfolder name when a tag is missing.
func metadataFromPlaylistTrack(mediaPath, trackDirName string) *core.Metadata {
	m := &core.Metadata{}

	if match := playlistTrackDirRe.FindStringSubmatch(trackDirName); match != nil {
		if n, err := strconv.Atoi(match[1]); err == nil {
			m.Track = n
		}
	}

	tags := core.ExtractAudioTags(mediaPath)
	m.Title = tags["title"]
	m.Artist = tags["artist"]
	m.Album = tags["album"]

	if m.Title == "" || m.Artist == "" {
		rest := playlistTrackDirRe.ReplaceAllString(trackDirName, "")
		if parts := strings.SplitN(rest, " - ", 2); len(parts) == 2 {
			if m.Artist == "" {
				m.Artist = strings.TrimSpace(parts[0])
			}
			if m.Title == "" {
				m.Title = strings.TrimSpace(parts[1])
			}
		}
	}

	return m
}

// resolvePlaylistDir validates folderPath as a plain, single-segment
// directory name (exactly what GetPlaylistFolders returns) and joins it under
// outputDir. Rejecting any path separator or ".." means the result can never
// escape outputDir, closing off path traversal via a crafted folderPath.
func resolvePlaylistDir(outputDir, folderPath string) (string, error) {
	if folderPath == "" || folderPath == "." || folderPath == ".." || strings.ContainsAny(folderPath, "/\\") {
		return "", fmt.Errorf("invalid folder path")
	}
	return filepath.Join(outputDir, folderPath), nil
}

// ReorganizePlaylist moves each track out of a playlist download
// (outputDir/PlaylistName/NN - Artist - Title/NN - Artist - Title.ext) into
// the app's regular NamingTemplate layout, using the file's embedded tags.
func (a *App) ReorganizePlaylist(folderPath string) (ReorganizeResult, error) {
	outputDir := a.config.OutputDirectory
	if outputDir == "" {
		outputDir = core.GetDefaultOutputDirectory()
	}
	playlistDir, err := resolvePlaylistDir(outputDir, folderPath)
	if err != nil {
		return ReorganizeResult{}, err
	}

	trackDirs, err := os.ReadDir(playlistDir)
	if err != nil {
		return ReorganizeResult{}, err
	}

	result := ReorganizeResult{Success: true}
	for _, trackDir := range trackDirs {
		if !trackDir.IsDir() {
			continue
		}
		trackPath := filepath.Join(playlistDir, trackDir.Name())
		files, _ := os.ReadDir(trackPath)
		for _, f := range files {
			ext := strings.ToLower(filepath.Ext(f.Name()))
			if f.IsDir() || (ext != ".mkv" && ext != ".flac") {
				continue
			}
			mediaPath := filepath.Join(trackPath, f.Name())
			metadata := metadataFromPlaylistTrack(mediaPath, trackDir.Name())

			// NB: core.RenameMKV hardcodes a ".mkv" destination extension, which
			// would corrupt the audio-only ".flac" fallback output — build the
			// destination path directly instead, preserving the real extension.
			newPath := core.GenerateFilePath(metadata, a.config.NamingTemplate, outputDir, ext)
			if newPath == mediaPath {
				continue
			}
			if conflict, _ := core.CheckFileConflict(newPath); conflict {
				result.Errors = append(result.Errors, fmt.Sprintf("%s: destination already exists", f.Name()))
				continue
			}
			if err := core.CreateDirectoryStructure(newPath); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("%s: %v", f.Name(), err))
				continue
			}
			if err := os.Rename(mediaPath, newPath); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("%s: %v", f.Name(), err))
				continue
			}
			result.Renamed++
			if a.config.GenerateNFO {
				core.WriteNFO(metadata, core.GenerateNFOPath(newPath), nil) // best-effort
			}
		}
	}

	return result, nil
}

// FlattenPlaylist moves each track's file up out of its per-track subfolder
// into the playlist folder root, e.g.
// "PlaylistName/01 - Artist - Title/01 - Artist - Title.mkv" ->
// "PlaylistName/01 - Artist - Title.mkv".
func (a *App) FlattenPlaylist(folderPath string) (FlattenResult, error) {
	outputDir := a.config.OutputDirectory
	if outputDir == "" {
		outputDir = core.GetDefaultOutputDirectory()
	}
	playlistDir, err := resolvePlaylistDir(outputDir, folderPath)
	if err != nil {
		return FlattenResult{}, err
	}

	trackDirs, err := os.ReadDir(playlistDir)
	if err != nil {
		return FlattenResult{}, err
	}

	result := FlattenResult{Success: true}
	for _, trackDir := range trackDirs {
		if !trackDir.IsDir() {
			continue
		}
		trackPath := filepath.Join(playlistDir, trackDir.Name())
		files, _ := os.ReadDir(trackPath)
		for _, f := range files {
			if f.IsDir() {
				continue
			}
			src := filepath.Join(trackPath, f.Name())
			dst := filepath.Join(playlistDir, f.Name())
			if conflict, _ := core.CheckFileConflict(dst); conflict {
				result.Errors = append(result.Errors, fmt.Sprintf("%s: destination already exists", f.Name()))
				continue
			}
			if err := os.Rename(src, dst); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("%s: %v", f.Name(), err))
				continue
			}
			result.Moved++
		}
		os.Remove(trackPath) // no-op if not empty (a file was skipped above)
	}

	return result, nil
}

// ============== Convert ==============
// Mirrors internal/api/handlers_convert.go and the ConvertDirectory /
// VideoPreview / Resample cases from handlers_audio_tools.go /
// handlers_convert.go, minus Fiber.

// Convert converts a single audio file per req.
func (a *App) Convert(req core.ConvertRequest) (*core.ConvertResult, error) {
	if req.SourcePath == "" || req.TargetFormat == "" {
		return nil, fmt.Errorf("sourcePath and targetFormat required")
	}
	return core.ConvertAudio(req)
}

// GetConvertFormats returns the list of supported convert target formats.
func (a *App) GetConvertFormats() []string {
	return core.SupportedConvertFormats
}

// ConvertDirectory converts every audio file in opts.Dir, emitting a
// "convert_progress" Wails event (payload: core.DirConvertResult) after each
// file so the frontend can track progress, then returns the final result.
func (a *App) ConvertDirectory(opts core.ConvertDirOptions) (*core.DirConvertResult, error) {
	if opts.Dir == "" {
		return nil, fmt.Errorf("dir is required")
	}

	root := a.config.OutputDirectory
	if root == "" {
		root = core.GetDefaultOutputDirectory()
	}
	if _, err := sandboxPath(root, opts.Dir); err != nil {
		return nil, fmt.Errorf("dir: %w", err)
	}

	var final core.DirConvertResult
	if err := core.ConvertDirectory(a.ctx, opts, func(r core.DirConvertResult) {
		final = r
		runtime.EventsEmit(a.ctx, "convert_progress", r)
	}); err != nil {
		return nil, err
	}

	return &final, nil
}

type ResampleResult struct {
	Success    bool   `json:"success"`
	OutputPath string `json:"outputPath"`
	InputRate  int    `json:"inputRate"`
	OutputRate int    `json:"outputRate"`
	DurationMs int64  `json:"durationMs"`
}

// Resample resamples a single audio file per opts, sandboxed to the
// configured/default output directory.
func (a *App) Resample(opts core.ResampleOptions) (ResampleResult, error) {
	if opts.InputPath == "" || opts.OutputPath == "" {
		return ResampleResult{}, fmt.Errorf("inputPath and outputPath required")
	}

	root := a.config.OutputDirectory
	if root == "" {
		root = core.GetDefaultOutputDirectory()
	}
	if _, err := sandboxPath(root, opts.InputPath); err != nil {
		return ResampleResult{}, fmt.Errorf("inputPath: %w", err)
	}
	sanitized, err := sandboxPath(root, opts.OutputPath)
	if err != nil {
		return ResampleResult{}, fmt.Errorf("outputPath: %w", err)
	}
	opts.OutputPath = sanitized

	info, err := core.AnalyzeAudio(opts.InputPath)
	if err != nil {
		return ResampleResult{}, fmt.Errorf("cannot read input: %w", err)
	}
	inputRate := info.SampleRate

	start := time.Now()
	if err := core.Resample(a.ctx, opts); err != nil {
		return ResampleResult{}, err
	}

	return ResampleResult{
		Success:    true,
		OutputPath: opts.OutputPath,
		InputRate:  inputRate,
		OutputRate: opts.SampleRate,
		DurationMs: time.Since(start).Milliseconds(),
	}, nil
}

// sandboxPath ensures p is within root (after resolving symlinks).
// Returns the cleaned absolute path or an error if it escapes root.
func sandboxPath(root, p string) (string, error) {
	abs, err := filepath.Abs(p)
	if err != nil {
		return "", fmt.Errorf("invalid path: %w", err)
	}
	// Resolve symlinks to prevent traversal via symlink chains.
	resolved, err := filepath.EvalSymlinks(abs)
	if err != nil && !os.IsNotExist(err) {
		return "", fmt.Errorf("cannot resolve path: %w", err)
	}
	if os.IsNotExist(err) {
		// For output paths that don't exist yet, check the abs path directly.
		resolved = abs
	}
	rootAbs, err := filepath.Abs(root)
	if err != nil {
		return "", fmt.Errorf("invalid root: %w", err)
	}
	if !strings.HasPrefix(resolved, rootAbs+string(os.PathSeparator)) && resolved != rootAbs {
		return "", fmt.Errorf("path outside allowed directory")
	}
	// Return the resolved (canonicalized) path when it exists; abs for not-yet-created outputs.
	return resolved, nil
}

// ============== Preview asset handler ==============
// Wails has no method-return equivalent for binary HTTP streaming, so video
// preview is served as a plain HTTP route via assetserver.Options.Handler
// instead of a bound method. previewAssetHandler is wired up in main.go:
//
//	AssetServer: &assetserver.Options{
//	    Assets:  assets,
//	    Handler: app.previewAssetHandler(),
//	}
//
// Per wails' assetserver.Options docs, Handler is only invoked for GET
// requests that Assets can't serve (os.ErrNotExist) and for all non-GET
// requests — so it's safe to 404 anything that isn't our one route and let
// the embedded frontend assets handle the rest.
//
// Route: GET /preview?url=<youtube_url>&seconds=30
func (a *App) PreviewAssetHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.URL.Path != "/preview" {
			http.NotFound(w, r)
			return
		}
		a.handlePreview(w, r)
	})
}

// handlePreview streams up to `seconds` (default 30, max 60) seconds of
// audio from a YouTube URL in OGG/Vorbis format suitable for a browser
// <audio> element.
func (a *App) handlePreview(w http.ResponseWriter, r *http.Request) {
	videoURL := r.URL.Query().Get("url")
	if videoURL == "" {
		http.Error(w, "url is required", http.StatusBadRequest)
		return
	}

	if _, err := core.ParseYouTubeURL(videoURL); err != nil {
		http.Error(w, "invalid YouTube URL: "+err.Error(), http.StatusBadRequest)
		return
	}

	seconds := 30
	if raw := r.URL.Query().Get("seconds"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil {
			http.Error(w, "seconds must be an integer", http.StatusBadRequest)
			return
		}
		if n > 60 {
			http.Error(w, "seconds must not exceed 60", http.StatusUnprocessableEntity)
			return
		}
		if n <= 0 {
			http.Error(w, "seconds must be positive", http.StatusUnprocessableEntity)
			return
		}
		seconds = n
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	reader, err := core.PreviewAudio(ctx, videoURL, seconds)
	if err != nil {
		msg := err.Error()
		// Dependency missing -> 503 so operators can distinguish from bad input
		if strings.Contains(msg, "install yt-dlp") || strings.Contains(msg, "install ffmpeg") {
			http.Error(w, msg, http.StatusServiceUnavailable)
			return
		}
		http.Error(w, msg, http.StatusUnprocessableEntity)
		return
	}
	defer reader.Close()

	w.Header().Set("Content-Type", "audio/ogg")
	w.Header().Set("Cache-Control", "no-store")
	io.Copy(w, reader)
}
