import { useMemo, useState } from 'preact/hooks';
import { useStudents } from '../../hooks/useStudents';
import { useAllRecords } from '../../hooks/useAllRecords';
import { useUndoableDelete } from '../../hooks/useUndoableDelete';
import { deleteStudent as deleteStudentDoc, updateStudent } from '../../data/students.repo';
import { normAr, toArabicDigits } from '../../domain/text';
import { getStudentName, recordsForStudent, sortStudentsByName } from '../../domain/students';
import {
  getAttendanceRanking,
  ATTENDANCE_BADGE_THRESHOLD,
  rankBadgeEmoji,
} from '../../domain/attendance';
import { genParentToken } from '../../domain/ids';
import { useToast } from '../../ui/ToastProvider';
import { MOSQUE_ID, HALAQA_ID } from '../../config';
import { StudentModal } from './StudentModal';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { FloatingAddButton } from '../../ui/FloatingAddButton';
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
  const [pendingDeleteStudent, setPendingDeleteStudent] = useState<Student | null>(null);

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
    return sortStudentsByName(list);
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

  /** Confirmation is the app's own dialog, not the browser's: `confirm()` is
   * unstyled, blocks the whole page and reads as a system error on a phone —
   * the same reason ConfirmDialog exists for every other destructive action. */
  function handleDelete(s: Student) {
    setPendingDeleteStudent(s);
  }

  function confirmDelete() {
    const s = pendingDeleteStudent;
    if (!s) return;
    setPendingDeleteStudent(null);
    requestDelete(s.id, `🗑 تم حذف ${getStudentName(s)}`, (id) =>
      deleteStudentDoc(MOSQUE_ID, HALAQA_ID, id),
    );
  }

  return (
    <div class="p-[18px] pb-[100px]" dir="rtl">
      <div class="flex items-center justify-between mb-4">
        <div class="text-[19px] font-extrabold text-ink-dark">الطلاب</div>
        <span class="text-xs font-bold text-[#8A6A15] bg-[#FFF8E6] px-3 py-1 rounded-full">
          {/* While searching, count what is actually listed — "٥٣ طالب" over
              two visible rows just looks wrong. */}
          {query
            ? `${toArabicDigits(visibleStudents.length)} من ${toArabicDigits(students.length)}`
            : `${toArabicDigits(students.length)} طالب`}
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
        {query ? (
          <button
            type="button"
            aria-label="مسح البحث"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full text-taupe text-sm flex items-center justify-center"
            onClick={() => setQuery('')}
          >
            ✕
          </button>
        ) : (
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
        )}
      </div>

      {!studentsLoaded && (
        <div class="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} class="h-16 rounded-2xl bg-[#F1ECDD] animate-pulse" />
          ))}
        </div>
      )}

      {studentsLoaded && visibleStudents.length === 0 && (
        <div class="text-center py-8">
          <div class="text-sm text-taupe">
            {/* No esc() here: JSX escapes text content, so running it first
                showed the entities themselves (a search for "<" read "&lt;").
                Left over from the innerHTML-based original. */}
            {query ? `لا يوجد نتائج لـ "${query}"` : 'لا يوجد طلاب بعد'}
          </div>
          {!query && (
            <button
              type="button"
              class="mt-4 px-5 py-3 rounded-2xl border-[1.5px] border-dashed border-mustard bg-[#FFFCF3] text-[#8A6A15] text-sm font-bold"
              onClick={openAddModal}
            >
              + إضافة أول طالب
            </button>
          )}
        </div>
      )}

      <div class="space-y-2.5 mb-4">
        {visibleStudents.map((s) => {
          const name = getStudentName(s);
          const metaParts = [s.age ? s.age + ' سنة' : '', s.grade || '', s.school || ''].filter(
            Boolean,
          );
          const count = recordsForStudent(s, records).length;
          const rank = topRanks[s.id];
          return (
            <div
              key={s.id}
              class="bg-white border border-hairline rounded-2xl p-3.5 flex items-start gap-3"
            >
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
                {metaParts.length > 0 && (
                  <div class="text-xs text-taupe mt-0.5">{metaParts.join(' · ')}</div>
                )}
                {s.phonePrimary ? (
                  <div class="text-xs text-taupe mt-0.5">واتساب: {s.phonePrimary}</div>
                ) : (
                  // Without a number the WhatsApp report simply never goes out,
                  // and nothing on the screen said so.
                  <div class="text-xs text-[#B24A3A] mt-0.5">⚠️ مفيش رقم واتساب</div>
                )}
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

      <FloatingAddButton label="إضافة طالب جديد" onClick={openAddModal} />

      {pendingDeleteStudent && (
        <ConfirmDialog
          title={`حذف ${getStudentName(pendingDeleteStudent)}؟`}
          message={
            recordsForStudent(pendingDeleteStudent, records).length
              ? `له ${recordsForStudent(pendingDeleteStudent, records).length} جلسة مسجلة. الجلسات هتفضل في السجل والإحصائيات باسمه الحالي، لكن مش هتقدر تربطها بملفه تاني بعد الحذف.`
              : 'مفيش جلسات مسجلة له.'
          }
          confirmLabel="احذف الطالب"
          cancelLabel="إلغاء"
          destructive
          onConfirm={confirmDelete}
          onCancel={() => setPendingDeleteStudent(null)}
        />
      )}

      {modalOpen && (
        <StudentModal
          student={editingStudent}
          allStudents={students}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
