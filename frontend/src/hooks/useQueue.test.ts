import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useQueue } from './useQueue';
import * as Api from '../lib/api';
import * as Ws from '../lib/websocket';
import type { QueueItem, QueueStats, QueueEvent } from '../lib/api';

vi.mock('../lib/websocket', () => ({ EventsOn: vi.fn() }));

function mkItem(id: string, over: Partial<QueueItem> = {}): QueueItem {
  return {
    id,
    videoUrl: 'https://youtu.be/x',
    title: 't',
    artist: 'a',
    status: 'pending',
    progress: 0,
    stage: '',
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  } as QueueItem;
}

const mkStats = (over: Partial<QueueStats> = {}): QueueStats => ({
  total: 0, pending: 0, active: 0, completed: 0, failed: 0, cancelled: 0, ...over,
});

describe('useQueue', () => {
  let eventHandler: ((event: QueueEvent) => void) | undefined;
  let unsubscribe: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    vi.restoreAllMocks();
    eventHandler = undefined;
    unsubscribe = vi.fn(() => {});
    vi.mocked(Ws.EventsOn).mockImplementation((eventName, cb) => {
      expect(eventName).toBe('queue:event');
      eventHandler = cb as (event: QueueEvent) => void;
      return unsubscribe;
    });
    vi.spyOn(Api, 'GetQueue').mockResolvedValue([]);
    vi.spyOn(Api, 'GetQueueStats').mockResolvedValue(mkStats());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches the queue and stats on mount', async () => {
    const items = [mkItem('1')];
    const stats = mkStats({ total: 1, pending: 1 });
    vi.mocked(Api.GetQueue).mockResolvedValue(items);
    vi.mocked(Api.GetQueueStats).mockResolvedValue(stats);

    const { result } = renderHook(() => useQueue());

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items).toEqual(items);
    expect(result.current.stats).toEqual(stats);
  });

  it('falls back to an empty array when GetQueue resolves null/undefined', async () => {
    vi.mocked(Api.GetQueue).mockResolvedValue(undefined as unknown as QueueItem[]);

    const { result } = renderHook(() => useQueue());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items).toEqual([]);
  });

  it('stops loading and logs when the initial fetch fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.GetQueue).mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useQueue());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items).toEqual([]);
    expect(errSpy).toHaveBeenCalledWith('Failed to fetch queue:', expect.any(Error));
  });

  it('subscribes to queue:event on mount and unsubscribes on unmount', async () => {
    const { result, unmount } = renderHook(() => useQueue());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(Ws.EventsOn).toHaveBeenCalledWith('queue:event', expect.any(Function));
    expect(unsubscribe).not.toHaveBeenCalled();

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('appends the item on an "added" event and refreshes stats', async () => {
    const { result } = renderHook(() => useQueue());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const newItem = mkItem('2');
    vi.mocked(Api.GetQueueStats).mockResolvedValue(mkStats({ total: 1, pending: 1 }));

    act(() => {
      eventHandler!({ type: 'added', itemId: '2', item: newItem });
    });

    await waitFor(() => expect(result.current.items).toEqual([newItem]));
    await waitFor(() => expect(result.current.stats).toEqual(mkStats({ total: 1, pending: 1 })));
  });

  it('replaces the matching item on an "updated" event', async () => {
    vi.mocked(Api.GetQueue).mockResolvedValue([mkItem('1', { progress: 10 })]);
    const { result } = renderHook(() => useQueue());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const updated = mkItem('1', { progress: 50 });
    act(() => {
      eventHandler!({ type: 'updated', itemId: '1', item: updated });
    });

    await waitFor(() => expect(result.current.items).toEqual([updated]));
  });

  it('removes the matching item on a "removed" event', async () => {
    vi.mocked(Api.GetQueue).mockResolvedValue([mkItem('1'), mkItem('2')]);
    const { result } = renderHook(() => useQueue());
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    act(() => {
      eventHandler!({ type: 'removed', itemId: '1' });
    });

    await waitFor(() => expect(result.current.items.map(i => i.id)).toEqual(['2']));
  });

  it('addToQueue() forwards videoUrl/spotifyUrl to Api.AddToQueue', async () => {
    vi.spyOn(Api, 'AddToQueue').mockResolvedValue('job-1');
    const { result } = renderHook(() => useQueue());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let id: string | undefined;
    await act(async () => {
      id = await result.current.addToQueue('https://youtu.be/x', 'https://open.spotify.com/track/1');
    });

    expect(Api.AddToQueue).toHaveBeenCalledWith({
      videoUrl: 'https://youtu.be/x',
      spotifyUrl: 'https://open.spotify.com/track/1',
    });
    expect(id).toBe('job-1');
  });

  it('clearCompleted() calls the API then re-fetches the queue', async () => {
    vi.spyOn(Api, 'ClearCompleted').mockResolvedValue(2);
    const { result } = renderHook(() => useQueue());
    await waitFor(() => expect(result.current.loading).toBe(false));

    vi.mocked(Api.GetQueue).mockClear();
    vi.mocked(Api.GetQueueStats).mockClear();

    await act(async () => {
      await result.current.clearCompleted();
    });

    expect(Api.ClearCompleted).toHaveBeenCalled();
    expect(Api.GetQueue).toHaveBeenCalledTimes(1);
    expect(Api.GetQueueStats).toHaveBeenCalledTimes(1);
  });

  it('moveItem() calls Api.MoveQueueItem with id/newIndex then re-fetches', async () => {
    vi.spyOn(Api, 'MoveQueueItem').mockResolvedValue(undefined);
    const { result } = renderHook(() => useQueue());
    await waitFor(() => expect(result.current.loading).toBe(false));

    vi.mocked(Api.GetQueue).mockClear();

    await act(async () => {
      await result.current.moveItem('1', 3);
    });

    expect(Api.MoveQueueItem).toHaveBeenCalledWith('1', 3);
    expect(Api.GetQueue).toHaveBeenCalledTimes(1);
  });

  it('removeFromQueue() and cancelItem() delegate straight to the API', async () => {
    vi.spyOn(Api, 'RemoveFromQueue').mockResolvedValue(undefined);
    vi.spyOn(Api, 'CancelQueueItem').mockResolvedValue(undefined);
    const { result } = renderHook(() => useQueue());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.removeFromQueue('1');
      await result.current.cancelItem('2');
    });

    expect(Api.RemoveFromQueue).toHaveBeenCalledWith('1');
    expect(Api.CancelQueueItem).toHaveBeenCalledWith('2');
  });
});
