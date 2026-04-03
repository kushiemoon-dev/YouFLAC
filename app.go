package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	core "github.com/kushiemoon-dev/youflac-core"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct - main Wails application
type App struct {
	ctx       context.Context
	queue     *core.Queue
	config    *core.Config
	fileIndex *core.FileIndex
	history   *core.History
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Load config first
	config, err := core.LoadConfig()
	if err == nil {
		a.config = config
	} else {
		// Use default config
		a.config = &core.Config{
			OutputDirectory:     core.GetDefaultOutputDirectory(),
			VideoQuality:        "best",
			AudioSourcePriority: []string{"tidal", "qobuz", "amazon"},
			NamingTemplate:      "{artist}/{title}/{title}",
			GenerateNFO:         true,
			ConcurrentDownloads: 2,
			EmbedCoverArt:       true,
			Theme:               "system",
		}
	}

	// Create queue with concurrency from config
	maxConcurrent := a.config.ConcurrentDownloads
	if maxConcurrent < 1 {
		maxConcurrent = 2
	}
	a.queue = core.NewQueue(ctx, maxConcurrent)

	// Set config for queue
	a.queue.SetConfig(a.config)

	// Set up progress callback to emit Wails events
	a.queue.SetProgressCallback(func(event core.QueueEvent) {
		runtime.EventsEmit(ctx, "queue:event", event)
	})

	// Load persisted queue
	a.queue.LoadQueue()

	// Start auto-save (every 30 seconds)
	a.queue.AutoSave(30 * time.Second)

	// Initialize file index for duplicate detection
	a.fileIndex = core.NewFileIndex(core.GetDataPath())
	a.fileIndex.Load()

	// Scan output directory in background
	go func() {
		outputDir := a.config.OutputDirectory
		if outputDir == "" {
			outputDir = core.GetDefaultOutputDirectory()
		}
		a.fileIndex.ScanDirectory(outputDir)
		a.fileIndex.Save()
	}()

	// Pass file index to queue for skip detection
	a.queue.SetFileIndex(a.fileIndex)

	// Initialize history
	a.history = core.NewHistory()

	// Pass history to queue for recording completed downloads
	a.queue.SetHistory(a.history)

	// Start processing queue
	a.queue.StartProcessing()
}

// shutdown is called when the app is closing
func (a *App) shutdown(ctx context.Context) {
	// Stop processing and save queue
	if a.queue != nil {
		a.queue.StopProcessing()
		a.queue.SaveQueue()
	}
}

// =============================================================================
// URL Processing
// =============================================================================

// ParseURL detects URL type and extracts metadata
func (a *App) ParseURL(url string) (*ParseURLResult, error) {
	// Detect if YouTube or Spotify URL
	result := &ParseURLResult{
		URL:  url,
		Type: detectURLType(url),
	}
	return result, nil
}

type ParseURLResult struct {
	URL  string `json:"url"`
	Type string `json:"type"` // "youtube", "spotify", "unknown"
}

func detectURLType(url string) string {
	if strings.Contains(url, "youtube.com") || strings.Contains(url, "youtu.be") {
		return "youtube"
	}
	if strings.Contains(url, "spotify.com") {
		return "spotify"
	}
	return "unknown"
}

// =============================================================================
// Video Operations
// =============================================================================

// GetVideoInfo fetches video metadata from YouTube
func (a *App) GetVideoInfo(url string) (*core.VideoInfo, error) {
	videoID, err := core.ParseYouTubeURL(url)
	if err != nil {
		return nil, err
	}
	return core.GetVideoMetadata(videoID)
}

// =============================================================================
// Audio Matching
// =============================================================================

// FindAudioMatch finds best FLAC audio match for a video
func (a *App) FindAudioMatch(videoInfo *core.VideoInfo) (*core.MatchResult, error) {
	// Audio matching is handled automatically in the queue processing pipeline
	return nil, nil
}

// =============================================================================
// Queue Management
// =============================================================================

// AddToQueue adds a download request to the queue
// If the URL is a playlist, all videos are added individually
func (a *App) AddToQueue(request core.DownloadRequest) (string, error) {
	// Check if it's a playlist URL
	if core.IsPlaylistURL(request.VideoURL) {
		// Try to extract video ID first (playlist URL might include a video)
		_, err := core.ParseYouTubeURL(request.VideoURL)
		if err != nil {
			// Pure playlist URL (no video ID), fetch all videos
			ids, err := a.AddPlaylistToQueue(request.VideoURL, request.Quality)
			if err != nil {
				return "", err
			}
			if len(ids) > 0 {
				return ids[0], nil // Return first video ID
			}
			return "", nil
		}
	}
	return a.queue.AddToQueue(request)
}

// AddPlaylistToQueue fetches playlist videos and adds each to the queue
func (a *App) AddPlaylistToQueue(playlistURL string, quality string) ([]string, error) {
	playlistInfo, err := core.GetPlaylistVideos(playlistURL)
	if err != nil {
		return nil, err
	}

	ids := []string{}
	for _, video := range playlistInfo.Videos {
		request := core.DownloadRequest{
			VideoURL: video.URL,
			Quality:  quality,
		}

		// Add with metadata already fetched
		videoInfo := &core.VideoInfo{
			ID:        video.ID,
			Title:     video.Title,
			Artist:    video.Artist,
			Duration:  video.Duration,
			Thumbnail: video.Thumbnail,
			URL:       video.URL,
		}

		// Pass playlist name and position for folder organization
		id, err := a.queue.AddToQueueWithPlaylist(request, videoInfo, playlistInfo.Title, video.Position)
		if err != nil {
			continue // Skip failed items
		}
		ids = append(ids, id)
	}

	return ids, nil
}

// AddToQueueWithMetadata adds an item with pre-fetched metadata
func (a *App) AddToQueueWithMetadata(request core.DownloadRequest, videoInfo *core.VideoInfo) (string, error) {
	return a.queue.AddToQueueWithMetadata(request, videoInfo)
}

// GetQueue returns all queue items
func (a *App) GetQueue() []core.QueueItem {
	return a.queue.GetQueue()
}

// GetQueueItem returns a specific queue item
func (a *App) GetQueueItem(id string) *core.QueueItem {
	return a.queue.GetItem(id)
}

// GetQueueStats returns queue statistics
func (a *App) GetQueueStats() core.QueueStats {
	return a.queue.GetStats()
}

// RemoveFromQueue removes an item from the queue
func (a *App) RemoveFromQueue(id string) error {
	return a.queue.RemoveFromQueue(id)
}

// CancelQueueItem cancels a processing item
func (a *App) CancelQueueItem(id string) error {
	return a.queue.CancelItem(id)
}

// ClearCompleted removes all completed items from the queue
func (a *App) ClearCompleted() int {
	return a.queue.ClearCompleted()
}

// RetryFailed resets all failed items to pending for retry
func (a *App) RetryFailed() int {
	return a.queue.RetryFailed()
}

// ClearQueue removes all items from the queue
func (a *App) ClearQueue() {
	a.queue.ClearAll()
}

// MoveQueueItem moves an item to a new position
func (a *App) MoveQueueItem(id string, newIndex int) error {
	return a.queue.MoveItem(id, newIndex)
}

// SaveQueue persists the queue to disk
func (a *App) SaveQueue() error {
	return a.queue.SaveQueue()
}

// =============================================================================
// Settings
// =============================================================================

// GetConfig returns current configuration
func (a *App) GetConfig() *core.Config {
	return a.config
}

// SaveConfig saves configuration
func (a *App) SaveConfig(config core.Config) error {
	a.config = &config
	return core.SaveConfig(&config)
}

// GetDefaultOutputDirectory returns default output path
func (a *App) GetDefaultOutputDirectory() string {
	return core.GetDefaultOutputDirectory()
}

// =============================================================================
// File Manager
// =============================================================================

// FileInfo represents a file in the file manager
type FileInfo struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	Size      int64  `json:"size"`
	Type      string `json:"type"` // "video", "cover", "nfo"
	Thumbnail string `json:"thumbnail,omitempty"`
}

// ListFiles lists files in a directory filtered by type
func (a *App) ListFiles(directory string, fileType string) ([]FileInfo, error) {
	if directory == "" {
		directory = a.config.OutputDirectory
		if directory == "" {
			directory = core.GetDefaultOutputDirectory()
		}
	}

	files := []FileInfo{}
	var extensions []string

	switch fileType {
	case "videos":
		extensions = []string{".mkv", ".mp4", ".webm", ".avi"}
	case "audio":
		extensions = []string{".flac", ".mp3", ".wav", ".m4a"}
	case "covers":
		extensions = []string{".jpg", ".jpeg", ".png", ".webp"}
	case "nfo":
		extensions = []string{".nfo"}
	default:
		extensions = []string{".mkv", ".mp4", ".webm", ".avi", ".flac", ".mp3", ".wav", ".m4a", ".jpg", ".jpeg", ".png", ".webp", ".nfo"}
	}

	// Walk directory recursively
	filepath.Walk(directory, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}

		ext := strings.ToLower(filepath.Ext(path))
		for _, e := range extensions {
			if ext == e {
				ft := "video"
				if ext == ".flac" || ext == ".mp3" || ext == ".wav" || ext == ".m4a" {
					ft = "audio"
				} else if ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".webp" {
					ft = "cover"
				} else if ext == ".nfo" {
					ft = "nfo"
				}

				files = append(files, FileInfo{
					Name: info.Name(),
					Path: path,
					Size: info.Size(),
					Type: ft,
				})
				break
			}
		}
		return nil
	})

	return files, nil
}

// BrowseDirectory opens a directory picker dialog
func (a *App) BrowseDirectory() (string, error) {
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:            "Select Directory",
		DefaultDirectory: core.GetDefaultOutputDirectory(),
	})
	return dir, err
}

// OpenFile opens a file with the default system application
func (a *App) OpenFile(path string) {
	runtime.BrowserOpenURL(a.ctx, "file://"+path)
}

// OpenDirectory opens a directory in the file manager
func (a *App) OpenDirectory(path string) {
	dir := filepath.Dir(path)
	runtime.BrowserOpenURL(a.ctx, "file://"+dir)
}

// GetImageAsDataURL reads an image file and returns it as a data URL
func (a *App) GetImageAsDataURL(imagePath string) (string, error) {
	data, err := os.ReadFile(imagePath)
	if err != nil {
		return "", err
	}

	ext := strings.ToLower(filepath.Ext(imagePath))
	mimeType := "image/jpeg"
	switch ext {
	case ".png":
		mimeType = "image/png"
	case ".webp":
		mimeType = "image/webp"
	case ".gif":
		mimeType = "image/gif"
	}

	encoded := base64.StdEncoding.EncodeToString(data)
	return "data:" + mimeType + ";base64," + encoded, nil
}

// =============================================================================
// Playlist Reorganization
// =============================================================================

// ReorganizePlaylistResult contains the result of playlist reorganization
type ReorganizePlaylistResult struct {
	Renamed int      `json:"renamed"`
	Skipped int      `json:"skipped"`
	Errors  []string `json:"errors,omitempty"`
}

// ReorganizePlaylist renames files in a playlist folder with track number prefixes
func (a *App) ReorganizePlaylist(playlistFolder string) (*ReorganizePlaylistResult, error) {
	result := &ReorganizePlaylistResult{}

	// Get playlist name from folder path
	playlistName := filepath.Base(playlistFolder)

	// Get all queue items for this playlist
	allItems := a.queue.GetQueue()
	playlistItems := make(map[string]*core.QueueItem) // key: normalized title+artist

	for i := range allItems {
		item := &allItems[i]
		if item.PlaylistName == playlistName && item.PlaylistPosition > 0 {
			// Create normalized key for matching
			key := core.NormalizeForMatching(item.Title, item.Artist)
			keyStr := key.Title + "|" + key.Artist
			playlistItems[keyStr] = item
		}
	}

	if len(playlistItems) == 0 {
		return result, nil // No playlist items with positions
	}

	// Walk through the playlist folder
	err := filepath.Walk(playlistFolder, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}

		ext := strings.ToLower(filepath.Ext(path))
		if ext != ".mkv" && ext != ".mp4" && ext != ".flac" {
			return nil
		}

		// Try to match file to a queue item
		// Extract title and artist from filename or embedded metadata
		title, artist := core.ParseFilename(path)

		key := core.NormalizeForMatching(title, artist)
		keyStr := key.Title + "|" + key.Artist

		item, found := playlistItems[keyStr]
		if !found {
			result.Skipped++
			return nil
		}

		// Check if already has track prefix
		filename := info.Name()
		if strings.HasPrefix(filename, fmt.Sprintf("%02d - ", item.PlaylistPosition)) {
			result.Skipped++
			return nil
		}

		// Generate new filename with track prefix
		newFilename := fmt.Sprintf("%02d - %s - %s%s",
			item.PlaylistPosition,
			core.SanitizeFileName(item.Artist),
			core.SanitizeFileName(item.Title),
			ext)

		// Create new folder with track prefix
		parentDir := filepath.Dir(path)
		grandParentDir := filepath.Dir(parentDir)

		// New folder structure: "01 - Artist - Title/01 - Artist - Title.mkv"
		newFolderName := strings.TrimSuffix(newFilename, ext)
		newFolder := filepath.Join(grandParentDir, newFolderName)
		newPath := filepath.Join(newFolder, newFilename)

		// Create new directory
		if err := os.MkdirAll(newFolder, 0755); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Failed to create dir for %s: %v", filename, err))
			return nil
		}

		// Move file
		if err := os.Rename(path, newPath); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Failed to rename %s: %v", filename, err))
			return nil
		}

		// Also move associated files (NFO, poster)
		nfoPath := strings.TrimSuffix(path, ext) + ".nfo"
		if _, err := os.Stat(nfoPath); err == nil {
			newNfoPath := strings.TrimSuffix(newPath, ext) + ".nfo"
			os.Rename(nfoPath, newNfoPath)
		}

		posterPath := filepath.Join(parentDir, "poster.jpg")
		if _, err := os.Stat(posterPath); err == nil {
			newPosterPath := filepath.Join(newFolder, "poster.jpg")
			os.Rename(posterPath, newPosterPath)
		}

		// Try to remove old empty directory
		os.Remove(parentDir)

		result.Renamed++
		return nil
	})

	if err != nil {
		return result, err
	}

	return result, nil
}

// GetPlaylistFolders returns list of playlist folders in output directory
func (a *App) GetPlaylistFolders() ([]string, error) {
	outputDir := a.config.OutputDirectory
	if outputDir == "" {
		outputDir = core.GetDefaultOutputDirectory()
	}

	folders := []string{}

	entries, err := os.ReadDir(outputDir)
	if err != nil {
		return nil, err
	}

	// Get all playlist names from queue
	allItems := a.queue.GetQueue()
	playlistNames := make(map[string]bool)
	for _, item := range allItems {
		if item.PlaylistName != "" {
			playlistNames[core.SanitizeFileName(item.PlaylistName)] = true
		}
	}

	for _, entry := range entries {
		if entry.IsDir() {
			// Check if this folder corresponds to a playlist
			if playlistNames[entry.Name()] {
				folders = append(folders, filepath.Join(outputDir, entry.Name()))
			}
		}
	}

	return folders, nil
}

// FlattenPlaylistResult contains the result of flattening a playlist folder
type FlattenPlaylistResult struct {
	Moved   int      `json:"moved"`
	Skipped int      `json:"skipped"`
	Errors  []string `json:"errors,omitempty"`
}

// FlattenPlaylistFolder moves all files from subfolders to the root of the playlist folder
func (a *App) FlattenPlaylistFolder(playlistFolder string) (*FlattenPlaylistResult, error) {
	result := &FlattenPlaylistResult{}

	// Collect all files to move first (to avoid modifying while iterating)
	type fileToMove struct {
		srcPath  string
		filename string
	}
	var filesToMove []fileToMove

	// Walk through the playlist folder
	err := filepath.Walk(playlistFolder, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}

		// Skip files already at root level
		if filepath.Dir(path) == playlistFolder {
			result.Skipped++
			return nil
		}

		ext := strings.ToLower(filepath.Ext(path))
		// Only move media files
		if ext == ".mkv" || ext == ".mp4" || ext == ".flac" || ext == ".mp3" || ext == ".wav" {
			filesToMove = append(filesToMove, fileToMove{
				srcPath:  path,
				filename: info.Name(),
			})
		}
		return nil
	})

	if err != nil {
		return result, err
	}

	// Move files to root
	for _, f := range filesToMove {
		destPath := filepath.Join(playlistFolder, f.filename)

		// Handle filename collision
		if _, err := os.Stat(destPath); err == nil {
			result.Errors = append(result.Errors, fmt.Sprintf("File already exists: %s", f.filename))
			continue
		}

		if err := os.Rename(f.srcPath, destPath); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Failed to move %s: %v", f.filename, err))
			continue
		}
		result.Moved++
	}

	// Clean up empty directories
	filepath.Walk(playlistFolder, func(path string, info os.FileInfo, err error) error {
		if err != nil || !info.IsDir() || path == playlistFolder {
			return nil
		}
		// Try to remove (will fail if not empty, which is fine)
		os.Remove(path)
		return nil
	})

	return result, nil
}

// =============================================================================
// History
// =============================================================================

// GetHistory returns all history entries
func (a *App) GetHistory() []core.HistoryEntry {
	return a.history.GetAll()
}

// SearchHistory searches history by title or artist
func (a *App) SearchHistory(query string) []core.HistoryEntry {
	return a.history.Search(query)
}

// FilterHistoryBySource returns history filtered by audio source
func (a *App) FilterHistoryBySource(source string) []core.HistoryEntry {
	return a.history.FilterBySource(source)
}

// FilterHistoryByStatus returns history filtered by status
func (a *App) FilterHistoryByStatus(status string) []core.HistoryEntry {
	return a.history.FilterByStatus(status)
}

// GetHistoryStats returns history statistics
func (a *App) GetHistoryStats() core.HistoryStats {
	return a.history.GetStats()
}

// DeleteHistoryEntry removes an entry from history
func (a *App) DeleteHistoryEntry(id string) error {
	return a.history.Delete(id)
}

// ClearHistory removes all history entries
func (a *App) ClearHistory() error {
	return a.history.Clear()
}

// RedownloadFromHistory adds a history item back to the queue for re-download
func (a *App) RedownloadFromHistory(id string) (string, error) {
	entry := a.history.GetByID(id)
	if entry == nil {
		return "", fmt.Errorf("history entry not found: %s", id)
	}

	request := core.DownloadRequest{
		VideoURL: entry.VideoURL,
	}

	return a.queue.AddToQueue(request)
}

// =============================================================================
// Audio Analyzer
// =============================================================================

// AnalyzeAudio performs quality analysis on an audio file
func (a *App) AnalyzeAudio(filePath string) (*core.AudioAnalysis, error) {
	return core.AnalyzeAudio(filePath)
}

// GenerateSpectrogram creates a spectrogram image for an audio file
// Returns the path to the generated PNG file
func (a *App) GenerateSpectrogram(inputPath string) (string, error) {
	// Generate spectrogram in temp directory
	tempDir := filepath.Join(os.TempDir(), "youflac", "spectrograms")
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create temp directory: %w", err)
	}

	// Use hash of input path for unique filename
	fileName := fmt.Sprintf("spec_%x.png", hash(inputPath))
	outputPath := filepath.Join(tempDir, fileName)

	if err := core.GenerateSpectrogram(inputPath, outputPath); err != nil {
		return "", err
	}

	return outputPath, nil
}

// GenerateWaveform creates a waveform image for an audio file
func (a *App) GenerateWaveform(inputPath string) (string, error) {
	tempDir := filepath.Join(os.TempDir(), "youflac", "waveforms")
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create temp directory: %w", err)
	}

	fileName := fmt.Sprintf("wave_%x.png", hash(inputPath))
	outputPath := filepath.Join(tempDir, fileName)

	if err := core.GenerateWaveform(inputPath, outputPath); err != nil {
		return "", err
	}

	return outputPath, nil
}

// =============================================================================
// Lyrics
// =============================================================================

// FetchLyrics fetches lyrics for a track from LRCLIB
func (a *App) FetchLyrics(artist, title string) (*core.LyricsResult, error) {
	return core.FetchLyrics(artist, title)
}

// FetchLyricsWithAlbum fetches lyrics with album context for better matching
func (a *App) FetchLyricsWithAlbum(artist, title, album string) (*core.LyricsResult, error) {
	return core.FetchLyricsWithAlbum(artist, title, album)
}

// EmbedLyrics embeds lyrics into a media file
func (a *App) EmbedLyrics(mediaPath string, lyrics *core.LyricsResult) error {
	return core.EmbedLyricsInFile(mediaPath, lyrics)
}

// SaveLRCFile saves synced lyrics to a .lrc file alongside the media file
func (a *App) SaveLRCFile(mediaPath string, lyrics *core.LyricsResult) (string, error) {
	return core.SaveLRCFile(lyrics, mediaPath)
}

// FetchAndEmbedLyrics fetches and embeds lyrics in one operation
func (a *App) FetchAndEmbedLyrics(mediaPath, artist, title, mode string) error {
	embedMode := core.LyricsEmbedMode(mode)
	return core.FetchAndEmbedLyrics(mediaPath, artist, title, embedMode)
}

// HasLyrics checks if a media file has embedded lyrics
func (a *App) HasLyrics(mediaPath string) (bool, error) {
	return core.HasLyrics(mediaPath)
}

// ExtractLyrics extracts embedded lyrics from a media file
func (a *App) ExtractLyrics(mediaPath string) (*core.LyricsResult, error) {
	return core.ExtractLyrics(mediaPath)
}

// =============================================================================
// System
// =============================================================================

// GetAppVersion returns application version
func (a *App) GetAppVersion() string {
	return "1.0.1"
}

// hash generates a simple hash of a string for filename purposes
func hash(s string) uint32 {
	h := uint32(0)
	for _, c := range s {
		h = h*31 + uint32(c)
	}
	return h
}

