package api

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	core "github.com/kushiemoon-dev/youflac-core/v4"
)

func TestHandleGetQueue_EmptyInitially(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/queue", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	var items []core.QueueItem
	json.NewDecoder(resp.Body).Decode(&items)
	if len(items) != 0 {
		t.Errorf("expected empty queue, got %d items", len(items))
	}
}

func TestHandleAddToQueue_ValidYouTubeURL(t *testing.T) {
	s := newTestServer(t)
	body, _ := json.Marshal(map[string]string{"videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"})
	req := httptest.NewRequest(http.MethodPost, "/api/queue", bytes.NewReader(body))
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
	if result["id"] == "" {
		t.Error("expected non-empty id")
	}
}

func TestHandleAddToQueue_InvalidVideoURL(t *testing.T) {
	s := newTestServer(t)
	body, _ := json.Marshal(map[string]string{"videoUrl": "https://example.com/not-youtube"})
	req := httptest.NewRequest(http.MethodPost, "/api/queue", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleAddToQueue_InvalidBody(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/queue", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

// TestHandleAddToQueue_RoutesMusicServiceURLToSpotifyURL verifies that a Tidal URL
// submitted via the videoUrl field gets rerouted to SpotifyURL, bypassing YouTube
// URL validation entirely.
func TestHandleAddToQueue_RoutesMusicServiceURLToSpotifyURL(t *testing.T) {
	s := newTestServer(t)
	body, _ := json.Marshal(map[string]string{"videoUrl": "https://tidal.com/track/12345"})
	req := httptest.NewRequest(http.MethodPost, "/api/queue", bytes.NewReader(body))
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
	if result["id"] == "" {
		t.Fatal("expected non-empty id")
	}

	itemReq := httptest.NewRequest(http.MethodGet, "/api/queue/"+result["id"], nil)
	itemResp, err := s.app.Test(itemReq, 5000)
	if err != nil {
		t.Fatal(err)
	}
	var item core.QueueItem
	json.NewDecoder(itemResp.Body).Decode(&item)
	if item.SpotifyURL != "https://tidal.com/track/12345" {
		t.Errorf("SpotifyURL: got %q, want tidal URL", item.SpotifyURL)
	}
	if item.VideoURL != "" {
		t.Errorf("VideoURL: got %q, want empty", item.VideoURL)
	}
}

// TestHandleAddToQueue_AmazonURL_ReturnsClearError verifies that a pasted
// Amazon Music URL gets a specific, actionable error instead of falling
// through to the generic YouTube URL validation error. Amazon is
// deliberately not routable by URL (see core.IsAmazonURL / DetectURLSource
// doc comments — AmazonSource is fallback-only), so this must not be routed
// like Qobuz/Tidal/Spotify.
func TestHandleAddToQueue_AmazonURL_ReturnsClearError(t *testing.T) {
	s := newTestServer(t)
	body, _ := json.Marshal(map[string]string{"videoUrl": "https://music.amazon.com/albums/B08JQZTMV3"})
	req := httptest.NewRequest(http.MethodPost, "/api/queue", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
	var result map[string]string
	json.NewDecoder(resp.Body).Decode(&result)
	if !strings.Contains(result["error"], "fallback-only") {
		t.Errorf("error = %q, want a message explaining Amazon is fallback-only", result["error"])
	}
}

func TestHandleGetQueueItem_NotFound(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/queue/nonexistent", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected 404, got %d", resp.StatusCode)
	}
}

func TestHandleGetItemLogs_ReturnsBuffered(t *testing.T) {
	core.InitLogger("debug")
	q := core.NewQueue(context.Background(), 1)
	s := NewServer(core.GetDefaultConfig(), q, nil, nil)

	core.RegisterItemLogger("item-x")
	defer core.UnregisterItemLogger("item-x")
	// Simulate a captured log entry via the handler path.
	ctx := core.WithItemID(context.Background(), "item-x")
	core.Logger.InfoContext(ctx, "hello")

	req := httptest.NewRequest("GET", "/api/queue/item-x/logs", nil)
	resp, err := s.app.Test(req)
	if err != nil {
		t.Fatalf("Test: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("status = %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	var entries []core.LogEntry
	if err := json.Unmarshal(body, &entries); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(entries) == 0 {
		t.Fatal("expected at least one entry")
	}
}

// TestHandleRemoveFromQueue_UnknownID_StillReturns200 characterizes the current
// (perhaps surprising) behavior: core.Queue.RemoveFromQueue never returns an
// error, even for an ID that isn't in the queue — idempotent delete is the
// deliberate design (see youflac-core's TestRemoveNonExistent) — so the
// handler's 404 branch is currently unreachable and removing an unknown ID
// succeeds silently.
func TestHandleRemoveFromQueue_UnknownID_StillReturns200(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodDelete, "/api/queue/nonexistent", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}

func TestHandleRemoveFromQueue_Success(t *testing.T) {
	s := newTestServer(t)
	id := addQueueItem(t, s, "https://www.youtube.com/watch?v=dQw4w9WgXcQ")

	req := httptest.NewRequest(http.MethodDelete, "/api/queue/"+id, nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}

func TestHandleCancelQueueItem_NotFound(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/queue/nonexistent/cancel", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected 404, got %d", resp.StatusCode)
	}
}

func TestHandleCancelQueueItem_Success(t *testing.T) {
	s := newTestServer(t)
	id := addQueueItem(t, s, "https://www.youtube.com/watch?v=dQw4w9WgXcQ")

	req := httptest.NewRequest(http.MethodPost, "/api/queue/"+id+"/cancel", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}

func TestHandlePauseQueueItem_Success(t *testing.T) {
	s := newTestServer(t)
	id := addQueueItem(t, s, "https://www.youtube.com/watch?v=dQw4w9WgXcQ")

	req := httptest.NewRequest(http.MethodPost, "/api/queue/"+id+"/pause", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}

func TestHandlePauseQueueItem_NotFound(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/queue/nonexistent/pause", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleResumeQueueItem_NotPaused(t *testing.T) {
	s := newTestServer(t)
	id := addQueueItem(t, s, "https://www.youtube.com/watch?v=dQw4w9WgXcQ")

	// Item is "pending", not "paused" — resume must reject it.
	req := httptest.NewRequest(http.MethodPost, "/api/queue/"+id+"/resume", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleResumeQueueItem_Success(t *testing.T) {
	s := newTestServer(t)
	id := addQueueItem(t, s, "https://www.youtube.com/watch?v=dQw4w9WgXcQ")

	pauseReq := httptest.NewRequest(http.MethodPost, "/api/queue/"+id+"/pause", nil)
	if _, err := s.app.Test(pauseReq, 5000); err != nil {
		t.Fatal(err)
	}

	resumeReq := httptest.NewRequest(http.MethodPost, "/api/queue/"+id+"/resume", nil)
	resp, err := s.app.Test(resumeReq, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}

func TestHandleMoveQueueItem_ChangesOrder(t *testing.T) {
	s := newTestServer(t)
	id1 := addQueueItem(t, s, "https://www.youtube.com/watch?v=aaaaaaaaaaa")
	_ = addQueueItem(t, s, "https://www.youtube.com/watch?v=bbbbbbbbbbb")

	body, _ := json.Marshal(map[string]int{"newPosition": 1})
	req := httptest.NewRequest(http.MethodPut, "/api/queue/"+id1+"/move", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/queue", nil)
	listResp, err := s.app.Test(listReq, 5000)
	if err != nil {
		t.Fatal(err)
	}
	var items []core.QueueItem
	json.NewDecoder(listResp.Body).Decode(&items)
	if len(items) != 2 || items[1].ID != id1 {
		t.Fatalf("expected item %s moved to index 1, got %+v", id1, items)
	}
}

func TestHandleGetQueueStats_OK(t *testing.T) {
	s := newTestServer(t)
	addQueueItem(t, s, "https://www.youtube.com/watch?v=dQw4w9WgXcQ")

	req := httptest.NewRequest(http.MethodGet, "/api/queue/stats", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	var stats core.QueueStats
	json.NewDecoder(resp.Body).Decode(&stats)
	if stats.Total != 1 || stats.Pending != 1 {
		t.Errorf("expected total=1 pending=1, got %+v", stats)
	}
}

func TestHandleClearCompleted_NoneCompleted(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/queue/clear", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	var result map[string]int
	json.NewDecoder(resp.Body).Decode(&result)
	if result["cleared"] != 0 {
		t.Errorf("cleared: got %d, want 0", result["cleared"])
	}
}

func TestHandleRetryFailed_NoneFailed(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/queue/retry", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	var result map[string]int
	json.NewDecoder(resp.Body).Decode(&result)
	if result["retried"] != 0 {
		t.Errorf("retried: got %d, want 0", result["retried"])
	}
}

func TestHandlePauseAll_PausesPendingItems(t *testing.T) {
	s := newTestServer(t)
	addQueueItem(t, s, "https://www.youtube.com/watch?v=aaaaaaaaaaa")
	addQueueItem(t, s, "https://www.youtube.com/watch?v=bbbbbbbbbbb")

	req := httptest.NewRequest(http.MethodPost, "/api/queue/pause-all", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	var result map[string]int
	json.NewDecoder(resp.Body).Decode(&result)
	if result["paused"] != 2 {
		t.Errorf("paused: got %d, want 2", result["paused"])
	}
}

func TestHandleResumeAll_ResumesPausedItems(t *testing.T) {
	s := newTestServer(t)
	addQueueItem(t, s, "https://www.youtube.com/watch?v=aaaaaaaaaaa")

	pauseReq := httptest.NewRequest(http.MethodPost, "/api/queue/pause-all", nil)
	if _, err := s.app.Test(pauseReq, 5000); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/queue/resume-all", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	var result map[string]int
	json.NewDecoder(resp.Body).Decode(&result)
	if result["resumed"] != 1 {
		t.Errorf("resumed: got %d, want 1", result["resumed"])
	}
}

func TestHandleRetryQueueItemWithOverride_NotFound(t *testing.T) {
	s := newTestServer(t)
	body, _ := json.Marshal(map[string]string{"artist": "New Artist"})
	req := httptest.NewRequest(http.MethodPost, "/api/queue/nonexistent/retry-override", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected 404, got %d", resp.StatusCode)
	}
}

func TestHandleRetryQueueItemWithOverride_AppliesOverride(t *testing.T) {
	s := newTestServer(t)
	id := addQueueItem(t, s, "https://www.youtube.com/watch?v=dQw4w9WgXcQ")

	body, _ := json.Marshal(map[string]string{"artist": "Override Artist"})
	req := httptest.NewRequest(http.MethodPost, "/api/queue/"+id+"/retry-override", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var item core.QueueItem
	json.NewDecoder(resp.Body).Decode(&item)
	if item.Artist != "Override Artist" {
		t.Errorf("Artist: got %q, want %q", item.Artist, "Override Artist")
	}
}

func TestHandleExportFailed_NoFailedItems(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/queue/failed/export", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected 404, got %d", resp.StatusCode)
	}
}

// addQueueItem is a test helper that adds a valid YouTube URL to s's queue and
// returns the new item's ID.
func addQueueItem(t *testing.T, s *Server, videoURL string) string {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"videoUrl": videoURL})
	req := httptest.NewRequest(http.MethodPost, "/api/queue", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("addQueueItem: expected 200, got %d", resp.StatusCode)
	}
	var result map[string]string
	json.NewDecoder(resp.Body).Decode(&result)
	if result["id"] == "" {
		t.Fatal("addQueueItem: expected non-empty id")
	}
	return result["id"]
}
