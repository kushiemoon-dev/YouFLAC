import { useMemo } from 'react';
import type { QueueItem } from '../lib/api';

export type QueueFilterStatus =
  | 'all' | 'pending' | 'downloading' | 'completed'
  | 'failed' | 'skipped' | 'paused' | 'cancelled';
export type QueueFilterSource =
  | 'all' | 'tidal' | 'qobuz' | 'amazon' | 'lucida' | 'deezer';
export type QueueFilterDate = 'today' | 'week' | 'all';

export interface QueueFilter {
  status: QueueFilterStatus;
  source: QueueFilterSource;
  dateRange: QueueFilterDate;
}

export type QueueSortKey = 'default' | 'date' | 'status' | 'source' | 'progress';
export interface QueueSort {
  by: QueueSortKey;
  dir?: 'asc' | 'desc';
}

const DOWNLOADING = new Set([
  'fetching_info', 'downloading_video', 'downloading_audio', 'muxing', 'organizing',
]);

function matchesStatus(item: QueueItem, s: QueueFilterStatus): boolean {
  switch (s) {
    case 'all':         return true;
    case 'pending':     return item.status === 'pending';
    case 'downloading': return DOWNLOADING.has(item.status);
    case 'completed':   return item.status === 'complete';
    case 'failed':      return item.status === 'error';
    case 'skipped':     return item.status === 'skipped';
    case 'paused':      return item.status === 'paused';
    case 'cancelled':   return item.status === 'cancelled';
  }
}

function matchesSource(item: QueueItem, s: QueueFilterSource): boolean {
  if (s === 'all') return true;
  return (item.audioSource || '').toLowerCase() === s;
}

function matchesDate(item: QueueItem, r: QueueFilterDate, now: Date): boolean {
  if (r === 'all') return true;
  const created = new Date(item.createdAt).getTime();
  if (Number.isNaN(created)) return false;
  const nowMs = now.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (r === 'today') return nowMs - created < dayMs;
  if (r === 'week')  return nowMs - created < 7 * dayMs;
  return true;
}

const STATUS_ORDER: Record<string, number> = {
  error: 0, downloading_video: 1, downloading_audio: 2,
  fetching_info: 3, muxing: 4, organizing: 5,
  pending: 6, paused: 7, complete: 8, skipped: 9, cancelled: 10,
};

export function applyQueueFilter(
  items: QueueItem[],
  filter: QueueFilter,
  sort: QueueSort,
  now: Date = new Date(),
): QueueItem[] {
  const filtered = items.filter(
    (it) =>
      matchesStatus(it, filter.status) &&
      matchesSource(it, filter.source) &&
      matchesDate(it, filter.dateRange, now),
  );

  if (sort.by === 'default') return filtered;

  const dir = sort.dir === 'asc' ? 1 : -1;
  const withIdx = filtered.map((item, idx) => ({ item, idx }));
  withIdx.sort((a, b) => {
    let cmp = 0;
    switch (sort.by) {
      case 'date':
        cmp = new Date(a.item.createdAt).getTime() - new Date(b.item.createdAt).getTime();
        break;
      case 'status':
        cmp = (STATUS_ORDER[a.item.status] ?? 99) - (STATUS_ORDER[b.item.status] ?? 99);
        break;
      case 'source':
        cmp = (a.item.audioSource || '').localeCompare(b.item.audioSource || '');
        break;
      case 'progress':
        cmp = (a.item.progress ?? 0) - (b.item.progress ?? 0);
        break;
    }
    if (cmp !== 0) return cmp * dir;
    return a.idx - b.idx;
  });
  return withIdx.map((w) => w.item);
}

export function useQueueFilter(
  items: QueueItem[],
  filter: QueueFilter,
  sort: QueueSort,
): QueueItem[] {
  return useMemo(() => applyQueueFilter(items, filter, sort), [items, filter, sort]);
}
