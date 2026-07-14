package app

import (
	"strings"
	"testing"

	core "github.com/kushiemoon-dev/youflac-core/v4"
)

// TestAddToQueue_AmazonURL_ReturnsClearError verifies that a pasted Amazon
// Music URL gets a specific, actionable error instead of falling through to
// the generic YouTube URL validation error. Amazon is deliberately not
// routable by URL (see core.IsAmazonURL / DetectURLSource doc comments —
// AmazonSource is fallback-only), so this must not be routed like
// Qobuz/Tidal/Spotify. Uses a zero-value App since the error must be
// returned before a.queue is ever touched.
func TestAddToQueue_AmazonURL_ReturnsClearError(t *testing.T) {
	a := &App{}
	_, err := a.AddToQueue(core.DownloadRequest{VideoURL: "https://music.amazon.com/albums/B08JQZTMV3"})
	if err == nil {
		t.Fatal("expected error for Amazon Music URL, got nil")
	}
	if !strings.Contains(err.Error(), "fallback-only") {
		t.Errorf("error = %q, want a message explaining Amazon is fallback-only", err.Error())
	}
}
