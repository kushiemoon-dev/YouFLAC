package api

import (
	"time"

	"github.com/gofiber/fiber/v2"
	core "github.com/kushiemoon-dev/youflac-core"
)

func (s *Server) handleResample(c *fiber.Ctx) error {
	var opts core.ResampleOptions
	if err := c.BodyParser(&opts); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if opts.InputPath == "" || opts.OutputPath == "" {
		return c.Status(400).JSON(fiber.Map{"error": "inputPath and outputPath required"})
	}

	var inputRate int
	if info, err := core.AnalyzeAudio(opts.InputPath); err == nil {
		inputRate = info.SampleRate
	}

	start := time.Now()
	if err := core.Resample(opts); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{
		"success":    true,
		"outputPath": opts.OutputPath,
		"inputRate":  inputRate,
		"outputRate": opts.SampleRate,
		"durationMs": time.Since(start).Milliseconds(),
	})
}
