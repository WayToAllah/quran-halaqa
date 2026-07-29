import type { SessionRecord } from '../types';
import { CHILD_STATS_BASE_URL } from '../config';
import { hasScore, scoreName, scoreToStars } from './scoring';
import { extractAssignedSuras } from './record';
import { joinSuraNames, ayahRange } from './suras';
import { toWesternDigits } from './text';

/**
 * Plain-text star row for WhatsApp, FILLED STARS ONLY.
 *
 * Uses the colour emoji star ⭐ (U+2B50) rather than the plain text glyph ★
 * (U+2605). ⭐ has no hollow counterpart, so there is nothing to pad the row
 * out to five with: pairing it with ☆ puts a flat monochrome outline beside a
 * colour emoji at a different advance width, and the row reads as broken.
 * Showing only what was earned is unambiguous anyway, since the grade label
 * always sits next to it on the same line.
 *
 * A consequence worth knowing: إعادة scores 0 stars, so that line carries the
 * label and no stars at all.
 */
const STAR_EMOJI = '\u2b50';

function starsTextFromScore(score: number): string {
  return STAR_EMOJI.repeat(scoreToStars(score));
}

/** Same row for an already-known 0-5 star COUNT (tajweed's fallback display
 * when no numeric score was given) — no score conversion. */
function starsTextFromCount(count: number): string {
  const full = Math.max(0, Math.min(5, Math.round(count)));
  return STAR_EMOJI.repeat(full);
}

/**
 * The evaluation is split across two lines for the parent: the numeric score
 * stays beside the sura it belongs to, and the stars + grade label drop onto
 * their own indented line beneath it. Long sura lists used to push the stars
 * off the end of a wrapped line on a phone, which is exactly the part the
 * parent looks for first.
 */
const GRADE_INDENT = '   ';

function scoreText(score: number): string {
  return `${score}/100`;
}

/**
 * The indented "⭐⭐⭐⭐ ممتاز" row. Built by joining non-empty parts rather
 * than concatenating with literal spaces: an إعادة score draws no stars at
 * all, and the naive `stars + ' ' + label` left a stray gap on the line the
 * parent reads. Returns '' when there is nothing to draw at all.
 */
function gradeRow(...parts: string[]): string {
  const row = parts.filter(Boolean).join(' ');
  return row ? GRADE_INDENT + row : '';
}

/** Grade row for a numeric score: stars + label. */
function gradeRowFromScore(score: number): string {
  return gradeRow(starsTextFromScore(score), scoreName(score));
}

/** The grade row plus its newline, or '' — so an empty row never leaves a
 * blank line sitting in the middle of the message. */
function gradeLine(row: string): string {
  return row ? row + '\n' : '';
}

/**
 * Builds the parent-facing WhatsApp progress message for a just-saved
 * session. `prevSession` is the session being evaluated today (its
 * newLoh/newMadi is "ما تم تسميعه اليوم") — pass the same value
 * findPreviousSession() / usePreviousSession() already gives the caller,
 * so this function doesn't need the full records array itself.
 *
 * Note: unlike the live app, this does NOT mint/push a parentToken or
 * publicStats — Firestore's rules deny client writes to publicStats
 * entirely (see firestore.rules), so that has to happen server-side
 * (Phase 5). If `parentToken` is omitted, the link line is simply left out.
 */
export function buildWhatsAppMessage(
  rec: SessionRecord,
  prevSession: SessionRecord | null,
  parentToken?: string,
): string {
  const nl = '\n';
  const firstName = (rec.student || '').split(' ')[0] || 'الطالب';
  const dateStr = rec.date
    ? new Date(rec.date).toLocaleDateString('ar-EG', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  let msg = 'السلام عليكم ورحمة الله وبركاته 🌿' + nl + nl;
  msg += `📅 *تقييم ${firstName} اليوم*` + nl;
  msg += dateStr + nl;
  msg += '─'.repeat(18) + nl + nl;

  const todayLoh = prevSession ? extractAssignedSuras(prevSession.newLoh, prevSession.loh) : [];
  const todayMadi = prevSession ? extractAssignedSuras(prevSession.newMadi, prevSession.madi) : [];

  if (todayLoh.length || todayMadi.length || hasScore(rec.loh) || hasScore(rec.madi)) {
    msg += '📖 *ما تم تسميعه اليوم*' + nl;
    if (todayLoh.length) {
      msg += '• اللوح: ' + joinSuraNames(todayLoh);
      if (hasScore(rec.loh)) msg += '  ←  ' + scoreText(rec.loh!.score!);
      msg += nl;
      if (hasScore(rec.loh)) msg += gradeLine(gradeRowFromScore(rec.loh!.score!));
    } else if (hasScore(rec.loh)) {
      msg += '• اللوح: ' + scoreText(rec.loh!.score!) + nl;
      msg += gradeLine(gradeRowFromScore(rec.loh!.score!));
    }
    if (todayMadi.length) {
      msg += '• الماضي: ' + joinSuraNames(todayMadi);
      if (hasScore(rec.madi)) msg += '  ←  ' + scoreText(rec.madi!.score!);
      msg += nl;
      if (hasScore(rec.madi)) msg += gradeLine(gradeRowFromScore(rec.madi!.score!));
    } else if (hasScore(rec.madi)) {
      msg += '• الماضي: ' + scoreText(rec.madi!.score!) + nl;
      msg += gradeLine(gradeRowFromScore(rec.madi!.score!));
    }
    msg += nl;
  }

  if (rec.tajweed?.sura) {
    msg += '📐 *التجويد*' + nl;
    // ayahRange() omits the parentheses entirely when no ayat were entered —
    // the hand-built version printed a bare "(–)" to the parent instead.
    msg += '• ' + rec.tajweed.sura + ayahRange(rec.tajweed.from, rec.tajweed.to);
    if (rec.tajweed.score) msg += '  ←  ' + scoreText(rec.tajweed.score);
    msg += nl;
    msg += gradeLine(
      rec.tajweed.score
        ? gradeRowFromScore(rec.tajweed.score)
        : gradeRow(starsTextFromCount(rec.tajweed.stars ?? 0)),
    );
    if (rec.tajweed.note) msg += '• ملاحظة: ' + rec.tajweed.note + nl;
    msg += nl;
  }

  const newLoh = extractAssignedSuras(rec.newLoh, undefined);
  const newMadi = extractAssignedSuras(rec.newMadi, undefined);
  if (newLoh.length || newMadi.length) {
    msg += '📝 *المهمة الجديدة للجلسة القادمة*' + nl;
    if (newLoh.length) msg += '• اللوح: ' + joinSuraNames(newLoh) + nl;
    if (newMadi.length) msg += '• الماضي: ' + joinSuraNames(newMadi) + nl;
    msg += nl;
  }

  if (rec.note) msg += '💬 *ملاحظة:* ' + rec.note + nl + nl;

  if (parentToken) {
    msg += `📊 لمتابعة تقدم ${firstName} أول بأول:` + nl;
    msg += CHILD_STATS_BASE_URL + '?t=' + parentToken + nl + nl;
  }

  msg += 'جزاكم الله خيراً 🤲';
  return msg;
}

/** Normalizes an Egyptian mobile number into wa.me's expected international
 * format (leading 0 -> 2, country code prefix), or '' if unusable. */
export function normalizeWhatsAppPhone(raw: string | undefined): string {
  // Arabic-Indic digits FIRST: stripping non-[0-9] before converting them
  // erased a number typed on an Arabic keyboard down to an empty string, and
  // the send button then did nothing without saying why.
  let phone = toWesternDigits(raw || '').replace(/[^0-9]/g, '');
  if (!phone) return '';
  if (phone.startsWith('0')) phone = '2' + phone;
  return phone;
}
