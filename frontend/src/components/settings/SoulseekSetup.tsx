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
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; details: string } | null>(null);

  const handleTest = async () => {
    if (!username || !password) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testLogin(username, password);
      setTestResult(result);
    } catch (err) {
      setTestResult({ ok: false, details: err instanceof Error ? err.message : 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  const binaryStatus = () => {
    if (loading) return null;
    if (!status) return null;
    if (status.available) {
      return (
        <span className="text-sm font-mono" style={{ color: 'var(--color-success, #22c55e)' }}>
          ✓ sldl {status.version ?? ''}
        </span>
      );
    }
    return (
      <span className="text-sm font-mono" style={{ color: 'var(--color-error, #ef4444)' }}>
        ✗ binary not found
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Info box */}
      <div
        className="rounded-lg px-4 py-3 text-sm"
        style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)' }}
      >
        <p className="font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>About Soulseek</p>
        <p>Soulseek is a peer-to-peer network used as a last-resort source when no lossless stream is found. It requires the <code>sldl</code> binary and a Soulseek account.</p>
      </div>

      {/* Binary status */}
      <div className="flex items-center gap-2">
        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Binary status:</span>
        {loading ? (
          <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full" style={{ color: 'var(--color-text-tertiary)' }} />
        ) : binaryStatus()}
      </div>

      {/* Credentials */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <label className="text-sm w-24 flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }}>Username</label>
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
          <label className="text-sm w-24 flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }}>Password</label>
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
          disabled={testing || !username || !password}
          style={{ opacity: !username || !password ? 0.5 : 1 }}
        >
          {testing ? 'Testing…' : 'Test connection'}
        </button>

        {testResult && (
          <span
            className="text-sm"
            style={{ color: testResult.ok ? 'var(--color-success, #22c55e)' : 'var(--color-error, #ef4444)' }}
          >
            {testResult.ok ? '✓ ' : '✗ '}{testResult.details}
          </span>
        )}
      </div>

      <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        Credentials are saved with the main config when you click "Save Changes".
      </p>
    </div>
  );
}
