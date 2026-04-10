import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueueItem } from './QueueItem';
import type { QueueItem as QueueItemType } from '../../lib/api';

const base = {
  id: '1',
  videoUrl: '',
  title: 'Song',
  artist: 'Artist',
  album: 'Album',
  status: 'skipped',
  progress: 100,
  stage: 'Skipped (existing file)',
  createdAt: '2026-04-10T10:00:00Z',
  explicit: true,
  audioSource: 'tidal',
} as unknown as QueueItemType;

const failedItem = {
  id: '2',
  videoUrl: '',
  title: 'Failed Song',
  artist: 'Artist',
  status: 'error',
  progress: 0,
  stage: '',
  createdAt: '2026-04-10T10:00:00Z',
  error: 'all download attempts failed for this track',
  matchDiagnostics: {
    sourcesTried: ['tidal', 'qobuz'],
    failureReason: 'all_download_attempts_failed',
    bestScore: 0,
  },
} as unknown as QueueItemType;

describe('QueueItem', () => {
  it('shows skipped badge for StatusSkipped', () => {
    render(<QueueItem item={base} onCancel={() => {}} onRemove={() => {}} />);
    expect(screen.getByText(/Skipped \(existing file\)/i)).toBeInTheDocument();
  });

  it('shows explicit badge', () => {
    render(<QueueItem item={base} onCancel={() => {}} onRemove={() => {}} />);
    expect(screen.getByTitle('Explicit content')).toBeInTheDocument();
  });

  it('calls onArtistClick when artist clicked', () => {
    const onArtistClick = vi.fn();
    render(
      <QueueItem
        item={base}
        onCancel={() => {}}
        onRemove={() => {}}
        onArtistClick={onArtistClick}
      />,
    );
    fireEvent.click(screen.getByText('Artist'));
    expect(onArtistClick).toHaveBeenCalledWith('Artist');
  });

  it('calls onViewLogs when View Logs clicked', () => {
    const onViewLogs = vi.fn();
    render(
      <QueueItem
        item={base}
        onCancel={() => {}}
        onRemove={() => {}}
        onViewLogs={onViewLogs}
      />,
    );
    fireEvent.click(screen.getByTitle('View logs'));
    expect(onViewLogs).toHaveBeenCalledWith('1');
  });

  it('displays truncated error message for failed item', () => {
    render(<QueueItem item={failedItem} onCancel={() => {}} onRemove={() => {}} />);
    expect(screen.getByText(/all download attempts failed/i)).toBeInTheDocument();
  });

  it('shows Fix button for failed items', () => {
    render(<QueueItem item={failedItem} onCancel={() => {}} onRemove={() => {}} />);
    expect(screen.getByTitle('Fix — retry with source')).toBeInTheDocument();
  });

  it('shows source select and Retry button after clicking Fix', () => {
    render(<QueueItem item={failedItem} onCancel={() => {}} onRemove={() => {}} />);
    fireEvent.click(screen.getByTitle('Fix — retry with source'));
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Retry$/ })).toBeInTheDocument();
  });

  it('shows sourcesTried hint when matchDiagnostics available', () => {
    render(<QueueItem item={failedItem} onCancel={() => {}} onRemove={() => {}} />);
    expect(screen.getByText(/Tried:/i)).toBeInTheDocument();
  });
});
