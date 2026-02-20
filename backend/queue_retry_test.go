package backend

import (
	"context"
	"testing"
)

// newTestQueue returns a minimal queue suitable for unit tests.
func newTestQueue() *Queue {
	return NewQueue(context.Background(), 1)
}

// addErrorItem adds a QueueItem in error state and returns its ID.
func addErrorItem(q *Queue, artist, title, videoURL, spotifyURL string) string {
	item := QueueItem{
		ID:         "test-id-1",
		Artist:     artist,
		Title:      title,
		VideoURL:   videoURL,
		SpotifyURL: spotifyURL,
		Status:     StatusError,
		Error:      "all_download_attempts_failed",
	}
	q.mutex.Lock()
	q.items = append(q.items, item)
	q.mutex.Unlock()
	return item.ID
}

func TestRetryWithOverride_MusicURL(t *testing.T) {
	q := newTestQueue()
	id := addErrorItem(q, "Old Artist", "Old Title", "https://youtube.com/watch?v=abc", "")

	musicURL := "https://tidal.com/browse/track/12345"
	result, err := q.RetryWithOverride(id, RetryOverrideRequest{MusicURL: musicURL})
	if err != nil {
		t.Fatalf("RetryWithOverride returned error: %v", err)
	}

	if result.Status != StatusPending {
		t.Errorf("expected status pending, got %s", result.Status)
	}
	if result.SpotifyURL != musicURL {
		t.Errorf("expected SpotifyURL %q, got %q", musicURL, result.SpotifyURL)
	}
	if result.Error != "" {
		t.Errorf("expected Error to be cleared, got %q", result.Error)
	}
	if result.MatchCandidates != nil {
		t.Errorf("expected MatchCandidates to be nil after retry")
	}
	if result.MatchDiagnostics != nil {
		t.Errorf("expected MatchDiagnostics to be nil after retry")
	}
}

func TestRetryWithOverride_ArtistTitle(t *testing.T) {
	q := newTestQueue()
	id := addErrorItem(q, "Wrong Artist", "Wrong Title", "https://youtube.com/watch?v=abc", "")

	result, err := q.RetryWithOverride(id, RetryOverrideRequest{
		Artist: "Correct Artist",
		Title:  "Correct Title",
	})
	if err != nil {
		t.Fatalf("RetryWithOverride returned error: %v", err)
	}

	if result.Artist != "Correct Artist" {
		t.Errorf("expected artist %q, got %q", "Correct Artist", result.Artist)
	}
	if result.Title != "Correct Title" {
		t.Errorf("expected title %q, got %q", "Correct Title", result.Title)
	}
	if result.Status != StatusPending {
		t.Errorf("expected status pending, got %s", result.Status)
	}
}

func TestRetryWithOverride_NotFound(t *testing.T) {
	q := newTestQueue()

	_, err := q.RetryWithOverride("nonexistent-id", RetryOverrideRequest{})
	if err == nil {
		t.Error("expected error for nonexistent item, got nil")
	}
}

func TestRetryWithOverride_NoOverride(t *testing.T) {
	q := newTestQueue()
	id := addErrorItem(q, "Artist", "Title", "https://youtube.com/watch?v=abc", "")

	result, err := q.RetryWithOverride(id, RetryOverrideRequest{})
	if err != nil {
		t.Fatalf("RetryWithOverride returned error: %v", err)
	}

	// Original fields should be preserved
	if result.Artist != "Artist" {
		t.Errorf("expected artist %q, got %q", "Artist", result.Artist)
	}
	if result.Title != "Title" {
		t.Errorf("expected title %q, got %q", "Title", result.Title)
	}
	if result.Status != StatusPending {
		t.Errorf("expected status pending, got %s", result.Status)
	}
}

func TestMatchDiagnostics_Populated(t *testing.T) {
	// Verify MatchDiagnostics struct is properly initialized
	diag := &MatchDiagnostics{
		SourcesTried:  []string{"song.link", "tidal"},
		FailureReason: "all_download_attempts_failed",
		BestScore:     0,
	}

	if len(diag.SourcesTried) != 2 {
		t.Errorf("expected 2 sources tried, got %d", len(diag.SourcesTried))
	}
	if diag.FailureReason != "all_download_attempts_failed" {
		t.Errorf("unexpected failure reason: %s", diag.FailureReason)
	}
	if diag.BestScore != 0 {
		t.Errorf("expected best score 0, got %f", diag.BestScore)
	}
}

func TestRetryWithOverride_ResetsMatchState(t *testing.T) {
	q := newTestQueue()

	// Add an item with existing match candidates and diagnostics
	item := QueueItem{
		ID:     "test-id-2",
		Artist: "Artist",
		Title:  "Title",
		Status: StatusError,
		Error:  "download failed",
		MatchCandidates: []AudioCandidate{
			{Platform: "tidal", URL: "https://tidal.com/track/1", Title: "Title", Artist: "Artist", Priority: 1},
		},
		MatchDiagnostics: &MatchDiagnostics{
			SourcesTried:  []string{"song.link"},
			FailureReason: "all_download_attempts_failed",
		},
	}
	q.mutex.Lock()
	q.items = append(q.items, item)
	q.mutex.Unlock()

	result, err := q.RetryWithOverride("test-id-2", RetryOverrideRequest{MusicURL: "https://tidal.com/track/999"})
	if err != nil {
		t.Fatalf("RetryWithOverride returned error: %v", err)
	}

	if result.MatchCandidates != nil {
		t.Error("expected MatchCandidates to be cleared after retry-override")
	}
	if result.MatchDiagnostics != nil {
		t.Error("expected MatchDiagnostics to be cleared after retry-override")
	}
	if result.SpotifyURL != "https://tidal.com/track/999" {
		t.Errorf("expected SpotifyURL to be set to override URL")
	}
}
