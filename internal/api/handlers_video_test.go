package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHandleParseURL_Video(t *testing.T) {
	s := newTestServer(t)
	body, _ := json.Marshal(map[string]string{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"})
	req := httptest.NewRequest(http.MethodPost, "/api/video/parse", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var result ParseURLResult
	json.NewDecoder(resp.Body).Decode(&result)
	if result.Type != "video" || result.VideoID != "dQw4w9WgXcQ" {
		t.Errorf("got %+v, want type=video videoId=dQw4w9WgXcQ", result)
	}
}

func TestHandleParseURL_Playlist(t *testing.T) {
	s := newTestServer(t)
	body, _ := json.Marshal(map[string]string{"url": "https://www.youtube.com/playlist?list=PLabc123"})
	req := httptest.NewRequest(http.MethodPost, "/api/video/parse", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	var result ParseURLResult
	json.NewDecoder(resp.Body).Decode(&result)
	if result.Type != "playlist" || result.PlaylistID != "PLabc123" {
		t.Errorf("got %+v, want type=playlist playlistId=PLabc123", result)
	}
}

func TestHandleParseURL_Channel(t *testing.T) {
	s := newTestServer(t)
	body, _ := json.Marshal(map[string]string{"url": "https://www.youtube.com/@SomeChannel"})
	req := httptest.NewRequest(http.MethodPost, "/api/video/parse", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	var result ParseURLResult
	json.NewDecoder(resp.Body).Decode(&result)
	if result.Type != "channel" {
		t.Errorf("got %+v, want type=channel", result)
	}
}

func TestHandleParseURL_Invalid(t *testing.T) {
	s := newTestServer(t)
	body, _ := json.Marshal(map[string]string{"url": "not a url at all"})
	req := httptest.NewRequest(http.MethodPost, "/api/video/parse", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	var result ParseURLResult
	json.NewDecoder(resp.Body).Decode(&result)
	if result.Type != "invalid" {
		t.Errorf("got %+v, want type=invalid", result)
	}
}

func TestHandleParseURL_InvalidBody(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/video/parse", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleGetVideoInfo_MissingURL(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/video/info", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleGetVideoInfo_InvalidURL(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/video/info?url=not-a-youtube-url", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleVideoCheck_MissingURL(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/video/check", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

// TestHandleFindAudioMatch_AlwaysErrorsWithNoCandidates characterizes the
// handler's current, always-losing behavior: it calls core.MatchVideoToAudio
// with a nil candidates slice, which unconditionally returns an error, so
// this endpoint currently always responds 500 regardless of the video body.
func TestHandleFindAudioMatch_AlwaysErrorsWithNoCandidates(t *testing.T) {
	s := newTestServer(t)
	body, _ := json.Marshal(map[string]string{"title": "Some Title", "artist": "Some Artist"})
	req := httptest.NewRequest(http.MethodPost, "/api/video/match", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", resp.StatusCode)
	}
}

func TestHandleFindAudioMatch_InvalidBody(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/video/match", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleSearch_MissingQuery(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/search", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}
