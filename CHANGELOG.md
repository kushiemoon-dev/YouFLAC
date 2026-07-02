# Changelog

## v4.3.0 — 2026-07-03

### New features
- **Reorganize/Flatten playlist tools actually work** — both were stubs that always reported "success, 0 moved"; `Reorganize` now moves each track into the regular `NamingTemplate` layout using its embedded tags, `Flatten` collapses the per-track subfolders a playlist download creates.
- **Jellyfin scan trigger** — Settings → Advanced → Media Server adds an enable toggle, server URL, and API key; triggers a debounced library scan a few seconds after a completed download.

### Fixes
- `GetPlaylistFolders` looked for numbered files directly under the playlist folder, but real playlist downloads nest one subfolder per track — it never matched anything, so the Reorganize/Flatten buttons never had a folder to act on.
- Path traversal: `Reorganize`/`Flatten` took `folderPath` straight from the request body with no validation, letting a crafted path escape the output directory. Now rejects anything but a plain, single-segment folder name.

### Internal
- Core dependency bumped to `v4.1.0` (multi-source endpoint discovery, full metadata tags, `.flac`/ISRC dedup, Jellyfin scan trigger — see [youflac-core's changelog](https://github.com/kushiemoon-dev/youflac-core/blob/main/CHANGELOG.md))
- Removed dead Wails desktop code (`main.go`, `app.go`, `wails.json`, `build/`) left over from the already-completed migration to a standalone web server
- Frontend version was stuck at 4.0.0 while the backend read 4.2.0; CI's frontend job only ran `tsc`, never the actual test suite; `README.md`'s build-from-source steps never mentioned cloning the required `youflac-core` sibling repo

---
