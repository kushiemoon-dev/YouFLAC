package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	core "github.com/kushiemoon-dev/youflac-core"
)

func newTestServer(t *testing.T) *Server {
	t.Helper()
	q := core.NewQueue(context.Background(), 1)
	return NewServer(core.GetDefaultConfig(), q, nil, nil)
}

func TestHandleChannelFetch_ValidURL(t *testing.T) {
	core.SetYtdlpBinaryForTests("/srv/http/YouFLAC-Core/.worktrees/feature/parity-phase-4/testdata/ytdlp_channel_ok.sh")
	defer core.SetYtdlpBinaryForTests("yt-dlp")

	s := newTestServer(t)
	body, _ := json.Marshal(map[string]interface{}{
		"url":      "https://www.youtube.com/@Test",
		"maxItems": 2,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/channel/fetch", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusAccepted {
		t.Errorf("expected 202, got %d", resp.StatusCode)
	}
	var result map[string]string
	json.NewDecoder(resp.Body).Decode(&result)
	if result["jobID"] == "" {
		t.Error("expected non-empty jobID in response")
	}
}

func TestHandleChannelFetch_InvalidURL(t *testing.T) {
	s := newTestServer(t)
	body, _ := json.Marshal(map[string]string{"url": "https://example.com/not-youtube"})
	req := httptest.NewRequest(http.MethodPost, "/api/channel/fetch", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := s.app.Test(req, 5000)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleChannelFetchCancel_UnknownID(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/channel/fetch/nonexistent/cancel", nil)
	resp, _ := s.app.Test(req, 5000)
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected 404, got %d", resp.StatusCode)
	}
}

func TestHandleChannelFetchStatus_UnknownID(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/channel/fetch/nonexistent", nil)
	resp, _ := s.app.Test(req, 5000)
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected 404, got %d", resp.StatusCode)
	}
}
