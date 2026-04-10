import { useState, useRef } from 'react';
import * as Api from '../../lib/api';
import { runWithConcurrency } from '../../utils/concurrency';
import { AnalyzerBatchTable } from './AnalyzerBatchTable';
import type { BatchResult } from './AnalyzerBatchTable';

const ACCEPTED = '.flac,.mp3,.m4a,.ogg,.opus,.wav,.aiff,.alac';
const MAX_CONCURRENT_ANALYSES = 3;

export function AnalyzerBatch() {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const next = Array.from(incoming).filter(
      (f) => !files.some((existing) => existing.name === f.name && existing.size === f.size)
    );
    setFiles((prev) => [...prev, ...next]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    addFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => setDragActive(false);

  const handleAnalyzeAll = async () => {
    if (files.length === 0 || analyzing) return;

    setAnalyzing(true);

    const initial: BatchResult[] = files.map((f) => ({ fileName: f.name, status: 'pending' }));
    setResults(initial);

    const tasks = files.map((file, index) => async () => {
      setResults((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], status: 'analyzing' };
        return next;
      });

      try {
        // file.path is injected by Wails/Electron; unavailable in plain browser context.
        const path = (file as File & { path?: string }).path;
        if (!path) {
          throw new Error('Full path unavailable — batch analyzer requires the desktop app');
        }
        const analysis = await Api.AnalyzeAudio(path);
        setResults((prev) => {
          const next = [...prev];
          next[index] = { fileName: file.name, status: 'done', analysis };
          return next;
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Analysis failed';
        setResults((prev) => {
          const next = [...prev];
          next[index] = { fileName: file.name, status: 'error', error: msg };
          return next;
        });
      }
    });

    await runWithConcurrency(tasks, MAX_CONCURRENT_ANALYSES);
    setAnalyzing(false);
  };

  const hasResults = results.length > 0;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Batch Analyzer
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
          Analyze multiple audio files at once
        </p>
      </div>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        className="rounded-xl border-2 border-dashed p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors"
        style={{
          borderColor: dragActive ? 'var(--color-accent)' : 'var(--color-border-subtle)',
          background: dragActive ? 'var(--color-accent-subtle)' : 'var(--color-bg-secondary)',
        }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-tertiary)' }}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Drag & drop audio files here, or{' '}
          <span style={{ color: 'var(--color-accent)' }}>choose files</span>
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          FLAC, MP3, M4A, OGG, OPUS, WAV, AIFF, ALAC
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              {files.length} file{files.length !== 1 ? 's' : ''} selected
            </p>
            <button
              onClick={handleAnalyzeAll}
              disabled={analyzing}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
              style={{
                background: 'var(--color-accent)',
                color: '#000',
                opacity: analyzing ? 0.5 : 1,
                cursor: analyzing ? 'not-allowed' : 'pointer',
              }}
            >
              {analyzing ? 'Analyzing…' : 'Analyze All'}
            </button>
          </div>
          <ul className="rounded-lg overflow-hidden" style={{ background: 'var(--color-bg-secondary)' }}>
            {files.map((f, i) => (
              <li
                key={i}
                className="flex items-center justify-between px-4 py-2.5"
                style={{ borderBottom: i < files.length - 1 ? '1px solid var(--color-border-subtle)' : undefined }}
              >
                <span className="text-sm truncate max-w-[400px]" style={{ color: 'var(--color-text-primary)' }}>
                  {f.name}
                </span>
                <button
                  onClick={() => removeFile(i)}
                  disabled={analyzing}
                  className="ml-4 text-lg leading-none opacity-50 hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--color-text-secondary)' }}
                  aria-label={`Remove ${f.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Results table */}
      {hasResults && <AnalyzerBatchTable results={results} />}
    </div>
  );
}
