import { useState } from 'react';
import type { QueueItem as QueueItemType, RetryOverrideRequest } from '../../lib/api';
import { retryWithOverride } from '../../lib/api';
import { ProgressBar } from './ProgressBar';
import { EditMetadataModal } from './EditMetadataModal';
import type { QueueStatus } from '../../types';

// Icons
const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const FolderOpenIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    <path d="M2 10h20" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const PencilIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

interface QueueItemProps {
  item: QueueItemType;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onRetry?: (id: string) => void;
  onOpenFolder?: (path: string) => void;
}

function getStatusBadge(status: QueueStatus): { label: string; className: string } {
  switch (status) {
    case 'pending':
      return { label: 'Pending', className: 'badge-neutral' };
    case 'fetching_info':
      return { label: 'Fetching', className: 'badge-info' };
    case 'downloading_video':
      return { label: 'Video', className: 'badge-info' };
    case 'downloading_audio':
      return { label: 'Audio', className: 'badge-accent' };
    case 'muxing':
      return { label: 'Muxing', className: 'badge-accent' };
    case 'organizing':
      return { label: 'Finalizing', className: 'badge-accent' };
    case 'complete':
      return { label: 'Complete', className: 'badge-success' };
    case 'error':
      return { label: 'Error', className: 'badge-error' };
    case 'cancelled':
      return { label: 'Cancelled', className: 'badge-neutral' };
    default:
      return { label: 'Unknown', className: 'badge-neutral' };
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function QueueItem({ item, onCancel, onRemove, onRetry, onOpenFolder }: QueueItemProps) {
  const status = item.status as QueueStatus;
  const isProcessing = !['complete', 'error', 'cancelled', 'pending'].includes(status);
  const badge = getStatusBadge(status);
  const [showEditModal, setShowEditModal] = useState(false);

  function handleRetryOverride(id: string, override: RetryOverrideRequest) {
    retryWithOverride(id, override).catch(() => {
      // Silently fall back — the queue will reflect error state via WebSocket
    });
  }

  return (
    <>
    <div
      className="card p-4 animate-slide-up"
      style={{
        opacity: status === 'cancelled' ? 0.5 : 1
      }}
    >
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="relative flex-shrink-0">
          <div
            className="w-24 h-16 rounded-lg overflow-hidden"
            style={{ background: 'var(--color-bg-tertiary)' }}
          >
            {item.thumbnail ? (
              <img
                src={item.thumbnail}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <PlayIcon />
              </div>
            )}
          </div>
          {/* Duration overlay */}
          {item.duration && (
            <span
              className="absolute bottom-1 right-1 text-[10px] font-mono px-1 rounded"
              style={{
                background: 'rgba(0,0,0,0.8)',
                color: 'var(--color-text-primary)'
              }}
            >
              {formatDuration(item.duration)}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4
                className="font-medium truncate"
                style={{ color: 'var(--color-text-primary)' }}
                title={item.title}
              >
                {item.title || 'Loading...'}
              </h4>
              <p
                className="text-sm truncate"
                style={{ color: 'var(--color-text-secondary)' }}
                title={item.artist}
              >
                {item.artist || 'Unknown Artist'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`badge ${badge.className}`}>
                {badge.label}
              </span>
            </div>
          </div>

          {/* Progress */}
          {isProcessing && (
            <div className="mt-3">
              <ProgressBar
                progress={item.progress}
                status={status}
                stage={item.stage}
                showStages
              />
            </div>
          )}

          {/* Error message */}
          {status === 'error' && item.error && (
            <div className="mt-2">
              <p className="text-sm" style={{ color: 'var(--color-error)' }}>
                {item.error}
              </p>
              {item.matchCandidates && item.matchCandidates.length > 0 && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                  {item.matchCandidates.length} candidate{item.matchCandidates.length > 1 ? 's' : ''} found — click &quot;Edit &amp; Retry&quot; to select
                </p>
              )}
              {item.matchDiagnostics?.failureReason && !item.matchCandidates?.length && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                  {item.matchDiagnostics.failureReason}
                </p>
              )}
            </div>
          )}

          {/* Actions row */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              {/* Audio source badge */}
              {item.audioSource && (
                <span className="badge badge-neutral text-[10px]">
                  {item.audioSource}
                </span>
              )}
              {/* Match confidence */}
              {item.matchConfidence && (
                <span
                  className="text-xs"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  {item.matchScore}% match
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* Retry button for errors */}
              {status === 'error' && onRetry && (
                <button
                  className="btn-icon"
                  onClick={() => onRetry(item.id)}
                  title="Retry"
                >
                  <RefreshIcon />
                </button>
              )}

              {/* Edit & Retry button for errors */}
              {status === 'error' && (
                <button
                  className="btn-icon"
                  onClick={() => setShowEditModal(true)}
                  title="Edit metadata &amp; retry"
                >
                  <PencilIcon />
                </button>
              )}

              {/* Open folder for completed */}
              {status === 'complete' && item.outputPath && onOpenFolder && (
                <button
                  className="btn-icon"
                  onClick={() => onOpenFolder(item.outputPath!)}
                  title="Open folder"
                >
                  <FolderOpenIcon />
                </button>
              )}

              {/* Cancel for processing */}
              {isProcessing && (
                <button
                  className="btn-icon"
                  onClick={() => onCancel(item.id)}
                  title="Cancel"
                  style={{ color: 'var(--color-error)' }}
                >
                  <CloseIcon />
                </button>
              )}

              {/* Remove for completed/error/cancelled */}
              {['complete', 'error', 'cancelled'].includes(status) && (
                <button
                  className="btn-icon"
                  onClick={() => onRemove(item.id)}
                  title="Remove"
                >
                  <CloseIcon />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

    {showEditModal && (
      <EditMetadataModal
        item={item}
        onClose={() => setShowEditModal(false)}
        onRetry={handleRetryOverride}
      />
    )}
    </>
  );
}
