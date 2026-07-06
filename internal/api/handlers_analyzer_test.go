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

func TestHandleAnalyzeAudio_ValidFile(t *testing.T) {
	wav := makeTempWAV(t)

	s := newTestServer(t)
	body, _ := json.Marshal(map[string]string{"filePath": wav})
	req := httptest.NewRequest(http.MethodPost, "/api/analyze", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 10000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}

func TestHandleAnalyzeAudio_NonexistentFile(t *testing.T) {
	s := newTestServer(t)
	body, _ := json.Marshal(map[string]string{"filePath": "/nonexistent/file.wav"})
	req := httptest.NewRequest(http.MethodPost, "/api/analyze", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 10000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", resp.StatusCode)
	}
}

func TestHandleAnalyzeAudio_InvalidBody(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/analyze", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleGenerateSpectrogram_ValidFile(t *testing.T) {
	wav := makeTempWAV(t)

	s := newTestServer(t)
	body, _ := json.Marshal(map[string]string{"filePath": wav})
	req := httptest.NewRequest(http.MethodPost, "/api/analyze/spectrogram", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 20000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var result map[string]string
	json.NewDecoder(resp.Body).Decode(&result)
	if result["path"] == "" {
		t.Fatal("expected non-empty spectrogram path")
	}
	if _, err := os.Stat(result["path"]); err != nil {
		t.Errorf("expected spectrogram file to exist at %s: %v", result["path"], err)
	}
}

func TestHandleGenerateWaveform_ValidFile(t *testing.T) {
	wav := makeTempWAV(t)

	s := newTestServer(t)
	body, _ := json.Marshal(map[string]string{"filePath": wav})
	req := httptest.NewRequest(http.MethodPost, "/api/analyze/waveform", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 20000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var result map[string]string
	json.NewDecoder(resp.Body).Decode(&result)
	if result["path"] == "" {
		t.Fatal("expected non-empty waveform path")
	}
	if _, err := os.Stat(result["path"]); err != nil {
		t.Errorf("expected waveform file to exist at %s: %v", result["path"], err)
	}
}

func TestHandleGetImage_MissingPath(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/image", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleGetImage_RejectsPathOutsideAllowedDirs(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/image?path=/etc/passwd", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("expected 403, got %d", resp.StatusCode)
	}
}

func TestHandleGetImage_ServesFileFromOutputDir(t *testing.T) {
	outputDir := t.TempDir()
	imgPath := filepath.Join(outputDir, "cover.jpg")
	if err := os.WriteFile(imgPath, []byte{0xFF, 0xD8, 0xFF}, 0644); err != nil {
		t.Fatal(err)
	}

	s := newTestServer(t)
	s.config.OutputDirectory = outputDir

	req := httptest.NewRequest(http.MethodGet, "/api/image?path="+imgPath, nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var result map[string]string
	json.NewDecoder(resp.Body).Decode(&result)
	if result["dataUrl"] == "" {
		t.Error("expected non-empty dataUrl")
	}
}
