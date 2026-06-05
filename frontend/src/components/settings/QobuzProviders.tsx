import { useState, useEffect } from 'react';
import * as Api from '../../lib/api';
import { Toggle } from '../ui/Toggle';

const PROVIDERS: { id: string; label: string; description: string }[] = [
  { id: 'dab', label: 'DAB', description: 'Provider via dab source' },
  { id: 'wjhe', label: 'WJHE', description: 'Provider via wjhe source' },
  { id: 'gdstudio', label: 'GD Studio', description: 'Provider via gdstudio source' },
  { id: 'musicdl', label: 'MusicDL', description: 'Provider via musicdl source' },
];

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
    const next = enabled
      ? disabled.filter((d) => d !== providerId)
      : [...disabled, providerId];
    setDisabled(next);
    setSaving(true);
    try {
      await Api.SetQobuzProviders(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      // Revert on error
      setDisabled(disabled);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2" style={{ color: 'var(--color-text-secondary)' }}>
        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
        <span className="text-sm">Loading providers…</span>
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm py-2" style={{ color: 'var(--color-error, #ef4444)' }}>{error}</p>
    );
  }

  // Show all known providers; grey out if not in available list
  return (
    <div className="space-y-1">
      {saving && (
        <p className="text-xs mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Saving…</p>
      )}
      {PROVIDERS.map((p) => {
        const isAvailable = available.length === 0 || available.includes(p.id);
        const isEnabled = !disabled.includes(p.id);
        return (
          <div key={p.id} className="flex items-center justify-between gap-4 py-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm" style={{ color: isAvailable ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>
                {p.label}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                {p.description}
              </p>
            </div>
            <div className="flex-shrink-0">
              <Toggle
                checked={isEnabled}
                onChange={(v) => toggle(p.id, v)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
