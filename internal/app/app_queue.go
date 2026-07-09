package app

import (
	"fmt"
	"path/filepath"
	"strings"

	core "github.com/kushiemoon-dev/youflac-core/v4"
	"github.com/kushiemoon-dev/youflac-core/v4/songlink"
	"github.com/kushiemoon-dev/youflac-core/v4/validate"
)

// ============== Queue Methods ==============
// Ported from internal/api/handlers_queue.go and internal/api/handlers_playlist.go.
// Wails bound methods support at most one non-error return value plus an
// error (see wailsapp/wails/v2 internal/binding.BoundMethod.Call), so
// handlers that returned a multi-field JSON object are given a small local
// result struct below instead of the fiber.Map used server-side.

// AddPlaylistResult is the result of AddPlaylistToQueue.
type AddPlaylistResult struct {
	IDs           []string `json:"ids"`
	PlaylistTitle string   `json:"playlistTitle"`
}

// BulkLyricsResult is the result of PlaylistLyricsBulk.
type BulkLyricsResult struct {
	Success int               `json:"success"`
	Failed  int               `json:"failed"`
	Files   map[string]string `json:"files"`
}

func (a *App) GetQueue() []core.QueueItem {
	return a.queue.GetQueue()
}

func (a *App) AddToQueue(req core.DownloadRequest) (string, error) {
	// If VideoURL is a music service URL, route it to SpotifyURL
	if req.SpotifyURL == "" && req.VideoURL != "" {
		if core.IsQobuzURL(req.VideoURL) || core.IsTidalURL(req.VideoURL) || songlink.IsSpotifyURL(req.VideoURL) {
			req.SpotifyURL = req.VideoURL
			req.VideoURL = ""
		}
	}

	// Only validate as YouTube URL if VideoURL is still set
	if req.VideoURL != "" {
		if err := validate.ValidateYouTubeURL(req.VideoURL); err != nil {
			return "", fmt.Errorf("invalid video URL: %w", err)
		}
	}

	return a.queue.AddToQueue(req)
}

func (a *App) GetQueueStats() core.QueueStats {
	return a.queue.GetStats()
}

// ExportFailed returns the failed-downloads report as plain text. Saving it
// to disk (runtime.SaveFileDialog) is handled by the frontend.
func (a *App) ExportFailed() (string, error) {
	failed := a.queue.GetFailedItems()
	if len(failed) == 0 {
		return "", fmt.Errorf("no failed items")
	}

	var sb strings.Builder
	for _, item := range failed {
		if item.VideoURL != "" {
			sb.WriteString(item.VideoURL)
			sb.WriteByte('\n')
		}
	}

	return sb.String(), nil
}

func (a *App) ClearCompleted() int {
	return a.queue.ClearCompleted()
}

func (a *App) RetryFailed() int {
	return a.queue.RetryFailed()
}

func (a *App) PauseAll() int {
	return a.queue.PauseAll()
}

func (a *App) ResumeAll() int {
	return a.queue.ResumeAll()
}

func (a *App) GetQueueItem(id string) (*core.QueueItem, error) {
	item := a.queue.GetItem(id)
	if item == nil {
		return nil, fmt.Errorf("item not found")
	}
	return item, nil
}

func (a *App) GetItemLogs(id string) ([]core.LogEntry, error) {
	if id == "" {
		return nil, fmt.Errorf("id required")
	}
	entries := core.GetItemLogs(id)
	if entries == nil {
		entries = []core.LogEntry{}
	}
	return entries, nil
}

func (a *App) RemoveFromQueue(id string) error {
	return a.queue.RemoveFromQueue(id)
}

func (a *App) CancelQueueItem(id string) error {
	return a.queue.CancelItem(id)
}

func (a *App) PauseQueueItem(id string) error {
	return a.queue.PauseItem(id)
}

func (a *App) ResumeQueueItem(id string) error {
	return a.queue.ResumeItem(id)
}

func (a *App) RetryQueueItemWithOverride(id string, req core.RetryOverrideRequest) (*core.QueueItem, error) {
	return a.queue.RetryWithOverride(id, req)
}

func (a *App) MoveQueueItem(id string, newPosition int) error {
	return a.queue.MoveItem(id, newPosition)
}

// ============== Playlist Methods ==============

func (a *App) AddPlaylistToQueue(url string, quality string, maxVideos int) (*AddPlaylistResult, error) {
	if quality == "" {
		quality = a.config.VideoQuality
	}

	// Detect channel URL vs playlist URL
	var playlist *core.PlaylistInfo
	var err error

	if core.IsChannelURL(url) {
		mv := maxVideos
		if mv <= 0 {
			mv = 50
		}
		playlist, err = core.GetChannelVideos(url, mv)
	} else {
		if err := validate.ValidateYouTubeURL(url); err != nil {
			return nil, fmt.Errorf("invalid playlist URL: %w", err)
		}
		playlist, err = core.GetPlaylistVideos(url)
	}

	if err != nil {
		return nil, err
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
		id, err := a.queue.AddToQueueWithPlaylist(req, videoInfo, playlist.Title, video.Position)
		if err != nil {
			continue
		}
		ids = append(ids, id)
	}

	return &AddPlaylistResult{IDs: ids, PlaylistTitle: playlist.Title}, nil
}

func (a *App) PlaylistLyricsBulk(dir string) (*BulkLyricsResult, error) {
	if dir == "" {
		return nil, fmt.Errorf("dir required")
	}
	absDir, err := filepath.Abs(dir)
	if err != nil {
		return nil, fmt.Errorf("invalid dir")
	}
	outputDir := a.config.OutputDirectory
	absOutput, err := filepath.Abs(outputDir)
	if err != nil {
		return nil, fmt.Errorf("server config error")
	}
	if !strings.HasPrefix(absDir, absOutput+string(filepath.Separator)) {
		return nil, fmt.Errorf("dir outside output directory")
	}
	results, err := core.BulkFetchLyrics(absDir)
	if err != nil {
		return nil, err
	}
	summary := map[string]string{}
	success, failed := 0, 0
	for path, ferr := range results {
		if ferr == nil {
			success++
			summary[path] = "ok"
		} else {
			failed++
			summary[path] = ferr.Error()
		}
	}
	return &BulkLyricsResult{Success: success, Failed: failed, Files: summary}, nil
}
