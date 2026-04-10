import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DebugLogsModal } from './DebugLogsModal';
import * as Api from '../../lib/api';

beforeEach(() => {
  vi.spyOn(Api, 'GetItemLogs').mockResolvedValue([
    { id: 1, time: '10:00:00', level: 'INFO', message: 'started' },
    { id: 2, time: '10:00:01', level: 'ERROR', message: 'boom' },
  ]);
});

describe('DebugLogsModal', () => {
  it('loads and renders logs', async () => {
    render(<DebugLogsModal itemId="abc" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('started')).toBeInTheDocument());
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('filters by level', async () => {
    render(<DebugLogsModal itemId="abc" onClose={() => {}} />);
    await waitFor(() => screen.getByText('started'));
    fireEvent.change(screen.getByLabelText('Level'), { target: { value: 'ERROR' } });
    expect(screen.queryByText('started')).toBeNull();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('copies logs to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<DebugLogsModal itemId="abc" onClose={() => {}} />);
    await waitFor(() => screen.getByText('started'));
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(writeText).toHaveBeenCalled();
  });
});
