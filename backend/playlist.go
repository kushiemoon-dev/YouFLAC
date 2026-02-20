package backend

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// GenerateM3U8 creates an .m3u8 playlist file from a slice of completed queue items.
// Only items with a non-empty OutputPath are included.
// The playlist is written to outputDir/<playlistName>.m3u8.
// Paths in the playlist are relative to outputDir.
func GenerateM3U8(items []QueueItem, outputDir, playlistName string) error {
	if len(items) == 0 {
		return nil
	}

	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	safeName := SanitizeFileName(playlistName)
	if safeName == "" {
		safeName = "playlist"
	}
	m3u8Path := filepath.Join(outputDir, safeName+".m3u8")

	var sb strings.Builder
	sb.WriteString("#EXTM3U\n")

	for _, item := range items {
		if item.OutputPath == "" {
			continue
		}

		// Compute path relative to outputDir for portability
		rel, err := filepath.Rel(outputDir, item.OutputPath)
		if err != nil {
			rel = item.OutputPath // fallback to absolute
		}

		duration := int(item.Duration)
		if duration <= 0 {
			duration = -1 // unknown
		}

		trackInfo := item.Title
		if item.Artist != "" {
			trackInfo = item.Artist + " - " + item.Title
		}

		sb.WriteString(fmt.Sprintf("#EXTINF:%d,%s\n", duration, trackInfo))
		sb.WriteString(rel + "\n")
	}

	return os.WriteFile(m3u8Path, []byte(sb.String()), 0644)
}
