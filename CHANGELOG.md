# Changelog

## v4.4.3 (2026-09-23)

### Fixes
- `AppVersion` (used by the headless server's `/api/version`/`/api/health`) is now set correctly
  by release builds: it was a Go `const`, which `-ldflags -X` cannot override, so every headless
  server release reported `4.4.0` regardless of the actual tag.

### Internal
- CI now runs on Go 1.26.5 (previously 1.25).
- Bumped `youflac-core` to `v4.4.3`, `wails` to `v2.13.0`, `vite` to `^8`.
- `SoulseekSetup.tsx`'s displayed sldl path moved from `~/.local/share/flacidal/sldl` to
  `~/.local/share/youflac/sldl`, matching youflac-core's `ResolveSldlPath` rename.

---

## v4.4.2 (2026-07-16)

### New features
- **Headless server works in a browser again**: the v4.3.1 "restore Wails desktop app" refactor moved `lib/api.ts`/`lib/websocket.ts` to Wails-only bindings (`window.go.*`), which broke the documented, released headless server (`youflac-server-*` binaries) in an actual browser tab, since `window.go` only exists inside the Wails webview. Restored dual-mode support: every function now checks a cached runtime detector and picks the Wails binding or a `fetch()`/WebSocket call to the Fiber server, reusing the pre-regression HTTP client logic rather than rewriting it.
- Amazon Music URLs are now recognized on the queue-add path and return a clear "fallback-only source" error instead of falling through to generic YouTube URL validation.
- Qobuz provider list now reflects live config (`Config.QobuzProxyProviders`) instead of a hardcoded, long-dead provider list.
- `/api/sources` distinguishes "not initialized" from "no sources" instead of returning a bare empty array either way.
- `go test`/`golangci-lint` (migrated to v2) now run in CI with real coverage collection; `main` is tested on every push, not just other branches.

### Internal
- Core dependency bumped to `v4.4.0`: real 4K/2160p support, real fake-lossless detection, dehardcoded Qobuz proxy providers, `ForceSource` wiring (see [youflac-core's changelog](https://github.com/kushiemoon-dev/youflac-core/blob/main/CHANGELOG.md)).
- Fixed 12 pre-existing findings surfaced by reactivating golangci-lint (errcheck on best-effort calls, unused params, error-string casing).
- Added `useQueue`/`useSettings` hook tests and closed a `SearchHistory` dispatch coverage gap.
- CI's `lint` and `build-check` jobs now generate the Wails JS bindings and a `frontend/dist`
  placeholder before running: both jobs referenced `frontend/dist` (`go:embed`) or `wailsjs/`
  (TypeScript imports) without ever creating them, unlike `test-frontend` which already did.

---

## v4.3.1 (2026-07-11)

### New features
- Wails desktop app restored as an alternative to the headless server mode, with native Windows/macOS build assets, alongside dedicated `internal/app/*` files split out to match youflac-core's package structure
- Reliable, self-hosted star-history badge (replaces the flaky third-party service)

### Fixes
- Resolved 13 Dependabot alerts (7 critical, 2 high, 4 medium) by bumping the transitive `golang.org/x/crypto` dependency to `v0.52.0`
- `golang.org/x/net` bumped to `v0.55.0` (DoS CVE)
- Fiber bumped and esbuild pinned (2 Dependabot advisories); a bad assumption about 404 responses was reverted after it broke behavior
- Jellyfin scan trigger documented in README

### Internal
- Core dependency bumped to `v4.3.1`: fixes a `channeljobs` test build break and makes the Tidal HiFi mirror base URL configurable via env instead of hardcoded (see [youflac-core's changelog](https://github.com/kushiemoon-dev/youflac-core/blob/main/CHANGELOG.md))
- `handlers.go` (1,200+ lines) split into per-domain files under `internal/api/`, each with new characterization tests
- Dead frontend code removed (per knip's report)
- CI: dedicated PAT for private `youflac-core` module access

---

## v4.3.0 (2026-07-03)

### New features
- **Reorganize/Flatten playlist tools actually work**: both were stubs that always reported "success, 0 moved"; `Reorganize` now moves each track into the regular `NamingTemplate` layout using its embedded tags, `Flatten` collapses the per-track subfolders a playlist download creates.
- **Jellyfin scan trigger**: Settings → Advanced → Media Server adds an enable toggle, server URL, and API key; triggers a debounced library scan a few seconds after a completed download.

### Fixes
- `GetPlaylistFolders` looked for numbered files directly under the playlist folder, but real playlist downloads nest one subfolder per track; it never matched anything, so the Reorganize/Flatten buttons never had a folder to act on.
- Path traversal: `Reorganize`/`Flatten` took `folderPath` straight from the request body with no validation, letting a crafted path escape the output directory. Now rejects anything but a plain, single-segment folder name.

### Internal
- **`youflac-core` is now a real pinned dependency**: `go.mod` requires `github.com/kushiemoon-dev/youflac-core/v4 v4.1.1` (fetched from its own tagged release) instead of a local `replace` to a sibling checkout that CI had to fake by cloning both repos on every build. Every build now uses the exact same Core version, not whatever happened to be on Core's `main` branch at the time. Core dependency covers multi-source endpoint discovery, full metadata tags, `.flac`/ISRC dedup, and the Jellyfin scan trigger, see [youflac-core's changelog](https://github.com/kushiemoon-dev/youflac-core/blob/main/CHANGELOG.md). Local cross-repo dev still works via a gitignored `go.work`.
- Removed dead Wails desktop code (`main.go`, `app.go`, `wails.json`, `build/`) left over from the already-completed migration to a standalone web server
- Frontend version was stuck at 4.0.0 while the backend read 4.2.0; CI's frontend job only ran `tsc`, never the actual test suite; `README.md`'s build-from-source steps previously (and briefly) needed a `youflac-core` sibling clone -- no longer true now that it's a pinned dependency

---

## v4.2.0 (2026-06-18)

### New features
- **Recentered the product on YouTube to MKV plus Soulseek FLAC**, removing the Universal Search surface added one bump earlier in v4.1.0
- Tagline and About page updated to describe the v4 architecture; README rewritten with screenshots and an updated config reference

---

## v4.1.0 (2026-06-18)

### New features
- **v4 rewrite: Soulseek and Qobuz as first-class sources alongside a source-priority UI**, with new backend endpoints for sources, Qobuz, Soulseek, and universal search, and matching frontend components (`SourcePriority`, `SoulseekSetup`, `QobuzProviders`, `UniversalSearch`)
- Orchestrator logging, FLAC verification, and env-driven config wired into the server
- Real Soulseek network probe replaces the placeholder login test
- Animated showcase GIF and a Remotion project added to the docs
- Internally bumped straight from 3.2.0 to 4.0.0 to 4.1.0 in the same session; 4.0.0 was never tagged or released

### Fixes
- Universal search response shape and the add-to-queue payload no longer disagree
- Missing `/system/update-check` route registered
- `vite` and `picomatch` security advisories resolved

### Internal
- Frontend build toolchain migrated from npm to pnpm 11, including three follow-up CI fixes (Node 22 requirement, cache integration, explicit pnpm version) to get the migration green
- `go.sum` synced for the `modernc.org/sqlite` transitive dependency pulled in via the youflac-core replace directive
- Nested `core/` and `mobile/` checkouts ignored; defunct Gitea sync removed; `frontend/dist` placeholder added back for the embed build

---

## v3.2.0 (2026-04-10)

### New features
- Channel download modal with URL classification, channel fetch endpoints, and websocket progress events
- Queue filtering by status/source/date/sort, a debug logs modal with level filtering, and skip/explicit badges on queue items
- Audio resampler page and endpoint, analyzer batch mode with drag-and-drop, and a converter folder mode with websocket progress streaming
- Audio preview endpoint and UI toggle, with an auto-update checker banner backed by a size-capped GitHub API call
- About page enriched with FAQ, GitHub warning, and donation links; font customization with a startup-applied CSS variable; unsaved-changes dialog and an open-config-folder button

### Fixes
- Data race in the channel fetch handler
- `sandboxPath` returned an unresolved path instead of the resolved canonical one
- Stuck "converting" state on server disconnect (missing `ws.onclose` guard)
- Desktop-only converter paths now reject gracefully instead of failing silently, with accessibility attributes added to the drop zone

---

## v3.1.0 (2026-04-03)

### Internal
- **Migrated off the local `backend/` package onto `youflac-core` as a shared module**: `server.go`, `main.go`, `app.go`, and `handlers.go` all moved to import youflac-core directly instead of a copy of the same code living in this repo

---

## v3.0.1 (2026-04-03)

### Fixes
- Qobuz URL regex now accepts alphanumeric IDs, not just digits
- Artist name extraction from the Lucida API response object fixed
- `LoadConfig`/`SaveConfig` now respect `CONFIG_DIR` via `GetConfigPathWithEnv`, fixing config paths under Docker
- Qobuz/Tidal/Spotify URLs routed to the wrong queue field; now routed to `SpotifyURL` correctly
- Tidal stream quality was hardcoded to `LOSSLESS` instead of honoring `PreferredQuality`
- Missing HTTP status checks before JSON parsing in `audio_orpheus`

### New features
- Qobuz credentials added to config and the settings UI

---

## v3.0.0 (2026-03-12)

### New features
- Light theme aligned with the Flacidal palette, with system preference detection; all hardcoded colors replaced with CSS variables
- Mobile-first responsive layout: sidebar becomes a bottom tab bar under 768px, with responsive padding, scrollable tabs, and wrapping filter pills
- Audio format converter (FLAC/WAV/MP3/AAC/OGG/ALAC) and YouTube search integration with video preview
- Queue enhancements: sort, filter, edit and retry, pause and resume

### Fixes
- Dependency updates to resolve security vulnerabilities

---

## v2.0.2 (2026-02-21)

### Fixes
- Cache-hit write in `CheckServiceStatus` was unprotected, causing a data race; now guarded by a mutex

### Internal
- Docker Go builds switched to pre-built binaries to fix a 6 hour CI timeout
- CI race detector merged in; the `golangci-lint` job (incompatible with Go 1.25 at the time) and the paid Codecov step were both removed in favor of a printed coverage summary
- Unit tests, benchmarks, a Makefile, and lint config added
- README rewritten with banner, screenshot, and full feature/API docs; broken Docker Hub pulls badge replaced with a static ghcr.io badge

---

## v2.0.1 (2026-02-20)

### Fixes
- Page title now correctly reads "YouFLAC"
- `docker-compose` now pulls the ghcr.io image instead of building locally
- ghcr.io image tagging now includes the v-prefixed semver tag (`v2.0.0`) alongside the bare version

### Internal
- Install docs updated with Docker (ghcr.io) and native binary instructions

---

## v2.0.0 (2026-02-20)

### New features
- **YouFLAC v2**: security hardening, a backend refactor, additional audio sources, and a CI/CD pipeline aligned with Flacidal's feature parity and design
- Endpoint rotation, proxy support, timeout config, and quality fallback for source lookups
- Structured logging via `log/slog`
- Explicit-content flag, M3U8 playlist export, and pause/resume on queue items
- Failed export, retry-all, and service status endpoints
- Music matching improvements with metadata-override retry

### Fixes
- Path traversal, input validation, and command injection issues closed as part of the security hardening pass
- FLAC audio trimmed of leading silence, and video/FLAC silence compared, to correct A/V sync drift

### Internal
- Large backend files split into focused modules
- Unit tests added for the new audio tools, queue, and API handlers
- Docker builder bumped to match `go.mod`'s Go version
- No GitHub Release was published for this tag

---

## v1.0.1 (2026-01-06)

### New features
- Docker containerization with a multi-stage build, plus an HTTP REST API server (Go Fiber) and websocket support for real-time queue updates, enabling a non-desktop deployment
- Audio analyzer with spectrogram/waveform visualization
- Download history with search and re-download, lyrics fetching from LRCLIB with embed/LRC options, accent color customization, and a sound effects toggle

### Fixes
- File Manager returned `null` instead of an empty array
- Naming template presets (Jellyfin, Plex, etc.) weren't resolving
- `SOUND_EFFECTS_ENABLED` environment variable naming corrected

---

## v1.0.0 (2026-01-05)

Initial release: YouTube + FLAC to MKV.

---
