import { useEffect, useMemo, useRef, useState } from 'react';
import { GetItemLogs, type LogEntry } from '../../lib/api';

interface DebugLogsModalProps {
  itemId: string;
  onClose: () => void;
}

type LevelFilter = 'all' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export function DebugLogsModal({ itemId, onClose }: DebugLogsModalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [level, setLevel] = useState<LevelFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    GetItemLogs(itemId)
      .then((l) => { if (alive) setLogs(l); })
      .catch((e) => { if (alive) setError(String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [itemId]);

  const filtered = useMemo(
    () => (level === 'all' ? logs : logs.filter((l) => l.level === level)),
    [logs, level],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [filtered]);

  async function handleCopy() {
    const text = filtered
      .map((l) => `[${l.time}] ${l.level} ${l.message}${l.fields ? ' ' + l.fields : ''}`)
      .join('\n');
    await navigator.clipboard.writeText(text);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="card w-full mx-4 p-0 overflow-hidden"
        style={{ maxWidth: 800, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}
        >
          <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Debug logs
          </h3>
          <div className="flex items-center gap-2">
            <label
              className="text-xs flex items-center gap-1.5"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Level
              <select
                aria-label="Level"
                value={level}
                onChange={(e) => setLevel(e.target.value as LevelFilter)}
                className="text-xs rounded px-1.5 py-0.5"
                style={{
                  background: 'var(--color-bg-tertiary)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <option value="all">All</option>
                <option value="DEBUG">Debug</option>
                <option value="INFO">Info</option>
                <option value="WARN">Warn</option>
                <option value="ERROR">Error</option>
              </select>
            </label>
            <button className="btn-ghost text-xs" onClick={handleCopy}>
              Copy
            </button>
            <button className="btn-icon" onClick={onClose} title="Close">
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto font-mono text-xs p-3"
          style={{ background: 'var(--color-bg-tertiary)', minHeight: 240 }}
        >
          {loading && (
            <div style={{ color: 'var(--color-text-tertiary)' }}>Loading logs…</div>
          )}
          {error && (
            <div style={{ color: 'var(--color-error)' }}>{error}</div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div style={{ color: 'var(--color-text-tertiary)' }}>
              No logs for this item.
            </div>
          )}
          {filtered.map((l) => (
            <div key={l.id} className="whitespace-pre-wrap py-0.5">
              <span style={{ color: 'var(--color-text-tertiary)' }}>[{l.time}]</span>{' '}
              <span
                style={{
                  color:
                    l.level === 'ERROR'
                      ? 'var(--color-error)'
                      : l.level === 'WARN'
                      ? 'var(--color-warning)'
                      : 'var(--color-text-secondary)',
                }}
              >
                {l.level}
              </span>{' '}
              <span style={{ color: 'var(--color-text-primary)' }}>{l.message}</span>
              {l.fields && (
                <span style={{ color: 'var(--color-text-tertiary)' }}> {l.fields}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
