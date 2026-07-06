# متابعة حفظ القرآن — Project Reference

Mobile-first Quran memorization circle (halaqa) tracker for ~50 students. Single HTML file,
no build tools, installable as a PWA. This document describes the project **as it currently
stands** — a reference for any future development work, not a changelog.

**Live URL:** https://waytoallah.github.io/quran-halaqa
**Repo:** https://github.com/WayToAllah/quran-halaqa (branch `main`)

---

## 1. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Vanilla HTML/CSS/JS, single `index.html` (~2000 lines) |
| Data | Firebase Realtime Database — sole source of truth, no localStorage |
| Auth | Firebase Authentication — Email/Password (admin only) |
| External sync | Google Apps Script → Google Sheets (write-only logging, not read from) |
| Hosting | GitHub Pages |
| PWA | `manifest.json` + `sw.js`, branded icons in `icons/` |
| Optional | `html2canvas` (CDN) — renders the "نجوم الحضور" share card to PNG |

**Files in the repo:**
- `index.html` — the admin app (record sessions, manage students, log, stats)
- `child.html` — read-only, per-child progress page for parents; see §3/§4 for the
  `parentToken`/`publicStats` mechanism behind it
- `manifest.json`, `sw.js`, `icons/*` — PWA
- `PROJECT_CONTEXT.md` — this document
- `BRD.html` — a standalone requirements/analysis document, informational only, not wired into the app

---

## 2. Architecture

There is exactly one path data takes into the UI: a live Firebase `.on('value', …)` listener
on `students` and `records` rebuilds the in-memory `students`/`records` arrays and re-renders
on every change, on every connected device. All writes go straight to Firebase
(`set()`/`update()`/`remove()`); there is no client-side cache or merge logic to reason about.

The app does not start syncing until a signed-in admin session is confirmed —
`init()`/`startSync()` are invoked from inside `firebase.auth().onAuthStateChanged`, gated
behind the full-screen login overlay (`#login-screen`).

```
students/{studentId}     → student profile
records/{recordId}       → one session or attendance-only entry
publicStats/{parentToken} → derived, read-only per-child summary (see §3/§4)
```

`publicStats` is not an independent data source — it's fully derived from `students`/`records`
by the admin app itself. `recomputePublicStats()` runs (debounced) every time the live
`students`/`records` listeners fire, rebuilding every student's summary from scratch and
pruning entries for students that no longer exist. `child.html` never talks to `students` or
`records` directly; it only ever reads its own `publicStats/{token}` node.

**Achievement badges** (`buildStudentBadges()` in `index.html`, rendered in `child.html`'s
"🏅 الأوسمة" card) are computed as part of `buildStudentPublicStats()` and stored as a
`badges: [{key, icon, label}, ...]` array inside each student's `publicStats` entry — there is
no separate Firebase node for them. Every badge in the current set is derived entirely from
existing `students`/`records` data (no new tracking fields were added):

| Badge | Condition |
|---|---|
| 💯 حضور مثالي | `attendPct >= 100` for the current period |
| 🔥 استمرارية N يوم | `ATTENDANCE_STREAK_THRESHOLD` (12) consecutive halaqa days attended, counted backward from the most recent halaqa day via `sortedHalaqaDatesDesc()` — stops at the first gap |
| 📖/📗/📘 حافظ ١٠٠/٢٠٠/٥٠٠ آية | `totalAyat` crosses each threshold in `AYAT_MILESTONES` (a student can hold more than one at once) |
| 🌟 التميّز | average of `avgLoh`/`avgMadi` (whichever exist) ≥ `EXCELLENCE_SCORE_THRESHOLD` (85) |
| 📈 الأكثر تحسناً | `computeIsImproving()`: needs ≥6 scored sessions; true when the average of the most recent 3 beats the average of the 3 before that |

`avgMadi` is a new field alongside the pre-existing `avgLoh`, computed the same way
(`hasScore()`-filtered mean, rounded) but was previously only tracked implicitly — it now
exists explicitly in `publicStats` for the excellence badge and is available for future stats
work too.

**Deferred (need new data tracking, not implemented yet):** بادج صلاة الجماعة، بادج الصف
الأول، وبادج حفظ الحديث — كل واحد فيهم محتاج حقل تسجيل جديد (مش موجود في الداتا موديل
الحالي) قبل ما يبقى قابل للحساب؛ اتفقنا يبقوا مرحلة تانية بعد ما نتفق على شكل التسجيل
اليومي المطلوب لكل واحد منهم.

---

## 3. Auth & Security

- **Admin app:** email/password login required before any UI is usable; logout via the 🚪
  button in the header. New admins are added directly in Firebase Console → Authentication →
  Users (no in-app invite flow exists).
- **`child.html`:** no sign-in at all. Reads exactly one path, `publicStats/{token}`, where
  `token` is a 20-char random string (`genParentToken()`, ~118 bits of entropy) stored on the
  student record. Knowing a token reveals only that one child's derived summary — never
  `students`/`records` — because the rules below grant read access at the `publicStats/$token`
  level specifically, not at the tree root.
- **Realtime Database rules** (configured in Firebase Console, not stored in this repo) —
  **⚠️ PENDING: still needs to be applied by Muhammad; the flat rule below is what's live as of
  this writing, and does *not* yet give child.html's link the isolation described above** (a
  root-level `auth != null` grant cascades to every child path including `publicStats`, so
  adding a nested rule under it changes nothing until the root grant is split up like this):
  ```json
  {
    "rules": {
      "students": { ".read": "auth != null", ".write": "auth != null" },
      "records": { ".read": "auth != null", ".write": "auth != null" },
      "publicStats": {
        "$token": { ".read": true, ".write": "auth != null" }
      }
    }
  }
  ```
  `students`/`records` keep their exact current behavior (any authenticated user can read/write
  either tree; unchanged from before). The new `publicStats/$token` rule is the only actual
  change: public, unauthenticated read of one specific token path, write still admin-only.
  There's still no per-mosque or per-role restriction on `students`/`records` themselves —
  appropriate for a single halaqa, and the first thing that needs to change if multi-tenant
  support is added (see §10).
  **Since `parent-form.html` was the only consumer of the Anonymous auth provider and it has
  now been removed from the app, the Anonymous provider itself is no longer needed — disabling
  it in Firebase Console → Authentication → Sign-in method is a safe, optional follow-up
  cleanup whenever convenient.**
- **XSS defense:** every value that can originate from user input (student names, notes,
  phone numbers) passes through `esc()` before being placed in `innerHTML`. Sura names from
  the fixed 114-entry `SURAS` constant are the only strings deliberately left unescaped, since
  they're never user-controllable.
- **Google Apps Script endpoint** requires a shared secret sent with every request
  (`SHEETS_SECRET` constant in `index.html`, checked against `SHARED_SECRET` in the Apps
  Script project) — requests without a match are rejected.
- **GitHub deploy token:** a fine-grained PAT scoped to Contents (read/write) on this repo
  only. Not stored in this document; a session that needs to push commits will need a working
  token supplied fresh.

---

## 4. Data Model

### Student
```json
{
  "id": "s_1751500000000_ab12c",
  "name": "زيد احمد",
  "age": "12",
  "grade": "الصف السادس الابتدائي",
  "school": "اسم المدرسة",
  "phoneType": "أم",
  "phonePrimary": "01XXXXXXXXX",
  "phoneSecondary": "01XXXXXXXXX",
  "parentToken": "Xk3f9aQzR2mNp8LwQhT4"
}
```
`id` is a generated key (`genId('s')`) used as both the Firebase key (via `fbKey()`) and the
reference other records point to (`studentId`). All student↔record matching goes through
`studentId`, never the name string — a student can be renamed freely without breaking any
historical link (see `studentMatch()` / `displayStudentName()` in §7).

`parentToken` is minted once per student (`genParentToken()`) and never changes — it's the `t=`
query param in that student's `child.html` link. `saveStudentModal()` always carries an
existing token forward explicitly (it's a full `.set()`, so leaving it out on an edit would
silently break the family's saved link); `backfillParentTokens()` mints one for any student
that predates this feature, the first time data syncs in each admin session.

### Session Record
```json
{
  "id": "r_1751500000000_xy34z",
  "studentId": "s_1751500000000_ab12c",
  "date": "2026-06-29",
  "student": "زيد احمد",
  "loh":  { "score": 90, "stars": 4 },
  "madi": { "score": 85, "stars": 4 },
  "newLoh":  [{ "sura": "البقرة", "from": "1", "to": "10" }],
  "newMadi": [{ "sura": "الفاتحة", "from": "1", "to": "7" }],
  "tajweed": {
    "sura": "البقرة", "from": "1", "to": "5",
    "score": 0, "stars": 5, "note": ""
  },
  "note": "general note"
}
```
- `loh`/`madi` hold the **evaluation of the previous session's assignment** — `score` is
  `null` when nothing was evaluated (distinct from a genuine zero grade "إعادة") and a number
  0–100 otherwise. `student` is a plain display-name snapshot; `studentId` is authoritative.
- `newLoh`/`newMadi` hold **this session's new assignment** for next time — arrays, since a
  session can assign more than one sura for either. `tajweed` is optional and self-contained
  (has its own sura/range/score, added only when the "مراجعة التجويد" toggle is used).
- Selecting a student in the تسجيل screen auto-loads their most recent session's
  `newLoh`/`newMadi` as today's items to evaluate.

### Attendance-only Record
```json
{
  "id": "att_1751500000000_ab12c",
  "studentId": "s_1751500000000_ab12c",
  "student": "زيد احمد",
  "date": "2026-06-06",
  "attendance_only": true,
  "note": ""
}
```
No `loh`/`madi`/`newLoh`/`newMadi`. Created individually via historical import, or in bulk via
the "✅ تسجيل حضور جماعي" flow (a date-scoped checklist of all students that batch-creates one
of these per checked student, skipping anyone who already has a record that date).

### Public Stats (`publicStats/{parentToken}`)
```json
{
  "name": "زيد احمد",
  "updatedAt": 1751500000000,
  "totalHalaqaDays": 12,
  "uniqueDays": 10,
  "attendPct": 83,
  "rank": 2,
  "sessionsCount": 9,
  "totalAyat": 340,
  "avgLoh": 88,
  "currentTask": { "date": "2026-06-29", "newLoh": [...], "newMadi": [...] },
  "recentSessions": [ { "date", "loh":{"score"}, "madi":{"score"}, "newLoh", "newMadi", "tajweed", "note" }, … up to 10, newest first ]
}
```
Entirely derived — never hand-edited. `recomputePublicStats()` rebuilds every student's entry
from `students`/`records` (debounced ~900ms after any change) and deletes entries for students
that no longer exist. `rank`/`attendPct` reuse the exact same `getAttendanceRanking()` logic as
the الإحصاءات screen, so a parent's link and the admin's leaderboard never disagree.

---

## 5. Screens

| Screen | Contents |
|---|---|
| **تسجيل** | Searchable student picker (type-to-filter, not a native `<select>`) → previous-task evaluation card → new-assignment form (multi-sura loh/madi rows, optional tajweed) → save. Includes the group-attendance entry point. |
| **الطلاب** | Add/edit/delete student profiles; attendance-badge indicator per student; search-as-you-type is not present here (full list, since it's typically ≤50 rows) |
| **السجل** | All sessions newest-first, with a name-search box; each entry editable or (undoably) deletable; multi-sura assignments shown joined ("الإخلاص والفلق"), suras with no ayah range shown by name alone |
| **إحصاءات** | Summary cards (total sessions, ayat, averages), weekly bar chart, top-3 ayat/attendance leaderboards, full per-student table, downloadable/shareable "نجوم الحضور" card |

`child.html` is a separate, standalone page: a permanent, read-only link
(`child.html?t={parentToken}`) showing one student's own attendance %, session count, total
ayat, average لوح score, current assignment, and last 10 sessions — nothing editable, and no
sign-in. The link is generated automatically and appended to every WhatsApp session summary
(`showWhatsAppPrompt()`), and can also be copied on demand from the 🔗 button on that student's
row in شاشة الطلاب (`copyChildLink()`).

---

## 6. Scoring & Attendance

| Score | Label |
|---|---|
| 85–100 | ممتاز |
| 75–84 | جيد جداً |
| 65–74 | جيد |
| 50–64 | مقبول |
| 0–49 | إعادة |

- Every 10 points = half a star; 0–5 stars in 0.5 steps (`scoreToHalfStars`).
- Total halaqa days = unique dates with any record, excluding `EXCLUDED_HALAQA_DATES` (a single
  named constant array — currently `['2026-06-04']`, a bonus/makeup day that shouldn't count
  against attendance percentages).
- Per-student attendance % = their unique session dates ÷ total halaqa days, capped at 100.
- "نجم الحضور" badge threshold is `ATTENDANCE_BADGE_THRESHOLD` (70), one named constant.
- Ranking is dense (tied students share a rank; no gaps in the sequence).

---

## 7. Core JS Patterns Worth Knowing Before Editing

```javascript
// Student↔record matching: always prefer the stable id, fall back to the
// name string only for records that predate studentId existing at all.
function studentMatch(rec, student) {
  if (rec.studentId && student.id) return rec.studentId === student.id;
  return rec.student === getStudentName(student);
}
// Display name always resolves to the student's CURRENT name via studentId,
// falling back to the name captured on the record if the student was deleted.
function displayStudentName(rec) {
  const s = rec.studentId && students.find(st => st.id === rec.studentId);
  return s ? getStudentName(s) : (rec.student || '—');
}

// A real zero score must be distinguishable from "not evaluated" — never
// use a plain truthy check on `.score` (0 is falsy in JS).
function hasScore(o) { return !!o && o.score != null; }

// Local (not UTC) date string — needed because Egypt is UTC+2/+3, so a
// naive toISOString().slice(0,10) can silently roll a late-night session
// back to the previous calendar day.
function localDateStr(d) {
  d = d || new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Ayah-range and multi-sura display, shared by the WhatsApp message and the log:
function ayahRange(from, to) { return (from && to) ? ' (' + from + '–' + to + ')' : from ? ' (من ' + from + ')' : ''; }
function joinSuraNames(list) {
  const parts = list.map(m => m.sura + ayahRange(m.from, m.to));
  return parts.length === 1 ? parts[0] : parts.slice(0, -1).join('، ') + ' و' + parts[parts.length - 1];
}

// Any value that can originate from user input must pass through this
// before being placed in innerHTML.
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Firebase write pattern — direct set() by sanitized id, no push()/merge.
function saveRecordToFirebase(rec) { return db.ref('records/' + fbKey(rec.id)).set(rec); }
function saveStudentToFirebase(s)  { return db.ref('students/' + fbKey(s.id)).set(s); }
```

**`CHILD_STATS_BASE_URL` is a hardcoded absolute URL constant in `index.html`**
(`https://waytoallah.github.io/quran-halaqa/child.html`), used to build every student's
`child.html?t={parentToken}` link (copy-link button, WhatsApp message). It does **not**
derive from `location.origin` — if the GitHub Pages domain ever changes again (repo
transfer, username change, custom domain), this constant must be updated by hand or every
newly-generated parent link will point at a dead URL, and links already sent before the
change will need to be regenerated and re-sent.

**When looking up "the previous/most recent session"** anywhere (evaluation defaults, the
WhatsApp preview, etc.), the lookup must exclude the record currently being edited and only
consider records strictly before it chronologically (`byNewest(r, editingRec) > 0`) — a lookup
that just grabs "the most recent session for this student" is wrong whenever the session being
edited is itself the most recent one.

**`.save-btn` is used by more than one button** (the login screen's submit button also has
it) — always scope selectors to `#screen-record .save-btn` rather than querying the class
alone.

**Toasts have `pointer-events:none` by default** so a passing success/error toast doesn't
block clicks underneath it. Any toast variant that needs an interactive element (like the
undo-toast's button) needs `pointer-events:auto` scoped to its own `.show` state.

**Sura/range data for the *new* assignment lives only in `newLoh`/`newMadi`.** `loh`/`madi`
are evaluation-only (`{score, stars}`) and have no `sura`/`from`/`to` fields — anything that
needs the assigned sura for a session should read `newLoh`/`newMadi`, with a same-shape legacy
fallback only for pre-migration records that might not have those arrays.

---

## 8. Testing Approach

No test framework is committed to the repo. The app has been validated with Playwright driving
a real Chromium browser against a hand-rolled Firebase compat-SDK mock (`window.firebase.auth()`
/`.database()` backed by an in-memory `window.__mockDb`), since the real Firebase/gstatic
endpoints aren't reachable from every environment this project gets worked on in. Key practices
for anyone rebuilding this harness:
- Serve the mock in place of the real `firebase-*-compat.js` script tags via request-route
  interception, so the app's actual code executes unmodified against realistic-looking Firebase
  calls (`.on()`, `.set()`, `.update()`, `.remove()`, `.signInWithEmailAndPassword()`, etc.).
- Seed test data via an init script that runs **before navigation**, not after page load — the
  app's one-time self-heal routines (auto-linking legacy records, merging known duplicate
  names) only run once per page load and will not re-fire against data injected later.
- Give mocked writes a small artificial delay rather than resolving instantly, so transient UI
  states (disabled buttons, loading labels) are actually observable by assertions.
- Cover the exact interaction sequence being tested, not just the general case — e.g. "edit a
  student's most recent session" is a meaningfully different code path from "edit an older
  one," and both are common enough in real use to need their own coverage.

---

## 9. Deployment Notes

Static hosting via GitHub Pages, auto-deployed on every push to `main`. The GitHub Pages
deploy step is occasionally flaky at the platform level (build succeeds, deploy step fails
with a generic "try again later," or a push lands without triggering a workflow run at all) —
neither is a code issue; retriggering with a fresh commit resolves it. To confirm a deploy
truly succeeded, check that the latest deployment's own status history ends in `success` (its
mere existence with the right commit sha doesn't guarantee that).

The service worker's navigation handler uses `{cache: 'no-store'}` to bypass GitHub Pages'
own HTTP caching, so a network-first strategy is actually network-first rather than serving a
several-minutes-stale cached response.

---

## 10. Scope Boundaries / Not Implemented

- **Multi-mosque / multi-tenant support** — currently in progress. Target design: a 3-level
  hierarchy (`mosques/{id}/halaqat/{id}/students|records`) with per-mosque security rules and
  an admin/mosque membership mapping, replacing the current flat `students`/`records` root.
  First mosque to migrate: مسجد التيسير (currently the only data in the system). A full
  architecture write-up (data model, rules sketch, admin-role design, migration plan, scale
  analysis) exists as a separate document delivered outside this repo.
- **Parent-editable profile page** — removed (previously `parent-form.html`); if a
  parent-facing profile-edit flow is reintroduced later, it must be built with per-family
  token scoping from the start rather than the old any-visitor-sees-everyone model.
- **Parent phone-number editing from `child.html`** — removed. `child.html` previously had a
  phone-edit card writing suggestions to a `phoneUpdates/{token}` queue that the admin app
  consumed and applied. Both sides are gone: the card and `savePhoneNumbers()` in `child.html`,
  and `attachPhoneUpdatesListenerOnce()`/`applyPendingPhoneUpdate()` in `index.html`.
  `phonePrimary`/`phoneSecondary` were also dropped from the `publicStats` payload (they only
  existed to pre-fill that card, and there's no reason to publish family phone numbers on a
  publicly-readable node). Phone edits now happen only in the admin's student modal. A stale
  `phoneUpdates` node may still exist in Firebase with old queued entries — safe to delete
  manually from the Console; nothing reads or writes it anymore.
- **Automatic annual grade promotion** — no such logic exists anywhere in the app.
- **Server-side/query-based pagination** — `.on('value')` loads the entire `records` tree into
  memory on every change; fine at current data volume (~50 students, low thousands of
  records), would need `orderByChild`/pagination if that grows an order of magnitude.
- **Concurrent-edit protection** — last-write-wins, no version/timestamp check; acceptable
  risk for a small number of admins editing at different times.

---

## 11. Reference Data

**Current halaqa's students** (Firebase is the source of truth; this list is a point-in-time
reference only):
زيد احمد، عبد الله احمد، ريتال رضا، رويدا رضا، يزن رفقي، نادين رفقي،
ساجد محمود ناجي، اسر محمود ناجي، يوسف خالد، انس هيثم، ياسين هيثم،
فاروق طارق، احمد حسام، فريدة حسام، عمر احمد خضر، عبد الرحمن جار،
معاذ جار، كنزي وليد، كندة، سيف محمد، ياسين محمد، حسن عيد، مؤمن،
اياد ايمن، ياسين رزق، سلمى ابراهيم، ياسين ابراهيم، حازم محمد حمدي،
حمزة محمد حمدي، حمدي محمد حمدي، عمر محمد يحيى، عمار محمد يحيى،
عمر احمد عبد المنعم، ليلي احمد عبد المنعم، ادم احمد، تاج بلال،
جمال احمد جمال، نبيل احمد جمال، مالك محمد سمير، محمد طارق فاروق،
مروان اشرف، طارق عيد، بتول احمد، احمد ياسر، زين الدين اسلام،
محمود عمرو محمود، يحيى محمد، يارا وليد، انس وليد، زياد جابر شريف

**Firebase project:** `quran-app-abe52` (Realtime Database, Authentication enabled for
Email/Password; the Anonymous provider was only used by the now-removed `parent-form.html`
and can be disabled in Console — see §3).

