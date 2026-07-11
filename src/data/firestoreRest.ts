import type { PublicStats } from '../types';

/**
 * Reads the one public, unauthenticated document (`publicStats/{token}`,
 * `allow get: if true` in firestore.rules) over the Firestore REST API instead
 * of the Firebase SDK. This keeps the parent-page bundle tiny — the SDK is
 * ~180KB gzip and the parent only ever does a single public read.
 *
 * These config values mirror src/data/firebase.ts and are NOT secrets: Firebase
 * web API keys are public identifiers (they ship in every client bundle) and
 * access is governed by security rules, not by hiding the key.
 */
const PROJECT_ID = 'quran-app-abe52';
const API_KEY = 'AIzaSyCLzsd-tyAPKoS6HQ-Kw6LEwaxPSibbKSg';

type FsValue = Record<string, unknown>;

/** Decode a single Firestore REST typed value back to a plain JS value. */
export function decodeFirestoreValue(v: FsValue | null | undefined): unknown {
  if (v == null) return null;
  if ('nullValue' in v) return null;
  if ('stringValue' in v) return v.stringValue as string;
  if ('booleanValue' in v) return v.booleanValue as boolean;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue as number;
  if ('timestampValue' in v) return v.timestampValue as string;
  if ('arrayValue' in v) {
    const arr = (v.arrayValue as { values?: FsValue[] })?.values ?? [];
    return arr.map((x) => decodeFirestoreValue(x));
  }
  if ('mapValue' in v) {
    const fields = (v.mapValue as { fields?: Record<string, FsValue> })?.fields ?? {};
    return decodeFirestoreFields(fields);
  }
  return null;
}

function decodeFirestoreFields(fields: Record<string, FsValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(fields)) out[key] = decodeFirestoreValue(fields[key]);
  return out;
}

/** Decode a Firestore REST Document (`{ name, fields, ... }`) to a plain object. */
export function decodeFirestoreDocument(doc: {
  fields?: Record<string, FsValue>;
}): Record<string, unknown> {
  return decodeFirestoreFields(doc?.fields ?? {});
}

interface FetchOpts {
  fetchImpl?: typeof fetch;
  projectId?: string;
  apiKey?: string;
}

/** Fetch a student's public projection by token. Returns null for a missing
 * document (404). Throws on other transport/HTTP errors so the page can show a
 * "try again" state rather than a false "not found". */
export async function fetchPublicStatsRest(
  token: string,
  opts: FetchOpts = {},
): Promise<PublicStats | null> {
  const doFetch = opts.fetchImpl ?? fetch;
  const projectId = opts.projectId ?? PROJECT_ID;
  const apiKey = opts.apiKey ?? API_KEY;
  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId}` +
    `/databases/(default)/documents/publicStats/${encodeURIComponent(token)}?key=${apiKey}`;

  const res = await doFetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('publicStats REST read failed: ' + res.status);
  const doc = (await res.json()) as { fields?: Record<string, FsValue> };
  return decodeFirestoreDocument(doc) as unknown as PublicStats;
}
