import { useState, useEffect } from 'react';
import { CheckForUpdates } from '../lib/api';

// Module-level flag so dismiss() survives remounts within the same session
let sessionDismissed = false;

export function useUpdateCheck(): {
  hasUpdate: boolean;
  latestVersion: string;
  releaseUrl: string;
  dismiss: () => void;
} {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');
  const [releaseUrl, setReleaseUrl] = useState('');
  const [dismissed, setDismissed] = useState(sessionDismissed);

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

  const dismiss = () => { sessionDismissed = true; setDismissed(true); };

  if (dismissed) {
    return { hasUpdate: false, latestVersion, releaseUrl, dismiss };
  }

  return { hasUpdate, latestVersion, releaseUrl, dismiss };
}
