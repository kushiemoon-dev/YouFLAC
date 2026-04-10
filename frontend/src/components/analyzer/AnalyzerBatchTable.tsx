import type { AudioAnalysis } from '../../lib/api';

export interface BatchResult {
  fileName: string;
  status: 'pending' | 'analyzing' | 'done' | 'error';
  analysis?: AudioAnalysis;
  error?: string;
}

interface Props {
  results: BatchResult[];
}

const qualityColor = (rating: string): string => {
  switch (rating) {
    case 'Excellent': return 'var(--color-success)';
    case 'Good':      return 'var(--color-accent)';
    case 'Fair':      return 'var(--color-warning)';
    default:          return 'var(--color-error)';
  }
};

const qualityBg = (rating: string): string => {
  switch (rating) {
    case 'Excellent': return 'var(--color-success-subtle)';
    case 'Good':      return 'var(--color-accent-subtle)';
    case 'Fair':      return 'var(--color-warning-subtle)';
    default:          return 'var(--color-error-subtle)';
  }
};

const formatSampleRate = (hz: number) =>
  hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${hz} Hz`;

export function AnalyzerBatchTable({ results }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg" style={{ background: 'var(--color-bg-secondary)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
            {['File', 'Codec', 'Sample Rate', 'Bit Depth', 'Quality', 'Status'].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((row, i) => (
            <tr
              key={i}
              style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
            >
              {/* File */}
              <td className="px-4 py-3 max-w-[200px] truncate" style={{ color: 'var(--color-text-primary)' }} title={row.fileName}>
                {row.fileName}
              </td>

              {/* Codec */}
              <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                {row.analysis ? row.analysis.codec?.toUpperCase() || '—' : '—'}
              </td>

              {/* Sample Rate */}
              <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                {row.analysis ? formatSampleRate(row.analysis.sampleRate) : '—'}
              </td>

              {/* Bit Depth */}
              <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                {row.analysis ? (row.analysis.bitsPerSample ? `${row.analysis.bitsPerSample}-bit` : '—') : '—'}
              </td>

              {/* Quality badge */}
              <td className="px-4 py-3">
                {row.analysis ? (
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{
                      background: qualityBg(row.analysis.qualityRating),
                      color: qualityColor(row.analysis.qualityRating),
                    }}
                  >
                    {row.analysis.qualityRating}
                  </span>
                ) : '—'}
              </td>

              {/* Status */}
              <td className="px-4 py-3">
                {row.status === 'pending' && (
                  <span className="flex items-center gap-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-text-tertiary)' }} />
                    Pending
                  </span>
                )}
                {row.status === 'analyzing' && (
                  <span className="flex items-center gap-1.5" style={{ color: 'var(--color-accent)' }}>
                    <span
                      className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                      style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }}
                    />
                    Analyzing
                  </span>
                )}
                {row.status === 'done' && (
                  <span className="flex items-center gap-1.5" style={{ color: 'var(--color-success)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Done
                  </span>
                )}
                {row.status === 'error' && (
                  <span
                    className="cursor-default"
                    title={row.error || 'Unknown error'}
                    style={{ color: 'var(--color-error)' }}
                  >
                    Error
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
