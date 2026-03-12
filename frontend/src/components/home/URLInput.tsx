import { useState, useCallback } from 'react';
import * as Api from '../../lib/api';
import type { VideoInfo } from '../../lib/api';

// Icons
const LinkIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const LoaderIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
  </svg>
);

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const PlayIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

type Tab = 'url' | 'search';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatViewCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M views`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K views`;
  return `${count} views`;
}

interface URLInputProps {
  onAdd: (videoUrl: string, spotifyUrl?: string) => Promise<void>;
}

export function URLInput({ onAdd }: URLInputProps) {
  const [activeTab, setActiveTab] = useState<Tab>('url');
  const [url, setUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<VideoInfo | null>(null);
  const [searchResults, setSearchResults] = useState<VideoInfo[]>([]);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [previewVideoId, setPreviewVideoId] = useState<string | null>(null);

  const handleURLSubmit = useCallback(async () => {
    if (!url.trim()) return;

    setLoading(true);
    setError('');

    try {
      const trimmedUrl = url.trim();
      const isPlaylist = trimmedUrl.includes('list=') && !trimmedUrl.includes('v=');
      const isChannel = /youtube\.com\/(@|channel\/|c\/|user\/)/.test(trimmedUrl);

      if (isPlaylist || isChannel) {
        const ids = await Api.AddPlaylistToQueue(trimmedUrl);
        setUrl('');
        setPreview(null);
        if (ids.length === 0) {
          setError('No videos found');
        }
      } else {
        const videoInfo = await Api.GetVideoInfo(trimmedUrl);
        if (videoInfo) {
          setPreview(videoInfo);
          await onAdd(trimmedUrl);
          setUrl('');
          setPreview(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process URL');
    } finally {
      setLoading(false);
    }
  }, [url, onAdd]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError('');
    setSearchResults([]);

    try {
      const results = await Api.SearchYouTube(searchQuery.trim());
      setSearchResults(results);
      if (results.length === 0) {
        setError('No results found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  const handleAddSearchResult = useCallback(async (result: VideoInfo) => {
    setAddingIds((prev) => new Set(prev).add(result.id));
    try {
      await onAdd(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(result.id);
        return next;
      });
    }
  }, [onAdd]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      if (activeTab === 'url') handleURLSubmit();
      else handleSearch();
    }
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="tabs inline-flex">
        <button
          className={`tab ${activeTab === 'url' ? 'active' : ''}`}
          onClick={() => { setActiveTab('url'); setError(''); }}
        >
          <span className="flex items-center gap-2">
            <LinkIcon />
            URL
          </span>
        </button>
        <button
          className={`tab ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => { setActiveTab('search'); setError(''); }}
        >
          <span className="flex items-center gap-2">
            <SearchIcon />
            Search
          </span>
        </button>
      </div>

      {/* Input area */}
      {activeTab === 'url' ? (
        <div className="flex gap-3">
          <div className="relative flex-1">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste YouTube, Spotify, or music video URL..."
              className="w-full pr-12"
              disabled={loading}
            />
            {url && !loading && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 btn-icon"
                onClick={() => setUrl('')}
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          <button
            className="btn-primary flex items-center gap-2"
            onClick={handleURLSubmit}
            disabled={loading || !url.trim()}
          >
            {loading ? <LoaderIcon /> : <PlusIcon />}
            {loading ? 'Adding...' : 'Add'}
          </button>
        </div>
      ) : (
        <div className="flex gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search for artist or song on YouTube..."
              className="w-full pr-12"
              disabled={loading}
            />
            {searchQuery && !loading && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 btn-icon"
                onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          <button
            className="btn-primary flex items-center gap-2"
            onClick={handleSearch}
            disabled={loading || !searchQuery.trim()}
          >
            {loading ? <LoaderIcon /> : <SearchIcon />}
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          className="text-sm p-3 rounded-lg"
          style={{
            background: 'var(--color-error-subtle)',
            color: 'var(--color-error)'
          }}
        >
          {error}
        </div>
      )}

      {/* URL Preview card */}
      {activeTab === 'url' && preview && (
        <div className="card p-4 animate-slide-up">
          <div className="flex gap-4">
            <div
              className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0"
              style={{ background: 'var(--color-bg-tertiary)' }}
            >
              {preview.thumbnail && (
                <img
                  src={preview.thumbnail}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div>
              <h4
                className="font-medium"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {preview.title}
              </h4>
              <p
                className="text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {preview.artist}
              </p>
              {preview.duration > 0 && (
                <p
                  className="text-sm mt-1"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  {formatDuration(preview.duration)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {activeTab === 'search' && searchResults.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
          </p>
          {searchResults.map((result) => (
            <div
              key={result.id}
              className="card-hover p-3 flex gap-3 items-center animate-slide-up cursor-pointer"
              onClick={() => handleAddSearchResult(result)}
            >
              {/* Thumbnail */}
              <div className="relative flex-shrink-0">
                <div
                  className="w-28 h-16 rounded-lg overflow-hidden"
                  style={{ background: 'var(--color-bg-tertiary)' }}
                >
                  {result.thumbnail && (
                    <img
                      src={result.thumbnail}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                {result.duration > 0 && (
                  <span
                    className="absolute bottom-1 right-1 text-[10px] font-mono px-1 rounded"
                    style={{ background: 'var(--color-overlay-heavy)', color: 'var(--color-text-primary)' }}
                  >
                    {formatDuration(result.duration)}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h4
                  className="font-medium text-sm truncate"
                  style={{ color: 'var(--color-text-primary)' }}
                  title={result.title}
                >
                  {result.title}
                </h4>
                <p
                  className="text-xs truncate"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {result.artist || result.channel}
                </p>
                {(result.viewCount ?? 0) > 0 && (
                  <p
                    className="text-[10px] mt-0.5"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    {formatViewCount(result.viewCount!)}
                  </p>
                )}
              </div>

              {/* Preview button */}
              <button
                className="btn-icon flex-shrink-0"
                style={{ color: 'var(--color-text-secondary)' }}
                onClick={(e) => { e.stopPropagation(); setPreviewVideoId(result.id); }}
                title="Preview"
              >
                <PlayIcon />
              </button>

              {/* Add button */}
              <button
                className="btn-icon flex-shrink-0"
                style={{ color: 'var(--color-accent)' }}
                onClick={(e) => { e.stopPropagation(); handleAddSearchResult(result); }}
                disabled={addingIds.has(result.id)}
                title="Add to queue"
              >
                {addingIds.has(result.id) ? <LoaderIcon /> : <PlusIcon />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Supported platforms hint */}
      {activeTab === 'url' && (
        <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          <span>Supported:</span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-4 rounded flex items-center justify-center text-[11px] font-bold" style={{ background: 'color-mix(in srgb, var(--color-error) 20%, transparent)', color: 'var(--color-error)' }}>Y</span>
            YouTube
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-4 rounded flex items-center justify-center text-[11px] font-bold" style={{ background: 'color-mix(in srgb, var(--color-success) 20%, transparent)', color: 'var(--color-success)' }}>S</span>
            Spotify
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-4 rounded flex items-center justify-center text-[11px] font-bold" style={{ background: 'color-mix(in srgb, var(--color-info) 20%, transparent)', color: 'var(--color-info)' }}>T</span>
            Tidal
          </span>
        </div>
      )}

      {/* Video Preview Modal */}
      {previewVideoId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'var(--color-overlay-heavy)' }}
          onClick={() => setPreviewVideoId(null)}
        >
          <div
            className="relative w-full max-w-2xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute -top-10 right-0 btn-icon"
              style={{ color: 'var(--color-text-primary)' }}
              onClick={() => setPreviewVideoId(null)}
              title="Close preview"
            >
              <CloseIcon />
            </button>
            <div className="rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
              <iframe
                src={`https://www.youtube.com/embed/${previewVideoId}?autoplay=1`}
                title="Video preview"
                allow="autoplay; encrypted-media"
                allowFullScreen
                className="w-full h-full"
                style={{ border: 'none' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
