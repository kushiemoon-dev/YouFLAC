package api

import (
	"github.com/gofiber/fiber/v2"

	core "github.com/kushiemoon-dev/youflac-core/v4"
	"github.com/kushiemoon-dev/youflac-core/v4/validate"
)

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

	if err := validate.ValidateOutputDirectory(config.OutputDirectory); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid output directory: " + err.Error()})
	}

	if len(config.AudioSourcePriority) > 0 {
		if err := validate.ValidateAudioSources(config.AudioSourcePriority); err != nil {
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
