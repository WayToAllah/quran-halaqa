import type { SuraAssignment } from '../types';

/**
 * The mushaf viewer lives outside the app bundle, at /mushaf/ next to it, and is
 * opened with the ward encoded in the query string. Keeping the link building
 * here (rather than inside the modal) means the encoding is unit-testable and
 * the component stays a thin frame around an iframe.
 *
 * Shape: ?a=sura:from:to,sura:from:to&n=<student>&w=<ward label>&id=<token>
 *
 * Whole-sura ranges ({sura, toSura, range:true}) carry no ayah numbers, so they
 * are sent as the sura alone; the viewer already reads a bare sura as "the whole
 * sura", which is the same meaning.
 */
export function mushafWardParam(list: readonly SuraAssignment[]): string {
  return list
    .filter((a) => a && a.sura)
    .map((a) => {
      const sura = encodeURIComponent(a.sura);
      if (a.range) return sura;
      const from = a.from ?? '';
      const to = a.to ?? '';
      if (!from && !to) return sura;
      return `${sura}:${from}:${to}`;
    })
    .join(',');
}

export interface MushafLinkOptions {
  /** Student name shown in the viewer header. */
  name?: string;
  /** 'اللوح' / 'الماضي', shown under the name. */
  ward?: string;
  /** Echoed back with the count, so a late message from a previous open is ignored. */
  token?: string;
  /** Defaults to the sibling folder of the app. */
  base?: string;
}

/** Full URL for the viewer, or null when there is nothing to show. */
export function mushafLink(
  list: readonly SuraAssignment[],
  { name = '', ward = '', token = '', base = '../mushaf/' }: MushafLinkOptions = {},
): string | null {
  const a = mushafWardParam(list);
  if (!a) return null;
  const params = [`a=${a}`];
  if (name) params.push(`n=${encodeURIComponent(name)}`);
  if (ward) params.push(`w=${encodeURIComponent(ward)}`);
  if (token) params.push(`id=${encodeURIComponent(token)}`);
  return `${base}?${params.join('&')}`;
}

/**
 * A message is only accepted when it is the viewer's own count message and it
 * carries the token we opened it with; anything else on the window is ignored.
 */
export function readMushafCount(data: unknown, token: string): number | null {
  if (!data || typeof data !== 'object') return null;
  const msg = data as { type?: unknown; id?: unknown; count?: unknown };
  if (msg.type !== 'mushaf-count') return null;
  if (String(msg.id ?? '') !== token) return null;
  const n = Number(msg.count);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

/**
 * The viewer says this once it is actually showing the ward. It is not the same
 * as the iframe loading: the viewer can come up and still fail to place the
 * ward (an unknown sura name), in which case it falls back to its own picker
 * and stays silent — and the app must keep offering a way out.
 */
export function isMushafReady(data: unknown, token: string): boolean {
  if (!data || typeof data !== 'object') return false;
  const msg = data as { type?: unknown; id?: unknown };
  if (msg.type !== 'mushaf-ready') return false;
  return String(msg.id ?? '') === token;
}
