const LABELS = ['', 'ضعيف', 'مقبول', 'جيد', 'جيد جداً', 'ممتاز'];

export function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div class="flex items-center gap-1.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          class={'text-xl leading-none ' + (n <= value ? 'text-mustard' : 'text-[#E7E1D3]')}
          aria-label={`${n} نجوم`}
          onClick={() => onChange(n)}
        >
          ★
        </button>
      ))}
      <span class="text-xs text-taupe mr-1" dir="rtl">
        {value ? LABELS[value] : '—'}
      </span>
    </div>
  );
}
