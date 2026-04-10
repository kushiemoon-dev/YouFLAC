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
  onArtistClick?: (artist: string) => void;
  onAlbumClick?: (album: string) => void;
  onViewLogs?: (id: string) => void;
}

const SkipIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 4 15 12 5 20 5 4" />
    <line x1="19" y1="5" x2="19" y2="19" />
  </svg>
);

const FileTextIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);

function getStatusBadge(status: QueueStatus, stage?: string): { label: string; className: string } {
  // Detect skipped items (real status or legacy stage-based)
  if (status === 'skipped' || (status === 'complete' && stage?.includes('Skipped'))) {
    return { label: 'Skipped (existing file)', className: 'badge-neutral' };
  }
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
    case 'paused':
      return { label: 'Paused', className: 'badge-neutral' };
    default:
      return { label: 'Unknown', className: 'badge-neutral' };
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function QueueItem({
  item,
  onCancel,
  onRemove,
  onRetry,
  onOpenFolder,
  onArtistClick,
  onAlbumClick,
  onViewLogs,
}: QueueItemProps) {
  const status = item.status as QueueStatus;
  const isProcessing = !['complete', 'error', 'cancelled', 'pending', 'skipped'].includes(status);
  const badge = getStatusBadge(status, item.stage);
  const isSkipped = status === 'skipped' || (status === 'complete' && item.stage?.includes('Skipped'));
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const hasDiagnostics = item.matchDiagnostics || (item.matchCandidates && item.matchCandidates.length > 0);
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
                background: 'var(--color-overlay-heavy)',
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
                {onArtistClick && item.artist ? (
                  <button
                    type="button"
                    onClick={() => onArtistClick(item.artist)}
                    className="hover:underline cursor-pointer bg-transparent border-none p-0"
                    style={{ color: 'inherit', font: 'inherit' }}
                  >
                    {item.artist}
                  </button>
                ) : (
                  item.artist || 'Unknown Artist'
                )}
                {item.album && (
                  <>
                    {' — '}
                    {onAlbumClick ? (
                      <button
                        type="button"
                        onClick={() => onAlbumClick(item.album!)}
                        className="hover:underline cursor-pointer bg-transparent border-none p-0"
                        style={{ color: 'inherit', font: 'inherit' }}
                      >
                        {item.album}
                      </button>
                    ) : (
                      <span>{item.album}</span>
                    )}
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {item.explicit && (
                <span
                  className="badge text-[10px] font-bold"
                  style={{ background: 'var(--color-warning)', color: 'var(--color-bg-primary)' }}
                  title="Explicit content"
                >
                  E
                </span>
              )}
              <span className={`badge ${badge.className} flex items-center gap-1`}>
                {isSkipped && <SkipIcon />}
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
              {/* Actual quality */}
              {item.actualQuality && (
                <span className="badge badge-neutral text-[10px]">
                  {item.actualQuality}
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
              {/* Diagnostics toggle */}
              {hasDiagnostics && ['complete', 'error'].includes(status) && (
                <button
                  className="text-[10px] underline cursor-pointer"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  onClick={() => setShowDiagnostics(!showDiagnostics)}
                >
                  {showDiagnostics ? 'hide details' : 'details'}
                </button>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* View logs */}
              {onViewLogs && (
                <button
                  className="btn-icon"
                  onClick={() => onViewLogs(item.id)}
                  title="View logs"
                >
                  <FileTextIcon />
                </button>
              )}

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

      {/* Diagnostics panel */}
      {showDiagnostics && hasDiagnostics && (
        <div
          className="mt-3 pt-3 text-xs space-y-1.5"
          style={{ borderTop: '1px solid var(--color-border-subtle)', color: 'var(--color-text-tertiary)' }}
        >
          {item.matchDiagnostics?.sourcesTried && (
            <div>
              <span className="font-medium">Sources tried: </span>
              {item.matchDiagnostics.sourcesTried.join(' → ')}
            </div>
          )}
          {item.matchDiagnostics?.failureReason && (
            <div>
              <span className="font-medium">Failure: </span>
              {item.matchDiagnostics.failureReason}
            </div>
          )}
          {item.matchCandidates && item.matchCandidates.length > 0 && (
            <div>
              <span className="font-medium">Candidates ({item.matchCandidates.length}):</span>
              <div className="mt-1 space-y-0.5 ml-2">
                {item.matchCandidates.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="badge badge-neutral text-[9px]">{c.platform}</span>
                    <span className="truncate">{c.artist} - {c.title}</span>
                    {c.quality && <span className="text-[9px] opacity-60">{c.quality}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
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
