package api

import (
	"os/exec"
	"strings"
	"time"

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
	disabledList := s.config.QobuzProvidersDisabled
	if disabledList == nil {
		disabledList = []string{}
	}
	return c.JSON(fiber.Map{
		"available": all,
		"disabled":  disabledList,
	})
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
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	_ = c.BodyParser(&body)

	st := s.soulseekStatusMap()

	// Use body credentials if provided, fall back to saved config.
	username := body.Username
	password := body.Password
	if username == "" {
		username = s.config.SoulseekUsername
	}
	if password == "" {
		password = s.config.SoulseekPassword
	}

	// Quick pre-checks before attempting a real network connection.
	if st["binaryFound"] != true {
		return c.JSON(fiber.Map{"ok": false, "details": st, "error": "sldl binary not found"})
	}
	if username == "" || password == "" {
		return c.JSON(fiber.Map{"ok": false, "details": st, "error": "credentials not configured"})
	}

	binaryPath := core.ResolveSldlPath(s.config.SoulseekBinaryPath)
	src := core.NewSoulseekSource(binaryPath, username, password)
	if err := src.TestLogin(20 * time.Second); err != nil {
		return c.JSON(fiber.Map{"ok": false, "details": st, "error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true, "details": st})
}

func (s *Server) soulseekStatusMap() fiber.Map {
	binaryPath := core.ResolveSldlPath(s.config.SoulseekBinaryPath)
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

