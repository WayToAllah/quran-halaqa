import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { SuraRow } from './SuraRow';
import type { SuraAssignment } from '../../types';

function renderRow(value: SuraAssignment = { sura: '', from: '', to: '' }) {
  const onChange = vi.fn();
  const result = render(<SuraRow value={value} onChange={onChange} label="اللوح 1" />);
  return { onChange, ...result };
}

beforeEach(() => vi.clearAllMocks());

describe('SuraRow — searchable sura picker', () => {
  it('filters the dropdown as you type and shows ayah count + page range', async () => {
    const user = userEvent.setup();
    renderRow();
    const input = screen.getByPlaceholderText('اكتب اسم السورة…');
    await user.click(input);
    await user.type(input, 'بقر');
    // البقرة option shows "2. البقرة" and "286 آية · صفحات 2-49"
    const option = await screen.findByRole('button', { name: /2\. البقرة/ });
    expect(option).toHaveTextContent('286 آية');
    expect(option).toHaveTextContent('صفحات 2-49');
  });

  it('commits the picked sura via onChange', async () => {
    const user = userEvent.setup();
    const { onChange } = renderRow();
    const input = screen.getByPlaceholderText('اكتب اسم السورة…');
    await user.click(input);
    await user.type(input, 'الفاتحة');
    await user.click(await screen.findByRole('button', { name: /1\. الفاتحة/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sura: 'الفاتحة' }));
  });

  it('shows the ayah-count + Madinah page hint once a sura is selected', () => {
    renderRow({ sura: 'الكهف', from: '', to: '' });
    expect(screen.getByText(/عدد آيات السورة: 110/)).toBeInTheDocument();
    expect(screen.getByText(/صفحات 293-304 \(مصحف المدينة\)/)).toBeInTheDocument();
  });

  it('shows "لا توجد نتائج" when nothing matches', async () => {
    const user = userEvent.setup();
    renderRow();
    const input = screen.getByPlaceholderText('اكتب اسم السورة…');
    await user.click(input);
    await user.type(input, 'زززز');
    expect(await screen.findByText('لا توجد نتائج')).toBeInTheDocument();
  });

  it('caps the ayah inputs at the selected sura length', () => {
    renderRow({ sura: 'الفاتحة', from: '', to: '' });
    const fromInput = screen.getByPlaceholderText('من آية') as HTMLInputElement;
    expect(fromInput.max).toBe('7');
  });

  it('shows an incomplete-range error when "من" is filled but "إلى" is empty', () => {
    renderRow({ sura: 'البقرة', from: '5', to: '' });
    expect(screen.getByText('أكمل نهاية النطاق')).toBeInTheDocument();
  });

  it('shows an incomplete-range error when "إلى" is filled but "من" is empty', () => {
    renderRow({ sura: 'البقرة', from: '', to: '5' });
    expect(screen.getByText('أكمل بداية النطاق')).toBeInTheDocument();
  });

  it('shows no incomplete-range error when both ayah fields are empty', () => {
    renderRow({ sura: 'البقرة', from: '', to: '' });
    expect(screen.queryByText('أكمل نهاية النطاق')).not.toBeInTheDocument();
    expect(screen.queryByText('أكمل بداية النطاق')).not.toBeInTheDocument();
  });
});

describe('SuraRow — whole-sura range mode', () => {
  it('reveals the "إلى سورة" picker and hides the ayah fields when toggled on', async () => {
    const user = userEvent.setup();
    const { onChange } = renderRow({ sura: 'الملك', from: '', to: '' });
    // ayah fields present before toggling
    expect(screen.getByPlaceholderText('من آية')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox'));
    // onChange fires with range:true, and from/to are dropped
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sura: 'الملك', range: true }));
    const call = onChange.mock.calls[0][0] as Record<string, unknown>;
    expect(call).not.toHaveProperty('from');
    expect(call).not.toHaveProperty('to');
  });

  it('when already a range, shows both pickers and no ayah inputs', () => {
    renderRow({ sura: 'الملك', toSura: 'الناس', range: true });
    expect(screen.getByText('إلى سورة')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('اكتب سورة النهاية…')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('من آية')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('إلى آية')).not.toBeInTheDocument();
  });

  it('commits the end sura via onChange as toSura', async () => {
    const user = userEvent.setup();
    const { onChange } = renderRow({ sura: 'الملك', toSura: '', range: true });
    const endInput = screen.getByPlaceholderText('اكتب سورة النهاية…');
    await user.click(endInput);
    await user.type(endInput, 'الناس');
    await user.click(await screen.findByRole('button', { name: /114\. الناس/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ toSura: 'الناس' }));
  });

  it('toggling back off drops toSura and range', async () => {
    const user = userEvent.setup();
    const { onChange } = renderRow({ sura: 'الملك', toSura: 'الناس', range: true });
    await user.click(screen.getByRole('checkbox'));
    const call = onChange.mock.calls[0][0] as Record<string, unknown>;
    expect(call).not.toHaveProperty('toSura');
    expect(call).not.toHaveProperty('range');
    expect(call).toMatchObject({ sura: 'الملك' });
  });
});
