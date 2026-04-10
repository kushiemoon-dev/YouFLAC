import { useState, useEffect } from 'react';
import { CheckForUpdates } from '../lib/api';

export function useUpdateCheck(): {
  hasUpdate: boolean;
  latestVersion: string;
  releaseUrl: string;
  dismiss: () => void;
} {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');
  const [releaseUrl, setReleaseUrl] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      CheckForUpdates()
        .then((result) => {
          if (result.hasUpdate) {
            setHasUpdate(true);
            setLatestVersion(result.latestVersion);
            setReleaseUrl(result.releaseUrl);
          }
        })
        .catch(() => {
          // ignore errors — graceful degradation
        });
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => setDismissed(true);

  if (dismissed) {
    return { hasUpdate: false, latestVersion, releaseUrl, dismiss };
  }

  return { hasUpdate, latestVersion, releaseUrl, dismiss };
}
