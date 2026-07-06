import { scoreToHalfStars } from '../domain/scoring';

/** Renders a 5-star rating with half-star precision, driven by a 0-100 score. */
export function StarRating({ score }: { score: number }) {
  const half = scoreToHalfStars(score);
  const fillPct = (half / 5) * 100;
  return (
    <span class="relative inline-block text-sm leading-none tracking-widest" dir="ltr">
      <span class="text-neutral-300">★★★★★</span>
      <span
        class="absolute top-0 left-0 overflow-hidden whitespace-nowrap text-amber-500"
        style={{ width: `${fillPct}%` }}
      >
        ★★★★★
      </span>
    </span>
  );
}

/** Plain (non-score-derived) star display for raw star counts like tajweed.stars. */
export function PlainStars({ count }: { count: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(count)));
  return (
    <span dir="ltr">
      {'★'.repeat(filled)}
      {'☆'.repeat(5 - filled)}
    </span>
  );
}
