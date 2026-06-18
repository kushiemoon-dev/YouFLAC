import { useState } from 'react';
import { useSoulseek } from '../../hooks/useSoulseek';

interface SoulseekSetupProps {
  username: string;
  password: string;
  onUsernameChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
}

export function SoulseekSetup({ username, password, onUsernameChange, onPasswordChange }: SoulseekSetupProps) {
  const { status, loading, testLogin } = useSoulseek();
  const [expanded, setExpanded] = useState(!!(username));
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleTest = async () => {
    if (!username || !password) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testLogin(username, password);
      setTestResult({
        ok: result.ok,
        message: result.ok ? 'Connection successful — save to confirm.' : 'Connection failed. Check credentials.',
      });
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  const binaryOk = status?.binaryFound === true;
  const binaryVersion = status?.version ?? '';
  const binaryPath = status?.binaryPath ?? '';

  return (
    <div className="space-y-3">
      {/* Header toggle row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Soulseek
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            Peer-to-peer network — lossless fallback source
          </p>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs px-3 py-1 rounded-md"
          style={{
            background: expanded ? 'var(--color-accent, #6366f1)' : 'var(--color-bg-secondary)',
            color: expanded ? '#fff' : 'var(--color-text-secondary)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          {expanded ? 'Configure ▲' : 'Configure ▼'}
        </button>
      </div>

      {/* Binary status badge — always visible */}
      <div className="flex items-center gap-2">
        {loading ? (
          <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full" style={{ color: 'var(--color-text-tertiary)' }} />
        ) : binaryOk ? (
          <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--color-success, #22c55e) 15%, transparent)', color: 'var(--color-success, #22c55e)' }}>
            ✓ sldl {binaryVersion}
          </span>
        ) : (
          <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--color-error, #ef4444) 15%, transparent)', color: 'var(--color-error, #ef4444)' }}>
            ✗ binary not found
          </span>
        )}
        {!loading && !binaryOk && (
          <a
            href="https://github.com/fiso64/slsk-batchdl/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline"
            style={{ color: 'var(--color-accent, #6366f1)' }}
          >
            Download sldl ↗
          </a>
        )}
        {!loading && binaryOk && binaryPath && (
          <span className="text-xs font-mono" style={{ color: 'var(--color-text-tertiary)' }}>{binaryPath}</span>
        )}
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="space-y-4 mt-1">
          {/* Info box */}
          <div
            className="rounded-lg px-4 py-3 text-sm space-y-1"
            style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)' }}
          >
            <p>
              Soulseek is a peer-to-peer network used as a last-resort source when no lossless stream is available.
              It requires the <code className="text-xs">sldl</code> binary and a Soulseek account.
            </p>
            <p>
              You can use the same account as{' '}
              <a href="https://www.nicotine-plus.org/" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--color-accent, #6366f1)' }}>
                Nicotine+
              </a>.
              No account yet?{' '}
              <a href="https://www.slsknet.org/news/node/1" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--color-accent, #6366f1)' }}>
                Create a slsknet.org account ↗
              </a>
            </p>
            {!binaryOk && (
              <p className="text-xs mt-1 pt-1" style={{ borderTop: '1px solid var(--color-border-subtle)', color: 'var(--color-text-tertiary)' }}>
                Expected paths: <code>~/.local/share/flacidal/sldl</code>, <code>~/.local/bin/sldl</code>, or in PATH.
              </p>
            )}
          </div>

          {/* Credentials */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <label className="text-sm w-24 flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => onUsernameChange(e.target.value)}
                placeholder="soulseek username"
                autoComplete="username"
                style={{ flex: 1 }}
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm w-24 flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                placeholder="soulseek password"
                autoComplete="current-password"
                style={{ flex: 1 }}
              />
            </div>
          </div>

          {/* Test button + result */}
          <div className="flex items-center gap-3">
            <button
              className="btn-secondary"
              onClick={handleTest}
              disabled={testing || !username || !password || !binaryOk}
              style={{ opacity: !username || !password || !binaryOk ? 0.5 : 1 }}
            >
              {testing ? 'Testing…' : 'Test connection'}
            </button>

            {testResult && (
              <span
                className="text-sm"
                style={{ color: testResult.ok ? 'var(--color-success, #22c55e)' : 'var(--color-error, #ef4444)' }}
              >
                {testResult.ok ? '✓ ' : '✗ '}{testResult.message}
              </span>
            )}
          </div>

          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            Credentials are saved with the main config when you click "Save Changes".
          </p>
        </div>
      )}
    </div>
  );
}
