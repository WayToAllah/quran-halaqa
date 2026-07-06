# متابعة حفظ القرآن — v2 (إعادة البناء)

⚠️ **هذا فرع تطوير منفصل تماماً عن الموقع الشغال.** الموقع الحالي (`main` → GitHub Pages)
غير متأثر بأي حاجة هنا، ومفيش أي نشر تلقائي من هذا الفرع.

## الحالة الحالية

### المرحلة 1 — الأساس ✅
- Vite + TypeScript + Preact + Tailwind CSS v4
- `src/domain/` — منطق الأعمال الصافي بالكامل، منقول 1:1 من `index.html`/`child.html`
  الحيّة، مع **85 اختبار Vitest** (`npm test`)
- إصلاح مضمّن ومختبر: `scoreName(0)` بيرجّع `"إعادة"` صح (كان بيرجّع فاضي)

### المرحلة 2 — نموذج بيانات Firestore + قواعد الأمان ✅
- `firestore.rules` — نموذج multi-tenant (`mosques/{id}/halaqat/{id}/students|records`)
  بعضوية صريحة (`members/{uid}`)، بدل قاعدة RTDB القديمة المفتوحة لأي مستخدم موثّق
- `src/data/` — طبقة وصول كاملة (`students.repo.ts`, `records.repo.ts`,
  `publicStats.repo.ts`, `mosques.repo.ts`) باستخدام Firestore modular SDK،
  باستعلامات مُرشّحة/محدودة بدل تحميل الشجرة كاملة على كل تغيير (المشكلة الأصلية
  في التطبيق الحالي)
- `firestore.rules.test.ts` — اختبارات آلية حقيقية لقواعد الأمان باستخدام
  `@firebase/rules-unit-testing` الرسمية (راجع القسم أدناه لتفاصيل مهمة)
- `scripts/migrate-rtdb-to-firestore.ts` — سكربت هجرة كامل، idempotent، بمعرّفات
  محفوظة بالضبط (فلا تنكسر روابط `child.html` المُرسلة على واتساب)

## ⚠️ ملاحظة مهمة: اختبارات قواعد الأمان لم تُنفَّذ فعلياً هنا

اختبارات `firestore.rules.test.ts` تحتاج تشغيل Firestore Emulator محلياً، واللي
بيحتاج تنزيل ملف JAR من `storage.googleapis.com` أول مرة. النطاق ده **مش متاح**
من الشبكة المقيدة اللي اتبنى بيها هذا الكود — جرّبت فعلياً وطلع خطأ 403 صريح
(`Host not in allowlist: storage.googleapis.com`)، مش افتراض.

**يعني إيه عملياً:**
- الكود مكتوب وتم فحص أنواعه (`npm run typecheck:rules`) ✅
- لكن **لم يتم تشغيله فعلياً وليس مؤكَّداً أنه ينجح** حتى تُشغَّل إحدى الطريقتين التاليتين:
  1. **GitHub Actions** (`.github/workflows/ci.yml`) — بيشتغل تلقائياً على push
     لأن أجهزة GitHub عندها إنترنت عادي، مش مقيّد زي هنا
  2. **جهازك المحلي** (لو عندك Node + إنترنت عادي): `npm run test:rules`

**لا تعتبر هذا الجزء "مُختبَراً" فعلياً حتى تشوف نتيجة ✅ من إحدى الطريقتين دي.**

## تشغيل محلي

```bash
npm install
npm run dev              # خادم تطوير
npm run build            # بناء إنتاجي (يتحقق من TypeScript أولاً)
npm test                 # اختبارات domain الصافية (سريعة، بلا شبكة)
npm run test:rules       # اختبارات قواعد Firestore (يحتاج إنترنت عادي + Java)
npm run typecheck        # فحص أنواع src/
npm run typecheck:rules  # فحص أنواع firestore.rules.test.ts
npm run typecheck:scripts # فحص أنواع scripts/
```

## البنية

```
src/
  types/index.ts       ← Student, SessionRecord, PublicStats, Mosque, Halaqa...
  domain/              ← منطق صافٍ 100%، بلا DOM ولا Firebase
    ids.ts, dates.ts, scoring.ts, suras.ts, students.ts, text.ts,
    attendance.ts, stats.ts   (+ 7 ملفات *.test.ts)
  data/                ← طبقة Firestore — كل وصول للبيانات يمر من هنا حصراً
    firebase.ts          تهيئة Firestore/Auth (modular SDK)
    converters.ts        محوّلات Firestore <-> TypeScript
    students.repo.ts
    records.repo.ts      ← استعلامات مُرشّحة/محدودة، لا تحميل شجرة كاملة
    publicStats.repo.ts
    mosques.repo.ts
  app.tsx              ← شاشة placeholder مؤقتة (الشاشات الحقيقية في المرحلة 3)
firestore.rules         ← قواعد الأمان (multi-tenant، عضوية صريحة)
firestore.indexes.json  ← الفهارس المركّبة المطلوبة لاستعلامات records.repo.ts
firestore.rules.test.ts ← اختبارات القواعد (تحتاج Emulator — راجع الملاحظة أعلاه)
scripts/
  migrate-rtdb-to-firestore.ts  ← سكربت الهجرة (تعليمات التشغيل داخل الملف)
.github/workflows/ci.yml         ← typecheck + اختبارات domain + build + اختبارات القواعد
```

## الخطوات القادمة

- **المرحلة 3:** الشاشات الأربع (تسجيل، الطلاب، السجل، إحصاءات) + بوابة ولي الأمر،
  كل واحدة تستخدم `domain/` و`data/` مباشرة
- **المرحلة 4:** تشغيل متوازي على مسار فرعي قبل أي قطع كامل عن `main`
- **قرار معلّق:** دالة `scoreLabel()` في الكود الحي فيها نفس نمط `s === 0` لكن في
  سياق مختلف (عرض حقل الإدخال المباشر، مش بيانات مخزّنة) — يحتاج قرار عند بناء
  شاشة "تسجيل" في المرحلة 3

راجع خطة إعادة البناء الكاملة في المحادثة الأصلية للتفاصيل الكاملة لكل مرحلة.
