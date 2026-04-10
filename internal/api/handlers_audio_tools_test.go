package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

// makeTempWAV creates a minimal silent WAV file via ffmpeg for testing.
// Skips the test if ffmpeg is not available.
func makeTempWAV(t *testing.T) string {
	t.Helper()
	tmp := t.TempDir()
	out := filepath.Join(tmp, "test.wav")
	cmd := exec.Command("ffmpeg", "-y", "-f", "lavfi",
		"-i", "sine=frequency=440:sample_rate=44100:duration=0.1",
		"-c:a", "pcm_s16le", out)
	if err := cmd.Run(); err != nil {
		t.Skipf("ffmpeg not available: %v", err)
	}
	if _, err := os.Stat(out); err != nil {
		t.Skipf("ffmpeg produced no output: %v", err)
	}
	return out
}

func TestHandleConvertDirectory_MissingDir(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/converter/directory", bytes.NewReader([]byte("{}")))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleResample_MissingBody(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/resampler", bytes.NewReader([]byte("{}")))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleVideoPreview_MissingURL(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/video/preview", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400 for missing url, got %d", resp.StatusCode)
	}
}

func TestHandleVideoPreview_SecondsTooHigh(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/video/preview?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ&seconds=999", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("expected 422 for seconds > 60, got %d", resp.StatusCode)
	}
}

func TestHandleVideoPreview_InvalidYouTubeURL(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/video/preview?url=https%3A%2F%2Fexample.com%2Fnotyt", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400 for non-YouTube URL, got %d", resp.StatusCode)
	}
}

func TestHandleResample_InvalidSampleRate(t *testing.T) {
	tmp := t.TempDir()

	// Generate input WAV inside tmp so sandbox check passes.
	inPath := filepath.Join(tmp, "in.wav")
	cmd := exec.Command("ffmpeg", "-y", "-f", "lavfi",
		"-i", "sine=frequency=440:sample_rate=44100:duration=0.1",
		"-c:a", "pcm_s16le", inPath)
	if err := cmd.Run(); err != nil {
		t.Skipf("ffmpeg not available: %v", err)
	}

	s := newTestServer(t)
	s.config.OutputDirectory = tmp

	body, _ := json.Marshal(map[string]interface{}{
		"inputPath":  inPath,
		"outputPath": filepath.Join(tmp, "out.flac"),
		"sampleRate": 99999, // not in SupportedSampleRates → core returns error
		"bitDepth":   16,
		"format":     "flac",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/resampler", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := s.app.Test(req, 30000)
	// AnalyzeAudio succeeds → core.Resample returns "unsupported sample rate" → 500
	if resp.StatusCode == http.StatusOK {
		t.Errorf("expected non-200 for unsupported sample rate, got 200")
	}
}
