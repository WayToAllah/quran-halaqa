import { scoreToStars } from '../domain/scoring';

/**
 * Renders a 5-star rating driven by a 0-100 score.
 *
 * Whole stars only. The previous version drew half-star precision by
 * overlaying a clipped copy of the star row at a percentage width; with stars
 * now derived from the grade band (scoreToStars) there are no half values left
 * to draw, so the clipping trick is gone.
 *
 * Filled stars use the brand mustard token rather than Tailwind's amber-500,
 * which was never part of the palette and read visibly orange next to the
 * mustard used everywhere else.
 */
export function StarRating({ score }: { score: number }) {
  const filled = scoreToStars(score);
  return (
    <span class="text-sm leading-none tracking-widest" dir="ltr">
      <span class="text-mustard">{'\u2605'.repeat(filled)}</span>
      <span class="text-hairline">{'\u2605'.repeat(5 - filled)}</span>
    </span>
  );
}

/** Plain (non-score-derived) star display for raw star counts like tajweed.stars. */
export function PlainStars({ count }: { count: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(count)));
  return (
    <span dir="ltr">
      {'\u2605'.repeat(filled)}
      {'\u2606'.repeat(5 - filled)}
    </span>
  );
}
