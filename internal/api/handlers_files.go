package api

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"

	core "github.com/kushiemoon-dev/youflac-core/v4"
)

// ============== Files Handlers ==============

type FileInfo struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	IsDir     bool   `json:"isDir"`
	Size      int64  `json:"size"`
	Extension string `json:"extension"`
	Type      string `json:"type"` // "video", "audio", "cover", "nfo", "other"
}

// getFileType determines the type of file based on its extension
func getFileType(ext string) string {
	ext = strings.ToLower(ext)
	switch ext {
	case ".mkv", ".mp4", ".webm", ".avi", ".mov":
		return "video"
	case ".flac", ".mp3", ".m4a", ".aac", ".ogg", ".opus", ".wav":
		return "audio"
	case ".jpg", ".jpeg", ".png", ".webp", ".gif":
		return "cover"
	case ".nfo":
		return "nfo"
	case ".lrc":
		return "lyrics"
	default:
		return "other"
	}
}

func (s *Server) handleListFiles(c *fiber.Ctx) error {
	dir := c.Query("dir")
	if dir == "" {
		dir = s.config.OutputDirectory
		if dir == "" {
			dir = core.GetDefaultOutputDirectory()
		}
	}

	filter := c.Query("filter") // e.g., ".mkv,.flac"

	entries, err := os.ReadDir(dir)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	files := []FileInfo{}
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}

		ext := strings.ToLower(filepath.Ext(entry.Name()))

		// Apply filter if specified
		if filter != "" {
			filters := strings.Split(filter, ",")
			matched := entry.IsDir() // Always include directories
			for _, f := range filters {
				if strings.ToLower(strings.TrimSpace(f)) == ext {
					matched = true
					break
				}
			}
			if !matched {
				continue
			}
		}

		files = append(files, FileInfo{
			Name:      entry.Name(),
			Path:      filepath.Join(dir, entry.Name()),
			IsDir:     entry.IsDir(),
			Size:      info.Size(),
			Extension: ext,
			Type:      getFileType(ext),
		})
	}

	return c.JSON(files)
}

// playlistTrackDirRe matches the leading track-number prefix that
// GeneratePlaylistFilePath gives each track's own subfolder, e.g.
// "01 - Artist - Title" -> track "01".
var playlistTrackDirRe = regexp.MustCompile(`^(\d+)\s*-\s*`)

func (s *Server) handleGetPlaylistFolders(c *fiber.Ctx) error {
	outputDir := s.config.OutputDirectory
	if outputDir == "" {
		outputDir = core.GetDefaultOutputDirectory()
	}

	folders := []string{}

	entries, err := os.ReadDir(outputDir)
	if err != nil {
		return c.JSON(folders) // Return empty if can't read
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		// A playlist folder's immediate children are per-track subfolders
		// named "01 - Artist - Title" (see GeneratePlaylistFilePath).
		subPath := filepath.Join(outputDir, entry.Name())
		subEntries, _ := os.ReadDir(subPath)
		for _, sub := range subEntries {
			if sub.IsDir() && playlistTrackDirRe.MatchString(sub.Name()) {
				folders = append(folders, entry.Name())
				break
			}
		}
	}

	return c.JSON(folders)
}

type ReorganizeResult struct {
	Success   bool     `json:"success"`
	Renamed   int      `json:"renamed"`
	Errors    []string `json:"errors,omitempty"`
	NewFolder string   `json:"newFolder,omitempty"`
}

type FlattenResult struct {
	Success bool     `json:"success"`
	Moved   int      `json:"moved"`
	Errors  []string `json:"errors,omitempty"`
}

// metadataFromPlaylistTrack builds naming metadata for a single track that
// was downloaded as part of a playlist. It prefers the tags ffmpeg embedded
// in the file at download time, falling back to the "NN - Artist - Title"
// track subfolder name when a tag is missing.
func metadataFromPlaylistTrack(mediaPath, trackDirName string) *core.Metadata {
	m := &core.Metadata{}

	if match := playlistTrackDirRe.FindStringSubmatch(trackDirName); match != nil {
		if n, err := strconv.Atoi(match[1]); err == nil {
			m.Track = n
		}
	}

	tags := core.ExtractAudioTags(mediaPath)
	m.Title = tags["title"]
	m.Artist = tags["artist"]
	m.Album = tags["album"]

	if m.Title == "" || m.Artist == "" {
		rest := playlistTrackDirRe.ReplaceAllString(trackDirName, "")
		if parts := strings.SplitN(rest, " - ", 2); len(parts) == 2 {
			if m.Artist == "" {
				m.Artist = strings.TrimSpace(parts[0])
			}
			if m.Title == "" {
				m.Title = strings.TrimSpace(parts[1])
			}
		}
	}

	return m
}

// resolvePlaylistDir validates folderPath as a plain, single-segment
// directory name (exactly what GetPlaylistFolders returns) and joins it under
// outputDir. Rejecting any path separator or ".." means the result can never
// escape outputDir, closing off path traversal via a crafted folderPath.
func resolvePlaylistDir(outputDir, folderPath string) (string, error) {
	if folderPath == "" || folderPath == "." || folderPath == ".." || strings.ContainsAny(folderPath, "/\\") {
		return "", fmt.Errorf("invalid folder path")
	}
	return filepath.Join(outputDir, folderPath), nil
}

// handleReorganizePlaylist moves each track out of a playlist download
// (outputDir/PlaylistName/NN - Artist - Title/NN - Artist - Title.ext) into
// the app's regular NamingTemplate layout, using the file's embedded tags.
func (s *Server) handleReorganizePlaylist(c *fiber.Ctx) error {
	var body struct {
		FolderPath string `json:"folderPath"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	outputDir := s.config.OutputDirectory
	if outputDir == "" {
		outputDir = core.GetDefaultOutputDirectory()
	}
	playlistDir, err := resolvePlaylistDir(outputDir, body.FolderPath)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	trackDirs, err := os.ReadDir(playlistDir)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	result := ReorganizeResult{Success: true}
	for _, trackDir := range trackDirs {
		if !trackDir.IsDir() {
			continue
		}
		trackPath := filepath.Join(playlistDir, trackDir.Name())
		files, _ := os.ReadDir(trackPath)
		for _, f := range files {
			ext := strings.ToLower(filepath.Ext(f.Name()))
			if f.IsDir() || (ext != ".mkv" && ext != ".flac") {
				continue
			}
			mediaPath := filepath.Join(trackPath, f.Name())
			metadata := metadataFromPlaylistTrack(mediaPath, trackDir.Name())

			// NB: core.RenameMKV hardcodes a ".mkv" destination extension, which
			// would corrupt the audio-only ".flac" fallback output — build the
			// destination path directly instead, preserving the real extension.
			newPath := core.GenerateFilePath(metadata, s.config.NamingTemplate, outputDir, ext)
			if newPath == mediaPath {
				continue
			}
			if conflict, _ := core.CheckFileConflict(newPath); conflict {
				result.Errors = append(result.Errors, fmt.Sprintf("%s: destination already exists", f.Name()))
				continue
			}
			if err := core.CreateDirectoryStructure(newPath); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("%s: %v", f.Name(), err))
				continue
			}
			if err := os.Rename(mediaPath, newPath); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("%s: %v", f.Name(), err))
				continue
			}
			result.Renamed++
			if s.config.GenerateNFO {
				core.WriteNFO(metadata, core.GenerateNFOPath(newPath), nil) // best-effort
			}
		}
	}

	return c.JSON(result)
}

// handleFlattenPlaylist moves each track's file up out of its per-track
// subfolder into the playlist folder root, e.g.
// "PlaylistName/01 - Artist - Title/01 - Artist - Title.mkv" ->
// "PlaylistName/01 - Artist - Title.mkv".
func (s *Server) handleFlattenPlaylist(c *fiber.Ctx) error {
	var body struct {
		FolderPath string `json:"folderPath"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	outputDir := s.config.OutputDirectory
	if outputDir == "" {
		outputDir = core.GetDefaultOutputDirectory()
	}
	playlistDir, err := resolvePlaylistDir(outputDir, body.FolderPath)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	trackDirs, err := os.ReadDir(playlistDir)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	result := FlattenResult{Success: true}
	for _, trackDir := range trackDirs {
		if !trackDir.IsDir() {
			continue
		}
		trackPath := filepath.Join(playlistDir, trackDir.Name())
		files, _ := os.ReadDir(trackPath)
		for _, f := range files {
			if f.IsDir() {
				continue
			}
			src := filepath.Join(trackPath, f.Name())
			dst := filepath.Join(playlistDir, f.Name())
			if conflict, _ := core.CheckFileConflict(dst); conflict {
				result.Errors = append(result.Errors, fmt.Sprintf("%s: destination already exists", f.Name()))
				continue
			}
			if err := os.Rename(src, dst); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("%s: %v", f.Name(), err))
				continue
			}
			result.Moved++
		}
		os.Remove(trackPath) // no-op if not empty (a file was skipped above)
	}

	return c.JSON(result)
}
