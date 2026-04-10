import { useState, useEffect, useRef } from 'react';
import { Header } from '../layout/Header';
import { Dropdown } from '../ui/Dropdown';
import * as Api from '../../lib/api';

const formatOptions = [
  { value: 'mp3', label: 'MP3', description: 'Lossy, universally compatible' },
  { value: 'wav', label: 'WAV', description: 'Uncompressed PCM audio' },
  { value: 'aac', label: 'AAC', description: 'Lossy, better than MP3' },
  { value: 'ogg', label: 'OGG Vorbis', description: 'Open-source lossy codec' },
  { value: 'alac', label: 'ALAC', description: 'Apple Lossless' },
  { value: 'flac', label: 'FLAC', description: 'Free Lossless Audio Codec' },
];

const bitrateOptions = [
  { value: '128', label: '128 kbps', description: 'Acceptable quality' },
  { value: '192', label: '192 kbps', description: 'Good quality' },
  { value: '256', label: '256 kbps', description: 'High quality' },
  { value: '320', label: '320 kbps', description: 'Maximum quality' },
];

const lossyFormats = ['mp3', 'aac', 'ogg'];

function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function Converter() {
  const [mode, setMode] = useState<'file' | 'folder'>('file');

  // file mode state
  const [sourcePath, setSourcePath] = useState('');
  const [targetFormat, setTargetFormat] = useState('mp3');
  const [bitrate, setBitrate] = useState('320');
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Api.ConvertResult | null>(null);

  // folder mode state
  const [dirPath, setDirPath] = useState('');
  const [dirFormat, setDirFormat] = useState('mp3');
  const [dirConverting, setDirConverting] = useState(false);
  const [dirError, setDirError] = useState('');
  const [dirProgress, setDirProgress] = useState<Api.DirConvertResult[]>([]);
  const [dirDone, setDirDone] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Close WS on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const handleConvert = async () => {
    if (!sourcePath.trim()) return;

    setConverting(true);
    setError('');
    setResult(null);

    try {
      const req: Api.ConvertRequest = {
        sourcePath: sourcePath.trim(),
        targetFormat,
      };

      if (lossyFormats.includes(targetFormat)) {
        req.bitrate = parseInt(bitrate);
      }

      const res = await Api.ConvertAudio(req);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setConverting(false);
    }
  };

  const handleConvertDir = async () => {
    if (!dirPath.trim()) return;

    setDirConverting(true);
    setDirError('');
    setDirProgress([]);
    setDirDone(false);

    // Open WS for progress events
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'convert_progress') {
          const data: Api.DirConvertResult = msg.data;
          setDirProgress((prev) => [...prev, data]);
          if (data.done) {
            setDirDone(true);
            setDirConverting(false);
            ws.close();
            wsRef.current = null;
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => {
      setDirError('WebSocket error while waiting for progress');
      setDirConverting(false);
      wsRef.current = null;
    };

    // Guard against server-side disconnects that never send done:true.
    ws.onclose = () => {
      if (!dirDone) {
        setDirConverting(false);
      }
      wsRef.current = null;
    };

    try {
      const opts: Api.ConvertDirOptions = {
        dir: dirPath.trim(),
        targetFormat: dirFormat,
      };
      await Api.ConvertDirectory(opts);
    } catch (err) {
      setDirError(err instanceof Error ? err.message : 'Conversion failed');
      setDirConverting(false);
      ws.close();
      wsRef.current = null;
    }
  };

  const finalResult = dirDone && dirProgress.length > 0 ? dirProgress[dirProgress.length - 1] : null;

  return (
    <div className="min-h-screen">
      <Header title="Converter" subtitle="Convert audio between formats" />

      <div className="px-4 md:px-8 pb-8 max-w-2xl">
        {/* Mode toggle */}
        <div className="flex gap-2 mb-4">
          <button
            className={mode === 'file' ? 'btn-primary' : 'btn-secondary'}
            style={{ borderRadius: '9999px', padding: '4px 18px', fontSize: '0.875rem' }}
            onClick={() => setMode('file')}
          >
            File
          </button>
          <button
            className={mode === 'folder' ? 'btn-primary' : 'btn-secondary'}
            style={{ borderRadius: '9999px', padding: '4px 18px', fontSize: '0.875rem' }}
            onClick={() => setMode('folder')}
          >
            Folder
          </button>
        </div>

        {mode === 'file' ? (
          <div className="card p-6 space-y-6">
            {/* Source file */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Source File
              </label>
              <input
                type="text"
                value={sourcePath}
                onChange={(e) => setSourcePath(e.target.value)}
                placeholder="/path/to/audio.flac"
                className="w-full"
              />
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                Full path to the audio file to convert
              </p>
            </div>

            {/* Target format */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Output Format
              </label>
              <div style={{ maxWidth: 240 }}>
                <Dropdown value={targetFormat} options={formatOptions} onChange={setTargetFormat} />
              </div>
            </div>

            {/* Bitrate (only for lossy formats) */}
            {lossyFormats.includes(targetFormat) && (
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  Bitrate
                </label>
                <div style={{ maxWidth: 240 }}>
                  <Dropdown value={bitrate} options={bitrateOptions} onChange={setBitrate} />
                </div>
              </div>
            )}

            {/* Convert button */}
            <button
              className="btn-primary flex items-center gap-2"
              onClick={handleConvert}
              disabled={converting || !sourcePath.trim()}
            >
              {converting && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                </svg>
              )}
              {converting ? 'Converting...' : 'Convert'}
            </button>

            {/* Error */}
            {error && (
              <div
                className="text-sm p-3 rounded-lg"
                style={{ background: 'var(--color-error-subtle)', color: 'var(--color-error)' }}
              >
                {error}
              </div>
            )}

            {/* Result */}
            {result && (
              <div
                className="p-4 rounded-lg"
                style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)' }}
              >
                <p className="font-medium" style={{ color: 'var(--color-success)' }}>
                  Conversion complete
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Output: {result.outputPath}
                </p>
                <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                  Format: {result.format.toUpperCase()} &middot; Size: {formatFileSize(result.size)}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="card p-6 space-y-6">
            {/* Source directory */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Source Directory
              </label>
              <input
                type="text"
                value={dirPath}
                onChange={(e) => setDirPath(e.target.value)}
                placeholder="/path/to/music/folder"
                className="w-full"
              />
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                Full path to the folder containing audio files
              </p>
            </div>

            {/* Target format */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Output Format
              </label>
              <div style={{ maxWidth: 240 }}>
                <Dropdown value={dirFormat} options={formatOptions} onChange={setDirFormat} />
              </div>
            </div>

            {/* Convert Folder button */}
            <button
              className="btn-primary flex items-center gap-2"
              onClick={handleConvertDir}
              disabled={dirConverting || !dirPath.trim()}
            >
              {dirConverting && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                </svg>
              )}
              {dirConverting ? 'Converting...' : 'Convert Folder'}
            </button>

            {/* Error */}
            {dirError && (
              <div
                className="text-sm p-3 rounded-lg"
                style={{ background: 'var(--color-error-subtle)', color: 'var(--color-error)' }}
              >
                {dirError}
              </div>
            )}

            {/* Progress list */}
            {dirProgress.length > 0 && !dirDone && (
              <div className="space-y-1">
                {dirProgress.map((item, i) => (
                  <div
                    key={i}
                    className="text-sm p-2 rounded"
                    style={{
                      background: 'var(--color-bg-secondary)',
                      color: item.error ? 'var(--color-error)' : 'var(--color-text-secondary)',
                    }}
                  >
                    {item.sourcePath}
                    {item.error && <span className="ml-2">— {item.error}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Final summary */}
            {dirDone && finalResult && (
              <div
                className="p-4 rounded-lg"
                style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)' }}
              >
                <p className="font-medium" style={{ color: 'var(--color-success)' }}>
                  Folder conversion complete
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  {finalResult.succeeded ?? 0} files converted
                  {finalResult.failed ? `, ${finalResult.failed} failed` : ''}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
