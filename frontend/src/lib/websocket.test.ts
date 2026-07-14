import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventsOn as WailsEventsOn, EventsOff as WailsEventsOff } from '../../wailsjs/runtime';
import { isWailsRuntime } from './runtime';

vi.mock('../../wailsjs/runtime', () => ({
  EventsOn: vi.fn(),
  EventsOff: vi.fn(),
}));
vi.mock('./runtime', () => ({ isWailsRuntime: vi.fn() }));

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  url: string;
  onopen: ((ev: any) => void) | null = null;
  onmessage: ((ev: any) => void) | null = null;
  onclose: ((ev: any) => void) | null = null;
  onerror: ((ev: any) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
  }

  simulateMessage(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);
});

describe('lib/websocket.ts — Wails mode (isWailsRuntime() === true)', () => {
  beforeEach(() => {
    vi.mocked(isWailsRuntime).mockReturnValue(true);
  });

  it('EventsOn() wraps the Wails runtime EventsOn and forwards data to the callback', async () => {
    const { EventsOn } = await import('./websocket');
    const unsub = vi.fn();
    vi.mocked(WailsEventsOn).mockReturnValue(unsub);

    const cb = vi.fn();
    const returned = EventsOn('queue:event', cb);

    expect(WailsEventsOn).toHaveBeenCalledWith('queue:event', expect.any(Function));
    const forwardedHandler = vi.mocked(WailsEventsOn).mock.calls[0][1];
    forwardedHandler({ type: 'added' });
    expect(cb).toHaveBeenCalledWith({ type: 'added' });
    expect(returned).toBe(unsub);
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it('EventsOff() calls the Wails runtime EventsOff', async () => {
    const { EventsOff } = await import('./websocket');
    EventsOff('queue:event');
    expect(WailsEventsOff).toHaveBeenCalledWith('queue:event');
  });
});

describe('lib/websocket.ts — browser mode (isWailsRuntime() === false)', () => {
  beforeEach(() => {
    vi.mocked(isWailsRuntime).mockReturnValue(false);
  });

  it('EventsOn() opens a single shared WebSocket to /ws on first subscriber', async () => {
    const { EventsOn } = await import('./websocket');
    EventsOn('queue:event', vi.fn());
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].url).toMatch(/\/ws$/);

    // A second subscription (any event) must not open a second connection.
    EventsOn('convert_progress', vi.fn());
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(WailsEventsOn).not.toHaveBeenCalled();
  });

  it('dispatches a raw queue event (unknown envelope type) to "queue:event" subscribers', async () => {
    const { EventsOn } = await import('./websocket');
    const cb = vi.fn();
    EventsOn('queue:event', cb);
    const ws = FakeWebSocket.instances[0];

    ws.simulateMessage({ type: 'added', itemId: '1', item: { id: '1' } });

    expect(cb).toHaveBeenCalledWith({ type: 'added', itemId: '1', item: { id: '1' } });
  });

  it('dispatches "channel_fetch_progress" / "channel_fetch_done" envelopes as-is, not to "queue:event"', async () => {
    const { EventsOn } = await import('./websocket');
    const queueCb = vi.fn();
    const progressCb = vi.fn();
    const doneCb = vi.fn();
    EventsOn('queue:event', queueCb);
    EventsOn('channel_fetch_progress', progressCb);
    EventsOn('channel_fetch_done', doneCb);
    const ws = FakeWebSocket.instances[0];

    ws.simulateMessage({ type: 'channel_fetch_progress', jobID: 'j1', count: 3, total: -1, item: { id: 'v1' } });
    expect(progressCb).toHaveBeenCalledWith({ type: 'channel_fetch_progress', jobID: 'j1', count: 3, total: -1, item: { id: 'v1' } });
    expect(queueCb).not.toHaveBeenCalled();

    ws.simulateMessage({ type: 'channel_fetch_done', jobID: 'j1', totalFetched: 10, errorCount: 0 });
    expect(doneCb).toHaveBeenCalledWith({ type: 'channel_fetch_done', jobID: 'j1', totalFetched: 10, errorCount: 0 });
    expect(queueCb).not.toHaveBeenCalled();
  });

  it('unwraps "convert_progress" envelopes to the raw DirConvertResult payload', async () => {
    const { EventsOn } = await import('./websocket');
    const cb = vi.fn();
    EventsOn('convert_progress', cb);
    const ws = FakeWebSocket.instances[0];

    const dirResult = { sourcePath: '/music/a.flac', done: false };
    ws.simulateMessage({ type: 'convert_progress', data: dirResult });

    expect(cb).toHaveBeenCalledWith(dirResult);
    expect(cb).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'convert_progress' }));
  });

  it('unsubscribing stops further callbacks and closes the connection once nobody is listening', async () => {
    const { EventsOn } = await import('./websocket');
    const cb = vi.fn();
    const unsubscribe = EventsOn('queue:event', cb);
    const ws = FakeWebSocket.instances[0];

    unsubscribe();
    ws.simulateMessage({ type: 'added', itemId: '1' });
    expect(cb).not.toHaveBeenCalled();
    expect(ws.readyState).toBe(FakeWebSocket.CLOSED);
  });

  it('EventsOff() is a no-op in browser mode (cleanup happens via the unsubscribe function)', async () => {
    const { EventsOff } = await import('./websocket');
    expect(() => EventsOff('queue:event')).not.toThrow();
    expect(WailsEventsOff).not.toHaveBeenCalled();
  });
});
