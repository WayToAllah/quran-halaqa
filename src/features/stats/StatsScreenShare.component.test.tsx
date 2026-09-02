import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { StatsScreen } from './StatsScreen';
import type { SessionRecord, Student } from '../../types';

const students: Student[] = [
  { id: 's_1', name: 'زيد' },
  { id: 's_2', name: 'عمر' },
];
const records: SessionRecord[] = [
  { id: 'r1', studentId: 's_1', date: '2026-07-01' },
  { id: 'r2', studentId: 's_2', date: '2026-07-01' },
];

vi.mock('../../hooks/useStudents', () => ({ useStudents: () => ({ students, loaded: true }) }));
vi.mock('../../hooks/useAllRecords', () => ({ useAllRecords: () => ({ records, loaded: true }) }));

// happy-dom has no canvas, so the rasterizer is stubbed; everything else,
// including sharePng itself, is the real implementation.
vi.mock('./shareCard', async (orig) => ({
  ...(await orig<typeof import('./shareCard')>()),
  svgToPngBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));

function stubShare(impl: () => Promise<void>) {
  const share = vi.fn((_data: unknown) => impl());
  vi.stubGlobal('navigator', { ...navigator, share, canShare: () => true });
  return share;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

async function openAttendanceCard() {
  render(<StatsScreen />);
  await userEvent.click(screen.getByText(/بطاقة نجوم الحضور — للمشاركة/));
  const btn = await screen.findByRole('button', { name: /مشاركة واتساب/ });
  await waitFor(() => expect(btn).not.toBeDisabled());
  return btn;
}

describe('StatsScreen — مشاركة البطاقة', () => {
  it('shares the already-rendered PNG straight from the tap', async () => {
    const share = stubShare(async () => {});
    const btn = await openAttendanceCard();
    await userEvent.click(btn);
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const arg = share.mock.calls[0][0] as unknown as { files: File[] };
    expect(arg.files[0].type).toBe('image/png');
  });

  it('says nothing when the user cancels the share sheet', async () => {
    stubShare(async () => {
      throw new DOMException('cancelled', 'AbortError');
    });
    const btn = await openAttendanceCard();
    await userEvent.click(btn);
    expect(screen.queryByText(/ماتمّتش/)).toBeNull();
  });

  it('explains a blocked share instead of silently saving a file', async () => {
    stubShare(async () => {
      throw new DOMException('denied', 'NotAllowedError');
    });
    const btn = await openAttendanceCard();
    await userEvent.click(btn);
    expect(await screen.findByText(/ماتمّتش/)).toBeTruthy();
  });

  it('offers no download button at all', async () => {
    stubShare(async () => {});
    await openAttendanceCard();
    expect(screen.queryByText(/تحميل/)).toBeNull();
  });
});
