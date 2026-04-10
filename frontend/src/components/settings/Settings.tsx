import { useState, useEffect } from 'react';
import { Header } from '../layout/Header';
import { Toggle } from '../ui/Toggle';
import { Dropdown } from '../ui/Dropdown';
import { ColorPicker } from '../ui/ColorPicker';
import { useSettings } from '../../hooks/useSettings';
import { applyAccentColor } from '../../hooks/useAccentColor';
import { applyTheme } from '../../hooks/useTheme';
import { setSoundEnabled } from '../../hooks/useSoundEffects';
import { AccentColor, Page } from '../../types';
import * as Api from '../../lib/api';

interface SettingsProps {
  pendingNavigate?: Page | null;
  onResolvePending?: (confirmed: boolean) => void;
  onRegisterGuard?: (fn: () => boolean) => void;
}

const FolderIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const SaveIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const videoQualityOptions = [
  { value: 'best', label: 'Best Available', description: 'Up to 4K if available' },
  { value: '1080p', label: '1080p', description: 'Full HD' },
  { value: '720p', label: '720p', description: 'HD' },
  { value: '480p', label: '480p', description: 'SD' },
];

const audioQualityOptions = [
  { value: 'highest', label: 'Highest', description: 'Best quality available' },
  { value: '24bit', label: '24-bit', description: 'Hi-Res lossless' },
  { value: '16bit', label: '16-bit', description: 'CD quality lossless' },
];

const namingTemplateOptions = [
  { value: 'jellyfin', label: 'Jellyfin', description: '{artist}/{title}/{title}' },
  { value: 'plex', label: 'Plex', description: '{artist}/{title}' },
  { value: 'flat', label: 'Flat', description: '{artist} - {title}' },
  { value: 'album', label: 'Album', description: '{artist}/{album}/{title}' },
  { value: 'year', label: 'Year', description: '{year}/{artist} - {title}' },
  { value: 'album tracks', label: 'Album Tracks', description: '{artist} - {album}/{track} {title}' },
  { value: 'genre', label: 'Genre', description: '{genre}/{artist}/{title}' },
  { value: 'date', label: 'Date', description: '{date}/{artist} - {title}' },
];

const themeOptions = [
  { value: 'system', label: 'System', description: 'Follow system preference' },
  { value: 'dark', label: 'Dark', description: 'Always use dark mode' },
  { value: 'light', label: 'Light', description: 'Always use light mode' },
];

const cookiesBrowserOptions = [
  { value: '', label: 'None', description: 'No browser cookies' },
  { value: 'librewolf', label: 'Librewolf', description: 'Use Librewolf cookies' },
  { value: 'firefox', label: 'Firefox', description: 'Use Firefox cookies' },
  { value: 'chrome', label: 'Chrome', description: 'Use Chrome cookies' },
  { value: 'chromium', label: 'Chromium', description: 'Use Chromium cookies' },
  { value: 'brave', label: 'Brave', description: 'Use Brave cookies' },
  { value: 'opera', label: 'Opera', description: 'Use Opera cookies' },
  { value: 'edge', label: 'Edge', description: 'Use Edge cookies' },
];

const lyricsEmbedModeOptions = [
  { value: 'lrc', label: 'LRC File', description: 'Save as .lrc file alongside media' },
  { value: 'embed', label: 'Embed', description: 'Embed lyrics in media file' },
  { value: 'both', label: 'Both', description: 'LRC file + embedded' },
];

const logLevelOptions = [
  { value: 'debug', label: 'Debug', description: 'Very verbose, for troubleshooting' },
  { value: 'info', label: 'Info', description: 'Normal operation logs' },
  { value: 'warn', label: 'Warn', description: 'Warnings and errors only' },
  { value: 'error', label: 'Error', description: 'Errors only' },
];

type SettingsTab = 'general' | 'audio' | 'naming' | 'ui' | 'advanced';

const tabs: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'audio', label: 'Audio' },
  { id: 'naming', label: 'Naming' },
  { id: 'ui', label: 'UI' },
  { id: 'advanced', label: 'Advanced' },
];

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
        {title}
      </h3>
      <hr className="mt-2" style={{ borderColor: 'var(--color-border-subtle)' }} />
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{label}</p>
        {description && (
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">
        {children}
      </div>
    </div>
  );
}

export function Settings({ pendingNavigate = null, onResolvePending, onRegisterGuard }: SettingsProps = {}) {
  const { config, loading, saving, saveConfig, updateField } = useSettings();
  const [defaultPath, setDefaultPath] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  useEffect(() => {
    Api.GetDefaultOutputDirectory().then(setDefaultPath).catch(() => {});
  }, []);

  useEffect(() => {
    if (onRegisterGuard) {
      onRegisterGuard(() => hasChanges);
    }
  }, [hasChanges, onRegisterGuard]);

  if (loading || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {pendingNavigate !== null && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            <div
              className="rounded-xl p-6 shadow-2xl max-w-sm w-full mx-4"
              style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)' }}
            >
              <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Unsaved changes
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                You have unsaved changes. Leave anyway?
              </p>
              <div className="flex gap-3 justify-end">
                <button className="btn-ghost" onClick={() => onResolvePending?.(false)}>Stay</button>
                <button className="btn-primary" onClick={() => onResolvePending?.(true)}>Leave</button>
              </div>
            </div>
          </div>
        )}
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-current border-t-transparent rounded-full mx-auto mb-4" style={{ color: 'var(--color-accent)' }} />
          <p style={{ color: 'var(--color-text-secondary)' }}>Loading settings...</p>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    await saveConfig(config);
    setHasChanges(false);
  };

  const handleReset = async () => {
    window.location.reload();
  };

  const handleChange = <K extends keyof typeof config>(field: K, value: typeof config[K]) => {
    updateField(field, value);
    setHasChanges(true);
  };

  return (
    <div className="min-h-screen pb-24">
      <Header title="Settings" subtitle="Configure your preferences" />

      {/* Tabs */}
      <div className="px-4 md:px-8 mb-6">
        <div className="flex gap-1 p-1 rounded-lg overflow-x-auto" style={{ background: 'var(--color-bg-secondary)' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`px-4 py-2 text-sm rounded-md transition-colors md:flex-1 flex-shrink-0 whitespace-nowrap ${activeTab === tab.id ? 'font-medium' : ''}`}
              style={{
                background: activeTab === tab.id ? 'var(--color-bg-tertiary)' : 'transparent',
                color: activeTab === tab.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 md:px-8 pb-8 max-w-2xl">

        {/* ── General Tab ── */}
        {activeTab === 'general' && (
          <>
            <section className="mb-8">
              <SectionTitle title="Downloads" />
              <div className="space-y-1">
                <SettingRow label="Output Directory">
                  <div className="flex gap-2" style={{ minWidth: 280 }}>
                    <input
                      type="text"
                      value={config.outputDirectory || defaultPath}
                      onChange={(e) => handleChange('outputDirectory', e.target.value)}
                      className="flex-1"
                      placeholder={defaultPath}
                    />
                    <button className="btn-secondary flex items-center gap-1.5">
                      <FolderIcon />
                      Browse
                    </button>
                  </div>
                </SettingRow>
                <SettingRow label="Concurrent Downloads">
                  <div className="flex items-center gap-3" style={{ minWidth: 140 }}>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={config.concurrentDownloads}
                      onChange={(e) => handleChange('concurrentDownloads', parseInt(e.target.value))}
                      className="flex-1"
                      style={{ accentColor: 'var(--color-accent)' }}
                    />
                    <span className="w-6 text-center font-mono" style={{ color: 'var(--color-text-primary)' }}>
                      {config.concurrentDownloads}
                    </span>
                  </div>
                </SettingRow>
                <SettingRow label="YouTube Cookies (Anti-Bot)" description="Use browser cookies to bypass bot detection">
                  <div style={{ minWidth: 160 }}>
                    <Dropdown value={config.cookiesBrowser || ''} options={cookiesBrowserOptions} onChange={(v) => handleChange('cookiesBrowser', v)} />
                  </div>
                </SettingRow>
              </div>
            </section>

            <section className="mb-8">
              <SectionTitle title="Metadata" />
              <div className="space-y-1">
                <SettingRow label="Generate NFO Files" description="Create metadata files for Jellyfin/Kodi">
                  <Toggle checked={config.generateNfo} onChange={(v) => handleChange('generateNfo', v)} />
                </SettingRow>
                <SettingRow label="Embed Cover Art" description="Include album art in MKV files">
                  <Toggle checked={config.embedCoverArt} onChange={(v) => handleChange('embedCoverArt', v)} />
                </SettingRow>
                <SettingRow label="Save Cover File" description="Also save album art as a separate .jpg file">
                  <Toggle checked={config.saveCoverFile ?? false} onChange={(v) => handleChange('saveCoverFile', v)} />
                </SettingRow>
                <SettingRow label="Generate M3U8" description="Create an .m3u8 playlist file when a batch completes">
                  <Toggle checked={config.generateM3u8 ?? false} onChange={(v) => handleChange('generateM3u8', v)} />
                </SettingRow>
              </div>
            </section>
          </>
        )}

        {/* ── Audio Tab ── */}
        {activeTab === 'audio' && (
          <>
            <section className="mb-8">
              <SectionTitle title="Quality" />
              <div className="space-y-1">
                <SettingRow label="Video Quality">
                  <div style={{ minWidth: 160 }}>
                    <Dropdown value={config.videoQuality} options={videoQualityOptions} onChange={(v) => handleChange('videoQuality', v)} />
                  </div>
                </SettingRow>
                <SettingRow label="Preferred Audio Quality" description="Target quality tier for lossless downloads">
                  <div style={{ minWidth: 160 }}>
                    <Dropdown value={config.preferredQuality || 'highest'} options={audioQualityOptions} onChange={(v) => handleChange('preferredQuality', v)} />
                  </div>
                </SettingRow>
                <SettingRow label="Auto Quality Fallback" description="Accept lower quality if preferred tier is unavailable">
                  <Toggle checked={config.autoQualityFallback ?? true} onChange={(v) => handleChange('autoQualityFallback', v)} />
                </SettingRow>
                <SettingRow label="Skip Explicit Tracks" description="Skip tracks flagged as explicit content">
                  <Toggle checked={config.skipExplicit ?? false} onChange={(v) => handleChange('skipExplicit', v)} />
                </SettingRow>
              </div>
            </section>

            <section className="mb-8">
              <SectionTitle title="Audio Sources" />
              <div className="space-y-1">
                <SettingRow label="Audio Source Priority" description="Drag to reorder">
                  <div className="flex gap-2">
                    {(config.audioSourcePriority || ['tidal', 'qobuz', 'amazon']).map((source, index) => (
                      <span key={source} className="badge badge-neutral cursor-move">
                        {index + 1}. {source}
                      </span>
                    ))}
                  </div>
                </SettingRow>
              </div>
            </section>

            <section className="mb-8">
              <SectionTitle title="Lyrics" />
              <div className="space-y-1">
                <SettingRow label="Fetch Lyrics" description="Automatically fetch lyrics from LRCLIB">
                  <Toggle checked={config.lyricsEnabled ?? false} onChange={(v) => handleChange('lyricsEnabled', v)} />
                </SettingRow>
                {config.lyricsEnabled && (
                  <SettingRow label="Lyrics Format">
                    <div style={{ minWidth: 160 }}>
                      <Dropdown value={config.lyricsEmbedMode || 'lrc'} options={lyricsEmbedModeOptions} onChange={(v) => handleChange('lyricsEmbedMode', v)} />
                    </div>
                  </SettingRow>
                )}
              </div>
            </section>
          </>
        )}

        {/* ── Naming Tab ── */}
        {activeTab === 'naming' && (
          <>
            <section className="mb-8">
              <SectionTitle title="File Organization" />
              <div className="space-y-1">
                <SettingRow label="Folder Structure" description={`Preview: ${config.outputDirectory || defaultPath}/${namingTemplateOptions.find(o => o.value === config.namingTemplate)?.description || '{artist}/{title}'}`}>
                  <div style={{ minWidth: 160 }}>
                    <Dropdown value={config.namingTemplate} options={namingTemplateOptions} onChange={(v) => handleChange('namingTemplate', v)} />
                  </div>
                </SettingRow>
              </div>
            </section>

            <section className="mb-8">
              <SectionTitle title="Artist Formatting" />
              <div className="space-y-1">
                <SettingRow label="First Artist Only" description="Strip featured artists from artist tag (e.g. &quot;Artist feat. X&quot; &rarr; &quot;Artist&quot;)">
                  <Toggle checked={config.firstArtistOnly ?? false} onChange={(v) => handleChange('firstArtistOnly', v)} />
                </SettingRow>
                {!config.firstArtistOnly && (
                  <SettingRow label="Artist Separator" description="Separator between multiple artists">
                    <div style={{ minWidth: 120 }}>
                      <Dropdown
                        value={config.artistSeparator || '; '}
                        options={[
                          { value: '; ', label: 'Semicolon', description: 'Artist; Artist' },
                          { value: ', ', label: 'Comma', description: 'Artist, Artist' },
                          { value: ' & ', label: 'Ampersand', description: 'Artist & Artist' },
                          { value: ' / ', label: 'Slash', description: 'Artist / Artist' },
                        ]}
                        onChange={(v) => handleChange('artistSeparator', v)}
                      />
                    </div>
                  </SettingRow>
                )}
              </div>
            </section>
          </>
        )}

        {/* ── UI Tab ── */}
        {activeTab === 'ui' && (
          <>
            <section className="mb-8">
              <SectionTitle title="Appearance" />
              <div className="space-y-1">
                <SettingRow label="Theme">
                  <div style={{ minWidth: 160 }}>
                    <Dropdown value={config.theme} options={themeOptions} onChange={(v) => { handleChange('theme', v); applyTheme(v as 'dark' | 'light' | 'system'); }} />
                  </div>
                </SettingRow>
                <SettingRow label="Accent Color">
                  <ColorPicker
                    value={(config.accentColor || 'pink') as AccentColor}
                    onChange={(color) => {
                      handleChange('accentColor', color);
                      applyAccentColor(color);
                    }}
                  />
                </SettingRow>
              </div>
            </section>

            <section className="mb-8">
              <SectionTitle title="Sound" />
              <div className="space-y-1">
                <SettingRow label="Sound Effects" description="Play sounds on download complete, error, etc.">
                  <Toggle
                    checked={config.soundEffectsEnabled ?? true}
                    onChange={(v) => {
                      handleChange('soundEffectsEnabled', v);
                      setSoundEnabled(v);
                    }}
                  />
                </SettingRow>
                {config.soundEffectsEnabled && (
                  <SettingRow label="Sound Volume">
                    <div className="flex items-center gap-3" style={{ minWidth: 140 }}>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={config.soundVolume ?? 70}
                        onChange={(e) => handleChange('soundVolume', parseInt(e.target.value))}
                        className="flex-1"
                        style={{ accentColor: 'var(--color-accent)' }}
                      />
                      <span className="w-8 text-center font-mono text-sm" style={{ color: 'var(--color-text-primary)' }}>
                        {config.soundVolume ?? 70}%
                      </span>
                    </div>
                  </SettingRow>
                )}
              </div>
            </section>
          </>
        )}

        {/* ── Advanced Tab ── */}
        {activeTab === 'advanced' && (
          <>
            <section className="mb-8">
              <SectionTitle title="Network" />
              <div className="space-y-1">
                <SettingRow label="Proxy URL" description="HTTP or SOCKS5 proxy for all requests">
                  <input
                    type="text"
                    value={config.proxyUrl || ''}
                    onChange={(e) => handleChange('proxyUrl', e.target.value)}
                    placeholder="socks5://127.0.0.1:1080"
                    style={{ minWidth: 240 }}
                  />
                </SettingRow>
              </div>
            </section>

            <section className="mb-8">
              <SectionTitle title="Timeouts & Logging" />
              <div className="space-y-1">
                <SettingRow label="Download Timeout" description="Per-file timeout in minutes (0 = default 10m)">
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={config.downloadTimeoutMinutes ?? 10}
                    onChange={(e) => handleChange('downloadTimeoutMinutes', parseFloat(e.target.value) || 0)}
                    style={{ width: 80, textAlign: 'right' }}
                  />
                </SettingRow>
                <SettingRow label="Log Level" description="Verbosity of application logs">
                  <div style={{ minWidth: 140 }}>
                    <Dropdown value={config.logLevel || 'info'} options={logLevelOptions} onChange={(v) => handleChange('logLevel', v)} />
                  </div>
                </SettingRow>
              </div>
            </section>

            <section className="mb-8">
              <SectionTitle title="Config" />
              <div className="space-y-1">
                <SettingRow label="Config Folder" description="Open the folder containing config.json">
                  <button
                    className="btn-secondary flex items-center gap-1.5"
                    onClick={() => Api.OpenConfigFolder().catch(console.error)}
                  >
                    <FolderIcon />
                    Open Config Folder
                  </button>
                </SettingRow>
              </div>
            </section>

            <section className="mb-8">
              <SectionTitle title="Qobuz Authentication" />
              <div className="space-y-1">
                <SettingRow label="App ID" description="Qobuz application ID">
                  <input
                    type="text"
                    value={config.qobuzAppId || ''}
                    onChange={(e) => handleChange('qobuzAppId', e.target.value)}
                    placeholder="App ID"
                    style={{ minWidth: 240 }}
                  />
                </SettingRow>
                <SettingRow label="App Secret" description="Qobuz application secret">
                  <input
                    type="password"
                    value={config.qobuzAppSecret || ''}
                    onChange={(e) => handleChange('qobuzAppSecret', e.target.value)}
                    placeholder="App Secret"
                    style={{ minWidth: 240 }}
                  />
                </SettingRow>
                <SettingRow label="User Token" description="Qobuz user authentication token">
                  <input
                    type="password"
                    value={config.qobuzUserToken || ''}
                    onChange={(e) => handleChange('qobuzUserToken', e.target.value)}
                    placeholder="User Token"
                    style={{ minWidth: 240 }}
                  />
                </SettingRow>
              </div>
            </section>
          </>
        )}

      </div>

      {/* Unsaved changes confirmation dialog */}
      {pendingNavigate !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
        >
          <div
            className="rounded-xl p-6 shadow-2xl max-w-sm w-full mx-4"
            style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)' }}
          >
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Unsaved changes
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
              You have unsaved changes. Leave anyway?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                className="btn-ghost"
                onClick={() => onResolvePending?.(false)}
              >
                Stay
              </button>
              <button
                className="btn-primary"
                onClick={() => onResolvePending?.(true)}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Footer */}
      <div
        className="fixed bottom-0 left-0 md:left-[64px] right-0 p-4 glass"
        style={{ borderTop: '1px solid var(--color-border-subtle)' }}
      >
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <button className="btn-ghost flex items-center gap-2" onClick={handleReset}>
            <RefreshIcon />
            Reset to Defaults
          </button>
          <button
            className={`btn-primary flex items-center gap-2 ${!hasChanges ? 'opacity-50' : ''}`}
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            <SaveIcon />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
