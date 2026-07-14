/**
 * Runtime detection for the dual-mode frontend.
 *
 * The app ships as a single bundle that runs either inside the Wails
 * desktop webview or in a plain browser tab against the headless Fiber
 * server. Wails' preload script injects both `window.runtime` (event bus,
 * clipboard, browser helpers, ...) and `window.go` (the generated App
 * bindings) before the frontend loads; neither exists in a regular
 * browser. lib/api.ts and lib/websocket.ts use this check to pick the
 * right backend per call.
 *
 * The result is cached after the first check since the runtime can't
 * change during a session.
 */

let cached: boolean | null = null;

export function isWailsRuntime(): boolean {
  if (cached === null) {
    cached =
      typeof window !== 'undefined' &&
      typeof (window as any).runtime !== 'undefined' &&
      typeof (window as any).go !== 'undefined';
  }
  return cached;
}
