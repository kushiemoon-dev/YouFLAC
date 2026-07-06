package api

import (
	"github.com/gofiber/fiber/v2"

	core "github.com/kushiemoon-dev/youflac-core/v4"
)

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
