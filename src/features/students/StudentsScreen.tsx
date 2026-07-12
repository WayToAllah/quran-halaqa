import { useMemo, useState } from 'preact/hooks';
import { useStudents } from '../../hooks/useStudents';
import { useAllRecords } from '../../hooks/useAllRecords';
import { useUndoableDelete } from '../../hooks/useUndoableDelete';
import { deleteStudent as deleteStudentDoc, updateStudent } from '../../data/students.repo';
import { normAr, esc } from '../../domain/text';
import { getStudentName, recordsForStudent } from '../../domain/students';
import { getAttendanceRanking, ATTENDANCE_BADGE_THRESHOLD, rankBadgeEmoji } from '../../domain/attendance';
import { genParentToken } from '../../domain/ids';
import { useToast } from '../../ui/ToastProvider';
import { MOSQUE_ID, HALAQA_ID } from '../../config';
import { StudentModal } from './StudentModal';
import type { Student } from '../../types';

import { CHILD_STATS_BASE_URL } from '../../config';

function initialsOf(name: string): string {
  return name
    .trim()
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
}

export function StudentsScreen() {
  const { students, loaded: studentsLoaded } = useStudents(MOSQUE_ID, HALAQA_ID);
  const { records } = useAllRecords(MOSQUE_ID, HALAQA_ID);
  const { showToast } = useToast();

  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const { pendingIds: pendingDeleteIds, requestDelete } = useUndoableDelete();

  const topRanks = useMemo(() => {
    const map: Record<string, number> = {};
    getAttendanceRanking(students, records, ATTENDANCE_BADGE_THRESHOLD).list.forEach((x) => {
      map[x.name] = x.rank;
    });
    return map;
  }, [students, records]);

  const visibleStudents = useMemo(() => {
    let list = students.filter((s) => !pendingDeleteIds.has(s.id));
    const q = query.trim();
    if (q) {
      const nq = normAr(q);
      list = list.filter((s) => normAr(getStudentName(s)).includes(nq));
    }
    return list;
  }, [students, pendingDeleteIds, query]);

  function openAddModal() {
    setEditingStudent(null);
    setModalOpen(true);
  }
  function openEditModal(s: Student) {
    setEditingStudent(s);
    setModalOpen(true);
  }

  async function handleCopyLink(s: Student) {
    let token = s.parentToken;
    if (!token) {
      token = genParentToken();
      try {
        await updateStudent(MOSQUE_ID, HALAQA_ID, s.id, { parentToken: token });
      } catch (err) {
        console.error('failed to mint parentToken:', err);
        showToast('⚠️ تعذّر إنشاء رابط المتابعة', true);
        return;
      }
    }
    const url = `${CHILD_STATS_BASE_URL}?t=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('✓ تم نسخ رابط المتابعة');
    } catch {
      showToast('⚠️ تعذر نسخ الرابط', true);
    }
  }

  function handleDelete(s: Student) {
    const linkedCount = recordsForStudent(s, records).length;
    const warning = linkedCount
      ? `حذف "${getStudentName(s)}"؟\n\nله ${linkedCount} جلسة مسجلة — هتفضل موجودة في السجل والإحصائيات باسمه الحالي لكن بدون إمكانية ربطها بملفه بعد الحذف.`
      : `حذف "${getStudentName(s)}"؟`;
    if (!confirm(warning)) return;
    requestDelete(s.id, `🗑 تم حذف ${getStudentName(s)}`, (id) => deleteStudentDoc(MOSQUE_ID, HALAQA_ID, id));
  }

  return (
    <div class="p-4 space-y-4" dir="rtl">
      <div class="bg-white rounded-2xl border border-neutral-200 p-4">
        <div class="font-bold text-neutral-900 mb-3">الطلاب المسجلون</div>
        <input
          type="text"
          class="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm mb-3"
          placeholder="🔍 ابحث باسم الطالب..."
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />

        {!studentsLoaded && (
          <div class="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} class="h-14 rounded-lg bg-neutral-100 animate-pulse" />
            ))}
          </div>
        )}

        {studentsLoaded && visibleStudents.length === 0 && (
          <div class="text-center text-sm text-neutral-400 py-8">
            {query ? `لا يوجد نتائج لـ "${esc(query)}"` : 'لا يوجد طلاب بعد'}
          </div>
        )}

        <div class="space-y-2">
          {visibleStudents.map((s) => {
            const name = getStudentName(s);
            const metaParts = [s.age ? s.age + ' سنة' : '', s.grade || '', s.school || ''].filter(Boolean);
            const count = recordsForStudent(s, records).length;
            const rank = topRanks[name];
            return (
              <div key={s.id} class="flex items-start gap-3 p-3 rounded-xl border border-neutral-100">
                <div class="w-10 h-10 shrink-0 rounded-full bg-brand-teal/10 text-brand-teal-deep font-bold flex items-center justify-center text-sm">
                  {initialsOf(name)}
                </div>
                <div class="flex-1 min-w-0 cursor-pointer" onClick={() => openEditModal(s)}>
                  <div class="font-semibold text-neutral-900 text-sm flex items-center gap-1.5">
                    <span>{name}</span>
                    {rank && <span title={`المركز ${rank} في الحضور`}>{rankBadgeEmoji(rank)}</span>}
                  </div>
                  {metaParts.length > 0 && (
                    <div class="text-xs text-neutral-400 mt-0.5">{metaParts.join(' · ')}</div>
                  )}
                  {s.phonePrimary && (
                    <div class="text-xs text-neutral-400 mt-0.5">واتساب: {s.phonePrimary}</div>
                  )}
                  <div class="text-xs text-neutral-400 mt-0.5">{count} جلسة مسجلة</div>
                </div>
                <div class="flex gap-1 shrink-0">
                  <button
                    class="w-8 h-8 rounded-full hover:bg-neutral-100 flex items-center justify-center"
                    aria-label="نسخ رابط المتابعة"
                    onClick={() => handleCopyLink(s)}
                  >
                    🔗
                  </button>
                  <button
                    class="w-8 h-8 rounded-full hover:bg-neutral-100 flex items-center justify-center"
                    aria-label="تعديل"
                    onClick={() => openEditModal(s)}
                  >
                    ✏️
                  </button>
                  <button
                    class="w-8 h-8 rounded-full hover:bg-red-50 text-red-600 flex items-center justify-center"
                    aria-label="حذف"
                    onClick={() => handleDelete(s)}
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button
        class="fixed bottom-6 left-6 w-14 h-14 rounded-full bg-brand-teal text-white text-2xl shadow-lg flex items-center justify-center"
        aria-label="إضافة طالب"
        onClick={openAddModal}
      >
        +
      </button>

      {modalOpen && (
        <StudentModal student={editingStudent} allStudents={students} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}
