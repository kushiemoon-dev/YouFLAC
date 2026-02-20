package backend

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// EmbedMetadata adds/updates metadata in existing MKV using mkvpropedit or ffmpeg
func EmbedMetadata(mkvPath string, metadata map[string]string) error {
	if _, err := os.Stat(mkvPath); os.IsNotExist(err) {
		return fmt.Errorf("file not found: %s", mkvPath)
	}

	// Try mkvpropedit first (more reliable for MKV)
	mkvpropeditPath, err := exec.LookPath("mkvpropedit")
	if err == nil {
		return embedMetadataMkvpropedit(mkvPath, metadata, mkvpropeditPath)
	}

	// Fall back to ffmpeg (requires re-mux)
	return embedMetadataFFmpeg(mkvPath, metadata)
}

func embedMetadataMkvpropedit(mkvPath string, metadata map[string]string, mkvpropeditPath string) error {
	// For full metadata, use --edit info
	args := []string{mkvPath, "--edit", "info"}
	for key, value := range metadata {
		if value != "" {
			switch strings.ToLower(key) {
			case "title":
				args = append(args, "--set", fmt.Sprintf("title=%s", value))
			case "artist":
				// MKV doesn't have a standard artist field in segment info
			case "album":
				// Same as artist
			}
		}
	}

	cmd := exec.Command(mkvpropeditPath, args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("mkvpropedit failed: %v - %s", err, stderr.String())
	}

	return nil
}

func embedMetadataFFmpeg(mkvPath string, metadata map[string]string) error {
	// FFmpeg requires re-muxing to change metadata
	tempPath := mkvPath + ".tmp"

	args := []string{
		"-y",
		"-i", mkvPath,
		"-c", "copy",
	}

	for key, value := range metadata {
		if value != "" {
			args = append(args, "-metadata", fmt.Sprintf("%s=%s", key, value))
		}
	}

	args = append(args, tempPath)

	cmd := exec.Command(GetFFmpegPath(), args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		os.Remove(tempPath)
		return fmt.Errorf("ffmpeg metadata failed: %v - %s", err, stderr.String())
	}

	// Replace original with temp
	if err := os.Rename(tempPath, mkvPath); err != nil {
		os.Remove(tempPath)
		return fmt.Errorf("failed to replace file: %w", err)
	}

	return nil
}

// EmbedCoverArt adds cover art to existing MKV
func EmbedCoverArt(mkvPath, coverPath string) error {
	if _, err := os.Stat(mkvPath); os.IsNotExist(err) {
		return fmt.Errorf("mkv file not found: %s", mkvPath)
	}
	if _, err := os.Stat(coverPath); os.IsNotExist(err) {
		return fmt.Errorf("cover file not found: %s", coverPath)
	}

	// Try mkvpropedit first
	mkvpropeditPath, err := exec.LookPath("mkvpropedit")
	if err == nil {
		return embedCoverMkvpropedit(mkvPath, coverPath, mkvpropeditPath)
	}

	// Fall back to ffmpeg
	return embedCoverFFmpeg(mkvPath, coverPath)
}

func embedCoverMkvpropedit(mkvPath, coverPath, mkvpropeditPath string) error {
	args := []string{
		mkvPath,
		"--add-attachment", coverPath,
	}

	cmd := exec.Command(mkvpropeditPath, args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("mkvpropedit cover failed: %v - %s", err, stderr.String())
	}

	return nil
}

func embedCoverFFmpeg(mkvPath, coverPath string) error {
	tempPath := mkvPath + ".tmp"

	args := []string{
		"-y",
		"-i", mkvPath,
		"-i", coverPath,
		"-map", "0",
		"-map", "1:0",
		"-c", "copy",
		"-c:v:1", "mjpeg",
		"-disposition:v:1", "attached_pic",
		tempPath,
	}

	cmd := exec.Command(GetFFmpegPath(), args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		os.Remove(tempPath)
		return fmt.Errorf("ffmpeg cover failed: %v - %s", err, stderr.String())
	}

	if err := os.Rename(tempPath, mkvPath); err != nil {
		os.Remove(tempPath)
		return fmt.Errorf("failed to replace file: %w", err)
	}

	return nil
}

// AddChapters adds chapter markers to MKV
func AddChapters(mkvPath string, chapters []Chapter) error {
	if len(chapters) == 0 {
		return nil
	}

	// Create chapters file in XML format for mkvpropedit
	chaptersFile, err := os.CreateTemp("", "chapters-*.xml")
	if err != nil {
		return fmt.Errorf("failed to create chapters file: %w", err)
	}
	defer os.Remove(chaptersFile.Name())

	var xml strings.Builder
	xml.WriteString(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE Chapters SYSTEM "matroskachapters.dtd">
<Chapters>
  <EditionEntry>
`)
	for i, ch := range chapters {
		startNs := int64(ch.StartTime * 1e9)
		endNs := int64(ch.EndTime * 1e9)
		xml.WriteString(fmt.Sprintf(`    <ChapterAtom>
      <ChapterUID>%d</ChapterUID>
      <ChapterTimeStart>%d</ChapterTimeStart>
      <ChapterTimeEnd>%d</ChapterTimeEnd>
      <ChapterDisplay>
        <ChapterString>%s</ChapterString>
        <ChapterLanguage>eng</ChapterLanguage>
      </ChapterDisplay>
    </ChapterAtom>
`, i+1, startNs, endNs, ch.Title))
	}
	xml.WriteString(`  </EditionEntry>
</Chapters>
`)

	if _, err := chaptersFile.WriteString(xml.String()); err != nil {
		return err
	}
	chaptersFile.Close()

	// mkvpropedit required — no ffmpeg fallback for chapters
	mkvpropeditPath, err := exec.LookPath("mkvpropedit")
	if err != nil {
		return fmt.Errorf("mkvpropedit not found, chapters require mkvtoolnix")
	}

	args := []string{
		mkvPath,
		"--chapters", chaptersFile.Name(),
	}

	cmd := exec.Command(mkvpropeditPath, args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("mkvpropedit chapters failed: %v - %s", err, stderr.String())
	}

	return nil
}
