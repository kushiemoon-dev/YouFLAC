import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnalyzerBatch } from './AnalyzerBatch';
import * as Api from '../../lib/api';

vi.mock('../../lib/api', () => ({
  AnalyzeAudio: vi.fn(),
}));

const mockAnalysis: Api.AudioAnalysis = {
  filePath: '/tmp/test.flac',
  fileName: 'test.flac',
  codec: 'flac',
  codecLong: 'FLAC (Free Lossless Audio Codec)',
  bitrate: 900000,
  sampleRate: 44100,
  bitsPerSample: 16,
  channels: 2,
  duration: 180,
  fileSize: 20000000,
  isTrueLossless: true,
  fakeLossless: false,
  qualityScore: 95,
  qualityRating: 'Excellent',
  format: 'flac',
};

describe('AnalyzerBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders drop zone text', () => {
    render(<AnalyzerBatch />);
    expect(screen.getByText(/Drag & drop audio files here/i)).toBeInTheDocument();
  });

  it('"Analyze All" button is disabled when no files selected', () => {
    render(<AnalyzerBatch />);
    // Button is not rendered until files are added — verify it's absent
    expect(screen.queryByRole('button', { name: /Analyze All/i })).not.toBeInTheDocument();
  });

  it('calls AnalyzeAudio for each file', async () => {
    vi.mocked(Api.AnalyzeAudio).mockResolvedValue(mockAnalysis);

    render(<AnalyzerBatch />);

    const file1 = new File(['audio'], 'track1.flac', { type: 'audio/flac' });
    const file2 = new File(['audio'], 'track2.mp3', { type: 'audio/mpeg' });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file1, file2] } });

    const button = await screen.findByRole('button', { name: /Analyze All/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(Api.AnalyzeAudio).toHaveBeenCalledTimes(2);
    });
  });
});
