import { useState, useEffect, useCallback } from 'react';
import * as Api from '../lib/api';
import type { SourceInfo } from '../lib/api';

interface UseSourcesReturn {
  sources: SourceInfo[];
  loading: boolean;
  error: string | null;
  setPriority: (names: string[]) => Promise<void>;
}

export function useSources(): UseSourcesReturn {
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Api.GetSources()
      .then(setSources)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load sources');
      })
      .finally(() => setLoading(false));
  }, []);

  const setPriority = useCallback(async (names: string[]) => {
    await Api.SetSourcePriority(names);
    setSources((prev) =>
      [...prev].sort((a, b) => names.indexOf(a.name) - names.indexOf(b.name))
    );
  }, []);

  return { sources, loading, error, setPriority };
}
