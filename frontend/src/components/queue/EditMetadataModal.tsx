import { useState } from 'react';
import type { QueueItem, AudioCandidate, RetryOverrideRequest } from '../../lib/api';

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

interface EditMetadataModalProps {
  item: QueueItem;
  onClose: () => void;
  onRetry: (id: string, override: RetryOverrideRequest) => void;
}

export function EditMetadataModal({ item, onClose, onRetry }: EditMetadataModalProps) {
  const [artist, setArtist] = useState(item.artist || '');
  const [title, setTitle] = useState(item.title || '');
  const [musicUrl, setMusicUrl] = useState(item.spotifyUrl || '');
  const [selectedCandidate, setSelectedCandidate] = useState<AudioCandidate | null>(null);

  const candidates = item.matchCandidates ?? [];

  function handleSelectCandidate(candidate: AudioCandidate) {
    setSelectedCandidate(candidate);
    setMusicUrl(candidate.url);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const override: RetryOverrideRequest = {};
    if (artist !== item.artist) override.artist = artist;
    if (title !== item.title) override.title = title;
    if (musicUrl) override.musicUrl = musicUrl;
    onRetry(item.id, override);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="card w-full max-w-md mx-4 p-0 overflow-hidden"
        style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}
        >
          <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Edit Track Metadata
          </h3>
          <button className="btn-icon" onClick={onClose} title="Close">
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', flex: 1 }}>
          <div className="px-5 py-4 flex flex-col gap-4">
            {/* Artist */}
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Artist
              </span>
              <input
                type="text"
                className="input"
                value={artist}
                onInput={(e) => setArtist((e.target as HTMLInputElement).value)}
                placeholder="Artist name"
              />
            </label>

            {/* Title */}
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Title
              </span>
              <input
                type="text"
                className="input"
                value={title}
                onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
                placeholder="Track title"
              />
            </label>

            {/* Music URL */}
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Music URL <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(Spotify / Tidal / Qobuz)</span>
              </span>
              <input
                type="url"
                className="input"
                value={musicUrl}
                onInput={(e) => { setMusicUrl((e.target as HTMLInputElement).value); setSelectedCandidate(null); }}
                placeholder="https://open.spotify.com/track/..."
              />
            </label>

            {/* Candidates */}
            {candidates.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Candidates found — select one to auto-fill URL:
                </span>
                <div className="flex flex-col gap-1">
                  {candidates.map((c, i) => (
                    <label
                      key={i}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer"
                      style={{
                        background: selectedCandidate === c
                          ? 'var(--color-accent-subtle, rgba(var(--color-accent-rgb, 99,102,241),0.12))'
                          : 'var(--color-bg-secondary)',
                        border: `1px solid ${selectedCandidate === c ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      }}
                    >
                      <input
                        type="radio"
                        name="candidate"
                        checked={selectedCandidate === c}
                        onChange={() => handleSelectCandidate(c)}
                        style={{ accentColor: 'var(--color-accent)' }}
                      />
                      <div className="flex-1 min-w-0">
                        <span
                          className="text-xs font-mono px-1.5 py-0.5 rounded mr-2"
                          style={{
                            background: 'var(--color-bg-tertiary)',
                            color: 'var(--color-text-secondary)',
                            textTransform: 'uppercase',
                          }}
                        >
                          {c.platform}
                        </span>
                        <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                          {c.artist} — {c.title}
                        </span>
                        {c.quality && (
                          <span className="ml-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                            {c.quality}
                          </span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Diagnostics hint */}
            {item.matchDiagnostics?.failureReason && (
              <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                Reason: {item.matchDiagnostics.failureReason}
              </p>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-3 px-5 py-4"
            style={{ borderTop: '1px solid var(--color-border)', flexShrink: 0 }}
          >
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Retry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
