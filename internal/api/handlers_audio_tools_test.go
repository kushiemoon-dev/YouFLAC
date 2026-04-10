package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHandleResample_MissingBody(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/resampler", bytes.NewReader([]byte("{}")))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	// Empty inputPath/outputPath → 400
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleResample_InvalidSampleRate(t *testing.T) {
	s := newTestServer(t)
	body, _ := json.Marshal(map[string]interface{}{
		"inputPath":  "/tmp/test.wav",
		"outputPath": "/tmp/out.flac",
		"sampleRate": 99999,
		"bitDepth":   16,
		"format":     "flac",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/resampler", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := s.app.Test(req, 5000)
	// Resample will fail validation → 500 (after missing file check) or 500
	// We just want it to not panic and return an error response
	if resp.StatusCode == http.StatusOK {
		t.Error("expected non-200 for invalid params")
	}
}
