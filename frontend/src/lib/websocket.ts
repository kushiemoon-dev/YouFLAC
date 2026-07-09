/**
 * Real-time queue event subscription — thin wrapper around the Wails
 * runtime's EventsOn/EventsOff, kept under this name/signature since
 * hooks/useQueue.ts already imports EventsOn from here.
 */

import { EventsOn as WailsEventsOn, EventsOff as WailsEventsOff } from '../../wailsjs/runtime';

export function EventsOn(eventName: string, callback: (data: any) => void): () => void {
  return WailsEventsOn(eventName, (data: any) => callback(data));
}

export function EventsOff(eventName: string): void {
  WailsEventsOff(eventName);
}
