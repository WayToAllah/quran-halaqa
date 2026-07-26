import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { MosqueProvider, type MosqueContextValue } from './MosqueContext';
import { HalaqaSwitcher } from './HalaqaSwitcher';
import { ScopeBar } from './ScopeBar';
import type { Halaqa, UserMosqueLink } from '../../types';

const mosque = (id: string, label: string): UserMosqueLink => ({ mosqueId: id, label });

const halaqa = (id: string, name: string, primaryTeacherUid?: string): Halaqa => ({
  id,
  name,
  excludedDates: [],
  attendanceBadgeThreshold: 70,
  primaryTeacherUid,
});

const SABAH = halaqa('sabah', 'حلقة الصبح', 'uid_ahmed');
const ASR = halaqa('asr', 'حلقة العصر', 'uid_mahmoud');

function ctx(over: Partial<MosqueContextValue> = {}): MosqueContextValue {
  return {
    mosqueId: 'altayseer',
    halaqaId: 'sabah',
    mosques: [mosque('altayseer', 'مسجد التيسير')],
    halaqat: [SABAH, ASR],
    switchMosque: vi.fn(),
    switchHalaqa: vi.fn(),
    ...over,
  };
}

describe('HalaqaSwitcher', () => {
  it('hides itself when the mosque has a single halaqa', () => {
    const { container } = render(
      <MosqueProvider value={ctx({ halaqat: [SABAH] })}>
        <HalaqaSwitcher />
      </MosqueProvider>,
    );
    expect(container.textContent).toBe('');
  });

  it('lists every halaqa in the mosque, so a substitute can pick any circle', () => {
    render(
      <MosqueProvider value={ctx()}>
        <HalaqaSwitcher />
      </MosqueProvider>,
    );
    expect(screen.getByRole('option', { name: 'حلقة الصبح' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'حلقة العصر' })).toBeInTheDocument();
  });

  it('calls switchHalaqa with the chosen id', async () => {
    const switchHalaqa = vi.fn();
    render(
      <MosqueProvider value={ctx({ switchHalaqa })}>
        <HalaqaSwitcher />
      </MosqueProvider>,
    );
    await userEvent.selectOptions(screen.getByRole('combobox'), 'asr');
    expect(switchHalaqa).toHaveBeenCalledWith('asr');
  });
});

describe('ScopeBar', () => {
  it('renders nothing for one mosque with one halaqa (original setup untouched)', () => {
    const { container } = render(
      <MosqueProvider value={ctx({ halaqat: [SABAH] })}>
        <ScopeBar />
      </MosqueProvider>,
    );
    expect(container.textContent).toBe('');
  });

  it('shows only the halaqa picker when there are several circles in one mosque', () => {
    render(
      <MosqueProvider value={ctx()}>
        <ScopeBar />
      </MosqueProvider>,
    );
    expect(screen.getByText('الحلقة:')).toBeInTheDocument();
    expect(screen.queryByText('المسجد الحالي:')).not.toBeInTheDocument();
  });

  it('shows both pickers for a teacher in several mosques with several circles', () => {
    render(
      <MosqueProvider
        value={ctx({ mosques: [mosque('altayseer', 'مسجد التيسير'), mosque('noor', 'مسجد النور')] })}
      >
        <ScopeBar />
      </MosqueProvider>,
    );
    expect(screen.getByText('المسجد الحالي:')).toBeInTheDocument();
    expect(screen.getByText('الحلقة:')).toBeInTheDocument();
  });
});
