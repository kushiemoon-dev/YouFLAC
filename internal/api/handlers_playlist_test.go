package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestHandleAddPlaylistToQueue_InvalidBody(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/playlist", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleAddPlaylistToQueue_InvalidPlaylistURL(t *testing.T) {
	s := newTestServer(t)
	body, _ := json.Marshal(map[string]string{"url": "https://example.com/not-youtube"})
	req := httptest.NewRequest(http.MethodPost, "/api/playlist", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandlePlaylistLyricsBulk_MissingDir(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/playlist/lyrics/bulk", bytes.NewReader([]byte("{}")))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandlePlaylistLyricsBulk_RejectsPathOutsideOutputDir(t *testing.T) {
	outputDir := t.TempDir()
	outsideDir := t.TempDir()

	s := newTestServer(t)
	s.config.OutputDirectory = outputDir

	body, _ := json.Marshal(map[string]string{"dir": outsideDir})
	req := httptest.NewRequest(http.MethodPost, "/api/playlist/lyrics/bulk", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("expected 403, got %d", resp.StatusCode)
	}
}

func TestHandlePlaylistLyricsBulk_EmptyDirSucceeds(t *testing.T) {
	outputDir := t.TempDir()
	subDir := filepath.Join(outputDir, "MyPlaylist")
	if err := os.MkdirAll(subDir, 0755); err != nil {
		t.Fatal(err)
	}

	s := newTestServer(t)
	s.config.OutputDirectory = outputDir

	body, _ := json.Marshal(map[string]string{"dir": subDir})
	req := httptest.NewRequest(http.MethodPost, "/api/playlist/lyrics/bulk", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if result["success"] != float64(0) || result["failed"] != float64(0) {
		t.Errorf("expected success=0 failed=0, got %+v", result)
	}
}
