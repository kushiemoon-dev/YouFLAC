package api

import (
	"github.com/gofiber/fiber/v2"

	core "github.com/kushiemoon-dev/youflac-core/v4"
)

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
