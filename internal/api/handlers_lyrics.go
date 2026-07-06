package api

import (
	"github.com/gofiber/fiber/v2"

	core "github.com/kushiemoon-dev/youflac-core/v4"
)

// ============== Lyrics Handlers ==============

func (s *Server) handleFetchLyrics(c *fiber.Ctx) error {
	artist := c.Query("artist")
	title := c.Query("title")
	album := c.Query("album")

	if artist == "" || title == "" {
		return c.Status(400).JSON(fiber.Map{"error": "artist and title required"})
	}

	var lyrics *core.LyricsResult
	var err error

	if album != "" {
		lyrics, err = core.FetchLyricsWithAlbum(artist, title, album)
	} else {
		lyrics, err = core.FetchLyrics(artist, title)
	}

	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(lyrics)
}

func (s *Server) handleEmbedLyrics(c *fiber.Ctx) error {
	var body struct {
		MediaPath string            `json:"mediaPath"`
		Lyrics    core.LyricsResult `json:"lyrics"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if err := core.EmbedLyricsInFile(body.MediaPath, &body.Lyrics); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"success": true})
}

func (s *Server) handleSaveLRCFile(c *fiber.Ctx) error {
	var body struct {
		MediaPath string            `json:"mediaPath"`
		Lyrics    core.LyricsResult `json:"lyrics"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	lrcPath, err := core.SaveLRCFile(&body.Lyrics, body.MediaPath)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"path": lrcPath})
}
