import { useState, useEffect } from 'react';
import * as Api from '../../lib/api';
import { Toggle } from '../ui/Toggle';

export function QobuzProviders() {
  const [disabled, setDisabled] = useState<string[]>([]);
  const [available, setAvailable] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Api.GetQobuzProviders()
      .then((cfg) => {
        setAvailable(cfg.available);
        setDisabled(cfg.disabled);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load providers');
      })
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (providerId: string, enabled: boolean) => {
    const prev = disabled;
    const next = enabled
      ? disabled.filter((d) => d !== providerId)
      : [...disabled, providerId];
    setDisabled(next);
    setSaving(true);
    try {
      await Api.SetQobuzProviders(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setDisabled(prev);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-lg"
      style={{ border: '1px solid var(--color-border-subtle)', overflow: 'hidden' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3"
        style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border-subtle)' }}
      >
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          Qobuz Providers
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
          Third-party proxies, no Qobuz account needed. Disable a provider if it goes down.
        </p>
      </div>

      {/* Body */}
      <div className="px-4 py-2">
        {loading && (
          <div className="flex items-center gap-2 py-3" style={{ color: 'var(--color-text-secondary)' }}>
            <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
            <span className="text-sm">Loading…</span>
          </div>
        )}

        {error && (
          <p className="text-sm py-3" style={{ color: 'var(--color-error, #ef4444)' }}>{error}</p>
        )}

        {!loading && !error && available.length === 0 && (
          <p className="text-sm py-3" style={{ color: 'var(--color-text-tertiary)' }}>
            No Qobuz providers are configured.
          </p>
        )}

        {!loading && !error && available.length > 0 && (
          <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
            {available.map((id) => {
              const isEnabled = !disabled.includes(id);
              return (
                <div key={id} className="flex items-center justify-between gap-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {id}
                    </p>
                  </div>
                  <Toggle
                    checked={isEnabled}
                    onChange={(v) => toggle(id, v)}
                  />
                </div>
              );
            })}
          </div>
        )}

        {saving && (
          <p className="text-xs py-1" style={{ color: 'var(--color-text-tertiary)' }}>Saving…</p>
        )}
      </div>
    </div>
  );
}
