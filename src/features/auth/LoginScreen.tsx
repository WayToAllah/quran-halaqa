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
      class="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(165deg, #0F3D2E, #0A2E22)' }}
      dir="rtl"
    >
      <div class="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center space-y-4">
        <div class="text-4xl">📖</div>
        <h1 class="text-xl font-extrabold text-ink-dark">متابعة حفظ القرآن</h1>
        <p class="text-sm text-taupe">{statusText}</p>

        {auth.status === 'denied' && (
          <button
            class="text-xs text-taupe underline"
            onClick={() => auth.signOutUser()}
          >
            تسجيل خروج وتجربة حساب آخر
          </button>
        )}

        {showForm && (
          <form class="space-y-3 text-right" onSubmit={handleSubmit}>
            <div class="space-y-1">
              <label class="text-xs font-semibold text-[#5B5646]">البريد الإلكتروني</label>
              <input
                type="email"
                required
                dir="ltr"
                class="w-full border border-hairline rounded-xl px-3.5 py-2.5 text-sm text-left text-ink-dark focus:outline-none focus:ring-2 focus:ring-forest"
                value={email}
                onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
                autocomplete="username"
              />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-semibold text-[#5B5646]">كلمة السر</label>
              <input
                type="password"
                required
                dir="ltr"
                class="w-full border border-hairline rounded-xl px-3.5 py-2.5 text-sm text-left text-ink-dark focus:outline-none focus:ring-2 focus:ring-forest"
                value={password}
                onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                autocomplete="current-password"
              />
            </div>

            {error && <div class="text-xs text-red-600">{error}</div>}
            {resetSent && (
              <div class="text-xs text-forest">تم إرسال رابط إعادة التعيين إلى بريدك.</div>
            )}

            <button
              type="submit"
              disabled={submitting}
              class="w-full bg-forest text-parchment rounded-xl py-3 text-sm font-bold disabled:opacity-60"
            >
              {submitting ? 'جاري الدخول…' : 'دخول'}
            </button>
            <button type="button" class="text-xs text-taupe underline block mx-auto" onClick={handleReset}>
              نسيت كلمة السر؟
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
