import { useState, useEffect } from 'react';
import { Header } from './layout/Header';
import * as Api from '../lib/api';

const GithubIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

const HeartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
  </svg>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const BTC_ADDRESS = 'bc1qyouflac000000000000000000000000000000';
const BTC_SHORT = 'bc1qyouflac…0000';

const FAQ_ITEMS = [
  {
    id: 'what',
    question: 'What is YouFLAC?',
    answer: 'YouFLAC downloads YouTube videos and replaces the audio with lossless FLAC from Tidal, Qobuz or Amazon Music, producing a high-quality MKV file.',
  },
  {
    id: 'subscription',
    question: 'Do I need a Tidal or Qobuz subscription?',
    answer: 'Yes. YouFLAC uses your existing credentials to fetch lossless audio. Set up your API keys in Settings.',
  },
  {
    id: 'files',
    question: 'Where are my files saved?',
    answer: 'By default in ~/MusicVideos. You can change the output directory in Settings → General.',
  },
  {
    id: 'legal',
    question: 'Is YouFLAC legal?',
    answer: 'YouFLAC is for personal use only. Always respect copyright law and the terms of service of any platform you use.',
  },
];

export function About() {
  const [version, setVersion] = useState('');
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [githubModalOpen, setGithubModalOpen] = useState(false);
  const [btcCopied, setBtcCopied] = useState(false);

  useEffect(() => {
    Api.GetAppVersion().then(setVersion).catch(console.error);
  }, []);

  function toggleFaq(id: string) {
    setOpenFaq((prev) => (prev === id ? null : id));
  }

  function handleCopyBtc() {
    navigator.clipboard.writeText(BTC_ADDRESS).then(() => {
      setBtcCopied(true);
      setTimeout(() => setBtcCopied(false), 2000);
    });
  }

  function handleOpenGithub() {
    window.open('https://github.com/kushie/youflac', '_blank');
    setGithubModalOpen(false);
  }

  return (
    <div className="min-h-screen">
      <Header title="About" subtitle="Application information" />

      <div className="px-4 md:px-8 pb-8 max-w-2xl">
        <div className="card p-8 text-center mb-8 animate-slide-up">
          {/* Logo */}
          <div className="mb-6">
            <div
              className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center relative"
              style={{
                background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-hover) 100%)'
              }}
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 4h16v16H4V4z"
                  fill="none"
                  stroke="#000"
                  strokeWidth="2"
                />
                <path
                  d="M9 8v8l7-4-7-4z"
                  fill="#000"
                />
              </svg>
              {/* Glow */}
              <div
                className="absolute inset-0 rounded-2xl blur-xl opacity-50 -z-10"
                style={{ background: 'var(--color-accent)' }}
              />
            </div>
          </div>

          <h2
            className="text-2xl font-semibold mb-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            YouFLAC
          </h2>
          <p
            className="mb-4"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            YouTube Video + Lossless FLAC = Perfect MKV
          </p>

          <span className="badge badge-accent mb-6">
            Version {version || '0.1.0'}
          </span>

          <p
            className="text-sm mb-6"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Create high-quality music video files by combining YouTube video with lossless FLAC audio from Tidal, Qobuz, or Amazon Music.
          </p>

          {/* Tech stack */}
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            <span className="badge badge-neutral">Go</span>
            <span className="badge badge-neutral">Wails v2</span>
            <span className="badge badge-neutral">React</span>
            <span className="badge badge-neutral">TypeScript</span>
            <span className="badge badge-neutral">FFmpeg</span>
            <span className="badge badge-neutral">yt-dlp</span>
          </div>

          {/* Links */}
          <div className="flex justify-center gap-4">
            <button
              className="btn-secondary flex items-center gap-2"
              onClick={() => setGithubModalOpen(true)}
            >
              <GithubIcon />
              GitHub
            </button>
          </div>
        </div>

        {/* Credits */}
        <div className="card p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <h3
            className="font-medium mb-4"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Powered by
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>yt-dlp</span>
              <span className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Video downloading</span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>FFmpeg</span>
              <span className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Video/audio muxing</span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>Wails</span>
              <span className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Desktop framework</span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>song.link</span>
              <span className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Audio source discovery</span>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="card p-6 mt-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <h3
            className="font-medium mb-4"
            style={{ color: 'var(--color-text-primary)' }}
          >
            FAQ
          </h3>
          <div className="space-y-2">
            {FAQ_ITEMS.map((item) => (
              <div key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <button
                  className="w-full flex items-center justify-between py-3 text-left"
                  onClick={() => toggleFaq(item.id)}
                  style={{ color: 'var(--color-text-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <span className="font-medium text-sm">{item.question}</span>
                  <ChevronIcon open={openFaq === item.id} />
                </button>
                {openFaq === item.id && (
                  <p
                    className="pb-3 text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {item.answer}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Support / Donations */}
        <div className="card p-6 mt-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <h3
            className="font-medium mb-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Support YouFLAC
          </h3>
          <p
            className="text-sm mb-4"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            If this tool saves you time, consider supporting development.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => window.open('https://ko-fi.com/username', '_blank')}
            >
              <HeartIcon />
              Ko-fi
            </button>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-mono"
              style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
            >
              <span>BTC: {BTC_SHORT}</span>
              <button
                className="btn-icon"
                onClick={handleCopyBtc}
                title="Copy BTC address"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                {btcCopied ? (
                  <span className="text-xs" style={{ color: 'var(--color-success)' }}>Copied!</span>
                ) : (
                  <CopyIcon />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* GitHub Warning Modal */}
      {githubModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'var(--color-overlay-heavy)' }}
          onClick={() => setGithubModalOpen(false)}
        >
          <div
            className="card p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="font-semibold text-lg mb-3"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Before opening an issue
            </h3>
            <p
              className="text-sm mb-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Please make sure you have:
            </p>
            <ul
              className="text-sm mb-4 space-y-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <li>• Checked the existing issues</li>
              <li>• Enabled Debug log level in Settings</li>
              <li>• Included your YouFLAC version and OS</li>
            </ul>
            <p
              className="text-sm mb-6"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Opening duplicate issues without this info may be closed without response.
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="btn-secondary"
                onClick={() => setGithubModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary flex items-center gap-2"
                onClick={handleOpenGithub}
              >
                <GithubIcon />
                Open GitHub
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
