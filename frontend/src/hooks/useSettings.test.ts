import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useSettings } from './useSettings';
import * as Api from '../lib/api';
import type { Config } from '../lib/api';

function mkConfig(over: Partial<Config> = {}): Config {
  return {
    outputDirectory: '/music',
    videoQuality: '1080p',
    audioSourcePriority: ['tidal', 'qobuz'],
    namingTemplate: '{artist}/{album}/{title}',
    generateNfo: false,
    concurrentDownloads: 2,
    embedCoverArt: true,
    theme: 'dark',
    cookiesBrowser: '',
    accentColor: '#5865f2',
    soundEffectsEnabled: true,
    soundVolume: 50,
    lyricsEnabled: false,
    lyricsEmbedMode: 'none',
    logLevel: 'info',
    proxyUrl: '',
    downloadTimeoutMinutes: 10,
    preferredQuality: 'lossless',
    generateM3u8: false,
    skipExplicit: false,
    saveCoverFile: false,
    firstArtistOnly: false,
    artistSeparator: ', ',
    autoQualityFallback: true,
    searchResultsLimit: 20,
    qobuzAppId: '',
    qobuzAppSecret: '',
    qobuzUserToken: '',
    uiFont: 'system',
    ...over,
  };
}

describe('useSettings', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches config on mount and clears loading', async () => {
    const config = mkConfig();
    vi.spyOn(Api, 'GetConfig').mockResolvedValue(config);

    const { result } = renderHook(() => useSettings());

    expect(result.current.loading).toBe(true);
    expect(result.current.config).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.config).toEqual(config);
    expect(Api.GetConfig).toHaveBeenCalledTimes(1);
  });

  it('stops loading and logs when the initial fetch fails, config stays null', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Api, 'GetConfig').mockRejectedValue(new Error('disk error'));

    const { result } = renderHook(() => useSettings());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.config).toBeNull();
    expect(errSpy).toHaveBeenCalledWith(expect.any(Error));
  });

  it('saveConfig() sets saving true during the call, persists, and updates config', async () => {
    vi.spyOn(Api, 'GetConfig').mockResolvedValue(mkConfig());
    let resolveSave: () => void;
    vi.spyOn(Api, 'SaveConfig').mockImplementation(
      () => new Promise<void>((resolve) => { resolveSave = resolve; })
    );

    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const newConfig = mkConfig({ outputDirectory: '/new-music' });
    let savePromise!: Promise<void>;
    act(() => {
      savePromise = result.current.saveConfig(newConfig);
    });

    expect(result.current.saving).toBe(true);

    await act(async () => {
      resolveSave!();
      await savePromise;
    });

    expect(Api.SaveConfig).toHaveBeenCalledWith(newConfig);
    expect(result.current.config).toEqual(newConfig);
    expect(result.current.saving).toBe(false);
  });

  it('saveConfig() resets saving to false and rethrows even when the API call fails', async () => {
    const originalConfig = mkConfig();
    vi.spyOn(Api, 'GetConfig').mockResolvedValue(originalConfig);
    vi.spyOn(Api, 'SaveConfig').mockRejectedValue(new Error('save failed'));

    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.saveConfig(mkConfig({ theme: 'light' }))).rejects.toThrow('save failed');
    });

    expect(result.current.saving).toBe(false);
    // Config is only updated on success — a failed save must not silently apply.
    expect(result.current.config).toEqual(originalConfig);
  });

  it('updateField() immutably updates a single field', async () => {
    const config = mkConfig({ theme: 'dark' });
    vi.spyOn(Api, 'GetConfig').mockResolvedValue(config);

    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.updateField('theme', 'light');
    });

    expect(result.current.config?.theme).toBe('light');
    expect(result.current.config).not.toBe(config);
  });

  it('updateField() is a no-op before config has loaded', async () => {
    vi.spyOn(Api, 'GetConfig').mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateField('theme', 'light');
    });

    expect(result.current.config).toBeNull();
  });
});
