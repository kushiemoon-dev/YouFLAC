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
});
