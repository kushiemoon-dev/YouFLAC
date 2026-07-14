import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as App from '../../wailsjs/go/app/App';
import { isWailsRuntime } from './runtime';
import { EventsOn } from './websocket';

vi.mock('../../wailsjs/go/app/App');
vi.mock('./runtime', () => ({ isWailsRuntime: vi.fn() }));
vi.mock('./websocket', () => ({ EventsOn: vi.fn() }));

function mockFetchOnce(body: unknown, init?: { ok?: boolean; status?: number }) {
  const ok = init?.ok ?? true;
  const status = init?.status ?? 200;
  (globalThis.fetch as any).mockResolvedValueOnce({
    ok,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
    json: async () => body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
});

describe('lib/api.ts — Wails mode (isWailsRuntime() === true)', () => {
  beforeEach(() => {
    vi.mocked(isWailsRuntime).mockReturnValue(true);
  });

  it('GetQueue() calls the Wails binding, not fetch', async () => {
    const { GetQueue } = await import('./api');
    vi.mocked(App.GetQueue).mockResolvedValue([] as any);
    await GetQueue();
    expect(App.GetQueue).toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('AddToQueue() forwards the request to the Wails binding', async () => {
    const { AddToQueue } = await import('./api');
    vi.mocked(App.AddToQueue).mockResolvedValue('job-1');
    const id = await AddToQueue({ videoUrl: 'https://youtu.be/x' });
    expect(App.AddToQueue).toHaveBeenCalledWith({ videoUrl: 'https://youtu.be/x' });
    expect(id).toBe('job-1');
  });

  it('ConvertDirectory() resolves directly with the Wails binding return value', async () => {
    const { ConvertDirectory } = await import('./api');
    const finalResult = { sourcePath: '/music', done: true, succeeded: 3 };
    vi.mocked(App.ConvertDirectory).mockResolvedValue(finalResult as any);
    const result = await ConvertDirectory({ dir: '/music', targetFormat: 'mp3' });
    expect(result).toEqual(finalResult);
    expect(EventsOn).not.toHaveBeenCalled();
  });

  it('GenerateSpectrogram() returns the data: URL from the binding directly', async () => {
    const { GenerateSpectrogram } = await import('./api');
    vi.mocked(App.GenerateSpectrogram).mockResolvedValue('data:image/png;base64,xyz');
    const url = await GenerateSpectrogram('/track.flac');
    expect(url).toBe('data:image/png;base64,xyz');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('GetPreviewURL() builds the Wails AssetServer path', async () => {
    const { GetPreviewURL } = await import('./api');
    expect(GetPreviewURL('https://youtu.be/x', 15)).toBe('/preview?url=https%3A%2F%2Fyoutu.be%2Fx&seconds=15');
  });

  it('CheckForUpdates() calls the Wails binding', async () => {
    const { CheckForUpdates } = await import('./api');
    vi.mocked(App.UpdateCheck).mockResolvedValue({
      currentVersion: '1', latestVersion: '2', hasUpdate: true, releaseUrl: 'x',
    } as any);
    await CheckForUpdates();
    expect(App.UpdateCheck).toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('ChannelFetch() and ChannelFetchCancel() call their Wails bindings', async () => {
    const { ChannelFetch, ChannelFetchCancel } = await import('./api');
    vi.mocked(App.ChannelFetch).mockResolvedValue('job-2');
    const jobID = await ChannelFetch('https://youtube.com/@x', false, true, '', 0);
    expect(App.ChannelFetch).toHaveBeenCalledWith('https://youtube.com/@x', false, true, '', 0);
    expect(jobID).toBe('job-2');

    await ChannelFetchCancel('job-2');
    expect(App.ChannelFetchCancel).toHaveBeenCalledWith('job-2');
  });

  it('SelectAudioFile()/SelectDirectory()/SelectSaveAudioFile() call their native dialog bindings', async () => {
    const { SelectAudioFile, SelectDirectory, SelectSaveAudioFile } = await import('./api');
    vi.mocked(App.SelectAudioFile).mockResolvedValue('/a.flac');
    vi.mocked(App.SelectDirectory).mockResolvedValue('/dir');
    vi.mocked(App.SelectSaveAudioFile).mockResolvedValue('/out.flac');

    expect(await SelectAudioFile()).toBe('/a.flac');
    expect(await SelectDirectory()).toBe('/dir');
    expect(await SelectSaveAudioFile('out.flac')).toBe('/out.flac');
    expect(App.SelectSaveAudioFile).toHaveBeenCalledWith('out.flac');
  });

  it('SearchHistory()/FilterHistoryBySource()/FilterHistoryByStatus() fill the right positional slot of the shared App.SearchHistory(query, source, status) binding', async () => {
    const { SearchHistory, FilterHistoryBySource, FilterHistoryByStatus } = await import('./api');
    vi.mocked(App.SearchHistory).mockResolvedValue([] as any);

    await SearchHistory('abba');
    expect(App.SearchHistory).toHaveBeenCalledWith('abba', '', '');

    await FilterHistoryBySource('tidal');
    expect(App.SearchHistory).toHaveBeenCalledWith('', 'tidal', '');

    await FilterHistoryByStatus('failed');
    expect(App.SearchHistory).toHaveBeenCalledWith('', '', 'failed');
  });
});

describe('lib/api.ts — browser mode (isWailsRuntime() === false)', () => {
  beforeEach(() => {
    vi.mocked(isWailsRuntime).mockReturnValue(false);
  });

  it('GetQueue() fetches GET /api/queue, not the Wails binding', async () => {
    const { GetQueue } = await import('./api');
    mockFetchOnce([{ id: '1' }]);
    const items = await GetQueue();
    expect(fetch).toHaveBeenCalledWith('/api/queue', expect.objectContaining({ headers: expect.any(Object) }));
    expect(items).toEqual([{ id: '1' }]);
    expect(App.GetQueue).not.toHaveBeenCalled();
  });

  it('AddToQueue() POSTs to /api/queue and unwraps {id}', async () => {
    const { AddToQueue } = await import('./api');
    mockFetchOnce({ id: 'job-1' });
    const id = await AddToQueue({ videoUrl: 'https://youtu.be/x' });
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toBe('/api/queue');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ videoUrl: 'https://youtu.be/x' });
    expect(id).toBe('job-1');
  });

  it('api() helper throws on a non-ok response using the response body as the message', async () => {
    const { GetQueue } = await import('./api');
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'boom',
    });
    await expect(GetQueue()).rejects.toThrow('boom');
  });

  it('ClearQueue() and RetryFailed() use the /queue/clear and /queue/retry HTTP routes', async () => {
    const { ClearQueue, RetryFailed } = await import('./api');
    mockFetchOnce(undefined);
    await ClearQueue();
    expect(fetch).toHaveBeenCalledWith('/api/queue/clear', expect.objectContaining({ method: 'POST' }));

    mockFetchOnce({ retried: 4 });
    const n = await RetryFailed();
    expect(fetch).toHaveBeenCalledWith('/api/queue/retry', expect.objectContaining({ method: 'POST' }));
    expect(n).toBe(4);
  });

  it('ConvertDirectory() POSTs the job and resolves from the convert_progress "done" event, not the ack body', async () => {
    const { ConvertDirectory } = await import('./api');
    const finalResult = { sourcePath: '/music', done: true, succeeded: 2, failed: 0 };

    let capturedCallback: ((data: unknown) => void) | undefined;
    const unsubscribe = vi.fn();
    vi.mocked(EventsOn).mockImplementation((eventName, cb) => {
      expect(eventName).toBe('convert_progress');
      capturedCallback = cb;
      return unsubscribe;
    });

    // The HTTP endpoint only ever acks {success, message} — never the real result.
    mockFetchOnce({ success: true, message: 'conversion complete' });

    const promise = ConvertDirectory({ dir: '/music', targetFormat: 'mp3' });

    // Simulate an in-progress (not done) event first — must not resolve yet.
    capturedCallback?.({ sourcePath: '/music/a.flac', done: false });
    // Then the final event.
    capturedCallback?.(finalResult);

    const result = await promise;
    expect(result).toEqual(finalResult);
    expect(unsubscribe).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith('/api/converter/directory', expect.objectContaining({ method: 'POST' }));
  });

  it('GenerateSpectrogram() does the historical two-step {path} fetch', async () => {
    const { GenerateSpectrogram } = await import('./api');
    mockFetchOnce({ path: '/tmp/spectrogram_x.png' });
    const path = await GenerateSpectrogram('/track.flac');
    expect(path).toBe('/tmp/spectrogram_x.png');
    expect(fetch).toHaveBeenCalledWith('/api/analyze/spectrogram', expect.objectContaining({ method: 'POST' }));
  });

  it('GetPreviewURL() builds the headless server path', async () => {
    const { GetPreviewURL } = await import('./api');
    expect(GetPreviewURL('https://youtu.be/x', 15)).toBe('/api/video/preview?url=https%3A%2F%2Fyoutu.be%2Fx&seconds=15');
  });

  it('CheckForUpdates() uses the historical raw fetch (not the api() helper) and throws on failure', async () => {
    const { CheckForUpdates } = await import('./api');
    (globalThis.fetch as any).mockResolvedValueOnce({ ok: false });
    await expect(CheckForUpdates()).rejects.toThrow('update check failed');
    expect(fetch).toHaveBeenCalledWith('/api/system/update-check');
  });

  it('ChannelFetch() POSTs to /api/channel/fetch and returns jobID; ChannelFetchCancel() POSTs the cancel route', async () => {
    const { ChannelFetch, ChannelFetchCancel } = await import('./api');
    mockFetchOnce({ jobID: 'job-2' });
    const jobID = await ChannelFetch('https://youtube.com/@x', false, true, '', 0);
    expect(fetch).toHaveBeenCalledWith('/api/channel/fetch', expect.objectContaining({ method: 'POST' }));
    expect(jobID).toBe('job-2');

    mockFetchOnce(undefined);
    await ChannelFetchCancel('job-2');
    expect(fetch).toHaveBeenCalledWith('/api/channel/fetch/job-2/cancel', expect.objectContaining({ method: 'POST' }));
  });

  it('SelectAudioFile()/SelectDirectory()/SelectSaveAudioFile() reject with a clear error instead of touching window.go', async () => {
    const { SelectAudioFile, SelectDirectory, SelectSaveAudioFile } = await import('./api');
    await expect(SelectAudioFile()).rejects.toThrow(/browser mode/i);
    await expect(SelectDirectory()).rejects.toThrow(/browser mode/i);
    await expect(SelectSaveAudioFile('out.flac')).rejects.toThrow(/browser mode/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('OpenConfigFolder() still works over HTTP (server-side reveal, no native picker involved)', async () => {
    const { OpenConfigFolder } = await import('./api');
    mockFetchOnce(undefined);
    await OpenConfigFolder();
    expect(fetch).toHaveBeenCalledWith('/api/system/open-config-folder', expect.objectContaining({ method: 'POST' }));
  });

  it('SearchHistory()/FilterHistoryBySource()/FilterHistoryByStatus() each hit /history/search with the right query param name', async () => {
    const { SearchHistory, FilterHistoryBySource, FilterHistoryByStatus } = await import('./api');

    mockFetchOnce([]);
    await SearchHistory('abba');
    expect(fetch).toHaveBeenCalledWith('/api/history/search?q=abba', expect.objectContaining({}));

    mockFetchOnce([]);
    await FilterHistoryBySource('tidal');
    expect(fetch).toHaveBeenCalledWith('/api/history/search?source=tidal', expect.objectContaining({}));

    mockFetchOnce([]);
    await FilterHistoryByStatus('failed');
    expect(fetch).toHaveBeenCalledWith('/api/history/search?status=failed', expect.objectContaining({}));
  });
});
