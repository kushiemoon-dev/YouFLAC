package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"

	core "github.com/kushiemoon-dev/youflac-core/v4"
)

// TestHandleGetQobuzProviders_ReflectsConfig verifies the endpoint reports
// the runtime-configured provider names (Config.QobuzProxyProviders /
// QobuzProvidersDisabled) instead of a hardcoded list.
func TestHandleGetQobuzProviders_ReflectsConfig(t *testing.T) {
	s := newTestServer(t)
	s.config.QobuzProxyProviders = []string{"dab", "musicdl"}
	s.config.QobuzProvidersDisabled = []string{"musicdl"}

	req := httptest.NewRequest(http.MethodGet, "/api/qobuz/providers", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var result struct {
		Available []string `json:"available"`
		Disabled  []string `json:"disabled"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	if !reflect.DeepEqual(result.Available, []string{"dab", "musicdl"}) {
		t.Errorf("available = %v, want [dab musicdl]", result.Available)
	}
	if !reflect.DeepEqual(result.Disabled, []string{"musicdl"}) {
		t.Errorf("disabled = %v, want [musicdl]", result.Disabled)
	}
}

// TestHandleGetQobuzProviders_EmptyConfigReturnsEmptyLists verifies the
// honest default (no providers configured -> empty lists, not a fake
// "all 4 known providers" list).
func TestHandleGetQobuzProviders_EmptyConfigReturnsEmptyLists(t *testing.T) {
	s := newTestServer(t)

	req := httptest.NewRequest(http.MethodGet, "/api/qobuz/providers", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	var result struct {
		Available []string `json:"available"`
		Disabled  []string `json:"disabled"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	if len(result.Available) != 0 {
		t.Errorf("available = %v, want empty", result.Available)
	}
	if len(result.Disabled) != 0 {
		t.Errorf("disabled = %v, want empty", result.Disabled)
	}
}

// TestHandleGetSources_NilSourceMgr_ReportsUninitialized verifies /api/sources
// distinguishes "engine not initialized" from "no sources available".
func TestHandleGetSources_NilSourceMgr_ReportsUninitialized(t *testing.T) {
	s := newTestServer(t) // sourceMgr is nil: SetEngineV4 was never called

	req := httptest.NewRequest(http.MethodGet, "/api/sources", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var result struct {
		Initialized bool              `json:"initialized"`
		Sources     []core.SourceInfo `json:"sources"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	if result.Initialized {
		t.Error("expected initialized=false when sourceMgr is nil")
	}
	if len(result.Sources) != 0 {
		t.Errorf("expected empty sources, got %v", result.Sources)
	}
}

// TestHandleGetSources_Initialized verifies the populated-engine case still
// reports initialized=true alongside the real source list.
func TestHandleGetSources_Initialized(t *testing.T) {
	s := newTestServer(t)
	sm := core.NewSourceManager()
	core.RegisterAllSources(core.GetDefaultConfig(), sm, nil)
	s.SetEngineV4(sm, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/sources", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var result struct {
		Initialized bool              `json:"initialized"`
		Sources     []core.SourceInfo `json:"sources"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	if !result.Initialized {
		t.Error("expected initialized=true when sourceMgr is set")
	}
	if len(result.Sources) == 0 {
		t.Error("expected non-empty sources")
	}
}
