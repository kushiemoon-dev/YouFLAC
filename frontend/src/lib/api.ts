/**
 * Dual-mode API client. Every exported function keeps its exact pre-existing
 * name and signature: it detects at runtime whether the app is running in
 * the Wails desktop webview or a plain browser tab (see lib/runtime.ts) and
 * dispatches to the generated Wails bindings or to a fetch() call against
 * the headless Fiber server accordingly. None of the ~40 files that import
 * from here need to know which mode is active.
 */

import * as App from '../../wailsjs/go/app/App';
import { isWailsRuntime } from './runtime';
import { EventsOn as wsEventsOn } from './websocket';

// Types (matching backend models)
export interface Config {
  outputDirectory: string;
  videoQuality: string;
  audioSourcePriority: string[];
  namingTemplate: string;
  generateNfo: boolean;
  concurrentDownloads: number;
  embedCoverArt: boolean;
  theme: string;
  cookiesBrowser: string;
  accentColor: string;
  soundEffectsEnabled: boolean;
  soundVolume: number;
  lyricsEnabled: boolean;
  lyricsEmbedMode: string;
  logLevel: string;
  proxyUrl: string;
  downloadTimeoutMinutes: number;
  preferredQuality: string;
  generateM3u8: boolean;
  skipExplicit: boolean;
  saveCoverFile: boolean;
  firstArtistOnly: boolean;
  artistSeparator: string;
  autoQualityFallback: boolean;
  searchResultsLimit: number;
  qobuzAppId: string;
  qobuzAppSecret: string;
  qobuzUserToken: string;
  uiFont: string;
  soulseekUsername?: string;
  soulseekPassword?: string;
}

export interface LogEntry {
  id: number;
  time: string;
  level: string;
  message: string;
  fields?: string;
}

export interface DownloadRequest {
  videoUrl?: string;
  spotifyUrl?: string;
  quality?: string;
  // Metadata-first path: set these instead of videoUrl for search results.
  title?: string;
  artist?: string;
  album?: string;
  thumbnail?: string;
  isrc?: string;
}

export interface MatchDiagnostics {
  sourcesTried: string[];
  failureReason: string;
  bestScore: number;
}

export interface RetryOverrideRequest {
  artist?: string;
  title?: string;
  musicUrl?: string;
  forceSource?: string;
}

export interface QueueItem {
  id: string;
  videoUrl: string;
  spotifyUrl?: string;
  title: string;
  artist: string;
  album?: string;
  playlistName?: string;
  playlistPosition?: number;
  thumbnail?: string;
  duration?: number;
  status: string;
  progress: number;
  stage: string;
  error?: string;
  outputPath?: string;
  videoPath?: string;
  audioPath?: string;
  fileSize?: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  matchScore?: number;
  matchConfidence?: string;
  audioSource?: string;
  quality?: string;
  actualQuality?: string;
  explicit?: boolean;
  audioOnly?: boolean;
  matchCandidates?: AudioCandidate[];
  matchDiagnostics?: MatchDiagnostics;
  forceSource?: string;
}

export interface QueueStats {
  total: number;
  pending: number;
  active: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export interface QueueEvent {
  type: string;
  itemId: string;
  item?: QueueItem;
  progress?: number;
  stage?: string;
  error?: string;
}

export interface VideoInfo {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  isrc?: string;
  thumbnail: string;
  url: string;
  uploadDate?: string;
  description?: string;
  channel?: string;
  viewCount?: number;
}

export interface HistoryEntry {
  id: string;
  videoUrl: string;
  title: string;
  artist: string;
  album?: string;
  audioSource: string;
  quality: string;
  outputPath: string;
  thumbnail?: string;
  duration?: number;
  fileSize: number;
  completedAt: string;
  status: string;
  error?: string;
  explicit?: boolean;
}

export interface HistoryStats {
  total: number;
  completed: number;
  failed: number;
  totalSize: number;
  sourceCounts: Record<string, number>;
}

export interface AudioAnalysis {
  filePath: string;
  fileName: string;
  codec: string;
  codecLong: string;
  bitrate: number;
  sampleRate: number;
  bitsPerSample: number;
  channels: number;
  duration: number;
  fileSize: number;
  isTrueLossless: boolean;
  fakeLossless: boolean;
  qualityScore: number;
  qualityRating: string;
  issues?: string[];
  spectrogramPath?: string;
  format: string;
  profile?: string;
  maxFreq?: number;
}

export interface AudioCandidate {
  platform: string;
  url: string;
  title: string;
  artist: string;
  album?: string;
  isrc?: string;
  duration: number;
  quality?: string;
  priority: number;
}

export interface FileInfo {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  extension: string;
  type: string;  // 'video' | 'audio' | 'cover' | 'nfo' | 'other'
}

export interface ReorganizePlaylistResult {
  success: boolean;
  renamed: number;
  errors?: string[];
  newFolder?: string;
}

export interface FlattenPlaylistResult {
  success: boolean;
  moved: number;
  errors?: string[];
}

// ============== HTTP client (headless/browser mode) ==============

// API Base URL - empty for same-origin (production), can be set for dev
const API_BASE = import.meta.env.VITE_API_URL || '';

// Generic fetch helper, used by every browser-mode function below.
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `HTTP ${res.status}`);
  }

  // Handle empty responses
  const text = await res.text();
  if (!text) return {} as T;

  return JSON.parse(text);
}

// Native OS dialogs (SelectAudioFile/SelectDirectory/SelectSaveAudioFile) have
// no sane browser equivalent — a <input type=file> can't return an absolute
// server-side path. Callers should gate the triggering UI on isWailsRuntime()
// (see Converter.tsx/Resampler.tsx Browse buttons); this is the fallback for
// anything that calls them anyway, so it fails loudly instead of trying to
// read `window.go` and crashing with a cryptic TypeError.
function requireWails(fnName: string): never {
  throw new Error(`${fnName}() needs the desktop app (native OS dialog) — not available in browser mode.`);
}

// ============== Queue API ==============

export async function GetQueue(): Promise<QueueItem[]> {
  if (isWailsRuntime()) return App.GetQueue() as unknown as Promise<QueueItem[]>;
  return api<QueueItem[]>('/queue');
}

export async function AddToQueue(request: DownloadRequest): Promise<string> {
  if (isWailsRuntime()) return App.AddToQueue(request as any);
  const res = await api<{ id: string }>('/queue', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return res.id;
}

export async function RemoveFromQueue(id: string): Promise<void> {
  if (isWailsRuntime()) {
    await App.RemoveFromQueue(id);
    return;
  }
  await api<void>(`/queue/${id}`, { method: 'DELETE' });
}

export async function CancelQueueItem(id: string): Promise<void> {
  if (isWailsRuntime()) {
    await App.CancelQueueItem(id);
    return;
  }
  await api<void>(`/queue/${id}/cancel`, { method: 'POST' });
}

export async function MoveQueueItem(id: string, newPosition: number): Promise<void> {
  if (isWailsRuntime()) {
    await App.MoveQueueItem(id, newPosition);
    return;
  }
  await api<void>(`/queue/${id}/move`, {
    method: 'PUT',
    body: JSON.stringify({ newPosition }),
  });
}

export async function GetQueueStats(): Promise<QueueStats> {
  if (isWailsRuntime()) return App.GetQueueStats() as unknown as Promise<QueueStats>;
  return api<QueueStats>('/queue/stats');
}

export async function ClearCompleted(): Promise<number> {
  if (isWailsRuntime()) return App.ClearCompleted();
  const res = await api<{ cleared: number }>('/queue/clear', { method: 'POST' });
  return res.cleared;
}

export async function RetryFailed(): Promise<number> {
  if (isWailsRuntime()) return App.RetryFailed();
  const res = await api<{ retried: number }>('/queue/retry', { method: 'POST' });
  return res.retried;
}

export async function retryWithOverride(id: string, req: RetryOverrideRequest): Promise<QueueItem> {
  if (isWailsRuntime()) {
    return App.RetryQueueItemWithOverride(id, req as any) as unknown as Promise<QueueItem>;
  }
  return api<QueueItem>(`/queue/${id}/retry-override`, {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function RetryQueueItemWithSource(id: string, forceSource: string): Promise<void> {
  const body: RetryOverrideRequest = {};
  if (forceSource && forceSource !== 'auto') body.forceSource = forceSource;
  if (isWailsRuntime()) {
    await App.RetryQueueItemWithOverride(id, body as any);
    return;
  }
  await api(`/queue/${id}/retry-override`, { method: 'POST', body: JSON.stringify(body) });
}

export async function ClearQueue(): Promise<void> {
  if (isWailsRuntime()) {
    // Same server-side action as ClearCompleted — only one Go method exists.
    await App.ClearCompleted();
    return;
  }
  await api<void>('/queue/clear', { method: 'POST' });
}

export async function PauseAll(): Promise<number> {
  if (isWailsRuntime()) return App.PauseAll();
  const res = await api<{ paused: number }>('/queue/pause-all', { method: 'POST' });
  return res.paused;
}

export async function ResumeAll(): Promise<number> {
  if (isWailsRuntime()) return App.ResumeAll();
  const res = await api<{ resumed: number }>('/queue/resume-all', { method: 'POST' });
  return res.resumed;
}

export async function FetchLogs(sinceId: number): Promise<LogEntry[]> {
  if (isWailsRuntime()) return App.GetLogs(sinceId) as unknown as Promise<LogEntry[]>;
  return api<LogEntry[]>(`/logs?since=${sinceId}`);
}

export async function GetItemLogs(id: string): Promise<LogEntry[]> {
  if (isWailsRuntime()) return App.GetItemLogs(id) as unknown as Promise<LogEntry[]>;
  return api<LogEntry[]>(`/queue/${encodeURIComponent(id)}/logs`);
}

// ============== Playlist API ==============

export async function AddPlaylistToQueue(url: string, quality?: string): Promise<string[]> {
  if (isWailsRuntime()) {
    // maxVideos: 0 = unlimited, matching the backend's default when unset.
    const res = await App.AddPlaylistToQueue(url, quality ?? '', 0);
    return res.ids;
  }
  const res = await api<{ ids: string[]; playlistTitle: string }>('/playlist', {
    method: 'POST',
    body: JSON.stringify({ url, quality }),
  });
  return res.ids;
}

// ============== Config API ==============

export async function GetConfig(): Promise<Config> {
  if (isWailsRuntime()) return App.GetConfig() as unknown as Promise<Config>;
  return api<Config>('/config');
}

export async function SaveConfig(config: Config): Promise<void> {
  if (isWailsRuntime()) {
    await App.SaveConfig(config as any);
    return;
  }
  await api<void>('/config', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export async function GetDefaultOutputDirectory(): Promise<string> {
  if (isWailsRuntime()) return App.GetDefaultOutputDirectory();
  const res = await api<{ path: string }>('/config/default-output');
  return res.path;
}

// ============== History API ==============

export async function GetHistory(): Promise<HistoryEntry[]> {
  if (isWailsRuntime()) return App.GetHistory() as unknown as Promise<HistoryEntry[]>;
  return api<HistoryEntry[]>('/history');
}

export async function GetHistoryStats(): Promise<HistoryStats> {
  if (isWailsRuntime()) return App.GetHistoryStats() as unknown as Promise<HistoryStats>;
  return api<HistoryStats>('/history/stats');
}

export async function SearchHistory(query: string): Promise<HistoryEntry[]> {
  if (isWailsRuntime()) return App.SearchHistory(query, '', '') as unknown as Promise<HistoryEntry[]>;
  return api<HistoryEntry[]>(`/history/search?q=${encodeURIComponent(query)}`);
}

export async function DeleteHistoryEntry(id: string): Promise<void> {
  if (isWailsRuntime()) {
    await App.DeleteHistoryEntry(id);
    return;
  }
  await api<void>(`/history/${id}`, { method: 'DELETE' });
}

export async function ClearHistory(): Promise<void> {
  if (isWailsRuntime()) {
    await App.ClearHistory();
    return;
  }
  await api<void>('/history/clear', { method: 'POST' });
}

export async function RedownloadFromHistory(id: string): Promise<string> {
  if (isWailsRuntime()) return App.RedownloadFromHistory(id);
  const res = await api<{ id: string }>(`/history/${id}/redownload`, { method: 'POST' });
  return res.id;
}

export async function FilterHistoryBySource(source: string): Promise<HistoryEntry[]> {
  if (isWailsRuntime()) return App.SearchHistory('', source, '') as unknown as Promise<HistoryEntry[]>;
  return api<HistoryEntry[]>(`/history/search?source=${encodeURIComponent(source)}`);
}

export async function FilterHistoryByStatus(status: string): Promise<HistoryEntry[]> {
  if (isWailsRuntime()) return App.SearchHistory('', '', status) as unknown as Promise<HistoryEntry[]>;
  return api<HistoryEntry[]>(`/history/search?status=${encodeURIComponent(status)}`);
}

// ============== Converter API ==============

export interface ConvertRequest {
  sourcePath: string;
  targetFormat: string;
  bitrate?: number;
  sampleRate?: number;
}

export interface ConvertResult {
  outputPath: string;
  format: string;
  size: number;
}

export async function ConvertAudio(req: ConvertRequest): Promise<ConvertResult> {
  if (isWailsRuntime()) return App.Convert(req as any) as unknown as Promise<ConvertResult>;
  return api<ConvertResult>('/convert', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export interface ConvertDirOptions {
  dir: string;
  targetFormat: string;
  bitrate?: number;
  sampleRate?: number;
}

export interface DirConvertResult {
  sourcePath: string;
  outputPath?: string;
  error?: string;
  done: boolean;
  total?: number;
  succeeded?: number;
  failed?: number;
}

export async function ConvertDirectory(opts: ConvertDirOptions): Promise<DirConvertResult> {
  if (isWailsRuntime()) {
    // The Wails binding returns the real final result (same shape as the
    // convert_progress event payload) directly.
    return App.ConvertDirectory(opts as any) as unknown as Promise<DirConvertResult>;
  }
  // The HTTP endpoint (internal/api/handlers_audio_tools.go) only acks
  // {success, message} — the real per-file and final results stream over
  // /ws as "convert_progress" events instead. Wait for the event carrying
  // done:true so this function resolves with the real result either way,
  // matching the Wails binding's contract for callers (e.g. Converter.tsx).
  return new Promise<DirConvertResult>((resolve, reject) => {
    const unsubscribe = wsEventsOn('convert_progress', (data: DirConvertResult) => {
      if (data.done) {
        unsubscribe();
        resolve(data);
      }
    });
    api<{ success: boolean; message: string }>('/converter/directory', {
      method: 'POST',
      body: JSON.stringify(opts),
    }).catch((err) => {
      unsubscribe();
      reject(err);
    });
  });
}

// ============== Search API ==============

export async function SearchYouTube(query: string, limit?: number): Promise<VideoInfo[]> {
  if (isWailsRuntime()) return App.Search(query, limit ?? 0) as unknown as Promise<VideoInfo[]>;
  let url = `/search?q=${encodeURIComponent(query)}`;
  if (limit) url += `&limit=${limit}`;
  return api<VideoInfo[]>(url);
}

// ============== Video/URL API ==============

export async function GetVideoInfo(url: string): Promise<VideoInfo> {
  if (isWailsRuntime()) return App.GetVideoInfo(url) as unknown as Promise<VideoInfo>;
  return api<VideoInfo>(`/video/info?url=${encodeURIComponent(url)}`);
}

// ============== Channel API ==============

export async function ChannelFetch(
  url: string,
  includeShorts: boolean,
  onlyLongForm: boolean,
  playlistID: string,
  maxItems: number
): Promise<string> {
  if (isWailsRuntime()) return App.ChannelFetch(url, includeShorts, onlyLongForm, playlistID, maxItems);
  const res = await api<{ jobID: string }>('/channel/fetch', {
    method: 'POST',
    body: JSON.stringify({ url, includeShorts, onlyLongForm, playlistID, maxItems }),
  });
  return res.jobID;
}

export async function ChannelFetchCancel(jobID: string): Promise<void> {
  if (isWailsRuntime()) {
    await App.ChannelFetchCancel(jobID);
    return;
  }
  await api<void>(`/channel/fetch/${encodeURIComponent(jobID)}/cancel`, { method: 'POST' });
}

// ============== Files API ==============

export async function ListFiles(dir: string, filter?: string): Promise<FileInfo[]> {
  if (isWailsRuntime()) return App.ListFiles(dir, filter ?? '') as unknown as Promise<FileInfo[]>;
  let url = `/files?dir=${encodeURIComponent(dir)}`;
  if (filter) url += `&filter=${encodeURIComponent(filter)}`;
  return api<FileInfo[]>(url);
}

export async function GetPlaylistFolders(): Promise<string[]> {
  if (isWailsRuntime()) return App.GetPlaylistFolders();
  return api<string[]>('/files/playlists');
}

export async function ReorganizePlaylist(folderPath: string): Promise<ReorganizePlaylistResult> {
  if (isWailsRuntime()) return App.ReorganizePlaylist(folderPath) as unknown as Promise<ReorganizePlaylistResult>;
  return api<ReorganizePlaylistResult>('/files/reorganize', {
    method: 'POST',
    body: JSON.stringify({ folderPath }),
  });
}

export async function FlattenPlaylistFolder(folderPath: string): Promise<FlattenPlaylistResult> {
  if (isWailsRuntime()) return App.FlattenPlaylist(folderPath) as unknown as Promise<FlattenPlaylistResult>;
  return api<FlattenPlaylistResult>('/files/flatten', {
    method: 'POST',
    body: JSON.stringify({ folderPath }),
  });
}

// ============== Analyzer API ==============

export async function AnalyzeAudio(filePath: string): Promise<AudioAnalysis> {
  if (isWailsRuntime()) return App.AnalyzeAudio(filePath) as unknown as Promise<AudioAnalysis>;
  return api<AudioAnalysis>('/analyze', {
    method: 'POST',
    body: JSON.stringify({ filePath }),
  });
}

export async function GenerateSpectrogram(filePath: string): Promise<string> {
  if (isWailsRuntime()) {
    // Returns a data: URL directly (image already inlined server-side by
    // the Wails binding); existing callers that feed this straight into an
    // <img src> keep working unchanged.
    return App.GenerateSpectrogram(filePath);
  }
  // The HTTP endpoint still returns a temp file path — a second
  // GetImageAsDataURL() call resolves it (see AudioAnalyzer.tsx, which
  // already does this two-step call).
  const res = await api<{ path: string }>('/analyze/spectrogram', {
    method: 'POST',
    body: JSON.stringify({ filePath }),
  });
  return res.path;
}

// ============== Resampler API ==============
export interface ResampleOptions {
  inputPath: string;
  outputPath: string;
  sampleRate: number;
  bitDepth: number;
  dither: boolean;
  format: 'flac' | 'wav' | 'alac';
}
export interface ResampleResult {
  success: boolean;
  outputPath: string;
  inputRate: number;
  outputRate: number;
  durationMs: number;
}
export async function Resample(opts: ResampleOptions): Promise<ResampleResult> {
  if (isWailsRuntime()) return App.Resample(opts as any) as unknown as Promise<ResampleResult>;
  return api<ResampleResult>('/resampler', { method: 'POST', body: JSON.stringify(opts) });
}

// ============== Image API ==============

export async function GetImageAsDataURL(path: string): Promise<string> {
  if (isWailsRuntime()) return App.GetImage(path);
  const res = await api<{ dataUrl: string }>(`/image?path=${encodeURIComponent(path)}`);
  return res.dataUrl;
}

// ============== Misc API ==============

export async function GetAppVersion(): Promise<string> {
  if (isWailsRuntime()) {
    const res: any = await App.GetVersion();
    return res.version;
  }
  const res = await api<{ version: string }>('/version');
  return res.version;
}

// ============== System API ==============

export async function OpenConfigFolder(): Promise<void> {
  if (isWailsRuntime()) {
    await App.OpenConfigFolder();
    return;
  }
  await api<void>('/system/open-config-folder', { method: 'POST' });
}

// ============== Dialogs API ==============
// Native OS file/folder pickers, for use instead of hand-typed paths.
// Wails-only — see requireWails() above. Return '' when the user cancels.

export async function SelectAudioFile(): Promise<string> {
  if (isWailsRuntime()) return App.SelectAudioFile();
  requireWails('SelectAudioFile');
}

export async function SelectDirectory(): Promise<string> {
  if (isWailsRuntime()) return App.SelectDirectory();
  requireWails('SelectDirectory');
}

export async function SelectSaveAudioFile(defaultFilename: string): Promise<string> {
  if (isWailsRuntime()) return App.SelectSaveAudioFile(defaultFilename);
  requireWails('SelectSaveAudioFile');
}

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseUrl: string;
}

export async function CheckForUpdates(): Promise<UpdateCheckResult> {
  if (isWailsRuntime()) return App.UpdateCheck() as unknown as Promise<UpdateCheckResult>;
  const res = await fetch('/api/system/update-check');
  if (!res.ok) throw new Error('update check failed');
  return res.json();
}

// ============== Preview API ==============

// Returns the URL for streaming a short audio preview (OGG/Vorbis).
// Use directly as <audio src> — no fetch needed. In Wails mode this is
// served by the AssetServer's custom handler (see app_files.go's
// previewAssetHandler); in browser mode it's the headless server's
// /api/video/preview route.
export function GetPreviewURL(videoURL: string, seconds = 30): string {
  if (isWailsRuntime()) {
    return `/preview?url=${encodeURIComponent(videoURL)}&seconds=${seconds}`;
  }
  return `/api/video/preview?url=${encodeURIComponent(videoURL)}&seconds=${seconds}`;
}

// ============== Sources API ==============

export interface SourceInfo {
  name: string;
  displayName: string;
  available: boolean;
}

export async function GetSources(): Promise<SourceInfo[]> {
  if (isWailsRuntime()) return App.GetSources() as unknown as Promise<SourceInfo[]>;
  return api<SourceInfo[]>('/sources');
}

export async function SetSourcePriority(names: string[]): Promise<void> {
  if (isWailsRuntime()) {
    await App.SetSourcePriority(names);
    return;
  }
  await api<void>('/sources/priority', {
    method: 'PUT',
    body: JSON.stringify({ priority: names }),
  });
}

// ============== Soulseek API ==============

export interface SoulseekStatus {
  available: boolean;
  binaryFound?: boolean;
  binaryPath?: string;
  credentialsSet?: boolean;
  version?: string;
  username?: string;
}

export interface SoulseekLoginTestResult {
  ok: boolean;
  details?: Record<string, unknown>;
  error?: string;
}

export async function GetSoulseekStatus(): Promise<SoulseekStatus> {
  if (isWailsRuntime()) {
    const res: any = await App.GetSoulseekStatus();
    return res;
  }
  return api<SoulseekStatus>('/soulseek/status');
}

export async function TestSoulseekLogin(username: string, password: string): Promise<SoulseekLoginTestResult> {
  if (isWailsRuntime()) {
    const res: any = await App.SoulseekLoginTest(username, password);
    return res;
  }
  return api<SoulseekLoginTestResult>('/soulseek/login-test', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

// ============== Qobuz Providers API ==============

export interface QobuzProvidersConfig {
  available: string[];
  disabled: string[];
}

export async function GetQobuzProviders(): Promise<QobuzProvidersConfig> {
  if (isWailsRuntime()) {
    const res: any = await App.GetQobuzProviders();
    return res;
  }
  return api<QobuzProvidersConfig>('/qobuz/providers');
}

export async function SetQobuzProviders(disabled: string[]): Promise<void> {
  if (isWailsRuntime()) {
    await App.SetQobuzProviders(disabled);
    return;
  }
  await api<void>('/qobuz/providers', {
    method: 'PUT',
    body: JSON.stringify({ disabled }),
  });
}
