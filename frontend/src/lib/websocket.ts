/**
 * Real-time event subscription — dual mode. In the Wails webview this wraps
 * the runtime's EventsOn/EventsOff. In a browser tab it maintains a single
 * shared, auto-reconnecting WebSocket connection to /ws and multiplexes
 * incoming messages to subscribers by event name, mirroring what the Wails
 * side emits for the same logical events:
 *   - "channel_fetch_progress" / "channel_fetch_done": dispatched as-is,
 *     matching internal/app/app_video.go's runtime.EventsEmit payloads
 *     ({jobID, count, total, item} / {jobID, totalFetched, errorCount}).
 *   - "convert_progress": the DirConvertResult is unwrapped from the
 *     server's {type, data} envelope, matching app_files.go's
 *     runtime.EventsEmit(ctx, "convert_progress", r) (payload is the
 *     DirConvertResult directly, not wrapped).
 *   - anything else (the raw core.QueueEvent broadcasts, whose own `type`
 *     field is a queue sub-status like "added"/"updated"/...) is dispatched
 *     to "queue:event" subscribers, matching internal/app/app.go's
 *     runtime.EventsEmit(ctx, "queue:event", event) — Wails emits every
 *     queue event under that one name regardless of its internal type.
 */

import { EventsOn as WailsEventsOn, EventsOff as WailsEventsOff } from '../../wailsjs/runtime';
import { isWailsRuntime } from './runtime';

type EventCallback = (data: any) => void;

// Envelope `type` values that map 1:1 to their own event name.
// "convert_progress" is handled separately since its payload needs unwrapping.
const PASSTHROUGH_ENVELOPE_TYPES = new Set(['channel_fetch_progress', 'channel_fetch_done']);

class BrowserEventBus {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private isConnecting = false;

  private connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.dispatch(msg);
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err);
        }
      };

      this.ws.onclose = (event) => {
        console.log('[WebSocket] Disconnected:', event.code, event.reason);
        this.isConnecting = false;
        this.ws = null;
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        this.isConnecting = false;
      };
    } catch (err) {
      console.error('[WebSocket] Connection failed:', err);
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }

  private dispatch(msg: any): void {
    const type = msg?.type;

    let eventName: string;
    let payload: any = msg;

    if (type === 'convert_progress') {
      eventName = 'convert_progress';
      payload = msg.data;
    } else if (PASSTHROUGH_ENVELOPE_TYPES.has(type)) {
      eventName = type;
    } else {
      eventName = 'queue:event';
    }

    const callbacks = this.listeners.get(eventName);
    if (!callbacks || callbacks.size === 0) return;
    callbacks.forEach((callback) => {
      try {
        callback(payload);
      } catch (err) {
        console.error('[WebSocket] Callback error:', err);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private subscriberCount(): number {
    let total = 0;
    for (const callbacks of this.listeners.values()) total += callbacks.size;
    return total;
  }

  subscribe(eventName: string, callback: EventCallback): () => void {
    let callbacks = this.listeners.get(eventName);
    if (!callbacks) {
      callbacks = new Set();
      this.listeners.set(eventName, callbacks);
    }
    callbacks.add(callback);

    // Auto-connect on the very first subscriber, across all event names —
    // there is only one shared /ws connection for the whole app.
    if (this.subscriberCount() === 1) {
      this.connect();
    }

    return () => {
      callbacks!.delete(callback);
      if (callbacks!.size === 0) this.listeners.delete(eventName);

      // Auto-disconnect when nobody is listening anymore.
      if (this.subscriberCount() === 0) this.disconnect();
    };
  }
}

// Singleton instance — one shared WebSocket connection for the whole app.
const browserEventBus = new BrowserEventBus();

export function EventsOn(eventName: string, callback: (data: any) => void): () => void {
  if (isWailsRuntime()) {
    return WailsEventsOn(eventName, (data: any) => callback(data));
  }
  return browserEventBus.subscribe(eventName, callback);
}

export function EventsOff(eventName: string): void {
  if (isWailsRuntime()) {
    WailsEventsOff(eventName);
    return;
  }
  // Legacy API — with the subscribe pattern, cleanup happens automatically
  // via the unsubscribe function returned by EventsOn.
  console.log(`[WebSocket] EventsOff called for: ${eventName}`);
}
