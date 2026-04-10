import { describe, expect, it } from 'vitest';
import { applyQueueFilter, type QueueFilter } from './useQueueFilter';
import type { QueueItem } from '../lib/api';

const base: Partial<QueueItem> = {
  title: 't', artist: 'a', progress: 0, stage: '',
};
function mk(id: string, over: Partial<QueueItem>): QueueItem {
  return { id, ...base, ...over } as QueueItem;
}

describe('applyQueueFilter', () => {
  const items: QueueItem[] = [
    mk('1', { status: 'pending',    audioSource: 'tidal',  createdAt: '2026-04-10T10:00:00Z', progress: 0 }),
    mk('2', { status: 'complete',   audioSource: 'qobuz',  createdAt: '2026-04-09T10:00:00Z', progress: 100 }),
    mk('3', { status: 'skipped',    audioSource: 'tidal',  createdAt: '2026-03-01T10:00:00Z', progress: 100 }),
    mk('4', { status: 'error',      audioSource: 'amazon', createdAt: '2026-04-10T09:00:00Z', progress: 30 }),
  ];

  it('filters by status including skipped', () => {
    const f: QueueFilter = { status: 'skipped', source: 'all', dateRange: 'all' };
    expect(applyQueueFilter(items, f, { by: 'default' }).map(i => i.id)).toEqual(['3']);
  });

  it('filters by source', () => {
    const f: QueueFilter = { status: 'all', source: 'tidal', dateRange: 'all' };
    expect(applyQueueFilter(items, f, { by: 'default' }).map(i => i.id).sort()).toEqual(['1', '3']);
  });

  it('filters by date range today', () => {
    const now = new Date('2026-04-10T12:00:00Z');
    const f: QueueFilter = { status: 'all', source: 'all', dateRange: 'today' };
    expect(applyQueueFilter(items, f, { by: 'default' }, now).map(i => i.id).sort())
      .toEqual(['1', '4']);
  });

  it('sorts by progress desc stably', () => {
    const f: QueueFilter = { status: 'all', source: 'all', dateRange: 'all' };
    const sorted = applyQueueFilter(items, f, { by: 'progress', dir: 'desc' });
    expect(sorted.map(i => i.id)).toEqual(['2', '3', '4', '1']);
  });
});
