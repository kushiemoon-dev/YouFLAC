package app

import (
	"reflect"
	"testing"

	core "github.com/kushiemoon-dev/youflac-core/v4"
)

// TestGetQobuzProviders_ReflectsConfig verifies the Wails-bound method
// reports the runtime-configured provider names (Config.QobuzProxyProviders
// / QobuzProvidersDisabled) instead of a hardcoded list.
func TestGetQobuzProviders_ReflectsConfig(t *testing.T) {
	a := &App{config: &core.Config{
		QobuzProxyProviders:    []string{"dab", "musicdl"},
		QobuzProvidersDisabled: []string{"musicdl"},
	}}

	result := a.GetQobuzProviders()

	available, _ := result["available"].([]string)
	if !reflect.DeepEqual(available, []string{"dab", "musicdl"}) {
		t.Errorf("available = %v, want [dab musicdl]", available)
	}
	disabled, _ := result["disabled"].([]string)
	if !reflect.DeepEqual(disabled, []string{"musicdl"}) {
		t.Errorf("disabled = %v, want [musicdl]", disabled)
	}
}

// TestGetQobuzProviders_EmptyConfigReturnsEmptyLists verifies the honest
// default (no providers configured -> empty lists, not a fake "all 4 known
// providers" list).
func TestGetQobuzProviders_EmptyConfigReturnsEmptyLists(t *testing.T) {
	a := &App{config: &core.Config{}}

	result := a.GetQobuzProviders()

	available, _ := result["available"].([]string)
	if len(available) != 0 {
		t.Errorf("available = %v, want empty", available)
	}
	disabled, _ := result["disabled"].([]string)
	if len(disabled) != 0 {
		t.Errorf("disabled = %v, want empty", disabled)
	}
}
