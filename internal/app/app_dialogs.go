package app

import (
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

var audioFileFilters = []runtime.FileFilter{
	{DisplayName: "Audio Files", Pattern: "*.flac;*.wav;*.mp3;*.m4a;*.ogg;*.opus;*.aiff;*.alac"},
	{DisplayName: "All Files", Pattern: "*.*"},
}

// SelectAudioFile opens a native file picker for an existing audio file.
// Returns "" (no error) if the user cancels.
func (a *App) SelectAudioFile() (string, error) {
	return runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title:   "Select Audio File",
		Filters: audioFileFilters,
	})
}

// SelectDirectory opens a native folder picker.
// Returns "" (no error) if the user cancels.
func (a *App) SelectDirectory() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Folder",
	})
}

// SelectSaveAudioFile opens a native save-file picker for a new audio output
// file. defaultFilename pre-fills the file name (e.g. "output.flac").
// Returns "" (no error) if the user cancels.
func (a *App) SelectSaveAudioFile(defaultFilename string) (string, error) {
	return runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:                "Save Audio File",
		DefaultFilename:      defaultFilename,
		Filters:              audioFileFilters,
		CanCreateDirectories: true,
	})
}
