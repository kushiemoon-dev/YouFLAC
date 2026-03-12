import { useState } from 'react';
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
  const [sourcePath, setSourcePath] = useState('');
  const [targetFormat, setTargetFormat] = useState('mp3');
  const [bitrate, setBitrate] = useState('320');
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Api.ConvertResult | null>(null);

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

  return (
    <div className="min-h-screen">
      <Header title="Converter" subtitle="Convert audio between formats" />

      <div className="px-4 md:px-8 pb-8 max-w-2xl">
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
      </div>
    </div>
  );
}
