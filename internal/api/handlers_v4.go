package api

import (
	"os/exec"
	"strings"

	"github.com/gofiber/fiber/v2"

	core "github.com/kushiemoon-dev/youflac-core"
)

// ── Sources ────────────────────────────────────────────────────────────────

func (s *Server) handleGetSources(c *fiber.Ctx) error {
	if s.sourceMgr == nil {
		return c.JSON([]core.SourceInfo{})
	}
	return c.JSON(s.sourceMgr.GetSourcesInfo())
}

func (s *Server) handleSetSourcePriority(c *fiber.Ctx) error {
	var body struct {
		Priority []string `json:"priority"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	if len(body.Priority) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "priority list is empty"})
	}

	s.config.SourceOrder = body.Priority
	s.config.AudioSourcePriority = body.Priority
	if s.orchestrator != nil {
		s.orchestrator.SetPriority(body.Priority)
	}
	if err := core.SaveConfig(s.config); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true})
}

// ── Qobuz providers ────────────────────────────────────────────────────────

func (s *Server) handleGetQobuzProviders(c *fiber.Ctx) error {
	all := []string{"dab", "wjhe", "gdstudio", "musicdl"}
	type providerStatus struct {
		Name     string `json:"name"`
		Disabled bool   `json:"disabled"`
	}
	disabled := make(map[string]bool, len(s.config.QobuzProvidersDisabled))
	for _, d := range s.config.QobuzProvidersDisabled {
		disabled[d] = true
	}
	result := make([]providerStatus, len(all))
	for i, name := range all {
		result[i] = providerStatus{Name: name, Disabled: disabled[name]}
	}
	return c.JSON(result)
}

func (s *Server) handleSetQobuzProviders(c *fiber.Ctx) error {
	var body struct {
		Disabled []string `json:"disabled"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	s.config.QobuzProvidersDisabled = body.Disabled
	if err := core.SaveConfig(s.config); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true})
}

// ── Soulseek ───────────────────────────────────────────────────────────────

func (s *Server) handleGetSoulseekStatus(c *fiber.Ctx) error {
	return c.JSON(s.soulseekStatusMap())
}

func (s *Server) handleSoulseekLoginTest(c *fiber.Ctx) error {
	st := s.soulseekStatusMap()
	ok := st["binaryFound"] == true && st["credentialsSet"] == true
	return c.JSON(fiber.Map{"ok": ok, "details": st})
}

func (s *Server) soulseekStatusMap() fiber.Map {
	binaryPath := s.config.SoulseekBinaryPath
	if binaryPath == "" {
		binaryPath = "sldl"
	}
	st := fiber.Map{
		"available":      false,
		"binaryFound":    false,
		"credentialsSet": s.config.SoulseekUsername != "" && s.config.SoulseekPassword != "",
		"binaryPath":     binaryPath,
		"version":        "",
	}
	if ver := sldlVersion(binaryPath); ver != "" {
		st["binaryFound"] = true
		st["version"] = ver
		if s.config.SoulseekUsername != "" && s.config.SoulseekPassword != "" {
			st["available"] = true
		}
	}
	return st
}

func sldlVersion(binaryPath string) string {
	out, err := exec.Command(binaryPath, "--version").Output()
	if err != nil {
		return ""
	}
	return strings.SplitN(strings.TrimSpace(string(out)), "\n", 2)[0]
}

// ── Universal search ───────────────────────────────────────────────────────

func (s *Server) handleUniversalSearch(c *fiber.Ctx) error {
	q := c.Query("q")
	if q == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "q is required"})
	}
	tracks, err := core.SearchDeezerTracks(q, 20)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"tracks": tracks, "total": len(tracks)})
}
