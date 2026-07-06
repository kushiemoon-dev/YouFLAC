package api

import (
	"github.com/gofiber/fiber/v2"

	core "github.com/kushiemoon-dev/youflac-core/v4"
)

func (s *Server) handleChannelAssets(c *fiber.Ctx) error {
	var body struct {
		URL string `json:"url"`
	}
	if err := c.BodyParser(&body); err != nil || body.URL == "" {
		return c.Status(400).JSON(fiber.Map{"error": "url required"})
	}
	assets, err := core.GetChannelAssets(body.URL)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	dir, err := core.DownloadChannelAssets(assets, s.config.OutputDirectory)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{
		"assets": assets,
		"dir":    dir,
	})
}

func (s *Server) handleChannelFetch(c *fiber.Ctx) error {
	var body struct {
		URL           string `json:"url"`
		IncludeShorts bool   `json:"includeShorts"`
		OnlyLongForm  bool   `json:"onlyLongForm"`
		PlaylistID    string `json:"playlistID"`
		MaxItems      int    `json:"maxItems"`
	}
	if err := c.BodyParser(&body); err != nil || body.URL == "" {
		return c.Status(400).JSON(fiber.Map{"error": "url required"})
	}
	if !core.IsChannelURL(body.URL) {
		return c.Status(400).JSON(fiber.Map{"error": "invalid channel URL"})
	}
	opts := core.ChannelOpts{
		IncludeShorts: body.IncludeShorts,
		OnlyLongForm:  body.OnlyLongForm,
		PlaylistID:    body.PlaylistID,
		MaxItems:      body.MaxItems,
	}
	var jobID string
	jobID = s.registry.StartJob(body.URL, opts, func(jid string, v core.VideoInfoLite, n int) {
		s.wsHub.Broadcast(map[string]interface{}{
			"type":  "channel_fetch_progress",
			"jobID": jid,
			"count": n,
			"total": -1,
			"item":  v,
		})
	}, func(total, errs int) {
		s.wsHub.Broadcast(map[string]interface{}{
			"type":         "channel_fetch_done",
			"jobID":        jobID,
			"totalFetched": total,
			"errorCount":   errs,
		})
	})
	return c.Status(202).JSON(fiber.Map{"jobID": jobID})
}

func (s *Server) handleChannelFetchCancel(c *fiber.Ctx) error {
	id := c.Params("id")
	if !s.registry.CancelJob(id) {
		return c.Status(404).JSON(fiber.Map{"error": "job not found"})
	}
	return c.JSON(fiber.Map{"cancelled": true})
}

func (s *Server) handleChannelFetchStatus(c *fiber.Ctx) error {
	id := c.Params("id")
	job, ok := s.registry.GetJobStatus(id)
	if !ok {
		return c.Status(404).JSON(fiber.Map{"error": "job not found"})
	}
	return c.JSON(job)
}
