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
});
