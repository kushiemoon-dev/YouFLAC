import { useState, useRef } from 'react';
import { useSources } from '../../hooks/useSources';
import type { SourceInfo } from '../../lib/api';

export function SourcePriority() {
  const { sources, loading, error, setPriority } = useSources();
  const [ordered, setOrdered] = useState<SourceInfo[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Sync local order with loaded sources (once)
  const initialized = useRef(false);
  if (!initialized.current && sources.length > 0) {
    setOrdered(sources);
    initialized.current = true;
  }

  const dragSrc = useRef<number | null>(null);

  const handleDragStart = (index: number) => {
    dragSrc.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragSrc.current === null || dragSrc.current === index) return;
    const next = [...ordered];
    const [moved] = next.splice(dragSrc.current, 1);
    next.splice(index, 0, moved);
    dragSrc.current = index;
    setOrdered(next);
    setIsDirty(true);
  };

  const handleDragEnd = () => {
    dragSrc.current = null;
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await setPriority(ordered.map((s) => s.name));
      setIsDirty(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save priority');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2" style={{ color: 'var(--color-text-secondary)' }}>
        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
        <span className="text-sm">Loading sources…</span>
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm py-2" style={{ color: 'var(--color-error, #ef4444)' }}>
        {error}
      </p>
    );
  }

  return (
    <div>
      <ul className="space-y-2 mb-3">
        {ordered.map((source, index) => (
          <li
            key={source.name}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing select-none"
            style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)' }}
          >
            {/* drag handle */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
              <circle cx="4" cy="3" r="1.2" /><circle cx="10" cy="3" r="1.2" />
              <circle cx="4" cy="7" r="1.2" /><circle cx="10" cy="7" r="1.2" />
              <circle cx="4" cy="11" r="1.2" /><circle cx="10" cy="11" r="1.2" />
            </svg>

            {/* availability dot */}
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: source.available ? 'var(--color-success, #22c55e)' : 'var(--color-text-tertiary)' }}
              title={source.available ? 'Available' : 'Unavailable'}
            />

            <span className="flex-1 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {source.displayName}
            </span>

            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              #{index + 1}
            </span>
          </li>
        ))}
      </ul>

      {saveError && (
        <p className="text-sm mb-2" style={{ color: 'var(--color-error, #ef4444)' }}>{saveError}</p>
      )}

      <button
        className="btn-primary"
        onClick={handleSave}
        disabled={!isDirty || saving}
        style={{ opacity: !isDirty || saving ? 0.5 : 1 }}
      >
        {saving ? 'Saving…' : 'Save Order'}
      </button>
    </div>
  );
}
