import { useState, useCallback } from 'react';
import * as Api from '../lib/api';
import type { UniversalSearchResult } from '../lib/api';

interface UseUniversalSearchReturn {
  results: UniversalSearchResult[];
  loading: boolean;
  error: string | null;
  search: (query: string) => void;
}

export function useUniversalSearch(): UseUniversalSearchReturn {
  const [results, setResults] = useState<UniversalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback((query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    Api.UniversalSearch(query)
      .then(setResults)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return { results, loading, error, search };
}
