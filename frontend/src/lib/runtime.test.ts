import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('isWailsRuntime', () => {
  afterEach(() => {
    delete (window as any).go;
    delete (window as any).runtime;
  });

  beforeEach(() => {
    delete (window as any).go;
    delete (window as any).runtime;
    // Module-level cache in runtime.ts must not leak between tests.
    vi.resetModules();
  });

  it('returns false in a plain browser (no window.go / window.runtime)', async () => {
    const { isWailsRuntime } = await import('./runtime');
    expect(isWailsRuntime()).toBe(false);
  });

  it('returns true when both window.go and window.runtime are present', async () => {
    (window as any).go = {};
    (window as any).runtime = {};
    const { isWailsRuntime } = await import('./runtime');
    expect(isWailsRuntime()).toBe(true);
  });

  it('returns false when only window.runtime is present (no bindings yet)', async () => {
    (window as any).runtime = {};
    const { isWailsRuntime } = await import('./runtime');
    expect(isWailsRuntime()).toBe(false);
  });

  it('caches the result — later changes to window.go/runtime do not flip it', async () => {
    const { isWailsRuntime } = await import('./runtime');
    expect(isWailsRuntime()).toBe(false);

    (window as any).go = {};
    (window as any).runtime = {};
    expect(isWailsRuntime()).toBe(false);
  });
});
