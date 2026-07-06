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

func TestHandleFetchLyrics_MissingParams(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/lyrics", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleEmbedLyrics_InvalidBody(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/lyrics/embed", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleEmbedLyrics_UnsupportedFormat(t *testing.T) {
	dir := t.TempDir()
	mediaPath := filepath.Join(dir, "song.txt")
	if err := os.WriteFile(mediaPath, []byte("data"), 0644); err != nil {
		t.Fatal(err)
	}

	s := newTestServer(t)
	body, _ := json.Marshal(map[string]interface{}{
		"mediaPath": mediaPath,
		"lyrics":    map[string]string{"plainText": "la la la"},
	})
	req := httptest.NewRequest(http.MethodPost, "/api/lyrics/embed", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", resp.StatusCode)
	}
}

func TestHandleSaveLRCFile_InvalidBody(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/lyrics/save", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleSaveLRCFile_NoSyncedLyrics(t *testing.T) {
	s := newTestServer(t)
	body, _ := json.Marshal(map[string]interface{}{
		"mediaPath": filepath.Join(t.TempDir(), "song.flac"),
		"lyrics":    map[string]string{"plainText": "la la la"},
	})
	req := httptest.NewRequest(http.MethodPost, "/api/lyrics/save", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", resp.StatusCode)
	}
}

func TestHandleSaveLRCFile_Success(t *testing.T) {
	dir := t.TempDir()
	mediaPath := filepath.Join(dir, "song.flac")

	s := newTestServer(t)
	body, _ := json.Marshal(map[string]interface{}{
		"mediaPath": mediaPath,
		"lyrics":    map[string]string{"syncedLyrics": "[00:01.00]la la la"},
	})
	req := httptest.NewRequest(http.MethodPost, "/api/lyrics/save", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var result map[string]string
	json.NewDecoder(resp.Body).Decode(&result)
	wantPath := filepath.Join(dir, "song.lrc")
	if result["path"] != wantPath {
		t.Errorf("path: got %q, want %q", result["path"], wantPath)
	}
	if _, err := os.Stat(wantPath); err != nil {
		t.Errorf("expected .lrc file to exist: %v", err)
	}
}
