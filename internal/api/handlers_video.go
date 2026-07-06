package api

import (
	"strings"

	"github.com/gofiber/fiber/v2"

	core "github.com/kushiemoon-dev/youflac-core/v4"
)

// ============== Video/URL Handlers ==============

type ParseURLResult struct {
	Type       string `json:"type"` // "video", "playlist", "channel", "invalid"
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

func (s *Server) handleVideoCheck(c *fiber.Ctx) error {
	url := c.Query("url")
	if url == "" {
		return c.Status(400).JSON(fiber.Map{"error": "url required"})
	}
	res, err := core.CheckAvailable(url)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error(), "available": false})
	}
	return c.JSON(res)
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
