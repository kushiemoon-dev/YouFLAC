import { useState, useMemo } from 'react';
import type { QueueItem as QueueItemType, QueueStats } from '../../lib/api';
import { QueueItem } from './QueueItem';
import { ConfirmDialog } from '../ui/ConfirmDialog';

// Icons
const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const PauseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
);

const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const SortIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <polyline points="19 12 12 19 5 12" />
  </svg>
);

type FilterOption = 'all' | 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled';
type SortOption = 'default' | 'name' | 'status' | 'date' | 'failed-first';

const filterLabels: Record<FilterOption, string> = {
  all: 'All',
  pending: 'Pending',
  downloading: 'Active',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

const sortLabels: Record<SortOption, string> = {
  default: 'Queue Order',
  name: 'Name',
  status: 'Status',
  date: 'Date Added',
  'failed-first': 'Failed First',
};

const statusOrder: Record<string, number> = {
  error: 0,
  downloading_video: 1,
  downloading_audio: 2,
  fetching_info: 3,
  muxing: 4,
  organizing: 5,
  pending: 6,
  paused: 7,
  complete: 8,
  cancelled: 9,
};

function matchesFilter(item: QueueItemType, filter: FilterOption): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'pending':
      return item.status === 'pending' || item.status === 'paused';
    case 'downloading':
      return ['fetching_info', 'downloading_video', 'downloading_audio', 'muxing', 'organizing'].includes(item.status);
    case 'completed':
      return item.status === 'complete';
    case 'failed':
      return item.status === 'error';
    case 'cancelled':
      return item.status === 'cancelled';
  }
}

function sortItems(items: QueueItemType[], sort: SortOption): QueueItemType[] {
  if (sort === 'default') return items;

  return [...items].sort((a, b) => {
    switch (sort) {
      case 'name':
        return (a.title || '').localeCompare(b.title || '');
      case 'status':
        return (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
      case 'date':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'failed-first':
        if (a.status === 'error' && b.status !== 'error') return -1;
        if (b.status === 'error' && a.status !== 'error') return 1;
        return 0;
      default:
        return 0;
    }
  });
}

interface QueueListProps {
  items: QueueItemType[];
  stats: QueueStats | null;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onClearCompleted: () => void;
  onRetryFailed: () => void;
  onClearAll: () => void;
  onPauseAll?: () => void;
  onResumeAll?: () => void;
}

export function QueueList({
  items,
  stats,
  onCancel,
  onRemove,
  onClearCompleted,
  onRetryFailed,
  onClearAll,
  onPauseAll,
  onResumeAll,
}: QueueListProps) {
  const [filter, setFilter] = useState<FilterOption>('all');
  const [sort, setSort] = useState<SortOption>('default');
  const [confirmAction, setConfirmAction] = useState<'clearAll' | 'clearCompleted' | null>(null);

  const filteredAndSorted = useMemo(() => {
    const filtered = items.filter((item) => matchesFilter(item, filter));
    return sortItems(filtered, sort);
  }, [items, filter, sort]);

  const hasItems = items.length > 0;
  const hasActive = stats && (stats.active > 0 || stats.pending > 0);
  const hasPaused = items.some((i) => i.status === 'paused');
  const hasCompleted = stats && stats.completed > 0;
  const hasFailed = stats && stats.failed > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3
            className="text-lg font-medium"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Download Queue
          </h3>
          {stats && (
            <div
              className="flex items-center gap-3 text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {stats.active > 0 && (
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ background: 'var(--color-accent)' }}
                  />
                  {stats.active} active
                </span>
              )}
              {stats.pending > 0 && (
                <span>{stats.pending} pending</span>
              )}
              {stats.completed > 0 && (
                <span className="flex items-center gap-1">
                  <CheckCircleIcon />
                  {stats.completed}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {hasItems && onResumeAll && hasPaused && (
            <button
              className="btn-ghost text-sm flex items-center gap-2"
              onClick={onResumeAll}
              style={{ color: 'var(--color-success)' }}
            >
              <PlayIcon />
              Resume all
            </button>
          )}
          {hasItems && onPauseAll && hasActive && (
            <button
              className="btn-ghost text-sm flex items-center gap-2"
              onClick={onPauseAll}
            >
              <PauseIcon />
              Pause all
            </button>
          )}
          {hasFailed && (
            <button
              className="btn-ghost text-sm flex items-center gap-2"
              onClick={onRetryFailed}
              style={{ color: 'var(--color-warning)' }}
            >
              <RefreshIcon />
              Retry failed ({stats?.failed})
            </button>
          )}
          {hasCompleted && (
            <button
              className="btn-ghost text-sm flex items-center gap-2"
              onClick={() => setConfirmAction('clearCompleted')}
            >
              <CheckCircleIcon />
              Clear completed
            </button>
          )}
          {hasItems && (
            <button
              className="btn-ghost text-sm flex items-center gap-2"
              onClick={() => setConfirmAction('clearAll')}
              style={{ color: 'var(--color-error)' }}
            >
              <TrashIcon />
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Filter + Sort bar */}
      {hasItems && (
        <div className="flex items-center justify-between gap-4">
          {/* Filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(Object.keys(filterLabels) as FilterOption[]).map((f) => (
              <button
                key={f}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${filter === f ? 'font-medium' : ''}`}
                style={{
                  background: filter === f ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
                  color: filter === f ? 'white' : 'var(--color-text-secondary)',
                }}
                onClick={() => setFilter(f)}
              >
                {filterLabels[f]}
                {f === 'failed' && stats?.failed ? ` (${stats.failed})` : ''}
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-1.5">
            <SortIcon />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="text-xs bg-transparent border-none outline-none cursor-pointer"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {(Object.keys(sortLabels) as SortOption[]).map((s) => (
                <option key={s} value={s}>{sortLabels[s]}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Queue items */}
      {hasItems ? (
        filteredAndSorted.length > 0 ? (
          <div className="space-y-3">
            {filteredAndSorted.map((item, index) => (
              <div
                key={item.id}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <QueueItem
                  item={item}
                  onCancel={onCancel}
                  onRemove={onRemove}
                />
              </div>
            ))}
          </div>
        ) : (
          <div
            className="card p-8 text-center"
            style={{ borderStyle: 'dashed' }}
          >
            <p
              className="text-sm"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              No items match the selected filter
            </p>
          </div>
        )
      ) : (
        <div
          className="card p-6 md:p-12 text-center"
          style={{ borderStyle: 'dashed' }}
        >
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'var(--color-bg-tertiary)' }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <p
            className="text-sm font-medium mb-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            No downloads in queue
          </p>
          <p
            className="text-sm"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Paste a YouTube or Spotify URL above to get started
          </p>
        </div>
      )}

      {/* Confirmation dialogs */}
      {confirmAction === 'clearAll' && (
        <ConfirmDialog
          title="Clear All Items"
          message="This will remove all items from the queue, including active downloads. This cannot be undone."
          confirmLabel="Clear All"
          destructive
          onConfirm={() => { onClearAll(); setConfirmAction(null); }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction === 'clearCompleted' && (
        <ConfirmDialog
          title="Clear Completed"
          message="Remove all completed items from the queue?"
          confirmLabel="Clear"
          onConfirm={() => { onClearCompleted(); setConfirmAction(null); }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
