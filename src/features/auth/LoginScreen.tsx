import { useState } from 'preact/hooks';
import type { AuthState } from './useAuth';

interface Props {
  auth: AuthState;
}

export function LoginScreen({ auth }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const statusText =
    auth.status === 'loading'
      ? 'جاري التحقق من الجلسة…'
      : auth.status === 'checking-membership'
        ? 'جاري التحقق من الصلاحية…'
        : auth.status === 'denied'
          ? 'هذا الحساب غير مسجَّل كمشرف على هذه الحلقة.'
          : 'سجّل الدخول لمتابعة الحلقة';

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError('');
    if (!email || !password) return;
    setSubmitting(true);
    try {
      await auth.signIn(email, password);
    } catch (err) {
      console.error('login failed:', err);
      setError('البريد أو كلمة السر غير صحيحة.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset() {
    if (!email) {
      setError('اكتب بريدك الإلكتروني أولاً ثم اضغط "نسيت كلمة السر".');
      return;
    }
    try {
      await auth.resetPassword(email);
      setResetSent(true);
    } catch (err) {
      console.error('reset failed:', err);
      setError('تعذّر إرسال رابط إعادة التعيين.');
    }
  }

  const showForm = auth.status === 'signed-out' || auth.status === 'denied';

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gradient-to-br from-emerald-800 to-emerald-600"
      dir="rtl"
    >
      <div class="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center space-y-4">
        <div class="text-4xl">📖</div>
        <h1 class="text-xl font-bold text-neutral-900">متابعة حفظ القرآن</h1>
        <p class="text-sm text-neutral-500">{statusText}</p>

        {auth.status === 'denied' && (
          <button
            class="text-xs text-neutral-400 underline"
            onClick={() => auth.signOutUser()}
          >
            تسجيل خروج وتجربة حساب آخر
          </button>
        )}

        {showForm && (
          <form class="space-y-3 text-right" onSubmit={handleSubmit}>
            <div class="space-y-1">
              <label class="text-xs font-semibold text-neutral-600">البريد الإلكتروني</label>
              <input
                type="email"
                required
                dir="ltr"
                class="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={email}
                onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
                autocomplete="username"
              />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-semibold text-neutral-600">كلمة السر</label>
              <input
                type="password"
                required
                dir="ltr"
                class="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={password}
                onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                autocomplete="current-password"
              />
            </div>

            {error && <div class="text-xs text-red-600">{error}</div>}
            {resetSent && (
              <div class="text-xs text-emerald-600">تم إرسال رابط إعادة التعيين إلى بريدك.</div>
            )}

            <button
              type="submit"
              disabled={submitting}
              class="w-full bg-emerald-700 text-white rounded-lg py-2.5 text-sm font-bold disabled:opacity-60"
            >
              {submitting ? 'جاري الدخول…' : 'دخول'}
            </button>
            <button type="button" class="text-xs text-neutral-400 underline block mx-auto" onClick={handleReset}>
              نسيت كلمة السر؟
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
