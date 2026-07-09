package api

import (
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"

	core "github.com/kushiemoon-dev/youflac-core/v4"
	"github.com/kushiemoon-dev/youflac-core/v4/validate"
)

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
		if err := validate.ValidateYouTubeURL(body.URL); err != nil {
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

func (s *Server) handlePlaylistLyricsBulk(c *fiber.Ctx) error {
	var body struct {
		Dir string `json:"dir"`
	}
	if err := c.BodyParser(&body); err != nil || body.Dir == "" {
		return c.Status(400).JSON(fiber.Map{"error": "dir required"})
	}
	absDir, err := filepath.Abs(body.Dir)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid dir"})
	}
	outputDir := s.config.OutputDirectory
	absOutput, err := filepath.Abs(outputDir)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "server config error"})
	}
	if !strings.HasPrefix(absDir, absOutput+string(filepath.Separator)) {
		return c.Status(403).JSON(fiber.Map{"error": "dir outside output directory"})
	}
	results, err := core.BulkFetchLyrics(absDir)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
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
	return c.JSON(fiber.Map{
		"success": success,
		"failed":  failed,
		"files":   summary,
	})
}
