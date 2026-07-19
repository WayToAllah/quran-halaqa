/**
 * Hijri (Umm al-Qura) date formatting, ported from the live index.html.
 *
 * Uses the browser's built-in `Intl.DateTimeFormat` with the
 * `islamic-umalqura` calendar — the same Saudi Umm al-Qura reckoning the
 * production app relies on, so v2 shows byte-identical Hijri strings. No
 * external library and no manual conversion tables.
 *
 * A plain 'YYYY-MM-DD' string is anchored at **noon** (`T12:00:00`) before
 * formatting. This mirrors production and dodges the same timezone-rollover
 * trap that `localDateStr` guards the Gregorian side against: parsing a bare
 * date as midnight-UTC can land on the previous local day in UTC+2/+3 (Egypt),
 * shifting the Hijri day by one. Noon is safely mid-day in every timezone.
 */

export type HijriOptions = Intl.DateTimeFormatOptions;

const DEFAULT_OPTS: HijriOptions = { day: 'numeric', month: 'long', year: 'numeric' };

/** Parse an input the same way production does: pass Date through untouched,
 * anchor a bare 'YYYY-MM-DD' at local noon, otherwise defer to `new Date()`. */
function toDate(input: Date | string): Date {
  if (input instanceof Date) return input;
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return new Date(input + 'T12:00:00');
  }
  return new Date(input);
}

/**
 * Formats a date as an Umm al-Qura Hijri string, e.g. "٢٤ محرم ١٤٤٨".
 * Returns '' for an unparseable input or if the runtime lacks the
 * islamic-umalqura calendar — callers treat '' as "no Hijri available" and
 * fall back to the Gregorian date alone (matching production).
 */
export function hijriStr(input: Date | string, opts: HijriOptions = DEFAULT_OPTS): string {
  try {
    const d = toDate(input);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', opts).format(d);
  } catch {
    return '';
  }
}

/** Long Hijri form for headers / the session-date sub-line:
 * "٢٤ محرم ١٤٤٨". */
export function hijriLong(input: Date | string): string {
  return hijriStr(input, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Short Hijri form for dense log rows: "٢٤ محرم". */
export function hijriShort(input: Date | string): string {
  return hijriStr(input, { day: 'numeric', month: 'short' });
}

/** Full Hijri form including the weekday, for the "today" line on the record /
 * stats screens: "الجمعة ٢٤ محرم ١٤٤٨". */
export function hijriFull(input: Date | string): string {
  return hijriStr(input, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
