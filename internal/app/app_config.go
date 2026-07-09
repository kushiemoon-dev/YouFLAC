package app

import (
	"errors"
	"fmt"

	core "github.com/kushiemoon-dev/youflac-core/v4"
	"github.com/kushiemoon-dev/youflac-core/v4/validate"
)

// ============== Config Methods ==============
// Mirrors internal/api/handlers_config.go, exposed as Wails-bound methods.

func (a *App) GetConfig() (*core.Config, error) {
	return core.LoadConfig()
}

func (a *App) SaveConfig(config core.Config) error {
	if err := validate.ValidateOutputDirectory(config.OutputDirectory); err != nil {
		return fmt.Errorf("Invalid output directory: %w", err)
	}

	if len(config.AudioSourcePriority) > 0 {
		if err := validate.ValidateAudioSources(config.AudioSourcePriority); err != nil {
			return fmt.Errorf("Invalid audio source priority: %w", err)
		}
	}

	if err := core.SaveConfig(&config); err != nil {
		return err
	}

	// Update in-memory config, since there's no server restart to reload it.
	a.config = &config
	core.SetCookiesBrowser(config.CookiesBrowser)

	return nil
}

func (a *App) GetDefaultOutputDirectory() string {
	return core.GetDefaultOutputDirectory()
}

// ============== History Methods ==============
// Mirrors internal/api/handlers_history.go, exposed as Wails-bound methods.

func (a *App) GetHistory() []core.HistoryEntry {
	return a.history.GetAll()
}

func (a *App) GetHistoryStats() core.HistoryStats {
	return a.history.GetStats()
}

// SearchHistory covers the three frontend wrappers (SearchHistory,
// FilterHistoryBySource, FilterHistoryByStatus) that all targeted the same
// GET /api/history/search endpoint with different query params. The
// frontend maps each wrapper onto this single method, passing empty
// strings for the params it doesn't use.
func (a *App) SearchHistory(query, source, status string) []core.HistoryEntry {
	switch {
	case query != "":
		return a.history.Search(query)
	case source != "":
		return a.history.FilterBySource(source)
	case status != "":
		return a.history.FilterByStatus(status)
	default:
		return a.history.GetAll()
	}
}

func (a *App) DeleteHistoryEntry(id string) error {
	return a.history.Delete(id)
}

func (a *App) ClearHistory() error {
	return a.history.Clear()
}

func (a *App) RedownloadFromHistory(id string) (string, error) {
	entries := a.history.GetAll()
	var entry *core.HistoryEntry
	for _, e := range entries {
		if e.ID == id {
			entry = &e
			break
		}
	}

	if entry == nil {
		return "", errors.New("history entry not found")
	}

	req := core.DownloadRequest{
		VideoURL: entry.VideoURL,
		Quality:  entry.Quality,
	}

	return a.queue.AddToQueue(req)
}
