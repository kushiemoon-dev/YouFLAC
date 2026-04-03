package api

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	core "github.com/kushiemoon-dev/youflac-core"
)

const AppVersion = "3.0.1"

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

// ============== Queue Handlers ==============

func (s *Server) handleGetQueue(c *fiber.Ctx) error {
	items := s.queue.GetQueue()
	return c.JSON(items)
}

func (s *Server) handleAddToQueue(c *fiber.Ctx) error {
	var req core.DownloadRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// If VideoURL is a music service URL, route it to SpotifyURL
	if req.SpotifyURL == "" && req.VideoURL != "" {
		if core.IsQobuzURL(req.VideoURL) || core.IsTidalURL(req.VideoURL) || core.IsSpotifyURL(req.VideoURL) {
			req.SpotifyURL = req.VideoURL
			req.VideoURL = ""
		}
	}

	// Only validate as YouTube URL if VideoURL is still set
	if req.VideoURL != "" {
		if err := core.ValidateYouTubeURL(req.VideoURL); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid video URL: " + err.Error()})
		}
	}

	id, err := s.queue.AddToQueue(req)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"id": id})
}

func (s *Server) handleGetQueueItem(c *fiber.Ctx) error {
	id := c.Params("id")
	item := s.queue.GetItem(id)
	if item == nil {
		return c.Status(404).JSON(fiber.Map{"error": "Item not found"})
	}
	return c.JSON(item)
}

func (s *Server) handleRemoveFromQueue(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := s.queue.RemoveFromQueue(id); err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"success": true})
}

func (s *Server) handleCancelQueueItem(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := s.queue.CancelItem(id); err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"success": true})
}

func (s *Server) handlePauseQueueItem(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := s.queue.PauseItem(id); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"success": true})
}

func (s *Server) handleResumeQueueItem(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := s.queue.ResumeItem(id); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"success": true})
}

func (s *Server) handleMoveQueueItem(c *fiber.Ctx) error {
	id := c.Params("id")
	var body struct {
		NewPosition int `json:"newPosition"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if err := s.queue.MoveItem(id, body.NewPosition); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"success": true})
}

func (s *Server) handleGetQueueStats(c *fiber.Ctx) error {
	stats := s.queue.GetStats()
	return c.JSON(stats)
}

func (s *Server) handleClearCompleted(c *fiber.Ctx) error {
	count := s.queue.ClearCompleted()
	return c.JSON(fiber.Map{"cleared": count})
}

func (s *Server) handleRetryFailed(c *fiber.Ctx) error {
	count := s.queue.RetryFailed()
	return c.JSON(fiber.Map{"retried": count})
}

func (s *Server) handlePauseAll(c *fiber.Ctx) error {
	count := s.queue.PauseAll()
	return c.JSON(fiber.Map{"paused": count})
}

func (s *Server) handleResumeAll(c *fiber.Ctx) error {
	count := s.queue.ResumeAll()
	return c.JSON(fiber.Map{"resumed": count})
}

func (s *Server) handleRetryQueueItemWithOverride(c *fiber.Ctx) error {
	id := c.Params("id")

	var req core.RetryOverrideRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	item, err := s.queue.RetryWithOverride(id, req)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(item)
}

func (s *Server) handleExportFailed(c *fiber.Ctx) error {
	failed := s.queue.GetFailedItems()
	if len(failed) == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "no failed items"})
	}

	var sb strings.Builder
	for _, item := range failed {
		if item.VideoURL != "" {
			sb.WriteString(item.VideoURL)
			sb.WriteByte('\n')
		}
	}

	c.Set("Content-Type", "text/plain; charset=utf-8")
	c.Set("Content-Disposition", fmt.Sprintf(`attachment; filename="failed_downloads_%s.txt"`, time.Now().Format("2006-01-02")))
	return c.SendString(sb.String())
}

// ============== Playlist Handlers ==============

func (s *Server) handleAddPlaylistToQueue(c *fiber.Ctx) error {
	var body struct {
		URL       string `json:"url"`
		Quality   string `json:"quality"`
		MaxVideos int    `json:"maxVideos"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	quality := body.Quality
	if quality == "" {
		quality = s.config.VideoQuality
	}

	// Detect channel URL vs playlist URL
	var playlist *core.PlaylistInfo
	var err error

	if core.IsChannelURL(body.URL) {
		maxVideos := body.MaxVideos
		if maxVideos <= 0 {
			maxVideos = 50
		}
		playlist, err = core.GetChannelVideos(body.URL, maxVideos)
	} else {
		if err := core.ValidateYouTubeURL(body.URL); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid playlist URL: " + err.Error()})
		}
		playlist, err = core.GetPlaylistVideos(body.URL)
	}

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Add each video to queue
	ids := []string{}
	for _, video := range playlist.Videos {
		req := core.DownloadRequest{
			VideoURL: video.URL,
			Quality:  quality,
		}
		// Convert PlaylistVideo to VideoInfo
		videoInfo := &core.VideoInfo{
			ID:        video.ID,
			Title:     video.Title,
			Artist:    video.Artist,
			Duration:  video.Duration,
			Thumbnail: video.Thumbnail,
			URL:       video.URL,
		}
		id, err := s.queue.AddToQueueWithPlaylist(req, videoInfo, playlist.Title, video.Position)
		if err != nil {
			continue
		}
		ids = append(ids, id)
	}

	return c.JSON(fiber.Map{"ids": ids, "playlistTitle": playlist.Title})
}

// ============== Config Handlers ==============

func (s *Server) handleGetConfig(c *fiber.Ctx) error {
	config, err := core.LoadConfig()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(config)
}

func (s *Server) handleSaveConfig(c *fiber.Ctx) error {
	var config core.Config
	if err := c.BodyParser(&config); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if err := core.ValidateOutputDirectory(config.OutputDirectory); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid output directory: " + err.Error()})
	}

	if len(config.AudioSourcePriority) > 0 {
		if err := core.ValidateAudioSources(config.AudioSourcePriority); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid audio source priority: " + err.Error()})
		}
	}

	if err := core.SaveConfig(&config); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Update server config
	s.config = &config

	return c.JSON(fiber.Map{"success": true})
}

func (s *Server) handleGetDefaultOutput(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"path": core.GetDefaultOutputDirectory()})
}

// ============== History Handlers ==============

func (s *Server) handleGetHistory(c *fiber.Ctx) error {
	entries := s.history.GetAll()
	return c.JSON(entries)
}

func (s *Server) handleGetHistoryStats(c *fiber.Ctx) error {
	stats := s.history.GetStats()
	return c.JSON(stats)
}

func (s *Server) handleSearchHistory(c *fiber.Ctx) error {
	query := c.Query("q")
	if query == "" {
		return c.JSON(s.history.GetAll())
	}
	results := s.history.Search(query)
	return c.JSON(results)
}

func (s *Server) handleDeleteHistoryEntry(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := s.history.Delete(id); err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"success": true})
}

func (s *Server) handleClearHistory(c *fiber.Ctx) error {
	if err := s.history.Clear(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"success": true})
}

func (s *Server) handleRedownloadFromHistory(c *fiber.Ctx) error {
	id := c.Params("id")

	// Find entry in history
	entries := s.history.GetAll()
	var entry *core.HistoryEntry
	for _, e := range entries {
		if e.ID == id {
			entry = &e
			break
		}
	}

	if entry == nil {
		return c.Status(404).JSON(fiber.Map{"error": "History entry not found"})
	}

	// Add to queue
	req := core.DownloadRequest{
		VideoURL: entry.VideoURL,
		Quality:  entry.Quality,
	}

	newID, err := s.queue.AddToQueue(req)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"id": newID})
}

// ============== Video/URL Handlers ==============

type ParseURLResult struct {
	Type       string `json:"type"`       // "video", "playlist", "channel", "invalid"
	VideoID    string `json:"videoId"`
	PlaylistID string `json:"playlistId"`
	URL        string `json:"url"`
}

func (s *Server) handleParseURL(c *fiber.Ctx) error {
	var body struct {
		URL string `json:"url"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	url := strings.TrimSpace(body.URL)
	result := ParseURLResult{URL: url}

	// Check if channel URL
	if core.IsChannelURL(url) {
		result.Type = "channel"
	} else if strings.Contains(url, "list=") {
		// Check if playlist
		result.Type = "playlist"
		if idx := strings.Index(url, "list="); idx != -1 {
			pID := url[idx+5:]
			if ampIdx := strings.Index(pID, "&"); ampIdx != -1 {
				pID = pID[:ampIdx]
			}
			result.PlaylistID = pID
		}
	} else {
		// Try to parse as video
		videoID, err := core.ParseYouTubeURL(url)
		if err != nil {
			result.Type = "invalid"
		} else {
			result.Type = "video"
			result.VideoID = videoID
		}
	}

	return c.JSON(result)
}

func (s *Server) handleGetVideoInfo(c *fiber.Ctx) error {
	url := c.Query("url")
	if url == "" {
		return c.Status(400).JSON(fiber.Map{"error": "URL required"})
	}

	videoID, err := core.ParseYouTubeURL(url)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	info, err := core.GetVideoMetadata(videoID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(info)
}

func (s *Server) handleFindAudioMatch(c *fiber.Ctx) error {
	var videoInfo core.VideoInfo
	if err := c.BodyParser(&videoInfo); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Use empty candidates and default options - the matcher will try to find matches
	result, err := core.MatchVideoToAudio(&videoInfo, nil, nil)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(result)
}

// ============== Files Handlers ==============

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

func (s *Server) handleListFiles(c *fiber.Ctx) error {
	dir := c.Query("dir")
	if dir == "" {
		dir = s.config.OutputDirectory
		if dir == "" {
			dir = core.GetDefaultOutputDirectory()
		}
	}

	filter := c.Query("filter") // e.g., ".mkv,.flac"

	entries, err := os.ReadDir(dir)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	files := []FileInfo{}
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}

		ext := strings.ToLower(filepath.Ext(entry.Name()))

		// Apply filter if specified
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

	return c.JSON(files)
}

func (s *Server) handleGetPlaylistFolders(c *fiber.Ctx) error {
	outputDir := s.config.OutputDirectory
	if outputDir == "" {
		outputDir = core.GetDefaultOutputDirectory()
	}

	folders := []string{}

	entries, err := os.ReadDir(outputDir)
	if err != nil {
		return c.JSON(folders) // Return empty if can't read
	}

	for _, entry := range entries {
		if entry.IsDir() {
			// Check if it looks like a playlist folder (has numbered files)
			subPath := filepath.Join(outputDir, entry.Name())
			subEntries, _ := os.ReadDir(subPath)
			for _, sub := range subEntries {
				if !sub.IsDir() && strings.HasPrefix(sub.Name(), "01") {
					folders = append(folders, entry.Name())
					break
				}
			}
		}
	}

	return c.JSON(folders)
}

type ReorganizeResult struct {
	Success   bool     `json:"success"`
	Moved     int      `json:"moved"`
	Errors    []string `json:"errors,omitempty"`
	NewFolder string   `json:"newFolder,omitempty"`
}

func (s *Server) handleReorganizePlaylist(c *fiber.Ctx) error {
	var body struct {
		FolderPath string `json:"folderPath"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// For now, return a simple response
	// Full implementation would reorganize files into artist/title structure
	return c.JSON(ReorganizeResult{
		Success: true,
		Moved:   0,
	})
}

func (s *Server) handleFlattenPlaylist(c *fiber.Ctx) error {
	var body struct {
		FolderPath string `json:"folderPath"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// For now, return a simple response
	return c.JSON(ReorganizeResult{
		Success: true,
		Moved:   0,
	})
}

// ============== Analyzer Handlers ==============

func (s *Server) handleAnalyzeAudio(c *fiber.Ctx) error {
	var body struct {
		FilePath string `json:"filePath"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	analysis, err := core.AnalyzeAudio(body.FilePath)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(analysis)
}

func (s *Server) handleGenerateSpectrogram(c *fiber.Ctx) error {
	var body struct {
		FilePath string `json:"filePath"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Generate spectrogram to temp file
	tempDir := os.TempDir()
	outputPath := filepath.Join(tempDir, "spectrogram_"+filepath.Base(body.FilePath)+".png")

	if err := core.GenerateSpectrogram(body.FilePath, outputPath); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Return path that can be fetched via /api/image
	return c.JSON(fiber.Map{"path": outputPath})
}

func (s *Server) handleGenerateWaveform(c *fiber.Ctx) error {
	var body struct {
		FilePath string `json:"filePath"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	tempDir := os.TempDir()
	outputPath := filepath.Join(tempDir, "waveform_"+filepath.Base(body.FilePath)+".png")

	if err := core.GenerateWaveform(body.FilePath, outputPath); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"path": outputPath})
}

// ============== Lyrics Handlers ==============

func (s *Server) handleFetchLyrics(c *fiber.Ctx) error {
	artist := c.Query("artist")
	title := c.Query("title")
	album := c.Query("album")

	if artist == "" || title == "" {
		return c.Status(400).JSON(fiber.Map{"error": "artist and title required"})
	}

	var lyrics *core.LyricsResult
	var err error

	if album != "" {
		lyrics, err = core.FetchLyricsWithAlbum(artist, title, album)
	} else {
		lyrics, err = core.FetchLyrics(artist, title)
	}

	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(lyrics)
}

func (s *Server) handleEmbedLyrics(c *fiber.Ctx) error {
	var body struct {
		MediaPath string               `json:"mediaPath"`
		Lyrics    core.LyricsResult `json:"lyrics"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if err := core.EmbedLyricsInFile(body.MediaPath, &body.Lyrics); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"success": true})
}

func (s *Server) handleSaveLRCFile(c *fiber.Ctx) error {
	var body struct {
		MediaPath string               `json:"mediaPath"`
		Lyrics    core.LyricsResult `json:"lyrics"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	lrcPath, err := core.SaveLRCFile(&body.Lyrics, body.MediaPath)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"path": lrcPath})
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

// ============== Image Handler ==============

func (s *Server) handleGetImage(c *fiber.Ctx) error {
	path := c.Query("path")
	if path == "" {
		return c.Status(400).JSON(fiber.Map{"error": "path required"})
	}

	// Security: resolve the real path and check it's within allowed directories.
	// filepath.Abs normalizes ".." traversal sequences before we compare.
	absPath, err := filepath.Abs(path)
	if err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "Access denied"})
	}

	absTemp, _ := filepath.Abs(os.TempDir())
	absOutput := s.config.OutputDirectory
	if absOutput == "" {
		absOutput = core.GetDefaultOutputDirectory()
	}
	absOutput, _ = filepath.Abs(absOutput)

	// Ensure the separator-terminated prefix so "/tmp" doesn't match "/tmpother"
	if !strings.HasPrefix(absPath, absTemp+string(filepath.Separator)) &&
		!strings.HasPrefix(absPath, absOutput+string(filepath.Separator)) {
		return c.Status(403).JSON(fiber.Map{"error": "Access denied"})
	}

	data, err := os.ReadFile(absPath)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "File not found"})
	}

	// Return as data URL
	ext := strings.ToLower(filepath.Ext(absPath))
	mimeType := "image/png"
	if ext == ".jpg" || ext == ".jpeg" {
		mimeType = "image/jpeg"
	}

	dataURL := "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(data)
	return c.JSON(fiber.Map{"dataUrl": dataURL})
}

func (s *Server) handleConvert(c *fiber.Ctx) error {
	var req core.ConvertRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	if req.SourcePath == "" || req.TargetFormat == "" {
		return c.Status(400).JSON(fiber.Map{"error": "sourcePath and targetFormat required"})
	}

	result, err := core.ConvertAudio(req)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(result)
}

func (s *Server) handleGetConvertFormats(c *fiber.Ctx) error {
	return c.JSON(core.SupportedConvertFormats)
}

func (s *Server) handleSearch(c *fiber.Ctx) error {
	query := c.Query("q")
	if query == "" {
		return c.Status(400).JSON(fiber.Map{"error": "query parameter 'q' required"})
	}

	limit := c.QueryInt("limit", 0)
	if limit <= 0 {
		limit = s.config.SearchResultsLimit
	}
	if limit <= 0 {
		limit = 10
	}
	if limit > 30 {
		limit = 30
	}

	results, err := core.SearchYouTube(query, limit)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(results)
}
