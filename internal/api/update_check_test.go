package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHandleUpdateCheck_NewVersionAvailable(t *testing.T) {
	// Mock GitHub API returning a newer version
	gh := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
	gh := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
