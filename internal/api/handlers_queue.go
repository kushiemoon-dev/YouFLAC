package api

import (
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	core "github.com/kushiemoon-dev/youflac-core/v4"
)

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

func (s *Server) handleGetItemLogs(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(400).JSON(fiber.Map{"error": "id required"})
	}
	entries := core.GetItemLogs(id)
	if entries == nil {
		entries = []core.LogEntry{}
	}
	return c.JSON(entries)
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
