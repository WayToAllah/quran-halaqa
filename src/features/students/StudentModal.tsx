import { useEffect, useState } from 'preact/hooks';
import { genId, genParentToken } from '../../domain/ids';
import { normAr, stripWhitespace, toWesternDigits } from '../../domain/text';
import { saveStudent } from '../../data/students.repo';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { useToast } from '../../ui/ToastProvider';
import { useTenant } from '../tenant/TenantContext';
import type { Student } from '../../types';

const GRADE_OPTIONS = [
  'رياض أطفال',
  'الصف الأول الابتدائي',
  'الصف الثاني الابتدائي',
  'الصف الثالث الابتدائي',
  'الصف الرابع الابتدائي',
  'الصف الخامس الابتدائي',
  'الصف السادس الابتدائي',
  'الصف الأول الإعدادي',
  'الصف الثاني الإعدادي',
  'الصف الثالث الإعدادي',
  'الصف الأول الثانوي',
  'الصف الثاني الثانوي',
  'الصف الثالث الثانوي',
];

/** Declared on the age input itself; enforced here so the claim is real. */
const AGE_MIN = 4;
const AGE_MAX = 25;
/** Shortest string that could plausibly reach a phone. */
const MIN_PHONE_DIGITS = 10;

interface Props {
  /** null = add mode, a Student = edit mode. */
  student: Student | null;
  allStudents: Student[];
  onClose: () => void;
}

export function StudentModal({ student, allStudents, onClose }: Props) {
  const { mosqueId, halaqaId } = useTenant();
  const { showToast } = useToast();
  const [name, setName] = useState(student?.name ?? '');
  const [age, setAge] = useState(student?.age ?? '');
  const [grade, setGrade] = useState(student?.grade ?? '');
  const [joinDate, setJoinDate] = useState(student?.joinDate ?? '');
  const [school, setSchool] = useState(student?.school ?? '');
  const [phonePrimary, setPhonePrimary] = useState(student?.phonePrimary ?? '');
  const [phoneSecondary, setPhoneSecondary] = useState(student?.phoneSecondary ?? '');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [ageError, setAgeError] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Anything typed but not yet written. Closing is only worth interrupting
  // when there is something to lose — opening a profile and closing it again
  // must not raise a dialog.
  const dirty =
    name !== (student?.name ?? '') ||
    age !== (student?.age ?? '') ||
    grade !== (student?.grade ?? '') ||
    joinDate !== (student?.joinDate ?? '') ||
    school !== (student?.school ?? '') ||
    phonePrimary !== (student?.phonePrimary ?? '') ||
    phoneSecondary !== (student?.phoneSecondary ?? '');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') requestClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  /** Every dismissal route goes through here: the backdrop, ✕ and إلغاء. The
   * backdrop is the dangerous one — a stray tap beside a bottom sheet on a
   * phone used to wipe a fully typed profile with no warning at all. */
  function requestClose() {
    if (saving) return;
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('الاسم مطلوب');
      return;
    }
    // genId('s') — the same shape as every other student id in the data
    // ('s_<ms>_<rand>'), rather than a bare hex string that reads as a
    // different kind of record when scanning the collection.
    const newId = student?.id ?? genId('s');
    // Compared the way the roster is SEARCHED, not byte-for-byte: normAr folds
    // hamza forms, alef maqsura, ta marbuta, diacritics and repeated spaces.
    // An exact match let "زيد أحمد" in alongside an existing "زيد احمد" — two
    // profiles for one boy, his sessions split between them, and the search
    // that would reveal it treats both spellings as the same word anyway.
    // The edited student is excluded so a no-op rename still passes.
    const key = normAr(trimmedName);
    const duplicate = allStudents.find((s) => normAr(s.name) === key && s.id !== newId);
    if (duplicate) {
      // Naming the existing spelling matters: when it differs only in hamza,
      // "الاسم موجود بالفعل" reads as a bug to someone staring at the list.
      setNameError(
        duplicate.name === trimmedName
          ? 'الاسم موجود بالفعل'
          : `فيه طالب بنفس الاسم مسجّل باسم "${duplicate.name}"`,
      );
      return;
    }

    // Enforce what the fields already claim. The age input declares min 4 /
    // max 25 and the phone is labelled واتساب, but nothing checked either, so
    // "999 سنة" saved happily and a half-typed number saved as a number that
    // can never receive the parent's report.
    if (age.trim()) {
      const n = Number(toWesternDigits(age));
      if (!Number.isFinite(n) || n < AGE_MIN || n > AGE_MAX) {
        setAgeError(`السن لازم يكون بين ${AGE_MIN} و${AGE_MAX}`);
        return;
      }
    }
    for (const [value, setError] of [
      [phonePrimary, setPhoneError],
      [phoneSecondary, setPhoneError],
    ] as const) {
      const digits = toWesternDigits(value).replace(/[^0-9]/g, '');
      if (value.trim() && digits.length < MIN_PHONE_DIGITS) {
        setError('الرقم قصير — رسالة الأب مش هتوصل على رقم زي ده');
        return;
      }
    }

    setSaving(true);
    const obj: Student = {
      id: newId,
      name: trimmedName,
      age: age || '',
      grade: grade || '',
      joinDate: joinDate || '',
      school: school.trim(),
      // Every space, not just the ones at the ends: a number typed as
      // "0100 123 4567" is the same number as "01001234567" and should be
      // stored as one.
      phonePrimary: stripWhitespace(phonePrimary),
      phoneSecondary: stripWhitespace(phoneSecondary),
      // Carry the existing token forward on edit — this is a full document
      // write, so omitting it would silently break the student's child
      // portal link on every profile edit.
      parentToken: student?.parentToken ?? genParentToken(),
    };

    try {
      await saveStudent(mosqueId, halaqaId, obj);
      showToast(student ? '✓ تم التحديث' : '✓ تم الحفظ بنجاح');
      onClose();
    } catch (err) {
      console.error('saveStudent failed:', err);
      showToast('⚠️ فشل الحفظ — تأكد من الإنترنت وحاول تاني', true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        class="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center"
        onClick={requestClose}
      >
        <div
          class="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
          dir="rtl"
        >
          <div class="flex items-center justify-between px-5 py-4 border-b border-hairline sticky top-0 bg-white">
            <span class="font-extrabold text-ink-dark">
              {student ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}
            </span>
            <button class="text-taupe text-lg" aria-label="إغلاق" onClick={requestClose}>
              ✕
            </button>
          </div>

          <div class="p-5 space-y-4">
            <div class="space-y-1">
              <label class="text-xs font-semibold text-[#5B5646]">الاسم الكامل *</label>
              <input
                class="w-full border border-hairline rounded-xl px-3.5 py-2.5 text-sm text-ink-dark"
                placeholder="اسم الطالب"
                value={name}
                onInput={(e) => {
                  setName((e.target as HTMLInputElement).value);
                  setNameError('');
                }}
              />
              {nameError && <div class="text-xs text-red-600">{nameError}</div>}
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-xs font-semibold text-[#5B5646]">السن</label>
                <input
                  type="number"
                  min={4}
                  max={25}
                  class="w-full border border-hairline rounded-xl px-3.5 py-2.5 text-sm text-ink-dark"
                  placeholder="مثلاً 10"
                  value={age}
                  onInput={(e) => {
                    setAge((e.target as HTMLInputElement).value);
                    setAgeError('');
                  }}
                />
                {ageError && <div class="text-xs text-red-600">{ageError}</div>}
              </div>
              <div class="space-y-1">
                <label class="text-xs font-semibold text-[#5B5646]">السنة الدراسية</label>
                <select
                  class="w-full border border-hairline rounded-xl px-3.5 py-2.5 text-sm bg-white text-ink-dark"
                  value={grade}
                  onChange={(e) => setGrade((e.target as HTMLSelectElement).value)}
                >
                  <option value="">— اختر —</option>
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div class="space-y-1">
              <label for="modal-join-date" class="text-xs font-semibold text-[#5B5646]">
                📅 تاريخ الانضمام <span class="text-taupe font-normal">اختياري</span>
              </label>
              <input
                id="modal-join-date"
                type="date"
                class="w-full border border-hairline rounded-xl px-3.5 py-2.5 text-sm text-ink-dark"
                value={joinDate}
                onInput={(e) => setJoinDate((e.target as HTMLInputElement).value)}
              />
            </div>

            <div class="space-y-1">
              <label class="text-xs font-semibold text-[#5B5646]">المدرسة</label>
              <input
                class="w-full border border-hairline rounded-xl px-3.5 py-2.5 text-sm text-ink-dark"
                placeholder="اسم المدرسة"
                value={school}
                onInput={(e) => setSchool((e.target as HTMLInputElement).value)}
              />
            </div>

            <div class="space-y-1">
              <label class="text-xs font-semibold text-[#5B5646]">📱 رقم الواتساب</label>
              <input
                type="tel"
                dir="ltr"
                class="w-full border border-hairline rounded-xl px-3.5 py-2.5 text-sm text-left text-ink-dark"
                placeholder="01XXXXXXXXX"
                value={phonePrimary}
                onInput={(e) => {
                  setPhonePrimary((e.target as HTMLInputElement).value);
                  setPhoneError('');
                }}
              />
              {phoneError && <div class="text-xs text-red-600">{phoneError}</div>}
            </div>

            <div class="space-y-1">
              <label class="text-xs font-semibold text-[#5B5646]">
                📱 الرقم الثانوي <span class="text-taupe font-normal">اختياري</span>
              </label>
              <input
                type="tel"
                dir="ltr"
                class="w-full border border-hairline rounded-xl px-3.5 py-2.5 text-sm text-left text-ink-dark"
                placeholder="01XXXXXXXXX"
                value={phoneSecondary}
                onInput={(e) => {
                  setPhoneSecondary((e.target as HTMLInputElement).value);
                  setPhoneError('');
                }}
              />
            </div>
          </div>

          <div class="flex gap-3 px-5 py-4 border-t border-hairline sticky bottom-0 bg-white">
            <button
              class="flex-1 py-2.5 rounded-xl border border-hairline text-sm font-semibold text-[#5B5646]"
              onClick={requestClose}
            >
              إلغاء
            </button>
            <button
              class="flex-1 py-2.5 rounded-xl bg-forest text-parchment text-sm font-bold disabled:opacity-60"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? 'جاري الحفظ…' : 'حفظ'}
            </button>
          </div>
        </div>
      </div>

      {/* Sibling of the sheet, not a child: inside it, a click on this
          dialog's own backdrop would bubble up to the sheet's backdrop
          handler and immediately re-open the very dialog it just closed. */}
      {confirmDiscard && (
        <ConfirmDialog
          title="بيانات لسه متحفظتش"
          message="لو قفلت دلوقتي البيانات اللي كتبتها هتضيع."
          confirmLabel="اقفل وامسح"
          cancelLabel="أكمل التعديل"
          destructive
          onConfirm={onClose}
          onCancel={() => setConfirmDiscard(false)}
        />
      )}
    </>
  );
}
