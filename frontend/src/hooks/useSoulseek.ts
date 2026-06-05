import { useState, useEffect, useCallback } from 'react';
import * as Api from '../lib/api';
import type { SoulseekStatus, SoulseekLoginTestResult } from '../lib/api';

interface UseSoulseekReturn {
  status: SoulseekStatus | null;
  loading: boolean;
  testLogin: (username: string, password: string) => Promise<SoulseekLoginTestResult>;
}

export function useSoulseek(): UseSoulseekReturn {
  const [status, setStatus] = useState<SoulseekStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Api.GetSoulseekStatus()
      .then(setStatus)
      .catch(() => {
        setStatus({ available: false });
      })
      .finally(() => setLoading(false));
  }, []);

  const testLogin = useCallback(async (username: string, password: string): Promise<SoulseekLoginTestResult> => {
    return Api.TestSoulseekLogin(username, password);
  }, []);

  return { status, loading, testLogin };
}
