package backend

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// ============================================================================
// TidalHifiService — unit tests (all mocked, no real network calls)
// ============================================================================

// newTidalSvc creates a TidalHifiService pointed at a mock test server.
func newTidalSvc(ts *httptest.Server) *TidalHifiService {
	svc := NewTidalHifiService(ts.Client())
	svc.baseURL = ts.URL
	return svc
}

func TestTidalHifiService_Name(t *testing.T) {
	ts := httptest.NewServer(http.NotFoundHandler())
	defer ts.Close()
	if got := newTidalSvc(ts).Name(); got != "tidal-hifi" {
		t.Errorf("Name() = %q, want %q", got, "tidal-hifi")
	}
}

func TestTidalHifiService_IsAvailable_Up(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer ts.Close()

	if !newTidalSvc(ts).IsAvailable() {
		t.Error("expected IsAvailable() == true for HTTP 200")
	}
}

func TestTidalHifiService_IsAvailable_Down(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer ts.Close()

	if newTidalSvc(ts).IsAvailable() {
		t.Error("expected IsAvailable() == false for HTTP 503")
	}
}

// ============================================================================
// ExtractTidalID — table-driven
// ============================================================================

func TestExtractTidalID(t *testing.T) {
	tests := []struct {
		name    string
		url     string
		wantID  int
		wantErr bool
	}{
		{"browse/track", "https://tidal.com/browse/track/12345", 12345, false},
		{"listen.tidal", "https://listen.tidal.com/track/99999", 99999, false},
		{"tidal:track", "tidal:track:42", 42, false},
		{"path /track/", "https://api.example.com/track/777", 777, false},
		{"no id", "https://tidal.com/browse/album/123", 0, true},
		{"empty", "", 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			id, err := ExtractTidalID(tt.url)
			if tt.wantErr {
				if err == nil {
					t.Errorf("ExtractTidalID(%q) expected error, got id=%d", tt.url, id)
				}
				return
			}
			if err != nil {
				t.Errorf("ExtractTidalID(%q) unexpected error: %v", tt.url, err)
				return
			}
			if id != tt.wantID {
				t.Errorf("ExtractTidalID(%q) = %d, want %d", tt.url, id, tt.wantID)
			}
		})
	}
}

// ============================================================================
// SearchTrack
// ============================================================================

func TestTidalHifiService_SearchTrack_Success(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{
			"data": {
				"items": [
					{
						"id": 12345,
						"title": "Thunderstruck",
						"isrc": "AUAP08700281",
						"artist": {"name": "AC/DC"},
						"album":  {"title": "The Razors Edge"}
					}
				]
			}
		}`)
	}))
	defer ts.Close()

	track, err := newTidalSvc(ts).SearchTrack("AC/DC Thunderstruck")
	if err != nil {
		t.Fatalf("SearchTrack() error: %v", err)
	}
	if track.ID != 12345 {
		t.Errorf("ID = %d, want 12345", track.ID)
	}
	if track.Title != "Thunderstruck" {
		t.Errorf("Title = %q, want Thunderstruck", track.Title)
	}
}

func TestTidalHifiService_SearchTrack_TracksFormat(t *testing.T) {
	// Alternate JSON shape using "tracks.items" instead of "data.items"
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{
			"tracks": {
				"items": [
					{
						"id": 9999,
						"title": "Back In Black",
						"artist": {"name": "AC/DC"},
						"album":  {"title": "Back In Black"}
					}
				]
			}
		}`)
	}))
	defer ts.Close()

	track, err := newTidalSvc(ts).SearchTrack("AC/DC Back In Black")
	if err != nil {
		t.Fatalf("SearchTrack() error: %v", err)
	}
	if track.ID != 9999 {
		t.Errorf("ID = %d, want 9999", track.ID)
	}
}

func TestTidalHifiService_SearchTrack_NoResults(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"data":{"items":[]},"tracks":{"items":[]}}`)
	}))
	defer ts.Close()

	_, err := newTidalSvc(ts).SearchTrack("nonexistent track xyz")
	if err == nil {
		t.Fatal("expected error for empty results, got nil")
	}
	if !strings.Contains(err.Error(), "no tracks found") {
		t.Errorf("error %q should mention 'no tracks found'", err.Error())
	}
}

// ============================================================================
// GetTrackByID
// ============================================================================

func TestTidalHifiService_GetTrackByID_V2Format(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{
			"version": "2.0",
			"data": {
				"id": 12345,
				"title": "Test Track",
				"isrc": "USABC1234567",
				"artist": {"name": "Test Artist"},
				"album":  {"title": "Test Album"}
			}
		}`)
	}))
	defer ts.Close()

	track, err := newTidalSvc(ts).GetTrackByID(12345)
	if err != nil {
		t.Fatalf("GetTrackByID() error: %v", err)
	}
	if track.ID != 12345 {
		t.Errorf("ID = %d, want 12345", track.ID)
	}
	if track.ISRC != "USABC1234567" {
		t.Errorf("ISRC = %q, want USABC1234567", track.ISRC)
	}
}

// ============================================================================
// GetStreamURL
// ============================================================================

// tidalManifestBase64 encodes a manifest with the given URLs.
func tidalManifestBase64(urls []string) string {
	m := TidalManifest{
		MimeType: "audio/flac",
		Codecs:   "flac",
		URLs:     urls,
	}
	data, _ := json.Marshal(m)
	return base64.StdEncoding.EncodeToString(data)
}

func TestTidalHifiService_GetStreamURL_Success(t *testing.T) {
	manifest := tidalManifestBase64([]string{"https://cdn.example.com/stream.flac"})
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"version":"2.0","data":{"manifest":%q}}`, manifest)
	}))
	defer ts.Close()

	url, err := newTidalSvc(ts).GetStreamURL(12345)
	if err != nil {
		t.Fatalf("GetStreamURL() error: %v", err)
	}
	if url != "https://cdn.example.com/stream.flac" {
		t.Errorf("URL = %q, want https://cdn.example.com/stream.flac", url)
	}
}

func TestTidalHifiService_GetStreamURL_NoManifest(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"version":"2.0","data":{"manifest":""}}`)
	}))
	defer ts.Close()

	_, err := newTidalSvc(ts).GetStreamURL(12345)
	if err == nil {
		t.Fatal("expected error for empty manifest, got nil")
	}
	if !strings.Contains(err.Error(), "no manifest") {
		t.Errorf("error %q should mention 'no manifest'", err.Error())
	}
}

func TestTidalHifiService_GetStreamURL_InvalidBase64(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"version":"2.0","data":{"manifest":"!!!bad!!!"}}`)
	}))
	defer ts.Close()

	_, err := newTidalSvc(ts).GetStreamURL(12345)
	if err == nil {
		t.Fatal("expected error for invalid base64, got nil")
	}
	if !strings.Contains(err.Error(), "decode manifest") {
		t.Errorf("error %q should mention 'decode manifest'", err.Error())
	}
}

func TestTidalHifiService_GetStreamURL_EmptyURLs(t *testing.T) {
	manifest := tidalManifestBase64([]string{}) // valid base64 JSON but URLs is empty
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"version":"2.0","data":{"manifest":%q}}`, manifest)
	}))
	defer ts.Close()

	_, err := newTidalSvc(ts).GetStreamURL(12345)
	if err == nil {
		t.Fatal("expected error for empty URLs list, got nil")
	}
	if !strings.Contains(err.Error(), "no download URLs") {
		t.Errorf("error %q should mention 'no download URLs'", err.Error())
	}
}

// ============================================================================
// GetTrackInfo — artist fallback
// ============================================================================

func TestTidalHifiService_GetTrackInfo_ArtistFallback(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.Contains(r.URL.Path, "/info/"):
			// Return track with empty Artist.Name but populated Artists
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprint(w, `{
				"version": "2.0",
				"data": {
					"id": 1,
					"title": "Song",
					"artist":  {"name": ""},
					"artists": [{"name": "Real Artist"}],
					"album":   {"title": "Album"}
				}
			}`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer ts.Close()

	info, err := newTidalSvc(ts).GetTrackInfo("https://tidal.com/browse/track/1")
	if err != nil {
		t.Fatalf("GetTrackInfo() error: %v", err)
	}
	if info.Artist != "Real Artist" {
		t.Errorf("Artist = %q, want %q", info.Artist, "Real Artist")
	}
}

// ============================================================================
// OrpheusDLService — pure logic tests (no exec calls)
// ============================================================================

func TestOrpheusDLService_Name(t *testing.T) {
	svc := NewOrpheusDLService()
	if got := svc.Name(); got != "orpheusdl" {
		t.Errorf("Name() = %q, want %q", got, "orpheusdl")
	}
}

func TestOrpheusDLService_GetTrackInfo_AlwaysErrors(t *testing.T) {
	svc := NewOrpheusDLService()
	_, err := svc.GetTrackInfo("https://tidal.com/browse/track/1")
	if err == nil {
		t.Fatal("expected error from GetTrackInfo, got nil")
	}
	if !strings.Contains(err.Error(), "does not support metadata-only queries") {
		t.Errorf("error %q should mention 'does not support metadata-only queries'", err.Error())
	}
}

// ============================================================================
// findDownloadedFLAC — tests via OrpheusDLService (same package)
// ============================================================================

func TestFindDownloadedFLAC_NotFound(t *testing.T) {
	svc := NewOrpheusDLService()
	_, err := svc.findDownloadedFLAC(t.TempDir())
	if err == nil {
		t.Fatal("expected error for empty directory, got nil")
	}
	if !strings.Contains(err.Error(), "no FLAC file found") {
		t.Errorf("error %q should mention 'no FLAC file found'", err.Error())
	}
}

func TestFindDownloadedFLAC_SingleFile(t *testing.T) {
	dir := t.TempDir()
	flacPath := filepath.Join(dir, "song.flac")
	if err := os.WriteFile(flacPath, []byte("FLACD"), 0600); err != nil {
		t.Fatal(err)
	}

	svc := NewOrpheusDLService()
	got, err := svc.findDownloadedFLAC(dir)
	if err != nil {
		t.Fatalf("findDownloadedFLAC() error: %v", err)
	}
	if got != flacPath {
		t.Errorf("got %q, want %q", got, flacPath)
	}
}

func TestFindDownloadedFLAC_NewestFile(t *testing.T) {
	dir := t.TempDir()

	older := filepath.Join(dir, "old.flac")
	newer := filepath.Join(dir, "new.flac")

	if err := os.WriteFile(older, []byte("old"), 0600); err != nil {
		t.Fatal(err)
	}
	// Ensure distinct mtimes by setting the older file's mtime 2 seconds in the past.
	pastTime := time.Now().Add(-2 * time.Second)
	if err := os.Chtimes(older, pastTime, pastTime); err != nil {
		t.Fatal(err)
	}

	if err := os.WriteFile(newer, []byte("new"), 0600); err != nil {
		t.Fatal(err)
	}

	svc := NewOrpheusDLService()
	got, err := svc.findDownloadedFLAC(dir)
	if err != nil {
		t.Fatalf("findDownloadedFLAC() error: %v", err)
	}
	if got != newer {
		t.Errorf("got %q, want %q (newest)", got, newer)
	}
}
