import { ReactNode, useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import type { Page } from '../../types';

interface LayoutProps {
  children: ReactNode;
  activePage: Page;
  onNavigate: (page: Page) => void;
}

export function Layout({ children, activePage, onNavigate }: LayoutProps) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar activePage={activePage} onNavigate={onNavigate} />
      <main
        className={`flex-1 overflow-y-auto relative ${isMobile ? 'pb-14' : ''}`}
        style={{ background: 'var(--color-bg-primary)' }}
      >
        {/* Subtle gradient overlay at top */}
        <div
          className="absolute top-0 left-0 right-0 h-32 pointer-events-none z-0"
          style={{
            background: 'linear-gradient(to bottom, var(--color-accent-subtle), transparent)'
          }}
        />
        <div className="relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}
