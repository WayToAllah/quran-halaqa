# متابعة حفظ القرآن — v2 (إعادة البناء)

⚠️ **هذا فرع تطوير منفصل تماماً عن الموقع الشغال.** الموقع الحالي (`main` → GitHub Pages)
غير متأثر بأي حاجة هنا، ومفيش أي نشر تلقائي من هذا الفرع.

## الحالة الحالية

### المرحلة 1 — الأساس ✅
Vite + TypeScript + Preact + Tailwind CSS v4، وطبقة `src/domain/` (منطق صافٍ 100%،
منقول 1:1 من الكود الحي) مع **98 اختبار Vitest**، بما فيها إصلاح مضمّن ومختبر لـ
`scoreName(0)`.

### المرحلة 2 — نموذج بيانات Firestore + قواعد الأمان ✅
نموذج multi-tenant (`mosques/{id}/halaqat/{id}/students|records`) بعضوية صريحة،
طبقة `src/data/` كاملة، سكربت هجرة، واختبارات قواعد أمان **مُثبَتة فعلاً عبر CI**
(GitHub Actions يشغّل Firestore Emulator وينجح ✅ — راجع تبويب Actions في الريبو).

### المرحلة 3 — الشاشات (قيد التنفيذ) 🚧
- ✅ **تسجيل الدخول** (`features/auth/`) — بريد/كلمة سر + فحص عضوية المسجد
- ✅ **شاشة الطلاب** (`features/students/`) كاملة الوظائف:
  - بحث بالاسم (بتطبيع عربي: أ/إ/آ ↔ ا، ة ↔ ه، إلخ)
  - إضافة/تعديل (نفس الحقول والتحقق من التكرار الموجودين في التطبيق الحي)
  - حذف بإمكانية **تراجع** (نفس نافذة الـ 5 ثوانٍ)
  - نسخ رابط متابعة الطالب (مع توليد token عند الحاجة)
  - شارة الترتيب في الحضور (👑🥈🥉)
  - **14 اختبار مكوّن حقيقي** (`*.component.test.tsx`, Testing Library + happy-dom)
    يغطي كل ما سبق فعلياً، مش مجرد تجميعه
- ⏳ **تسجيل، السجل، إحصاءات** — لسه شاشات "قريباً" (placeholder) في `app.tsx`

## ⚠️ ملاحظة مهمة: اختبارات قواعد الأمان

اختبارات `firestore.rules.test.ts` تحتاج Firestore Emulator (يُحمَّل من
`storage.googleapis.com`، مقفول من بيئة التطوير الأصلية لهذا الكود). **تم تشغيلها
فعلاً بنجاح عبر GitHub Actions** — هذا ليس افتراضاً؛ النتيجة ظاهرة في تبويب Actions.
لو عدّلت `firestore.rules`، تحقق من أن الـ CI لسه ناجح بعد التعديل.

## تشغيل محلي

```bash
npm install
npm run dev                # خادم تطوير
npm run build               # بناء إنتاجي (يتحقق من TypeScript أولاً)
npm test                    # اختبارات domain الصافية (سريعة، بلا شبكة) — 98 اختبار
npm run test:components     # اختبارات المكوّنات (Testing Library + happy-dom) — 14 اختبار
npm run test:rules          # اختبارات قواعد Firestore (يحتاج إنترنت عادي + Java 21+)
npm run typecheck           # فحص أنواع src/
```

## البنية

```
src/
  types/index.ts       ← Student, SessionRecord, PublicStats, Mosque, Halaqa...
  domain/              ← منطق صافٍ 100%، بلا DOM ولا Firebase (98 اختبار)
  data/                ← طبقة Firestore — كل وصول للبيانات يمر من هنا حصراً
    firebase.ts, converters.ts, students.repo.ts, records.repo.ts,
    publicStats.repo.ts, mosques.repo.ts
  hooks/               ← useStudents, useAllRecords (اشتراكات Firestore حية)
  ui/                  ← ToastProvider (توست عادي + توست بزر "تراجع")
  features/
    auth/                useAuth.ts, LoginScreen.tsx
    students/            StudentsScreen.tsx, StudentModal.tsx (+ اختبارات مكوّن)
  config.ts            ← MOSQUE_ID/HALAQA_ID (مسجد التيسير الوحيد حالياً)
  app.tsx              ← الهيكل العام: تسجيل دخول → تابات (الطلاب شغالة، الباقي قريباً)
firestore.rules / firestore.indexes.json / firestore.rules.test.ts
scripts/migrate-rtdb-to-firestore.ts
.github/workflows/ci.yml
```

## فجوات معروفة (موثّقة عمداً، مش أخطاء مخفية)

- **"نسخ رابط المتابعة"** في شاشة الطلاب بيولّد الرابط ويحفظ الـ token، لكن **مبيحدّثش
  `publicStats`** — قواعد Firestore الجديدة بتمنع أي كتابة مباشرة من العميل على
  `publicStats` (عمداً، أأمن من قبل). التحديث الفعلي لازم يجي من Cloud Function
  (المرحلة 5) أو من سكربت الهجرة. راجع `TODO(phase 5)` في `StudentsScreen.tsx`.
- **رابط "المتابعة" حالياً بيشاور على `child.html` الإنتاجي** (RTDB)، مش بوابة v2
  (لسه ما بُنيت). شغال بسبب حفظ الـ token بالضبط أثناء الهجرة، لكنه مؤقت.
- شاشات **تسجيل/السجل/إحصاءات** لسه placeholders.

## الخطوات القادمة

- استكمال باقي شاشات المرحلة 3
- المرحلة 4: تشغيل متوازي على مسار فرعي قبل أي قطع كامل عن `main`
- المرحلة 5: Cloud Function لحساب `publicStats` (تسد الفجوة أعلاه) + مزامنة Sheets

راجع خطة إعادة البناء الكاملة في المحادثة الأصلية للتفاصيل الكاملة لكل مرحلة.
