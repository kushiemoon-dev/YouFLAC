import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useUpdateCheck } from './useUpdateCheck';
import * as api from '../lib/api';

describe('useUpdateCheck', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('sets hasUpdate true when API returns an update', async () => {
    vi.spyOn(api, 'CheckForUpdates').mockResolvedValue({
      currentVersion: '3.1.0',
      latestVersion: '3.2.0',
      hasUpdate: true,
      releaseUrl: 'https://github.com/kushiemoon-dev/YouFLAC/releases/tag/v3.2.0',
    });

    const { result } = renderHook(() => useUpdateCheck());

    expect(result.current.hasUpdate).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(5000);
      // flush microtasks
      await Promise.resolve();
    });

    expect(result.current.hasUpdate).toBe(true);
    expect(result.current.latestVersion).toBe('3.2.0');
    expect(result.current.releaseUrl).toBe('https://github.com/kushiemoon-dev/YouFLAC/releases/tag/v3.2.0');
  });

  it('sets hasUpdate false after dismiss()', async () => {
    vi.spyOn(api, 'CheckForUpdates').mockResolvedValue({
      currentVersion: '3.1.0',
      latestVersion: '3.2.0',
      hasUpdate: true,
      releaseUrl: 'https://github.com/kushiemoon-dev/YouFLAC/releases/tag/v3.2.0',
    });

    const { result } = renderHook(() => useUpdateCheck());

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(result.current.hasUpdate).toBe(true);

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.hasUpdate).toBe(false);
  });

  it('graceful degradation: hasUpdate stays false when fetch throws', async () => {
    vi.spyOn(api, 'CheckForUpdates').mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useUpdateCheck());

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(result.current.hasUpdate).toBe(false);
  });
});
