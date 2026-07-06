import { SURAS } from './domain/suras';
import { scoreName } from './domain/scoring';

/**
 * Placeholder shell for Phase 1 (foundation). The real admin screens
 * (تسجيل / الطلاب / السجل / إحصاءات) land in Phase 3 once the Firestore data
 * layer (Phase 2) exists. This just proves the scaffold — Vite, Preact,
 * TypeScript, Tailwind, and the domain layer — all boot and wire together
 * correctly.
 */
export function App() {
  return (
    <main class="min-h-screen bg-neutral-50 flex items-center justify-center p-6" dir="rtl">
      <div class="max-w-md w-full bg-white rounded-2xl shadow-sm border border-neutral-200 p-8 text-center space-y-3">
        <h1 class="text-xl font-bold text-neutral-900">متابعة حفظ القرآن — v2</h1>
        <p class="text-sm text-neutral-500">المرحلة 1: الأساس جاهز</p>
        <div class="text-xs text-neutral-400 pt-4 border-t border-neutral-100 space-y-1">
          <p>عدد السور المحمّلة: {SURAS.length}</p>
          <p>اختبار سريع: scoreName(0) = "{scoreName(0)}"</p>
        </div>
      </div>
    </main>
  );
}
