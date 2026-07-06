package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	core "github.com/kushiemoon-dev/youflac-core/v4"
)

func TestHandleConvert_MissingFields(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/convert", bytes.NewReader([]byte("{}")))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleConvert_InvalidBody(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/convert", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleConvert_ValidFile(t *testing.T) {
	wav := makeTempWAV(t)

	s := newTestServer(t)
	body, _ := json.Marshal(map[string]interface{}{
		"sourcePath":   wav,
		"targetFormat": "mp3",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/convert", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 20000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var result core.ConvertResult
	json.NewDecoder(resp.Body).Decode(&result)
	if result.Format != "mp3" {
		t.Errorf("format: got %q, want mp3", result.Format)
	}
	if filepath.Ext(result.OutputPath) != ".mp3" {
		t.Errorf("outputPath: got %q, want .mp3 extension", result.OutputPath)
	}
}

func TestHandleGetConvertFormats_OK(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/convert/formats", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	var formats []string
	json.NewDecoder(resp.Body).Decode(&formats)
	if len(formats) != len(core.SupportedConvertFormats) {
		t.Errorf("got %v, want %v", formats, core.SupportedConvertFormats)
	}
}
