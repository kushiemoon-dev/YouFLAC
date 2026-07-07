package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	core "github.com/kushiemoon-dev/youflac-core/v4"
)

// newHistoryTestServer sandboxes core's data directory to a temp dir (so History's
// on-disk file never touches the real user's data) and wires a fresh core.History
// into a new Server.
func newHistoryTestServer(t *testing.T) *Server {
	t.Helper()
	core.SetDataDir(t.TempDir())
	h := core.NewHistory()
	q := core.NewQueue(context.Background(), 1)
	return NewServer(core.GetDefaultConfig(), q, h, nil)
}

func TestHandleGetHistory_EmptyInitially(t *testing.T) {
	s := newHistoryTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/history", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	var entries []core.HistoryEntry
	json.NewDecoder(resp.Body).Decode(&entries)
	if len(entries) != 0 {
		t.Errorf("expected empty history, got %d entries", len(entries))
	}
}

func TestHandleGetHistoryStats_OK(t *testing.T) {
	s := newHistoryTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/history/stats", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}

func TestHandleSearchHistory_NoQueryReturnsAll(t *testing.T) {
	s := newHistoryTestServer(t)
	if err := s.history.Add(core.HistoryEntry{ID: "h1", Title: "Some Song", CompletedAt: time.Now()}); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/history/search", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	var entries []core.HistoryEntry
	json.NewDecoder(resp.Body).Decode(&entries)
	if len(entries) != 1 {
		t.Errorf("expected 1 entry, got %d", len(entries))
	}
}

func TestHandleSearchHistory_WithQuery(t *testing.T) {
	s := newHistoryTestServer(t)
	if err := s.history.Add(core.HistoryEntry{ID: "h1", Title: "Bohemian Rhapsody", CompletedAt: time.Now()}); err != nil {
		t.Fatal(err)
	}
	if err := s.history.Add(core.HistoryEntry{ID: "h2", Title: "Another Song", CompletedAt: time.Now()}); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/history/search?q=Bohemian", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	var entries []core.HistoryEntry
	json.NewDecoder(resp.Body).Decode(&entries)
	if len(entries) != 1 || entries[0].ID != "h1" {
		t.Errorf("expected 1 match (h1), got %+v", entries)
	}
}

// TestHandleDeleteHistoryEntry_UnknownID_StillReturns200 characterizes the
// current behavior: core.History.Delete never returns an error, even for an
// ID that isn't in history (same idempotent-delete design as RemoveFromQueue),
// so the handler's 404 branch is currently unreachable.
func TestHandleDeleteHistoryEntry_UnknownID_StillReturns200(t *testing.T) {
	s := newHistoryTestServer(t)
	req := httptest.NewRequest(http.MethodDelete, "/api/history/nonexistent", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}

func TestHandleDeleteHistoryEntry_Success(t *testing.T) {
	s := newHistoryTestServer(t)
	if err := s.history.Add(core.HistoryEntry{ID: "h1", Title: "Some Song", CompletedAt: time.Now()}); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodDelete, "/api/history/h1", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}

func TestHandleClearHistory_OK(t *testing.T) {
	s := newHistoryTestServer(t)
	if err := s.history.Add(core.HistoryEntry{ID: "h1", Title: "Some Song", CompletedAt: time.Now()}); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/history/clear", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	if len(s.history.GetAll()) != 0 {
		t.Error("expected history to be empty after clear")
	}
}

func TestHandleRedownloadFromHistory_NotFound(t *testing.T) {
	s := newHistoryTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/history/nonexistent/redownload", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected 404, got %d", resp.StatusCode)
	}
}

func TestHandleRedownloadFromHistory_Success(t *testing.T) {
	s := newHistoryTestServer(t)
	if err := s.history.Add(core.HistoryEntry{
		ID:          "h1",
		VideoURL:    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		Title:       "Some Song",
		Quality:     "best",
		CompletedAt: time.Now(),
	}); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/history/h1/redownload", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var result map[string]string
	json.NewDecoder(resp.Body).Decode(&result)
	if result["id"] == "" {
		t.Error("expected non-empty new queue id")
	}
}
