import { useState, useEffect, useRef } from 'react';
import './style.css';

import { Layout } from './components/layout/Layout';
import { Home } from './components/home/Home';
import { History } from './components/history/History';
import { Settings } from './components/settings/Settings';
import { FileManager } from './components/files/FileManager';
import { Terminal } from './components/Terminal';
import { About } from './components/About';
import { Converter } from './components/converter/Converter';
import { Resampler } from './components/resampler';
import { AnalyzerBatch } from './components/analyzer';
import { applyAccentColor } from './hooks/useAccentColor';
import { applyTheme } from './hooks/useTheme';
import { setSoundEnabled } from './hooks/useSoundEffects';
import type { Page, AccentColor } from './types';
import * as Api from './lib/api';

function App() {
  const [activePage, setActivePage] = useState<Page>('home');
  const [pendingPage, setPendingPage] = useState<Page | null>(null);
  const settingsGuardRef = useRef<(() => boolean) | null>(null);

  const handleNavigate = (page: Page) => {
    if (activePage === 'settings' && settingsGuardRef.current?.()) {
      setPendingPage(page);
    } else {
      setActivePage(page);
    }
  };

  const handleResolvePending = (confirmed: boolean) => {
    if (confirmed && pendingPage !== null) {
      setActivePage(pendingPage);
    }
    setPendingPage(null);
  };

  // Apply saved settings on startup
  useEffect(() => {
    Api.GetConfig()
      .then((config) => {
        // Apply accent color
        if (config.accentColor) {
          applyAccentColor(config.accentColor as AccentColor);
        }
        // Apply theme
        if (config.theme) {
          applyTheme(config.theme as 'dark' | 'light' | 'system');
        }
        // Set sound effects state
        setSoundEnabled(config.soundEffectsEnabled ?? true);
      })
      .catch(console.error);
  }, []);

  const renderPage = () => {
    switch (activePage) {
      case 'home':
        return <Home />;
      case 'history':
        return <History />;
      case 'settings':
        return (
          <Settings
            pendingNavigate={pendingPage}
            onResolvePending={handleResolvePending}
            onRegisterGuard={(fn) => { settingsGuardRef.current = fn; }}
          />
        );
      case 'files':
        return <FileManager />;
      case 'converter':
        return <Converter />;
      case 'terminal':
        return <Terminal />;
      case 'about':
        return <About />;
      case 'resampler':
        return <Resampler />;
      case 'analyzer-batch':
        return <AnalyzerBatch />;
      default:
        return <Home />;
    }
  };

  return (
    <Layout activePage={activePage} onNavigate={handleNavigate}>
      {renderPage()}
    </Layout>
  );
}

export default App;
