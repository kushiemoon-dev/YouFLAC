package backend

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// lucidaSuccessJSON builds a JSON response for lucida API with the given download URL.
func lucidaSuccessJSON(downloadURL string) string {
	return fmt.Sprintf(`{
		"success": true,
		"track": {
			"id": "track123",
			"title": "Test Track",
			"artist": "Test Artist",
			"album": "Test Album",
			"duration": 240.0,
			"isrc": "USABC1234567",
			"platform": "tidal"
		},
		"formats": [
			{"format": "flac", "quality": "lossless", "size": 1024, "url": %q},
			{"format": "mp3",  "quality": "320kbps",  "size": 512,  "url": %q}
		]
	}`, downloadURL, downloadURL)
}

// newLucidaSvc creates a LucidaService wired to the given test servers.
// All servers must be reachable via http.DefaultClient (localhost).
func newLucidaSvc(endpoints ...string) *LucidaService {
	return &LucidaService{
		client:    http.DefaultClient,
		endpoints: endpoints,
	}
}

// newLucidaSvcClient creates a LucidaService using the test server's own client
// (useful for single-server tests to avoid TLS issues).
func newLucidaSvcClient(ts *httptest.Server) *LucidaService {
	return &LucidaService{
		client:    ts.Client(),
		endpoints: []string{ts.URL},
	}
}

// ============================================================================
// Name
// ============================================================================

func TestLucidaService_Name(t *testing.T) {
	svc := &LucidaService{client: http.DefaultClient, endpoints: []string{"http://localhost"}}
	if got := svc.Name(); got != "lucida" {
		t.Errorf("Name() = %q, want %q", got, "lucida")
	}
}

// ============================================================================
// IsAvailable
// ============================================================================

func TestLucidaService_IsAvailable_Up(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer ts.Close()

	svc := newLucidaSvcClient(ts)
	if !svc.IsAvailable() {
		t.Error("expected IsAvailable() == true for HTTP 200")
	}
}

func TestLucidaService_IsAvailable_ServerError(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer ts.Close()

	svc := newLucidaSvcClient(ts)
	if svc.IsAvailable() {
		t.Error("expected IsAvailable() == false for HTTP 503")
	}
}

func TestLucidaService_IsAvailable_FallsBackToSecond(t *testing.T) {
	ts1 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer ts1.Close()

	ts2 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer ts2.Close()

	svc := newLucidaSvc(ts1.URL, ts2.URL)
	if !svc.IsAvailable() {
		t.Error("expected IsAvailable() == true when second endpoint returns 200")
	}
}

func TestLucidaService_IsAvailable_AllEndpointsFail(t *testing.T) {
	ts1 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer ts1.Close()

	ts2 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer ts2.Close()

	svc := newLucidaSvc(ts1.URL, ts2.URL)
	if svc.IsAvailable() {
		t.Error("expected IsAvailable() == false when all endpoints return 500")
	}
}

// ============================================================================
// GetTrackInfo
// ============================================================================

func TestLucidaService_GetTrackInfo_Success(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" || !strings.HasSuffix(r.URL.Path, lucidaAPIPath) {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, lucidaSuccessJSON("http://example.com/file.flac"))
	}))
	defer ts.Close()

	svc := newLucidaSvcClient(ts)
	info, err := svc.GetTrackInfo("https://tidal.com/browse/track/12345")
	if err != nil {
		t.Fatalf("GetTrackInfo() error: %v", err)
	}
	if info.Title != "Test Track" {
		t.Errorf("Title = %q, want %q", info.Title, "Test Track")
	}
	if info.Artist != "Test Artist" {
		t.Errorf("Artist = %q, want %q", info.Artist, "Test Artist")
	}
	if info.ISRC != "USABC1234567" {
		t.Errorf("ISRC = %q, want %q", info.ISRC, "USABC1234567")
	}
	if info.Duration != 240.0 {
		t.Errorf("Duration = %v, want 240.0", info.Duration)
	}
}

func TestLucidaService_GetTrackInfo_APIError(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"success": false, "error": "track not found"}`)
	}))
	defer ts.Close()

	svc := newLucidaSvcClient(ts)
	_, err := svc.GetTrackInfo("https://tidal.com/browse/track/99999")
	if err == nil {
		t.Fatal("expected error for success:false response, got nil")
	}
	if !strings.Contains(err.Error(), "API error") {
		t.Errorf("error %q should mention 'API error'", err.Error())
	}
}

func TestLucidaService_GetTrackInfo_AllEndpointsFail(t *testing.T) {
	ts1 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer ts1.Close()

	ts2 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer ts2.Close()

	svc := newLucidaSvc(ts1.URL, ts2.URL)
	_, err := svc.GetTrackInfo("https://tidal.com/browse/track/1")
	if err == nil {
		t.Fatal("expected error when all endpoints fail")
	}
	if !strings.Contains(err.Error(), "all lucida endpoints failed") {
		t.Errorf("error %q should mention 'all lucida endpoints failed'", err.Error())
	}
}

func TestLucidaService_GetTrackInfo_EndpointFallback(t *testing.T) {
	ts1 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer ts1.Close()

	ts2 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, lucidaSuccessJSON("http://example.com/file.flac"))
	}))
	defer ts2.Close()

	svc := newLucidaSvc(ts1.URL, ts2.URL)
	info, err := svc.GetTrackInfo("https://tidal.com/browse/track/1")
	if err != nil {
		t.Fatalf("GetTrackInfo() error after fallback: %v", err)
	}
	if info.Title != "Test Track" {
		t.Errorf("Title = %q, want %q", info.Title, "Test Track")
	}
}

// ============================================================================
// Download
// ============================================================================

// newFileServer starts a test server that serves fake FLAC content.
func newFileServer(t *testing.T, content []byte) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "audio/flac")
		w.WriteHeader(http.StatusOK)
		w.Write(content) //nolint:errcheck
	}))
}

func TestLucidaService_Download_ExactFormatMatch(t *testing.T) {
	fileContent := []byte("fake flac binary content")
	fileServer := newFileServer(t, fileContent)
	defer fileServer.Close()

	apiServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		// Both formats point to the same file server; test verifies FLAC is chosen.
		fmt.Fprintf(w, `{
			"success": true,
			"track": {"id":"1","title":"Test Track","artist":"Test Artist"},
			"formats": [
				{"format": "flac", "quality": "lossless", "size": 100, "url": %q},
				{"format": "mp3",  "quality": "320kbps",  "size": 50,  "url": %q}
			]
		}`, fileServer.URL+"/file.flac", fileServer.URL+"/file.mp3")
	}))
	defer apiServer.Close()

	svc := newLucidaSvc(apiServer.URL)
	result, err := svc.Download("https://tidal.com/browse/track/1", t.TempDir(), "flac")
	if err != nil {
		t.Fatalf("Download() error: %v", err)
	}
	if !strings.EqualFold(result.Format, "flac") {
		t.Errorf("Format = %q, want flac", result.Format)
	}
}

func TestLucidaService_Download_FallbackFromFLAC(t *testing.T) {
	fileContent := []byte("fake mp3 content")
	fileServer := newFileServer(t, fileContent)
	defer fileServer.Close()

	apiServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		// Only MP3 available; requesting FLAC should fall back to MP3.
		fmt.Fprintf(w, `{
			"success": true,
			"track": {"id":"1","title":"Test Track","artist":"Test Artist"},
			"formats": [
				{"format": "mp3", "quality": "320kbps", "size": 50, "url": %q}
			]
		}`, fileServer.URL+"/file.mp3")
	}))
	defer apiServer.Close()

	svc := newLucidaSvc(apiServer.URL)
	result, err := svc.Download("https://tidal.com/browse/track/1", t.TempDir(), "flac")
	if err != nil {
		t.Fatalf("Download() error: %v", err)
	}
	if !strings.EqualFold(result.Format, "mp3") {
		t.Errorf("Format = %q, want mp3 (fallback)", result.Format)
	}
}

func TestLucidaService_Download_WriteToTempDir(t *testing.T) {
	fileContent := []byte("binary flac data 0xFLAC")
	fileServer := newFileServer(t, fileContent)
	defer fileServer.Close()

	apiServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{
			"success": true,
			"track": {"id":"1","title":"Song","artist":"Band"},
			"formats": [
				{"format": "flac", "quality": "lossless", "size": 100, "url": %q}
			]
		}`, fileServer.URL+"/song.flac")
	}))
	defer apiServer.Close()

	outDir := t.TempDir()
	svc := newLucidaSvc(apiServer.URL)
	result, err := svc.Download("https://tidal.com/browse/track/1", outDir, "flac")
	if err != nil {
		t.Fatalf("Download() error: %v", err)
	}

	// Verify file exists inside outDir
	if !strings.HasPrefix(result.FilePath, outDir) {
		t.Errorf("FilePath %q not inside outDir %q", result.FilePath, outDir)
	}
	data, err := os.ReadFile(filepath.Clean(result.FilePath))
	if err != nil {
		t.Fatalf("could not read downloaded file: %v", err)
	}
	if string(data) != string(fileContent) {
		t.Errorf("file content mismatch: got %q, want %q", data, fileContent)
	}
}
