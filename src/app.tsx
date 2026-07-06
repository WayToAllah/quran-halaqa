import { useState } from 'preact/hooks';
import { ToastProvider } from './ui/ToastProvider';
import { useAuth } from './features/auth/useAuth';
import { LoginScreen } from './features/auth/LoginScreen';
import { StudentsScreen } from './features/students/StudentsScreen';
import { LogScreen } from './features/log/LogScreen';
import { StatsScreen } from './features/stats/StatsScreen';
import { RecordScreen } from './features/record/RecordScreen';

type Tab = 'record' | 'students' | 'log' | 'stats';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'record', label: 'تسجيل', icon: '📝' },
  { id: 'students', label: 'الطلاب', icon: '👥' },
  { id: 'log', label: 'السجل', icon: '📋' },
  { id: 'stats', label: 'إحصاءات', icon: '📊' },
];

function AppShell() {
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>('record');

  if (auth.status === 'loading' || auth.status === 'checking-membership') {
    return <LoginScreen auth={auth} />;
  }
  if (auth.status === 'signed-out' || auth.status === 'denied') {
    return <LoginScreen auth={auth} />;
  }

  return (
    <div class="min-h-screen bg-neutral-50 pb-20" dir="rtl">
      <header class="bg-emerald-700 text-white px-4 py-4 flex items-center gap-3">
        <div class="text-2xl">📖</div>
        <div class="flex-1">
          <h1 class="font-bold text-sm">متابعة حفظ القرآن</h1>
          <div class="text-xs text-emerald-100">{auth.user?.email}</div>
        </div>
        <button
          class="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center"
          aria-label="تسجيل الخروج"
          onClick={() => auth.signOutUser()}
        >
          🚪
        </button>
      </header>

      <main>
        {tab === 'record' && <RecordScreen />}
        {tab === 'students' && <StudentsScreen />}
        {tab === 'log' && <LogScreen />}
        {tab === 'stats' && <StatsScreen />}
      </main>

      <nav class="fixed bottom-0 inset-x-0 bg-white border-t border-neutral-200 flex">
        {TABS.map((t) => (
          <button
            key={t.id}
            class={
              'flex-1 py-2.5 flex flex-col items-center gap-0.5 text-xs ' +
              (tab === t.id ? 'text-emerald-700 font-bold' : 'text-neutral-400')
            }
            onClick={() => setTab(t.id)}
          >
            <span class="text-lg">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}
