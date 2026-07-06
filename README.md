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
(GitHub Actions يشغّل Firestore Emulator وينجح ✅).

### المرحلة 3 — الشاشات (قيد التنفيذ) 🚧
- ✅ **تسجيل الدخول** (`features/auth/`) — بريد/كلمة سر + فحص عضوية المسجد
- ✅ **شاشة الطلاب** (`features/students/`) — بحث، إضافة/تعديل/حذف بتراجع، نسخ رابط،
  شارات الترتيب — 14 اختبار مكوّن
- ✅ **شاشة السجل** (`features/log/`) — قائمة مُرقّمة (pagination حقيقي، مش تحميل الشجرة
  كاملة)، بحث، حذف بتراجع، عرض تقييمات اللوح/الماضي/التجويد بدقة (بما فيها إصلاح
  `scoreName(0)`) — 11 اختبار مكوّن
- ⏳ **تسجيل، إحصاءات** — لسه شاشات "قريباً" (placeholder) في `app.tsx`

**نمط مشترك جديد:** `useUndoableDelete` (`src/hooks/`) — استُخرج من شاشة الطلاب
واستُخدم في شاشة السجل، بدل تكرار نفس منطق الـ 5 ثوانٍ + التراجع في كل شاشة.

## ⚠️ ملاحظة مهمة: اختبارات قواعد الأمان

اختبارات `firestore.rules.test.ts` تحتاج Firestore Emulator (يُحمَّل من
`storage.googleapis.com`، مقفول من بيئة التطوير الأصلية لهذا الكود). **تم تشغيلها
فعلاً بنجاح عبر GitHub Actions** — هذا ليس افتراضاً؛ النتيجة ظاهرة في تبويب Actions.

## تشغيل محلي

```bash
npm install
npm run dev                # خادم تطوير
npm run build               # بناء إنتاجي (يتحقق من TypeScript أولاً)
npm test                    # اختبارات domain الصافية — 98 اختبار
npm run test:components     # اختبارات المكوّنات (Testing Library + happy-dom) — 25 اختبار
npm run test:rules          # اختبارات قواعد Firestore (يحتاج إنترنت عادي + Java 21+)
npm run typecheck           # فحص أنواع src/
```

## البنية

```
src/
  types/index.ts       ← Student, SessionRecord, PublicStats, Mosque, Halaqa...
  domain/              ← منطق صافٍ 100%، بلا DOM ولا Firebase (98 اختبار)
  data/                ← طبقة Firestore — كل وصول للبيانات يمر من هنا حصراً
  hooks/
    useStudents.ts, useAllRecords.ts     ← اشتراكات حية (كاملة، لتجميعات عبر الطلاب)
    useRecentRecords.ts                  ← اشتراك مُرقّم (40 الأحدث) + "تحميل المزيد"
    useUndoableDelete.ts                 ← نمط الحذف بتراجع المشترك
  ui/                  ← ToastProvider, StarRating/PlainStars
  features/
    auth/                useAuth.ts, LoginScreen.tsx
    students/            StudentsScreen.tsx, StudentModal.tsx (+ 14 اختبار)
    log/                 LogScreen.tsx (+ 11 اختبار)
  config.ts            ← MOSQUE_ID/HALAQA_ID (مسجد التيسير الوحيد حالياً)
  app.tsx              ← الهيكل العام: تسجيل دخول → تابات
firestore.rules / firestore.indexes.json / firestore.rules.test.ts
scripts/migrate-rtdb-to-firestore.ts
.github/workflows/ci.yml
```

## فجوات معروفة (موثّقة عمداً، مش أخطاء مخفية)

- **"نسخ رابط المتابعة"** بيولّد الرابط لكن **مبيحدّثش `publicStats`** — قواعد Firestore
  الجديدة بتمنع كتابة العميل المباشرة على `publicStats` عمداً؛ محتاج Cloud Function
  (المرحلة 5). راجع `TODO(phase 5)` في `StudentsScreen.tsx`.
- **زرار "تعديل" في السجل** بيعرض توست "قريباً" — تعديل جلسة محتاج شاشة "تسجيل" اللي
  لسه ما اتبنتش.
- **البحث في السجل** بيدوّر بس في الجلسات المحمّلة حالياً (40 افتراضياً)، مش كل
  التاريخ — نتيجة مباشرة لتحسين المرحلة 2 (تجنّب تحميل الشجرة كاملة). "تحميل المزيد"
  قبل البحث يوسّع النطاق. موضّح للمستخدم في الواجهة نفسها.
- رابط "المتابعة" حالياً بيشاور على `child.html` الإنتاجي (RTDB)، مش بوابة v2.
- شاشتا **تسجيل وإحصاءات** لسه placeholders.

## الخطوات القادمة

- شاشة **تسجيل** (الأعقد — student picker، صفوف لوح/ماضي متعددة، التجويد)
- شاشة **إحصاءات**
- المرحلة 4: تشغيل متوازي على مسار فرعي قبل أي قطع كامل عن `main`
- المرحلة 5: Cloud Function لحساب `publicStats` + مزامنة Sheets

راجع خطة إعادة البناء الكاملة في المحادثة الأصلية للتفاصيل الكاملة لكل مرحلة.
