# متابعة حفظ القرآن — v2 (إعادة البناء)

⚠️ **هذا فرع تطوير منفصل تماماً عن الموقع الشغال.** الموقع الحالي (`main` → GitHub Pages)
غير متأثر بأي حاجة هنا، ومفيش أي نشر تلقائي من هذا الفرع.

## الحالة الحالية: المرحلة 1 — الأساس ✅

- Vite + TypeScript + Preact + Tailwind CSS v4
- طبقة `src/domain/` — منطق الأعمال الصافي بالكامل، منقول 1:1 من `index.html`/`child.html`
  الحيّة (بدون أي DOM أو Firebase)، مع 85 اختبار Vitest
- إصلاح مضمّن: `scoreName(0)` بيرجّع `"إعادة"` صح (كان بيرجّع فاضي)

## تشغيل محلي

```bash
npm install
npm run dev        # خادم تطوير
npm run build      # بناء إنتاجي (يتحقق من TypeScript أولاً)
npm test           # تشغيل كل الاختبارات
npm run typecheck  # فحص الأنواع فقط
```

## البنية

```
src/
  types/index.ts     ← الأنواع الأساسية (Student, SessionRecord, PublicStats...)
  domain/            ← منطق صافٍ 100%، بلا DOM ولا Firebase — قابل للاختبار كاملاً
    ids.ts             fbKey, genId, recTime
    dates.ts           localDateStr, byNewest
    scoring.ts         scoreName, scoreToHalfStars, hasScore
    suras.ts           قائمة الـ 114 سورة + countAyat, joinSuraNames, ayahRange
    students.ts        studentMatch, displayStudentName
    text.ts            esc, normAr
    attendance.ts       computeAttendanceStreak, getAttendanceRanking
    stats.ts           buildStudentBadges, buildStudentPublicStats
  app.tsx            ← شاشة placeholder مؤقتة (الشاشات الحقيقية في المرحلة 3)
```

## الخطوات القادمة

- **المرحلة 2:** نموذج بيانات Firestore الهرمي (`mosques/{id}/halaqat/{id}/students|records`)
  + قواعد أمان مختبرة بـ Firebase Emulator + سكربت هجرة من RTDB
- **المرحلة 3:** الشاشات الأربع (تسجيل، الطلاب، السجل، إحصاءات) + بوابة ولي الأمر، كل واحدة
  تستخدم طبقة `domain/` هذه مباشرة
- **المرحلة 4:** تشغيل متوازي على مسار فرعي قبل أي قطع كامل عن `main`

راجع خطة إعادة البناء الكاملة في المحادثة الأصلية للتفاصيل الكاملة لكل مرحلة.
