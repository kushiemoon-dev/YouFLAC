package main

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"

	core "github.com/kushiemoon-dev/youflac-core/v4"
)

// AnalyzeAudio mirrors internal/api/handlers_analyzer.go's handleAnalyzeAudio.
func (a *App) AnalyzeAudio(filePath string) (*core.AudioAnalysis, error) {
	return core.AnalyzeAudio(filePath)
}

// ============== Lyrics (mirrors internal/api/handlers_lyrics.go) ==============

// FetchLyrics mirrors handleFetchLyrics. When album is non-empty it uses
// core.FetchLyricsWithAlbum, otherwise core.FetchLyrics.
func (a *App) FetchLyrics(artist, title, album string) (*core.LyricsResult, error) {
	if album != "" {
		return core.FetchLyricsWithAlbum(artist, title, album)
	}
	return core.FetchLyrics(artist, title)
}

// EmbedLyrics mirrors handleEmbedLyrics.
func (a *App) EmbedLyrics(mediaPath string, lyrics core.LyricsResult) error {
	return core.EmbedLyricsInFile(mediaPath, &lyrics)
}

// SaveLRCFile mirrors handleSaveLRCFile.
func (a *App) SaveLRCFile(mediaPath string, lyrics core.LyricsResult) (string, error) {
	return core.SaveLRCFile(&lyrics, mediaPath)
}

// GenerateSpectrogram mirrors handleGenerateSpectrogram + handleGetImage
// collapsed into a single round-trip: it generates the spectrogram PNG to a
// temp file, reads it back immediately, and returns it as a base64 data URL.
func (a *App) GenerateSpectrogram(filePath string) (string, error) {
	tempDir := os.TempDir()
	outputPath := filepath.Join(tempDir, "spectrogram_"+filepath.Base(filePath)+".png")

	if err := core.GenerateSpectrogram(filePath, outputPath); err != nil {
		return "", err
	}

	return readImageAsDataURL(outputPath)
}

// GenerateWaveform mirrors handleGenerateWaveform + handleGetImage collapsed
// into a single round-trip: it generates the waveform PNG to a temp file,
// reads it back immediately, and returns it as a base64 data URL.
func (a *App) GenerateWaveform(filePath string) (string, error) {
	tempDir := os.TempDir()
	outputPath := filepath.Join(tempDir, "waveform_"+filepath.Base(filePath)+".png")

	if err := core.GenerateWaveform(filePath, outputPath); err != nil {
		return "", err
	}

	return readImageAsDataURL(outputPath)
}

// GetImage mirrors handleGetImage. Unlike the spectrogram/waveform duo above,
// this is still needed standalone: the frontend also calls it for arbitrary
// paths unrelated to analysis (e.g. FileManager poster/thumbnail images), so
// it can't be folded away.
func (a *App) GetImage(path string) (string, error) {
	// Security: resolve the real path and check it's within allowed
	// directories. filepath.Abs normalizes ".." traversal sequences before
	// we compare (same policy as the HTTP handler).
	absPath, err := filepath.Abs(path)
	if err != nil {
		return "", os.ErrPermission
	}

	absTemp, _ := filepath.Abs(os.TempDir())
	absOutput := a.config.OutputDirectory
	if absOutput == "" {
		absOutput = core.GetDefaultOutputDirectory()
	}
	absOutput, _ = filepath.Abs(absOutput)

	// Ensure the separator-terminated prefix so "/tmp" doesn't match "/tmpother"
	if !strings.HasPrefix(absPath, absTemp+string(filepath.Separator)) &&
		!strings.HasPrefix(absPath, absOutput+string(filepath.Separator)) {
		return "", os.ErrPermission
	}

	return readImageAsDataURL(absPath)
}

// readImageAsDataURL reads an image file and encodes it as a data URL, using
// the same mime-type detection as the former handleGetImage HTTP handler.
func readImageAsDataURL(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}

	ext := strings.ToLower(filepath.Ext(path))
	mimeType := "image/png"
	if ext == ".jpg" || ext == ".jpeg" {
		mimeType = "image/jpeg"
	}

	return "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(data), nil
}
