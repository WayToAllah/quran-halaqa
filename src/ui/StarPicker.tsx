/** Indexed by star count. There is no 1-star grade in the halaqa's scale
 * (90/80/70/60 → 5/4/3/2 stars, إعادة → no stars), so 2 is the lowest
 * selectable rating and index 1 is unreachable. */
const LABELS = ['', '', 'مقبول', 'جيد', 'جيد جداً', 'ممتاز'];

/** Lowest selectable rating — see LABELS. */
const MIN_STARS = 2;

export function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div class="flex items-center gap-1.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => {
        // The first position is still DRAWN so the control reads as "out of
        // five" and matches how the same star count is displayed elsewhere
        // (PlainStars). It just isn't selectable, because a 1-star grade
        // doesn't exist.
        const locked = n < MIN_STARS;
        return (
          <button
            key={n}
            type="button"
            disabled={locked}
            class={
              'text-xl leading-none ' +
              (n <= value ? 'text-mustard' : 'text-[#E7E1D3]') +
              (locked ? ' opacity-45 cursor-default' : '')
            }
            aria-label={locked ? 'أقل تقدير هو نجمتان' : `${n} نجوم`}
            title={locked ? 'أقل تقدير هو نجمتان (مقبول)' : undefined}
            onClick={() => onChange(n)}
          >
            ★
          </button>
        );
      })}
      <span class="text-xs text-taupe mr-1" dir="rtl">
        {value ? LABELS[value] : '—'}
      </span>
    </div>
  );
}
