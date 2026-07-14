package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	core "github.com/kushiemoon-dev/youflac-core/v4"
)

func TestHandleHealth_OK(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	var result map[string]string
	json.NewDecoder(resp.Body).Decode(&result)
	if result["status"] != "ok" {
		t.Errorf("status: got %q, want ok", result["status"])
	}
	if result["version"] != AppVersion {
		t.Errorf("version: got %q, want %s", result["version"], AppVersion)
	}
}

func TestHandleGetVersion_OK(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/version", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	var result map[string]string
	json.NewDecoder(resp.Body).Decode(&result)
	if result["version"] != AppVersion {
		t.Errorf("version: got %q, want %s", result["version"], AppVersion)
	}
}

// TestHandleServicesStatus_OK exercises the real handler wiring. CheckServiceStatus
// probes real external endpoints (tidal.com, qobuz.com, ...) with a 10s timeout each,
// run in parallel — this may be slow/network-dependent but always returns 200 with a
// well-formed map regardless of reachability, so the test remains deterministic.
func TestHandleServicesStatus_OK(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/services/status", nil)
	resp, err := s.app.Test(req, 15000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	var result map[string]map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode: %v", err)
	}
	for _, svc := range []string{"tidal", "qobuz", "amazon", "deezer", "lucida"} {
		if _, ok := result[svc]; !ok {
			t.Errorf("expected %q in response", svc)
		}
	}
}

func TestHandleFFmpegStatus_OK(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/system/ffmpeg/status", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if _, ok := result["found"]; !ok {
		t.Error("expected 'found' key in response")
	}
}

func TestHandleGetLogs_ReturnsArray(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/logs", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	var entries []core.LogEntry
	if err := json.NewDecoder(resp.Body).Decode(&entries); err != nil {
		t.Fatalf("expected a JSON array, decode failed: %v", err)
	}
	if entries == nil {
		t.Error("expected non-nil (possibly empty) array, got null")
	}
}

func TestHandleUpdateCheck_NewVersionAvailable(t *testing.T) {
	// Mock GitHub API returning a newer version
	gh := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"tag_name":"v9.9.9","html_url":"https://github.com/kushiemoon-dev/YouFLAC/releases/tag/v9.9.9"}`)
	}))
	defer gh.Close()

	// Temporarily override the GitHub URL via the handler by patching the constant
	// We test by pointing the server's client at our mock via env-style indirection.
	// Since handleUpdateCheck uses http.DefaultClient and a hardcoded URL, we inject
	// a custom transport that redirects github API calls to our mock.
	orig := http.DefaultTransport
	http.DefaultTransport = &redirectTransport{target: gh.URL}
	defer func() { http.DefaultTransport = orig }()

	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/system/update-check", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatal(err)
	}

	if result["currentVersion"] != AppVersion {
		t.Errorf("currentVersion: got %v, want %s", result["currentVersion"], AppVersion)
	}
	if result["latestVersion"] != "9.9.9" {
		t.Errorf("latestVersion: got %v, want 9.9.9", result["latestVersion"])
	}
	if result["hasUpdate"] != true {
		t.Errorf("hasUpdate: got %v, want true", result["hasUpdate"])
	}
	if result["releaseUrl"] == "" {
		t.Error("releaseUrl should not be empty")
	}
}

func TestHandleUpdateCheck_GitHubError_GracefulDegradation(t *testing.T) {
	// Mock GitHub API returning 500
	gh := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer gh.Close()

	orig := http.DefaultTransport
	http.DefaultTransport = &redirectTransport{target: gh.URL}
	defer func() { http.DefaultTransport = orig }()

	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/system/update-check", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	// Must not return 5xx — graceful degradation
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 (graceful), got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatal(err)
	}

	if result["hasUpdate"] != false {
		t.Errorf("hasUpdate: got %v, want false", result["hasUpdate"])
	}
	if result["latestVersion"] != "" {
		t.Errorf("latestVersion: got %v, want empty string", result["latestVersion"])
	}
	if result["currentVersion"] != AppVersion {
		t.Errorf("currentVersion: got %v, want %s", result["currentVersion"], AppVersion)
	}
}

// redirectTransport rewrites all requests to point at target host,
// preserving the path, so our mock httptest.Server intercepts GitHub calls.
type redirectTransport struct {
	target string
}

func (rt *redirectTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	cloned := req.Clone(req.Context())
	cloned.URL.Scheme = "http"
	cloned.URL.Host = rt.target[len("http://"):]
	return (&http.Transport{}).RoundTrip(cloned)
}
