package api

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	core "github.com/kushiemoon-dev/youflac-core"
)

// sandboxPath ensures p is within root (after resolving symlinks).
// Returns the cleaned absolute path or an error if it escapes root.
func sandboxPath(root, p string) (string, error) {
	abs, err := filepath.Abs(p)
	if err != nil {
		return "", fmt.Errorf("invalid path: %w", err)
	}
	// Resolve symlinks to prevent traversal via symlink chains.
	resolved, err := filepath.EvalSymlinks(abs)
	if err != nil && !os.IsNotExist(err) {
		return "", fmt.Errorf("cannot resolve path: %w", err)
	}
	if os.IsNotExist(err) {
		// For output paths that don't exist yet, check the abs path directly.
		resolved = abs
	}
	rootAbs, err := filepath.Abs(root)
	if err != nil {
		return "", fmt.Errorf("invalid root: %w", err)
	}
	if !strings.HasPrefix(resolved, rootAbs+string(os.PathSeparator)) && resolved != rootAbs {
		return "", fmt.Errorf("path outside allowed directory")
	}
	return abs, nil
}

func (s *Server) handleResample(c *fiber.Ctx) error {
	var opts core.ResampleOptions
	if err := c.BodyParser(&opts); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if opts.InputPath == "" || opts.OutputPath == "" {
		return c.Status(400).JSON(fiber.Map{"error": "inputPath and outputPath required"})
	}

	root := s.config.OutputDirectory
	if root == "" {
		root = core.GetDefaultOutputDirectory()
	}
	if _, err := sandboxPath(root, opts.InputPath); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "inputPath: " + err.Error()})
	}
	sanitized, err := sandboxPath(root, opts.OutputPath)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "outputPath: " + err.Error()})
	}
	opts.OutputPath = sanitized

	info, err := core.AnalyzeAudio(opts.InputPath)
	if err != nil {
		return c.Status(422).JSON(fiber.Map{"error": "cannot read input: " + err.Error()})
	}
	inputRate := info.SampleRate

	start := time.Now()
	if err := core.Resample(c.Context(), opts); err != nil {
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
