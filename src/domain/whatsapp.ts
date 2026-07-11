import type { SessionRecord } from '../types';
import { CHILD_STATS_BASE_URL } from '../config';
import { hasScore, scoreName, scoreToHalfStars } from './scoring';
import { extractAssignedSuras } from './record';
import { joinSuraNames } from './suras';

/**
 * Plain-text star string (not JSX) for a 0-100 SCORE — WhatsApp fonts render
 * the half-star glyph inconsistently across phones, so this rounds to the
 * nearest whole star for message text, unlike the UI's half-star StarRating.
 */
function starsTextFromScore(score: number): string {
  const full = Math.round(scoreToHalfStars(score));
  return '★'.repeat(full) + '☆'.repeat(Math.max(0, 5 - full));
}

/** Plain-text star string for an already-known 0-5 star COUNT (tajweed's
 * fallback display when no numeric score was given) — no score conversion. */
function starsTextFromCount(count: number): string {
  const full = Math.max(0, Math.min(5, Math.round(count)));
  return '★'.repeat(full) + '☆'.repeat(5 - full);
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
export function buildWhatsAppMessage(rec: SessionRecord, prevSession: SessionRecord | null, parentToken?: string): string {
  const nl = '\n';
  const firstName = (rec.student || '').split(' ')[0] || 'الطالب';
  const dateStr = rec.date
    ? new Date(rec.date).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
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
      if (hasScore(rec.loh)) msg += '  ←  ' + rec.loh!.score + '/100 ' + starsTextFromScore(rec.loh!.score!) + ' ' + scoreName(rec.loh!.score);
      msg += nl;
    } else if (hasScore(rec.loh)) {
      msg += '• اللوح: ' + rec.loh!.score + '/100 ' + starsTextFromScore(rec.loh!.score!) + ' ' + scoreName(rec.loh!.score) + nl;
    }
    if (todayMadi.length) {
      msg += '• الماضي: ' + joinSuraNames(todayMadi);
      if (hasScore(rec.madi)) msg += '  ←  ' + rec.madi!.score + '/100 ' + starsTextFromScore(rec.madi!.score!) + ' ' + scoreName(rec.madi!.score);
      msg += nl;
    } else if (hasScore(rec.madi)) {
      msg += '• الماضي: ' + rec.madi!.score + '/100 ' + starsTextFromScore(rec.madi!.score!) + ' ' + scoreName(rec.madi!.score) + nl;
    }
    msg += nl;
  }

  if (rec.tajweed?.sura) {
    msg += '📐 *التجويد*' + nl;
    msg += '• ' + rec.tajweed.sura + ' (' + rec.tajweed.from + '–' + rec.tajweed.to + ')';
    msg += rec.tajweed.score
      ? '  ←  ' + rec.tajweed.score + '/100 ' + starsTextFromScore(rec.tajweed.score) + ' ' + scoreName(rec.tajweed.score)
      : '  ' + starsTextFromCount(rec.tajweed.stars ?? 0);
    msg += nl;
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
  let phone = (raw || '').replace(/[^0-9]/g, '');
  if (!phone) return '';
  if (phone.startsWith('0')) phone = '2' + phone;
  return phone;
}
