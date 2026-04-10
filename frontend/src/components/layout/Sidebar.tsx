import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import * as Api from '../../lib/api';

// SVG Icons as components
const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const SearchIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const FolderIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const TerminalIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

const InfoIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const ConverterIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 3 21 3 21 8" />
    <line x1="4" y1="20" x2="21" y2="3" />
    <polyline points="21 16 21 21 16 21" />
    <line x1="15" y1="15" x2="21" y2="21" />
    <line x1="4" y1="4" x2="9" y2="9" />
  </svg>
);

const HistoryIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const ResamplerIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12h4l3-9 4 18 3-9h6" />
  </svg>
);

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const [queueCount, setQueueCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Poll queue stats every 3s for badge count
  useEffect(() => {
    const fetchStats = () => {
      Api.GetQueueStats()
        .then((stats) => setQueueCount((stats.pending ?? 0) + (stats.active ?? 0)))
        .catch(() => {});
    };
    fetchStats();
    const timer = setInterval(fetchStats, 3000);
    return () => clearInterval(timer);
  }, []);

  const navItems: { id: Page | 'search'; icon: React.FC; label: string; targetPage: Page; iconClass: string }[] = [
    { id: 'home', icon: HomeIcon, label: 'Home', targetPage: 'home', iconClass: 'icon-home' },
    { id: 'search', icon: SearchIcon, label: 'Search', targetPage: 'home', iconClass: 'icon-search' },
    { id: 'history', icon: HistoryIcon, label: 'History', targetPage: 'history', iconClass: 'icon-history' },
    { id: 'files', icon: FolderIcon, label: 'Files', targetPage: 'files', iconClass: 'icon-files' },
    { id: 'converter', icon: ConverterIcon, label: 'Converter', targetPage: 'converter', iconClass: 'icon-converter' },
    { id: 'resampler', icon: ResamplerIcon, label: 'Resampler', targetPage: 'resampler', iconClass: 'icon-resampler' },
  ];

  const bottomItems: { id: Page; icon: React.FC; label: string; iconClass: string }[] = [
    { id: 'terminal', icon: TerminalIcon, label: 'Terminal', iconClass: 'icon-terminal' },
    { id: 'settings', icon: SettingsIcon, label: 'Settings', iconClass: 'icon-settings' },
    { id: 'about', icon: InfoIcon, label: 'About', iconClass: 'icon-about' },
  ];

  const mobileItems = [
    ...navItems,
    { id: 'settings' as const, icon: SettingsIcon, label: 'Settings', targetPage: 'settings' as Page },
  ];

  if (isMobile) {
    return (
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around h-14"
        style={{
          background: 'var(--color-bg-secondary)',
          borderTop: '1px solid var(--color-border-subtle)',
        }}
      >
        {mobileItems.map((item) => {
          const isActive = item.id === 'search'
            ? false
            : activePage === item.targetPage;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.targetPage)}
              className="sidebar-item"
              style={{ width: 40, height: 40 }}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              data-active={isActive}
            >
              <item.icon />
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <aside
      className="flex flex-col items-center py-4 w-[64px] min-h-screen"
      style={{
        background: 'var(--color-bg-secondary)',
        borderRight: '1px solid var(--color-border-subtle)'
      }}
    >
      {/* Logo */}
      <div className="mb-6 relative">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-hover) 100%)'
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M4 4h16v16H4V4z" fill="none" stroke="#000" strokeWidth="2" />
            <path d="M9 8v8l7-4-7-4z" fill="#000" />
          </svg>
        </div>
        {/* Glow effect */}
        <div
          className="absolute inset-0 rounded-xl opacity-40 blur-lg -z-10"
          style={{ background: 'var(--color-accent)' }}
        />
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-2 flex-1">
        {navItems.map((item, index) => {
          const isActive = item.id === 'search'
            ? false  // Search is a shortcut to Home, never "active"
            : activePage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.targetPage)}
              className={`sidebar-item animate-slide-in stagger-${index + 1}`}
              style={{ animationFillMode: 'backwards' }}
              title={item.label}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              data-active={isActive}
            >
              <div className="relative">
                <span className={`icon-anim ${item.iconClass}`}><item.icon /></span>
                {/* Badge count on Home icon */}
                {item.id === 'home' && queueCount > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center text-[10px] font-bold leading-none"
                    style={{
                      background: 'var(--color-accent)',
                      color: '#000',
                    }}
                  >
                    {queueCount > 99 ? '99+' : queueCount}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </nav>

      {/* Bottom items */}
      <div className="flex flex-col gap-2 mt-auto">
        {bottomItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="sidebar-item"
            title={item.label}
            aria-label={item.label}
            aria-current={activePage === item.id ? 'page' : undefined}
            data-active={activePage === item.id}
          >
            <span className={`icon-anim ${item.iconClass}`}><item.icon /></span>
          </button>
        ))}
      </div>
    </aside>
  );
}
