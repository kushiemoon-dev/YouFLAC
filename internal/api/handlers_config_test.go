package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	core "github.com/kushiemoon-dev/youflac-core/v4"
)

func TestHandleGetConfig_OK(t *testing.T) {
	// Sandbox the config file location away from the real user config dir.
	t.Setenv("CONFIG_DIR", t.TempDir())

	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/config", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	var config core.Config
	if err := json.NewDecoder(resp.Body).Decode(&config); err != nil {
		t.Fatalf("decode: %v", err)
	}
}

func TestHandleSaveConfig_InvalidBody(t *testing.T) {
	t.Setenv("CONFIG_DIR", t.TempDir())
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/config", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleSaveConfig_RejectsSystemOutputDirectory(t *testing.T) {
	t.Setenv("CONFIG_DIR", t.TempDir())
	s := newTestServer(t)
	config := core.GetDefaultConfig()
	config.OutputDirectory = "/etc"
	body, _ := json.Marshal(config)
	req := httptest.NewRequest(http.MethodPost, "/api/config", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleSaveConfig_RejectsUnknownAudioSource(t *testing.T) {
	t.Setenv("CONFIG_DIR", t.TempDir())
	s := newTestServer(t)
	config := core.GetDefaultConfig()
	config.AudioSourcePriority = []string{"not-a-real-source"}
	body, _ := json.Marshal(config)
	req := httptest.NewRequest(http.MethodPost, "/api/config", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleSaveConfig_Success(t *testing.T) {
	t.Setenv("CONFIG_DIR", t.TempDir())
	s := newTestServer(t)
	config := core.GetDefaultConfig()
	config.Theme = "dark"
	body, _ := json.Marshal(config)
	req := httptest.NewRequest(http.MethodPost, "/api/config", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	if s.config.Theme != "dark" {
		t.Errorf("expected server config to update in place, got theme=%q", s.config.Theme)
	}
}

func TestHandleGetDefaultOutput_OK(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/config/default-output", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	var result map[string]string
	json.NewDecoder(resp.Body).Decode(&result)
	if result["path"] == "" {
		t.Error("expected non-empty default output path")
	}
}
