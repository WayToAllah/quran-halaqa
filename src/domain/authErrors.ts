/**
 * Turning Firebase error codes into decisions, kept pure so both the
 * decisions and the wording can be tested without a Firebase client.
 *
 * The motivating bug: every failure was collapsed into one outcome. A dead
 * connection was reported as "البريد أو كلمة السر غير صحيحة", and a Firestore
 * read that could not complete was read as "this account is not a member" —
 * which locked a legitimate teacher out of the app entirely.
 */

/** Firebase errors carry a string `code`; anything else has none. */
function codeOf(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return '';
}

/**
 * What to tell someone whose sign-in attempt failed.
 *
 * Note there is no offline sign-in to offer: a password is verified by Google's
 * servers, never on the device, so a first sign-in genuinely requires a
 * connection. The message says so instead of blaming their password.
 */
export function loginErrorMessage(err: unknown): string {
  switch (codeOf(err)) {
    case 'auth/network-request-failed':
      return 'مفيش اتصال بالإنترنت. أول تسجيل دخول على الجهاز لازم يكون فيه نت.';
    case 'auth/too-many-requests':
      return 'محاولات كتير ورا بعض. استنى شوية وحاول تاني.';
    case 'auth/invalid-email':
      return 'صيغة البريد الإلكتروني مش صحيحة.';
    case 'auth/user-disabled':
      return 'الحساب ده متوقف. كلّم مسؤول الحلقة.';
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return 'البريد أو كلمة السر غير صحيحة.';
    default:
      return 'تعذّر تسجيل الدخول. حاول تاني.';
  }
}

export type MembershipFailure = 'unreachable' | 'denied' | 'unknown';

/**
 * Why the membership read failed — the distinction the old code did not make.
 *
 * `'denied'` means the server answered and said no. `'unreachable'` means we
 * never got an answer, which says nothing at all about whether this account is
 * a member and must never be presented as a rejection.
 *
 * `online` comes from the caller (navigator.onLine) because a browser that
 * knows it is offline is decisive on its own; the error codes cover the cases
 * where it wrongly believes it is online.
 */
export function classifyMembershipError(err: unknown, online: boolean): MembershipFailure {
  const code = codeOf(err);
  // A real rejection from the server outranks the connection state: if the
  // rules said no, saying no is correct even on a flaky link.
  if (code === 'permission-denied' || code === 'unauthenticated') return 'denied';
  if (!online) return 'unreachable';
  switch (code) {
    case 'unavailable':
    case 'deadline-exceeded':
    case 'cancelled':
    case 'resource-exhausted':
    case 'internal':
    case 'aborted':
      return 'unreachable';
    default:
      return 'unknown';
  }
}
