import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { NiyyahBar } from './NiyyahBar';
import { DEFAULT_NIYYAH } from '../../domain/niyyat';

beforeEach(() => {
  vi.useFakeTimers();
  // Default: motion NOT reduced, so the fade path runs.
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('NiyyahBar', () => {
  it('shows the default verse when the list is empty', () => {
    render(<NiyyahBar niyyat={[]} onEdit={vi.fn()} />);
    expect(screen.getByText(DEFAULT_NIYYAH)).toBeInTheDocument();
  });

  it('shows the first niyyah initially', () => {
    render(<NiyyahBar niyyat={['نية ١', 'نية ٢']} onEdit={vi.fn()} />);
    expect(screen.getByText('نية ١')).toBeInTheDocument();
  });

  it('rotates to the next niyyah after the interval + fade', () => {
    render(<NiyyahBar niyyat={['نية ١', 'نية ٢']} onEdit={vi.fn()} intervalSec={4} />);
    expect(screen.getByText('نية ١')).toBeInTheDocument();
    // advance past the 4s hold, then past the fade swap
    act(() => {
      vi.advanceTimersByTime(4000); // triggers fade-out + schedules swap
      vi.advanceTimersByTime(500); // fade duration → swap happens
    });
    expect(screen.getByText('نية ٢')).toBeInTheDocument();
  });

  it('wraps back to the first after the last', () => {
    render(<NiyyahBar niyyat={['أ', 'ب']} onEdit={vi.fn()} intervalSec={4} />);
    act(() => {
      vi.advanceTimersByTime(4500);
    }); // → ب
    expect(screen.getByText('ب')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4500);
    }); // → wrap to أ
    expect(screen.getByText('أ')).toBeInTheDocument();
  });

  it('does not rotate when there is only one niyyah', () => {
    render(<NiyyahBar niyyat={['وحيدة']} onEdit={vi.fn()} intervalSec={4} />);
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(screen.getByText('وحيدة')).toBeInTheDocument();
  });

  it('fires onEdit when the pencil is tapped', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<NiyyahBar niyyat={['نية']} onEdit={onEdit} />);
    await user.click(screen.getByRole('button', { name: 'تعديل النوايا' }));
    expect(onEdit).toHaveBeenCalledOnce();
  });
});
