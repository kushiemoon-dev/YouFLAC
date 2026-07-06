package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	core "github.com/kushiemoon-dev/youflac-core/v4"
)

// makePlaylistFixture creates the on-disk shape produced by a real playlist
// download: outputDir/PlaylistName/NN - Artist - Title/NN - Artist - Title.ext
func makePlaylistFixture(t *testing.T, outputDir, playlistName, trackDirName, ext string) string {
	t.Helper()
	trackDir := filepath.Join(outputDir, playlistName, trackDirName)
	if err := os.MkdirAll(trackDir, 0755); err != nil {
		t.Fatal(err)
	}
	mediaPath := filepath.Join(trackDir, trackDirName+ext)
	if err := os.WriteFile(mediaPath, []byte("dummy"), 0644); err != nil {
		t.Fatal(err)
	}
	return mediaPath
}

func TestHandleGetPlaylistFolders_DetectsNestedTrackStructure(t *testing.T) {
	outputDir := t.TempDir()
	makePlaylistFixture(t, outputDir, "MyPlaylist", "01 - Artist - Title", ".flac")

	s := newTestServer(t)
	s.config.OutputDirectory = outputDir

	req := httptest.NewRequest(http.MethodGet, "/api/files/playlists", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	var folders []string
	json.NewDecoder(resp.Body).Decode(&folders)
	if len(folders) != 1 || folders[0] != "MyPlaylist" {
		t.Fatalf("got %v, want [MyPlaylist]", folders)
	}
}

func TestHandleFlattenPlaylist_MovesFilesUpAndRemovesEmptyDir(t *testing.T) {
	outputDir := t.TempDir()
	mediaPath := makePlaylistFixture(t, outputDir, "MyPlaylist", "01 - Artist - Title", ".flac")
	trackDir := filepath.Dir(mediaPath)

	s := newTestServer(t)
	s.config.OutputDirectory = outputDir

	body, _ := json.Marshal(map[string]string{"folderPath": "MyPlaylist"})
	req := httptest.NewRequest(http.MethodPost, "/api/files/flatten", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	var result FlattenResult
	json.NewDecoder(resp.Body).Decode(&result)
	if result.Moved != 1 || len(result.Errors) != 0 {
		t.Fatalf("got moved=%d errors=%v", result.Moved, result.Errors)
	}

	flatPath := filepath.Join(outputDir, "MyPlaylist", "01 - Artist - Title.flac")
	if _, err := os.Stat(flatPath); err != nil {
		t.Fatalf("expected file at %s: %v", flatPath, err)
	}
	if _, err := os.Stat(trackDir); !os.IsNotExist(err) {
		t.Fatalf("expected empty track dir %s to be removed", trackDir)
	}
}

func TestHandleReorganizePlaylist_UsesFolderNameFallbackAndPreservesExtension(t *testing.T) {
	outputDir := t.TempDir()
	// ffprobe will fail on this dummy file, forcing the folder-name fallback.
	makePlaylistFixture(t, outputDir, "MyPlaylist", "01 - Artist - Title", ".flac")

	s := newTestServer(t)
	s.config.OutputDirectory = outputDir
	s.config.NamingTemplate = core.DefaultTemplate // "{artist}/{title}/{title}"

	body, _ := json.Marshal(map[string]string{"folderPath": "MyPlaylist"})
	req := httptest.NewRequest(http.MethodPost, "/api/files/reorganize", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	var result ReorganizeResult
	json.NewDecoder(resp.Body).Decode(&result)
	if result.Renamed != 1 || len(result.Errors) != 0 {
		t.Fatalf("got renamed=%d errors=%v", result.Renamed, result.Errors)
	}

	// The extension must stay .flac, not be forced to .mkv.
	wantPath := filepath.Join(outputDir, "Artist", "Title", "Title.flac")
	if _, err := os.Stat(wantPath); err != nil {
		t.Fatalf("expected file at %s: %v", wantPath, err)
	}
}

func TestHandleReorganizeAndFlattenPlaylist_RejectPathTraversal(t *testing.T) {
	outputDir := t.TempDir()
	// A sibling directory outside outputDir that a traversal payload could reach.
	secret := filepath.Join(filepath.Dir(outputDir), "secret-outside-outputdir")
	if err := os.MkdirAll(secret, 0755); err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(secret)

	s := newTestServer(t)
	s.config.OutputDirectory = outputDir

	payloads := []string{"../secret-outside-outputdir", "/etc", "..", "a/../../secret-outside-outputdir"}
	endpoints := []string{"/api/files/reorganize", "/api/files/flatten"}

	for _, endpoint := range endpoints {
		for _, payload := range payloads {
			body, _ := json.Marshal(map[string]string{"folderPath": payload})
			req := httptest.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			resp, err := s.app.Test(req, 5000)
			if err != nil {
				t.Fatal(err)
			}
			if resp.StatusCode != http.StatusBadRequest {
				t.Errorf("%s folderPath=%q: got status %d, want 400", endpoint, payload, resp.StatusCode)
			}
		}
	}
}

func TestHandleListFiles_ListsFilesWithDetectedTypes(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{"song.flac", "video.mkv", "notes.txt"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("data"), 0644); err != nil {
			t.Fatal(err)
		}
	}

	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/files?dir="+dir, nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var files []FileInfo
	json.NewDecoder(resp.Body).Decode(&files)
	if len(files) != 3 {
		t.Fatalf("expected 3 files, got %d: %+v", len(files), files)
	}
	types := map[string]string{}
	for _, f := range files {
		types[f.Name] = f.Type
	}
	if types["song.flac"] != "audio" || types["video.mkv"] != "video" || types["notes.txt"] != "other" {
		t.Errorf("unexpected type mapping: %+v", types)
	}
}

func TestHandleListFiles_FiltersByExtension(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{"song.flac", "video.mkv"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("data"), 0644); err != nil {
			t.Fatal(err)
		}
	}

	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/files?dir="+dir+"&filter=.flac", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	var files []FileInfo
	json.NewDecoder(resp.Body).Decode(&files)
	if len(files) != 1 || files[0].Name != "song.flac" {
		t.Fatalf("expected only song.flac, got %+v", files)
	}
}

func TestHandleListFiles_NonexistentDir(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/files?dir=/this/does/not/exist", nil)
	resp, err := s.app.Test(req, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", resp.StatusCode)
	}
}
