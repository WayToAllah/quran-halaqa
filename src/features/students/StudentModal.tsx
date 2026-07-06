import { useState } from 'preact/hooks';
import { genParentToken } from '../../domain/ids';
import { saveStudent } from '../../data/students.repo';
import { useToast } from '../../ui/ToastProvider';
import { MOSQUE_ID, HALAQA_ID } from '../../config';
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

interface Props {
  /** null = add mode, a Student = edit mode. */
  student: Student | null;
  allStudents: Student[];
  onClose: () => void;
}

export function StudentModal({ student, allStudents, onClose }: Props) {
  const { showToast } = useToast();
  const [name, setName] = useState(student?.name ?? '');
  const [age, setAge] = useState(student?.age ?? '');
  const [grade, setGrade] = useState(student?.grade ?? '');
  const [school, setSchool] = useState(student?.school ?? '');
  const [phonePrimary, setPhonePrimary] = useState(student?.phonePrimary ?? '');
  const [phoneSecondary, setPhoneSecondary] = useState(student?.phoneSecondary ?? '');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('الاسم مطلوب');
      return;
    }
    const newId = student?.id ?? crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    // Duplicate-name check excludes the student being edited, so a no-op
    // rename (same name) still passes (matches the live app's fix for this).
    const duplicate = allStudents.find((s) => s.name === trimmedName && s.id !== newId);
    if (duplicate) {
      setNameError('الاسم موجود بالفعل');
      return;
    }

    setSaving(true);
    const obj: Student = {
      id: newId,
      name: trimmedName,
      age: age || '',
      grade: grade || '',
      school: school.trim(),
      phonePrimary: phonePrimary.trim(),
      phoneSecondary: phoneSecondary.trim(),
      // Carry the existing token forward on edit — this is a full document
      // write, so omitting it would silently break the student's child
      // portal link on every profile edit.
      parentToken: student?.parentToken ?? genParentToken(),
    };

    try {
      await saveStudent(MOSQUE_ID, HALAQA_ID, obj);
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
    <div class="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        class="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div class="flex items-center justify-between px-5 py-4 border-b border-neutral-100 sticky top-0 bg-white">
          <span class="font-bold text-neutral-900">{student ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}</span>
          <button class="text-neutral-400 text-lg" onClick={onClose}>
            ✕
          </button>
        </div>

        <div class="p-5 space-y-4">
          <div class="space-y-1">
            <label class="text-xs font-semibold text-neutral-600">الاسم الكامل *</label>
            <input
              class="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm"
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
              <label class="text-xs font-semibold text-neutral-600">السن</label>
              <input
                type="number"
                min={4}
                max={25}
                class="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm"
                placeholder="مثلاً 10"
                value={age}
                onInput={(e) => setAge((e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-semibold text-neutral-600">السنة الدراسية</label>
              <select
                class="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm bg-white"
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
            <label class="text-xs font-semibold text-neutral-600">المدرسة</label>
            <input
              class="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm"
              placeholder="اسم المدرسة"
              value={school}
              onInput={(e) => setSchool((e.target as HTMLInputElement).value)}
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold text-neutral-600">📱 رقم الواتساب</label>
            <input
              type="tel"
              dir="ltr"
              class="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm text-left"
              placeholder="01XXXXXXXXX"
              value={phonePrimary}
              onInput={(e) => setPhonePrimary((e.target as HTMLInputElement).value)}
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold text-neutral-600">
              📱 الرقم الثانوي <span class="text-neutral-400 font-normal">اختياري</span>
            </label>
            <input
              type="tel"
              dir="ltr"
              class="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm text-left"
              placeholder="01XXXXXXXXX"
              value={phoneSecondary}
              onInput={(e) => setPhoneSecondary((e.target as HTMLInputElement).value)}
            />
          </div>
        </div>

        <div class="flex gap-3 px-5 py-4 border-t border-neutral-100 sticky bottom-0 bg-white">
          <button class="flex-1 py-2.5 rounded-lg border border-neutral-300 text-sm font-semibold" onClick={onClose}>
            إلغاء
          </button>
          <button
            class="flex-1 py-2.5 rounded-lg bg-emerald-700 text-white text-sm font-bold disabled:opacity-60"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? 'جاري الحفظ…' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  );
}
