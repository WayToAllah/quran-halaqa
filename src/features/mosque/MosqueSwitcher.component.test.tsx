import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { MosqueProvider } from './MosqueContext';
import { MosqueSwitcher } from './MosqueSwitcher';
import type { UserMosqueLink } from '../../types';

const A: UserMosqueLink = { mosqueId: 'altayseer', label: 'مسجد التيسير' };
const B: UserMosqueLink = { mosqueId: 'noor', label: 'مسجد النور' };

function renderSwitcher(mosques: UserMosqueLink[], active: UserMosqueLink, switchMosque = vi.fn()) {
  render(
    <MosqueProvider
      value={{
        mosqueId: active.mosqueId,
        halaqaId: 'main',
        mosques,
        halaqat: [],
        switchMosque,
        switchHalaqa: () => {},
      }}
    >
      <MosqueSwitcher />
    </MosqueProvider>,
  );
  return { switchMosque };
}

describe('MosqueSwitcher', () => {
  it('renders nothing for a single-mosque user (unchanged single-tenant UI)', () => {
    const { container } = render(
      <MosqueProvider
        value={{
          mosqueId: A.mosqueId,
          halaqaId: 'main',
          mosques: [A],
          halaqat: [],
          switchMosque: vi.fn(),
          switchHalaqa: () => {},
        }}
      >
        <MosqueSwitcher />
      </MosqueProvider>,
    );
    expect(container.textContent).toBe('');
  });

  it('shows a picker with every mosque when the user has more than one', () => {
    renderSwitcher([A, B], A);
    expect(screen.getByText('المسجد الحالي:')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'مسجد التيسير' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'مسجد النور' })).toBeInTheDocument();
  });

  it('reflects the active mosque as the selected value', () => {
    renderSwitcher([A, B], B);
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('noor');
  });

  it('calls switchMosque with the chosen id', async () => {
    const { switchMosque } = renderSwitcher([A, B], A);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'noor');
    expect(switchMosque).toHaveBeenCalledWith('noor');
  });
});
