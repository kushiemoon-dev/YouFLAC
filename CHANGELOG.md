# Changelog

## v4.3.0 — 2026-07-03

### New features
- **Reorganize/Flatten playlist tools actually work** — both were stubs that always reported "success, 0 moved"; `Reorganize` now moves each track into the regular `NamingTemplate` layout using its embedded tags, `Flatten` collapses the per-track subfolders a playlist download creates.
- **Jellyfin scan trigger** — Settings → Advanced → Media Server adds an enable toggle, server URL, and API key; triggers a debounced library scan a few seconds after a completed download.

### Fixes
- `GetPlaylistFolders` looked for numbered files directly under the playlist folder, but real playlist downloads nest one subfolder per track — it never matched anything, so the Reorganize/Flatten buttons never had a folder to act on.
- Path traversal: `Reorganize`/`Flatten` took `folderPath` straight from the request body with no validation, letting a crafted path escape the output directory. Now rejects anything but a plain, single-segment folder name.

### Internal
- **`youflac-core` is now a real pinned dependency** — `go.mod` requires `github.com/kushiemoon-dev/youflac-core/v4 v4.1.1` (fetched from its own tagged release) instead of a local `replace` to a sibling checkout that CI had to fake by cloning both repos on every build. Every build now uses the exact same Core version, not whatever happened to be on Core's `main` branch at the time. Core dependency covers multi-source endpoint discovery, full metadata tags, `.flac`/ISRC dedup, and the Jellyfin scan trigger — see [youflac-core's changelog](https://github.com/kushiemoon-dev/youflac-core/blob/main/CHANGELOG.md). Local cross-repo dev still works via a gitignored `go.work`.
- Removed dead Wails desktop code (`main.go`, `app.go`, `wails.json`, `build/`) left over from the already-completed migration to a standalone web server
- Frontend version was stuck at 4.0.0 while the backend read 4.2.0; CI's frontend job only ran `tsc`, never the actual test suite; `README.md`'s build-from-source steps previously (and briefly) needed a `youflac-core` sibling clone -- no longer true now that it's a pinned dependency

---
