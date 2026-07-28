import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { StarPicker } from './StarPicker';
import { StarRating, PlainStars } from './StarRating';

const FILLED = '\u2605';
const HOLLOW = '\u2606';

describe('StarRating', () => {
  // Stars follow the grade bands (90/80/70/60 -> 5/4/3/2, إعادة -> none), so
  // the count is asserted against the band rather than any arithmetic on the
  // score. Half stars no longer exist.
  it.each([
    [100, 5],
    [90, 5],
    [89, 4],
    [80, 4],
    [70, 3],
    [60, 2],
    [59, 0],
    [0, 0],
  ])('draws %i as %i filled stars', (score, filled) => {
    const { container } = render(<StarRating score={score} />);
    const text = container.textContent ?? '';
    // Always five positions drawn; only the fill count varies.
    expect(text.split(FILLED).length - 1).toBe(5);
    const goldSpan = container.querySelector('.text-mustard');
    expect(goldSpan?.textContent).toBe(FILLED.repeat(filled));
  });

  it('never draws a single filled star, since no 1-star grade exists', () => {
    for (let score = 0; score <= 100; score++) {
      const { container, unmount } = render(<StarRating score={score} />);
      expect(container.querySelector('.text-mustard')?.textContent).not.toBe(FILLED);
      unmount();
    }
  });

  it('uses the brand mustard token, not Tailwind amber', () => {
    const { container } = render(<StarRating score={90} />);
    expect(container.querySelector('.text-mustard')).not.toBeNull();
    expect(container.querySelector('[class*="amber"]')).toBeNull();
  });
});

describe('PlainStars', () => {
  it('pads a raw count out to five with hollow stars', () => {
    const { container } = render(<PlainStars count={3} />);
    expect(container.textContent).toBe(FILLED.repeat(3) + HOLLOW.repeat(2));
  });

  it('clamps out-of-range counts instead of drawing a broken row', () => {
    const { container: over } = render(<PlainStars count={9} />);
    expect(over.textContent).toBe(FILLED.repeat(5));
    const { container: under } = render(<PlainStars count={-2} />);
    expect(under.textContent).toBe(HOLLOW.repeat(5));
  });
});

describe('StarPicker', () => {
  it('still draws five positions so it reads as "out of five"', () => {
    render(<StarPicker value={4} onChange={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('cannot select one star — the lowest rating is two', async () => {
    const onChange = vi.fn();
    render(<StarPicker value={0} onChange={onChange} />);

    const first = screen.getByRole('button', { name: 'أقل تقدير هو نجمتان' });
    expect(first).toBeDisabled();
    await userEvent.click(first);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('selects two stars from the second position', async () => {
    const onChange = vi.fn();
    render(<StarPicker value={0} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: '2 نجوم' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it.each([
    [2, 'مقبول'],
    [3, 'جيد'],
    [4, 'جيد جداً'],
    [5, 'ممتاز'],
  ])('labels %i stars as %s', (value, label) => {
    render(<StarPicker value={value} onChange={() => {}} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('shows a dash when nothing has been picked yet', () => {
    render(<StarPicker value={0} onChange={() => {}} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
