# Changelog

## v4.4.0 — 2026-07-14

### New features
- **Headless server works in a browser again** — the v4.3.1 "restore Wails desktop app" refactor moved `lib/api.ts`/`lib/websocket.ts` to Wails-only bindings (`window.go.*`), which broke the documented, released headless server (`youflac-server-*` binaries) in an actual browser tab, since `window.go` only exists inside the Wails webview. Restored dual-mode support: every function now checks a cached runtime detector and picks the Wails binding or a `fetch()`/WebSocket call to the Fiber server, reusing the pre-regression HTTP client logic rather than rewriting it.
- Amazon Music URLs are now recognized on the queue-add path and return a clear "fallback-only source" error instead of falling through to generic YouTube URL validation.
- Qobuz provider list now reflects live config (`Config.QobuzProxyProviders`) instead of a hardcoded, long-dead provider list.
- `/api/sources` distinguishes "not initialized" from "no sources" instead of returning a bare empty array either way.
- `go test`/`golangci-lint` (migrated to v2) now run in CI with real coverage collection; `main` is tested on every push, not just other branches.

### Internal
- Core dependency bumped to `v4.4.0` — real 4K/2160p support, real fake-lossless detection, dehardcoded Qobuz proxy providers, `ForceSource` wiring (see [youflac-core's changelog](https://github.com/kushiemoon-dev/youflac-core/blob/main/CHANGELOG.md)).
- Fixed 12 pre-existing findings surfaced by reactivating golangci-lint (errcheck on best-effort calls, unused params, error-string casing).
- Added `useQueue`/`useSettings` hook tests and closed a `SearchHistory` dispatch coverage gap.

---

## v4.3.1 — 2026-07-11

### New features
- Wails desktop app restored as an alternative to the headless server mode, with native Windows/macOS build assets, alongside dedicated `internal/app/*` files split out to match youflac-core's package structure
- Reliable, self-hosted star-history badge (replaces the flaky third-party service)

### Fixes
- Resolved 13 Dependabot alerts (7 critical, 2 high, 4 medium) by bumping the transitive `golang.org/x/crypto` dependency to `v0.52.0`
- `golang.org/x/net` bumped to `v0.55.0` (DoS CVE)
- Fiber bumped and esbuild pinned (2 Dependabot advisories); a bad assumption about 404 responses was reverted after it broke behavior
- Jellyfin scan trigger documented in README

### Internal
- Core dependency bumped to `v4.3.1` — fixes a `channeljobs` test build break and makes the Tidal HiFi mirror base URL configurable via env instead of hardcoded (see [youflac-core's changelog](https://github.com/kushiemoon-dev/youflac-core/blob/main/CHANGELOG.md))
- `handlers.go` (1,200+ lines) split into per-domain files under `internal/api/`, each with new characterization tests
- Dead frontend code removed (per knip's report)
- CI: dedicated PAT for private `youflac-core` module access

---

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
