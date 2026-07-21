import { useMemo, useState } from 'preact/hooks';
import { useStudents } from '../../hooks/useStudents';
import { useAllRecords } from '../../hooks/useAllRecords';
import { useUndoableDelete } from '../../hooks/useUndoableDelete';
import { deleteStudent as deleteStudentDoc, updateStudent } from '../../data/students.repo';
import { normAr, esc, toArabicDigits } from '../../domain/text';
import { getStudentName, recordsForStudent } from '../../domain/students';
import { getAttendanceRanking, ATTENDANCE_BADGE_THRESHOLD, rankBadgeEmoji } from '../../domain/attendance';
import { genParentToken } from '../../domain/ids';
import { useToast } from '../../ui/ToastProvider';
import { MOSQUE_ID, HALAQA_ID } from '../../config';
import { StudentModal } from './StudentModal';
import type { Student } from '../../types';

import { CHILD_STATS_BASE_URL } from '../../config';

// A generic person-silhouette icon for the student avatar circle (Heroicons
// "user" solid, inlined so we don't need an icon-library dependency for one glyph).
function PersonAvatarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6" aria-hidden="true">
      <path
        fill-rule="evenodd"
        d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"
        clip-rule="evenodd"
      />
    </svg>
  );
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
      map[x.id] = x.rank;
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
      ? `حذف \"${getStudentName(s)}\"؟\n\nله ${linkedCount} جلسة مسجلة — هتفضل موجودة في السجل والإحصائيات باسمه الحالي لكن بدون إمكانية ربطها بملفه بعد الحذف.`
      : `حذف \"${getStudentName(s)}\"؟`;
    if (!confirm(warning)) return;
    requestDelete(s.id, `🗑 تم حذف ${getStudentName(s)}`, (id) => deleteStudentDoc(MOSQUE_ID, HALAQA_ID, id));
  }

  return (
    <div class="p-[18px] pb-[100px]" dir="rtl">
      <div class="flex items-center justify-between mb-4">
        <div class="text-[19px] font-extrabold text-ink-dark">الطلاب</div>
        <span class="text-xs font-bold text-[#8A6A15] bg-[#FFF8E6] px-3 py-1 rounded-full">
          {toArabicDigits(students.length)} طالب
        </span>
      </div>

      <div class="relative mb-3.5">
        <input
          type="text"
          class="w-full border border-hairline rounded-xl px-3.5 py-3 pr-10 text-sm text-ink-dark bg-white"
          placeholder="ابحث بالاسم…"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
        <svg
          viewBox="0 0 24 24"
          width="17"
          height="17"
          fill="none"
          stroke="#8A8372"
          stroke-width="2"
          class="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      </div>

      {!studentsLoaded && (
        <div class="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} class="h-16 rounded-2xl bg-[#F1ECDD] animate-pulse" />
          ))}
        </div>
      )}

      {studentsLoaded && visibleStudents.length === 0 && (
        <div class="text-center text-sm text-taupe py-8">
          {query ? `لا يوجد نتائج لـ "${esc(query)}"` : 'لا يوجد طلاب بعد'}
        </div>
      )}

      <div class="space-y-2.5 mb-4">
        {visibleStudents.map((s) => {
          const name = getStudentName(s);
          const metaParts = [s.age ? s.age + ' سنة' : '', s.grade || '', s.school || ''].filter(Boolean);
          const count = recordsForStudent(s, records).length;
          const rank = topRanks[s.id];
          return (
            <div key={s.id} class="bg-white border border-hairline rounded-2xl p-3.5 flex items-start gap-3">
              <div
                class="w-11 h-11 shrink-0 rounded-full bg-[#F1ECDD] text-forest font-extrabold flex items-center justify-center text-sm cursor-pointer"
                onClick={() => openEditModal(s)}
              >
                <PersonAvatarIcon />
              </div>
              <div class="flex-1 min-w-0 cursor-pointer" onClick={() => openEditModal(s)}>
                <div class="font-bold text-ink-dark text-sm flex items-center gap-1.5">
                  <span>{name}</span>
                  {rank && <span title={`المركز ${rank} في الحضور`}>{rankBadgeEmoji(rank)}</span>}
                </div>
                {metaParts.length > 0 && <div class="text-xs text-taupe mt-0.5">{metaParts.join(' · ')}</div>}
                {s.phonePrimary && <div class="text-xs text-taupe mt-0.5">واتساب: {s.phonePrimary}</div>}
                <div class="text-xs text-taupe mt-0.5">{count} جلسة مسجلة</div>
              </div>
              <div class="flex gap-1 shrink-0">
                <button
                  class="w-8 h-8 rounded-[9px] border border-hairline bg-white flex items-center justify-center"
                  aria-label="نسخ رابط المتابعة"
                  onClick={() => handleCopyLink(s)}
                >
                  🔗
                </button>
                <button
                  class="w-8 h-8 rounded-[9px] border border-hairline bg-white flex items-center justify-center"
                  aria-label="تعديل"
                  onClick={() => openEditModal(s)}
                >
                  ✏️
                </button>
                <button
                  class="w-8 h-8 rounded-[9px] border border-hairline bg-white flex items-center justify-center text-[#B24A3A]"
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

      <button
        type="button"
        class="w-full py-3.5 rounded-2xl border-[1.5px] border-dashed border-mustard bg-[#FFFCF3] text-[#8A6A15] text-sm font-bold"
        onClick={openAddModal}
      >
        + إضافة طالب جديد
      </button>

      {modalOpen && (
        <StudentModal student={editingStudent} allStudents={students} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}
