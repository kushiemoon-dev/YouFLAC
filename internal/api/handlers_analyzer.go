package api

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"

	core "github.com/kushiemoon-dev/youflac-core/v4"
)

// ============== Analyzer Handlers ==============

func (s *Server) handleAnalyzeAudio(c *fiber.Ctx) error {
	var body struct {
		FilePath string `json:"filePath"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	analysis, err := core.AnalyzeAudio(body.FilePath)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(analysis)
}

func (s *Server) handleGenerateSpectrogram(c *fiber.Ctx) error {
	var body struct {
		FilePath string `json:"filePath"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Generate spectrogram to temp file
	tempDir := os.TempDir()
	outputPath := filepath.Join(tempDir, "spectrogram_"+filepath.Base(body.FilePath)+".png")

	if err := core.GenerateSpectrogram(body.FilePath, outputPath); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Return path that can be fetched via /api/image
	return c.JSON(fiber.Map{"path": outputPath})
}

func (s *Server) handleGenerateWaveform(c *fiber.Ctx) error {
	var body struct {
		FilePath string `json:"filePath"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	tempDir := os.TempDir()
	outputPath := filepath.Join(tempDir, "waveform_"+filepath.Base(body.FilePath)+".png")

	if err := core.GenerateWaveform(body.FilePath, outputPath); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"path": outputPath})
}

// ============== Image Handler ==============

func (s *Server) handleGetImage(c *fiber.Ctx) error {
	path := c.Query("path")
	if path == "" {
		return c.Status(400).JSON(fiber.Map{"error": "path required"})
	}

	// Security: resolve the real path and check it's within allowed directories.
	// filepath.Abs normalizes ".." traversal sequences before we compare.
	absPath, err := filepath.Abs(path)
	if err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "Access denied"})
	}

	absTemp, _ := filepath.Abs(os.TempDir())
	absOutput := s.config.OutputDirectory
	if absOutput == "" {
		absOutput = core.GetDefaultOutputDirectory()
	}
	absOutput, _ = filepath.Abs(absOutput)

	// Ensure the separator-terminated prefix so "/tmp" doesn't match "/tmpother"
	if !strings.HasPrefix(absPath, absTemp+string(filepath.Separator)) &&
		!strings.HasPrefix(absPath, absOutput+string(filepath.Separator)) {
		return c.Status(403).JSON(fiber.Map{"error": "Access denied"})
	}

	data, err := os.ReadFile(absPath)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "File not found"})
	}

	// Return as data URL
	ext := strings.ToLower(filepath.Ext(absPath))
	mimeType := "image/png"
	if ext == ".jpg" || ext == ".jpeg" {
		mimeType = "image/jpeg"
	}

	dataURL := "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(data)
	return c.JSON(fiber.Map{"dataUrl": dataURL})
}
