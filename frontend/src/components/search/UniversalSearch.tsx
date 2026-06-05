import { useState, useEffect, useRef } from 'react';
import { useUniversalSearch } from '../../hooks/useUniversalSearch';
import * as Api from '../../lib/api';

function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function UniversalSearch() {
  const [query, setQuery] = useState('');
  const [addingIsrc, setAddingIsrc] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const { results, loading, error, search } = useUniversalSearch();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  const handleAddToQueue = async (result: Api.UniversalSearchResult) => {
    setAddingIsrc(result.isrc ?? result.url);
    setAddError(null);
    try {
      await Api.AddToQueue({ videoUrl: result.url });
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add to queue');
    } finally {
      setAddingIsrc(null);
    }
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="px-4 md:px-8 py-6">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Universal Search
        </h2>

        {/* Search input */}
        <div className="relative mb-6">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, artist, ISRC…"
            className="w-full"
            style={{ paddingLeft: '2.5rem' }}
            autoFocus
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        </div>

        {/* States */}
        {loading && (
          <div className="flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
            <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
            <span className="text-sm">Searching…</span>
          </div>
        )}

        {error && !loading && (
          <p className="text-sm" style={{ color: 'var(--color-error, #ef4444)' }}>{error}</p>
        )}

        {addError && (
          <p className="text-sm mb-2" style={{ color: 'var(--color-error, #ef4444)' }}>{addError}</p>
        )}

        {/* Results grid */}
        {!loading && results.length > 0 && (
          <div className="grid gap-3">
            {results.map((result, i) => {
              const itemKey = result.isrc ?? `${result.url}-${i}`;
              const isAdding = addingIsrc === (result.isrc ?? result.url);
              return (
                <div
                  key={itemKey}
                  className="flex items-center gap-4 rounded-xl p-3"
                  style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)' }}
                >
                  {/* Thumbnail */}
                  {result.thumbnail ? (
                    <img
                      src={result.thumbnail}
                      alt=""
                      className="w-12 h-12 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <div
                      className="w-12 h-12 rounded flex-shrink-0"
                      style={{ background: 'var(--color-bg-tertiary)' }}
                    />
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm" style={{ color: 'var(--color-text-primary)' }}>
                      {result.title}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                      {result.artist}{result.album ? ` — ${result.album}` : ''}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {result.isrc && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded font-mono"
                          style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}
                        >
                          {result.isrc}
                        </span>
                      )}
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}
                      >
                        {result.source}
                      </span>
                      {result.duration && (
                        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                          {formatDuration(result.duration)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Add button */}
                  <button
                    className="btn-primary flex-shrink-0 text-sm"
                    onClick={() => handleAddToQueue(result)}
                    disabled={isAdding}
                    style={{ opacity: isAdding ? 0.5 : 1 }}
                  >
                    {isAdding ? '…' : '+ Queue'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {!loading && !error && query.trim() && results.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            No results for "{query}"
          </p>
        )}
      </div>
    </div>
  );
}
