import { useState } from 'preact/hooks';
import { ToastProvider } from './ui/ToastProvider';
import { useAuth } from './features/auth/useAuth';
import { LoginScreen } from './features/auth/LoginScreen';
import { StudentsScreen } from './features/students/StudentsScreen';
import { LogScreen } from './features/log/LogScreen';
import { StatsScreen } from './features/stats/StatsScreen';
import { RecordScreen } from './features/record/RecordScreen';
import { RecordIcon, StudentsIcon, LogIcon, StatsIcon } from './ui/NavIcons';
import type { SessionRecord } from './types';
import type { JSX } from 'preact';

type Tab = 'record' | 'students' | 'log' | 'stats';

const TABS: { id: Tab; label: string; Icon: (p: { class?: string }) => JSX.Element }[] = [
  { id: 'record', label: 'تسجيل', Icon: RecordIcon },
  { id: 'students', label: 'الطلاب', Icon: StudentsIcon },
  { id: 'log', label: 'السجل', Icon: LogIcon },
  { id: 'stats', label: 'إحصائيات', Icon: StatsIcon },
];

function AppShell() {
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>('record');
  // A session handed off from the log screen's ✏️ button to the record screen.
  const [editingRecord, setEditingRecord] = useState<SessionRecord | null>(null);

  if (auth.status === 'loading' || auth.status === 'checking-membership') {
    return <LoginScreen auth={auth} />;
  }
  if (auth.status === 'signed-out' || auth.status === 'denied') {
    return <LoginScreen auth={auth} />;
  }

  function handleEditRecord(rec: SessionRecord) {
    setEditingRecord(rec);
    setTab('record');
  }

  return (
    <div class="min-h-screen bg-parchment pb-20" dir="rtl">
      <header class="bg-white border-b border-hairline px-[18px] py-4 flex items-center justify-between sticky top-0 z-10">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-[10px] bg-forest flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none">
              <path
                d="M6 20.5V11c0-3.3 2.7-6 6-6s6 2.7 6 6v9.5"
                stroke="#C9A227"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path d="M4.5 20.5h15" stroke="#C9A227" stroke-width="1.7" stroke-linecap="round" />
              <path d="M12 5.2v1.1" stroke="#C9A227" stroke-width="1.7" stroke-linecap="round" />
              <path
                d="M10.6 3.6l1.4 1.5 1.4-1.5"
                stroke="#C9A227"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <circle cx="12" cy="14.5" r="2.1" stroke="#C9A227" stroke-width="1.4" />
            </svg>
          </div>
          <div>
            <div class="text-[14.5px] font-extrabold text-ink-dark leading-tight">متابعة حفظ القرآن</div>
            <div class="text-[11px] text-taupe leading-tight">{auth.user?.email}</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-[34px] h-[34px] rounded-full bg-[#F1ECDD] border border-hairline flex items-center justify-center text-[12.5px] font-bold text-forest">
            أد
          </div>
          <button
            class="w-8 h-8 rounded-full border border-hairline bg-white flex items-center justify-center text-sm"
            aria-label="تسجيل الخروج"
            onClick={() => auth.signOutUser()}
          >
            🚪
          </button>
        </div>
      </header>

      <main>
        {tab === 'record' && (
          <RecordScreen editRecord={editingRecord} onEditConsumed={() => setEditingRecord(null)} />
        )}
        {tab === 'students' && <StudentsScreen />}
        {tab === 'log' && <LogScreen onEditRecord={handleEditRecord} />}
        {tab === 'stats' && <StatsScreen />}
      </main>

      <nav class="fixed bottom-0 inset-x-0 bg-white border-t border-hairline flex px-1.5 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              class="flex-1 py-2.5 px-1 flex flex-col items-center gap-1"
              style={{ color: active ? '#0F3D2E' : '#B4AD98' }}
              onClick={() => setTab(t.id)}
            >
              <t.Icon />
              <span class="text-[10.5px] font-bold">{t.label}</span>
            </button>
          );
        })}
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
