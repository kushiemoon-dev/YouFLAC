/**
 * Wails bindings client. Every exported function/type here keeps its exact
 * pre-existing name and signature (this file used to be an HTTP client
 * calling a local Fiber server) — only the internal implementation changed,
 * from fetch() to generated Wails Go bindings, so none of the ~40 files that
 * import from here need to change.
 */

import * as App from '../../wailsjs/go/app/App';

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

// ============== Queue API ==============

export async function GetQueue(): Promise<QueueItem[]> {
  return App.GetQueue() as unknown as Promise<QueueItem[]>;
}

export async function AddToQueue(request: DownloadRequest): Promise<string> {
  return App.AddToQueue(request as any);
}

export async function RemoveFromQueue(id: string): Promise<void> {
  await App.RemoveFromQueue(id);
}

export async function CancelQueueItem(id: string): Promise<void> {
  await App.CancelQueueItem(id);
}

export async function MoveQueueItem(id: string, newPosition: number): Promise<void> {
  await App.MoveQueueItem(id, newPosition);
}

export async function GetQueueStats(): Promise<QueueStats> {
  return App.GetQueueStats() as unknown as Promise<QueueStats>;
}

export async function ClearCompleted(): Promise<number> {
  return App.ClearCompleted();
}

export async function RetryFailed(): Promise<number> {
  return App.RetryFailed();
}

export async function retryWithOverride(id: string, req: RetryOverrideRequest): Promise<QueueItem> {
  return App.RetryQueueItemWithOverride(id, req as any) as unknown as Promise<QueueItem>;
}

export async function RetryQueueItemWithSource(id: string, forceSource: string): Promise<void> {
  const body: RetryOverrideRequest = {};
  if (forceSource && forceSource !== 'auto') body.forceSource = forceSource;
  await App.RetryQueueItemWithOverride(id, body as any);
}

export async function ClearQueue(): Promise<void> {
  // Same server-side action as ClearCompleted — only one Go method exists.
  await App.ClearCompleted();
}

export async function PauseAll(): Promise<number> {
  return App.PauseAll();
}

export async function ResumeAll(): Promise<number> {
  return App.ResumeAll();
}

export async function FetchLogs(sinceId: number): Promise<LogEntry[]> {
  return App.GetLogs(sinceId) as unknown as Promise<LogEntry[]>;
}

export async function GetItemLogs(id: string): Promise<LogEntry[]> {
  return App.GetItemLogs(id) as unknown as Promise<LogEntry[]>;
}

// ============== Playlist API ==============

export async function AddPlaylistToQueue(url: string, quality?: string): Promise<string[]> {
  // maxVideos: 0 = unlimited, matching the backend's default when unset.
  const res = await App.AddPlaylistToQueue(url, quality ?? '', 0);
  return res.ids;
}

// ============== Config API ==============

export async function GetConfig(): Promise<Config> {
  return App.GetConfig() as unknown as Promise<Config>;
}

export async function SaveConfig(config: Config): Promise<void> {
  await App.SaveConfig(config as any);
}

export async function GetDefaultOutputDirectory(): Promise<string> {
  return App.GetDefaultOutputDirectory();
}

// ============== History API ==============

export async function GetHistory(): Promise<HistoryEntry[]> {
  return App.GetHistory() as unknown as Promise<HistoryEntry[]>;
}

export async function GetHistoryStats(): Promise<HistoryStats> {
  return App.GetHistoryStats() as unknown as Promise<HistoryStats>;
}

export async function SearchHistory(query: string): Promise<HistoryEntry[]> {
  return App.SearchHistory(query, '', '') as unknown as Promise<HistoryEntry[]>;
}

export async function DeleteHistoryEntry(id: string): Promise<void> {
  await App.DeleteHistoryEntry(id);
}

export async function ClearHistory(): Promise<void> {
  await App.ClearHistory();
}

export async function RedownloadFromHistory(id: string): Promise<string> {
  return App.RedownloadFromHistory(id);
}

export async function FilterHistoryBySource(source: string): Promise<HistoryEntry[]> {
  return App.SearchHistory('', source, '') as unknown as Promise<HistoryEntry[]>;
}

export async function FilterHistoryByStatus(status: string): Promise<HistoryEntry[]> {
  return App.SearchHistory('', '', status) as unknown as Promise<HistoryEntry[]>;
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
  return App.Convert(req as any) as unknown as Promise<ConvertResult>;
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
  // The Wails binding returns the real final result (same shape as the
  // convert_progress event payload); the old HTTP endpoint only returned a
  // generic {success, message} ack, so callers reading the richer fields
  // below are new, not a behavior change for existing callers.
  return App.ConvertDirectory(opts as any) as unknown as Promise<DirConvertResult>;
}

// ============== Search API ==============

export async function SearchYouTube(query: string, limit?: number): Promise<VideoInfo[]> {
  return App.Search(query, limit ?? 0) as unknown as Promise<VideoInfo[]>;
}

// ============== Video/URL API ==============

export async function GetVideoInfo(url: string): Promise<VideoInfo> {
  return App.GetVideoInfo(url) as unknown as Promise<VideoInfo>;
}

// ============== Channel API ==============

export async function ChannelFetch(
  url: string,
  includeShorts: boolean,
  onlyLongForm: boolean,
  playlistID: string,
  maxItems: number
): Promise<string> {
  return App.ChannelFetch(url, includeShorts, onlyLongForm, playlistID, maxItems);
}

export async function ChannelFetchCancel(jobID: string): Promise<void> {
  await App.ChannelFetchCancel(jobID);
}

// ============== Files API ==============

export async function ListFiles(dir: string, filter?: string): Promise<FileInfo[]> {
  return App.ListFiles(dir, filter ?? '') as unknown as Promise<FileInfo[]>;
}

export async function GetPlaylistFolders(): Promise<string[]> {
  return App.GetPlaylistFolders();
}

export async function ReorganizePlaylist(folderPath: string): Promise<ReorganizePlaylistResult> {
  return App.ReorganizePlaylist(folderPath) as unknown as Promise<ReorganizePlaylistResult>;
}

export async function FlattenPlaylistFolder(folderPath: string): Promise<FlattenPlaylistResult> {
  return App.FlattenPlaylist(folderPath) as unknown as Promise<FlattenPlaylistResult>;
}

// ============== Analyzer API ==============

export async function AnalyzeAudio(filePath: string): Promise<AudioAnalysis> {
  return App.AnalyzeAudio(filePath) as unknown as Promise<AudioAnalysis>;
}

export async function GenerateSpectrogram(filePath: string): Promise<string> {
  // Returns a data: URL directly now (image already inlined server-side),
  // where the old HTTP path returned a temp file path that a second
  // GetImageAsDataURL() call had to resolve. Existing callers that fed this
  // straight into an <img src> keep working unchanged either way.
  return App.GenerateSpectrogram(filePath);
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
  return App.Resample(opts as any) as unknown as Promise<ResampleResult>;
}

// ============== Image API ==============

export async function GetImageAsDataURL(path: string): Promise<string> {
  return App.GetImage(path);
}

// ============== Misc API ==============

export async function GetAppVersion(): Promise<string> {
  const res: any = await App.GetVersion();
  return res.version;
}

// ============== System API ==============

export async function OpenConfigFolder(): Promise<void> {
  await App.OpenConfigFolder();
}

// ============== Dialogs API ==============
// Native OS file/folder pickers, for use instead of hand-typed paths.
// Return '' when the user cancels.

export async function SelectAudioFile(): Promise<string> {
  return App.SelectAudioFile();
}

export async function SelectDirectory(): Promise<string> {
  return App.SelectDirectory();
}

export async function SelectSaveAudioFile(defaultFilename: string): Promise<string> {
  return App.SelectSaveAudioFile(defaultFilename);
}

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseUrl: string;
}

export async function CheckForUpdates(): Promise<UpdateCheckResult> {
  return App.UpdateCheck() as unknown as Promise<UpdateCheckResult>;
}

// ============== Preview API ==============

// Returns the URL for streaming a short audio preview (OGG/Vorbis).
// Use directly as <audio src> — no fetch needed. Served by the Wails
// AssetServer's custom handler (see app_files.go's previewAssetHandler),
// not the old /api/video/preview HTTP route.
export function GetPreviewURL(videoURL: string, seconds = 30): string {
  return `/preview?url=${encodeURIComponent(videoURL)}&seconds=${seconds}`;
}

// ============== Sources API ==============

export interface SourceInfo {
  name: string;
  displayName: string;
  available: boolean;
}

export async function GetSources(): Promise<SourceInfo[]> {
  return App.GetSources() as unknown as Promise<SourceInfo[]>;
}

export async function SetSourcePriority(names: string[]): Promise<void> {
  await App.SetSourcePriority(names);
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
  const res: any = await App.GetSoulseekStatus();
  return res;
}

export async function TestSoulseekLogin(username: string, password: string): Promise<SoulseekLoginTestResult> {
  const res: any = await App.SoulseekLoginTest(username, password);
  return res;
}

// ============== Qobuz Providers API ==============

export interface QobuzProvidersConfig {
  available: string[];
  disabled: string[];
}

export async function GetQobuzProviders(): Promise<QobuzProvidersConfig> {
  const res: any = await App.GetQobuzProviders();
  return res;
}

export async function SetQobuzProviders(disabled: string[]): Promise<void> {
  await App.SetQobuzProviders(disabled);
}
