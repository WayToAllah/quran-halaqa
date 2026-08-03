import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { useState } from 'preact/hooks';
import { SearchInput } from './SearchInput';

/** Wrapper that owns the value, so typing and clearing behave as they do in
 * the screens rather than against a frozen prop. */
function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <SearchInput
      value={value}
      onChange={setValue}
      placeholder="ابحث باسم الطالب…"
      label="ابحث في السجل باسم الطالب"
    />
  );
}

describe('SearchInput', () => {
  it('shows no clear button while the field is empty', () => {
    render(<Harness />);
    expect(screen.queryByRole('button', { name: 'مسح البحث' })).not.toBeInTheDocument();
  });

  it('offers a clear button as soon as there is something to clear', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText('ابحث في السجل باسم الطالب'), 'محمد');
    expect(screen.getByRole('button', { name: 'مسح البحث' })).toBeInTheDocument();
  });

  it('empties the field in one tap', async () => {
    render(<Harness initial="محمد" />);
    await userEvent.click(screen.getByRole('button', { name: 'مسح البحث' }));

    expect(screen.getByLabelText('ابحث في السجل باسم الطالب')).toHaveValue('');
    // Back to the magnifier — nothing left to clear.
    expect(screen.queryByRole('button', { name: 'مسح البحث' })).not.toBeInTheDocument();
  });

  it('reports the cleared value once, not once per character', async () => {
    // The log re-queries Firestore on every change; backspacing through a name
    // fires one search per keystroke, which is the cost this button avoids.
    const onChange = vi.fn();
    render(
      <SearchInput value="محمد" onChange={onChange} placeholder="ابحث باسم الطالب…" label="بحث" />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'مسح البحث' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('keeps focus in the field after clearing, so the keyboard stays up', async () => {
    render(<Harness initial="محمد" />);
    await userEvent.click(screen.getByRole('button', { name: 'مسح البحث' }));
    expect(screen.getByLabelText('ابحث في السجل باسم الطالب')).toHaveFocus();
  });

  it('names the field for screen readers, which never see the placeholder', () => {
    render(<Harness />);
    expect(screen.getByLabelText('ابحث في السجل باسم الطالب')).toBeInTheDocument();
  });
});
