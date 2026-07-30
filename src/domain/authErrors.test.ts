import { describe, it, expect } from 'vitest';
import { loginErrorMessage, classifyMembershipError } from './authErrors';

function fbError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

describe('loginErrorMessage', () => {
  it('blames the connection, not the password, when the request never left', () => {
    const msg = loginErrorMessage(fbError('auth/network-request-failed'));
    expect(msg).toContain('مفيش اتصال');
    expect(msg).not.toContain('كلمة السر غير صحيحة');
  });

  it('still reports genuinely bad credentials as such', () => {
    for (const code of ['auth/wrong-password', 'auth/user-not-found', 'auth/invalid-credential']) {
      expect(loginErrorMessage(fbError(code))).toBe('البريد أو كلمة السر غير صحيحة.');
    }
  });

  it('distinguishes rate limiting, bad email format and disabled accounts', () => {
    expect(loginErrorMessage(fbError('auth/too-many-requests'))).toContain('محاولات كتير');
    expect(loginErrorMessage(fbError('auth/invalid-email'))).toContain('صيغة البريد');
    expect(loginErrorMessage(fbError('auth/user-disabled'))).toContain('متوقف');
  });

  it('falls back to a neutral message for anything unrecognised', () => {
    expect(loginErrorMessage(new Error('boom'))).toBe('تعذّر تسجيل الدخول. حاول تاني.');
    expect(loginErrorMessage(null)).toBe('تعذّر تسجيل الدخول. حاول تاني.');
    expect(loginErrorMessage({ code: 42 })).toBe('تعذّر تسجيل الدخول. حاول تاني.');
  });
});

describe('classifyMembershipError', () => {
  it('treats an offline browser as unreachable, never as a rejection', () => {
    expect(classifyMembershipError(fbError('unavailable'), false)).toBe('unreachable');
    expect(classifyMembershipError(new Error('whatever'), false)).toBe('unreachable');
  });

  it('treats transient server-side codes as unreachable even while online', () => {
    for (const code of [
      'unavailable',
      'deadline-exceeded',
      'cancelled',
      'resource-exhausted',
      'internal',
      'aborted',
    ]) {
      expect(classifyMembershipError(fbError(code), true)).toBe('unreachable');
    }
  });

  it('honours an actual refusal from the rules, online or off', () => {
    // The server answered. That answer outranks the connection state — the
    // offline fallback must not become a way around the rules.
    expect(classifyMembershipError(fbError('permission-denied'), true)).toBe('denied');
    expect(classifyMembershipError(fbError('permission-denied'), false)).toBe('denied');
    expect(classifyMembershipError(fbError('unauthenticated'), false)).toBe('denied');
  });

  it('does not guess when online and the code means nothing to us', () => {
    expect(classifyMembershipError(new Error('boom'), true)).toBe('unknown');
    expect(classifyMembershipError(fbError('not-found'), true)).toBe('unknown');
  });
});
