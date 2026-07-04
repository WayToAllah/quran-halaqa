# متابعة حفظ القرآن — Project Context

## Overview
A mobile-first web app for tracking a Quran memorization circle (~50 students).
Single HTML file, no build tools, works in any browser. Installable as a PWA.

**Live URL:** https://mredwan214-code.github.io/quran-halaqa
**GitHub Repo:** https://github.com/mredwan214-code/quran-halaqa (branch `main`)

---

## Tech Stack
- **Frontend:** Vanilla HTML + CSS + JS (single `index.html`)
- **Realtime DB:** Firebase Realtime Database — **single source of truth**, no localStorage anywhere
- **Auth:** Firebase Authentication — **Email/Password** for the admin app, **Anonymous** for `parent-form.html`
- **Sheets Sync:** Google Apps Script (fire-and-forget, best-effort logging only — not read from)
- **Hosting:** GitHub Pages
- **PWA:** `manifest.json` + `sw.js` (network-first shell, offline fallback) + branded icon set in `icons/`
- **Optional lib:** `html2canvas` (CDN) — used only for downloading the "نجوم الحضور" attendance-stars card as a PNG

> **Architecture note:** There is exactly one way data enters the UI: a live Firebase
> `.on('value', …)` listener on `students` and `records` that rebuilds the in-memory arrays
> and re-renders on every change. No localStorage cache, no merge logic. Writes go straight
> to Firebase (`set()`/`update()`/`remove()`), and the listener does the rest on every device.
> **The app only starts syncing after a signed-in admin session is confirmed** (see Auth below)
> — `init()`/`startSync()` are called from inside `onAuthStateChanged`, not unconditionally.

---

## Auth & Security (added 2026-07-03/04 — previously the DB was fully open)

- **Admin app (`index.html`):** full-screen login gate (`#login-screen`) blocks the UI until
  `firebase.auth().onAuthStateChanged` reports a signed-in user. Email/Password only — new
  admins are added via Firebase Console → Authentication → Users (no in-app invite flow).
  Logout button (🚪) in the header calls `firebase.auth().signOut()`.
- **`parent-form.html`:** signs in **anonymously** on load (`firebase.auth().signInAnonymously()`)
  before touching the DB, so it keeps working under the auth-gated rules below. It still shows
  **every** student to any visitor (no per-student token) — this was a deliberate, deferred
  trade-off, not an oversight. Revisit if this ever becomes a real privacy concern.
- **Realtime Database security rules** (set in Firebase Console, not in this repo):
  ```json
  { "rules": { ".read": "auth != null", ".write": "auth != null" } }
  ```
  Root-level, so it covers every node including any legacy ones (`attendance`, `deletedIds`)
  without needing per-path rules. Blocks all unauthenticated access; does **not** restrict
  which authenticated user can touch which data (single-halaqa app, not multi-tenant).
- **XSS:** every value that can originate from user input (student names, notes, phone
  numbers, sura fields restored during edit) is passed through `esc()` before being placed in
  `innerHTML`. This closes a real stored-XSS hole — `parent-form.html` lets visitors edit
  student names with no server-side validation, and those names used to render unescaped in
  the admin's browser (log, stats, student list, dropdowns). Sura names from the hardcoded
  `SURAS` array are the only strings NOT escaped, since they're not user-controllable.
- **`setup.html` was removed (2026-07-04).** It was a one-time destructive wipe/reseed tool
  with 51 real student names hardcoded in plaintext page source and no auth check of its own
  — a privacy leak that also bypassed the auth gate above (view-source needed no login). Its
  job was already done; it's preserved in the `backup-2026-07-03-pre-security` branch if the
  original seed data is ever needed for reference.
- **Still outstanding (needs the project owner, not code):**
  - GitHub PAT used for deploys should be revoked and replaced with a fine-grained token
    scoped to just this repo (the working token was shared in a chat context).
  - The Google Apps Script endpoint (`SHEETS_URL`) has no shared-secret check — anyone can
    POST arbitrary data to it. Needs a change in the Apps Script project itself (not in this
    repo) to reject requests without a matching secret.

---

## Firebase Config
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyCLzsd-tyAPKoS6HQ-Kw6LEwaxPSibbKSg",
  authDomain: "quran-app-abe52.firebaseapp.com",
  databaseURL: "https://quran-app-abe52-default-rtdb.firebaseio.com",
  projectId: "quran-app-abe52",
  storageBucket: "quran-app-abe52.firebasestorage.app",
  messagingSenderId: "484959710944",
  appId: "1:484959710944:web:454059b1f2136c0d73aa85"
};
```
Note: `quran-app-abe52-default-rtdb.firebaseio.com` and `*.gstatic.com` (the Firebase SDK
CDN) are **not** reachable from the Claude sandbox's network egress allowlist. Testing this
app therefore requires a local Firebase mock (see Testing section) rather than the live DB.

## Google Apps Script URL
```
https://script.google.com/macros/s/AKfycbzw3X51RGVsjg0IhXbD1Tbv0ZZ09bUP8jiM4ufEU3fVRw2Ow3nbQqVosvzeAQId1_zQjQ/exec
```
No auth/secret check on this endpoint yet — see Auth & Security above.

---

## Data Structures

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
  "phoneSecondary": "01XXXXXXXXX"
}
```
- `id` is a stable generated key (`genId('s')` → `s_<ms>_<rand>`), used as the Firebase key
  (via `fbKey()`) and as the reference on records (`studentId`).
- **Renaming a student is now completely safe.** All lookups resolve via `studentId` first
  (see `studentMatch()` / `displayStudentName()` / `recordsForStudent()` below); the stored
  `student` name on a record is only a fallback display value for legacy records that predate
  `studentId`. A one-time self-heal (`backfillStudentIds()`) retroactively links any legacy
  record to its student automatically the first time the app loads after this fix, IF the
  stored name matches exactly one current student.
- Renaming to a name that collides with another existing student is now blocked with an alert
  (previously only checked when *adding* a new student, not editing one).
- Deleting a student now warns with the exact count of linked sessions first, and the delete
  itself goes through a 5-second undoable-delete flow (see UX section) rather than firing
  immediately.

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
- **`loh.score` / `madi.score` are now `null`, not `0`, when no evaluation was entered.**
  Previously both cases collapsed to `0`, which meant a genuine "إعادة" (zero) grade was
  indistinguishable from "nothing was evaluated" and got silently hidden from every average,
  badge, and log line that checked `if (r.loh.score)` (0 is falsy in JS). All such checks now
  use the `hasScore(o)` helper (`!!o && o.score != null`) instead.
- `newLoh`/`newMadi` are arrays (multiple suras per session supported for both).
- Each session stores the **evaluation of the previous task** (`loh.score`/`madi.score`) AND
  the **new task** for next time (`newLoh`/`newMadi`). Selecting a student auto-loads their
  last session's `newLoh`/`newMadi` as today's items to evaluate (`onStudentChange`).
- **Editing an old (non-latest) session is now safe:**
  - Switching the student dropdown mid-edit cancels edit mode instead of silently reassigning
    the old session to the newly-picked student (`onStudentSelectManualChange`).
  - The WhatsApp "previous session" lookup only considers sessions chronologically *before*
    the one being edited (`byNewest(r, rec) > 0`), so editing an old session no longer pulls
    in a session that's actually newer as if it were "last time."
- A completely empty session (no loh, no madi, no tajweed, no note) now asks for confirmation
  before saving, instead of silently creating a content-free record.
- Saving is guarded against double-submit (`savingRecord` flag + disabled button) and against
  silent Firebase failures (`.then()`/`.catch()` — a failed save shows a red toast and keeps
  the form filled, instead of showing "✓ تم الحفظ" regardless of outcome).
- Records are editable/deletable from the السجل (Log) screen; delete goes through the
  undoable-delete flow.

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
- No `loh`/`madi`/`newLoh`/`newMadi` fields. All stats/render code guards with
  `r.attendance_only` checks or `hasScore()`/optional-chaining before touching those fields.
- **Now creatable from the UI** (previously only existed from a one-time historical import,
  with zero way to make new ones): the "✅ تسجيل حضور جماعي" button on the تسجيل screen opens
  a checklist of all students for a chosen date; checking students and saving batch-creates
  one `attendance_only` record per checked student. Students who already have *any* record
  (session or attendance-only) for that date are shown greyed-out and can't be double-checked.
- Five specific "ghost" name variants from the original historical import (double spaces,
  ي/ى spelling differences) were confirmed by Muhammad on 2026-07-03 to be typos of real
  students, not different people, and are auto-merged on load (`CONFIRMED_NAME_MERGES` in
  `mergeGhostNames()`) — same one-time self-heal pattern as the studentId backfill.

---

## Screens
| Screen | Purpose |
|--------|---------|
| تسجيل (Record) | Evaluate previous task + assign new task; searchable student picker (not a native `<select>`); "تسجيل حضور جماعي" button for batch attendance |
| الطلاب (Students) | Add/edit/delete student profiles; top-70%-attendance badge shown per student; skeleton loading state before first sync |
| السجل (Log) | Sessions newest-first; search box filters by student name (unbounded results when searching, capped at 40 when not); each session editable/deletable with undo |
| إحصاءات (Stats) | Summary cards, weekly bar chart, score distribution, top-3 ayat/attendance leaderboards, per-student detail list, "نجوم الحضور" share card |

Student picker (`#student-search-input` + hidden `#student-select` + `#student-search-dropdown`)
uses the same type-to-filter pattern as the sura fields, but resolves selections by **array
index** into a temporary `studentDropdownList`, not by embedding the name in the `onclick`
string — student names are user-editable (unlike the fixed 114-sura list), so embedding raw
names in an inline event handler would reopen the same class of injection risk `esc()` closes
elsewhere.

---

## Scoring System
| Score | Label |
|-------|-------|
| 85–100 | ممتاز |
| 75–84 | جيد جداً |
| 65–74 | جيد |
| 50–64 | مقبول |
| 0–49 | إعادة |

- Every 10 points = half star (`scoreToHalfStars`), 0–5 stars in 0.5 steps.
- `hasScore(o)` (`!!o && o.score != null`) is the correct way to check "was this evaluated at
  all" — a plain truthy check on `.score` treats a real 0 the same as "never entered."

---

## Attendance Calculation
- Total halaqa days = unique dates with any record, excluding dates in `EXCLUDED_HALAQA_DATES`
  (currently just `2026-06-04`, a bonus/makeup day) — this constant lives in one place now
  instead of being duplicated inline in two functions.
- Attendance % per student = unique session dates ÷ total halaqa days, capped at 100%.
- Badge threshold is `ATTENDANCE_BADGE_THRESHOLD` (70), also consolidated into one constant
  used by all three places that used to hardcode the number `70` separately.
- Ranking (`getAttendanceRanking`) uses dense ranking (ties share a rank, no gaps).

---

## UX additions (2026-07-04)
- **PWA:** installable via "Add to Home Screen" — `manifest.json`, `sw.js` (network-first for
  the app shell, cache fallback offline, stale-while-revalidate for CDN libs), icon set in
  `icons/` (192/512/maskable/apple-touch/favicon).
- **Undoable delete:** deleting a student or session hides it immediately (optimistic UI via
  `pendingDeleteStudentIds`/`pendingDeleteRecordIds`) and shows a 5-second "تراجع" toast before
  the Firebase delete actually fires. Clicking تراجع cancels the pending delete with zero
  Firebase writes having happened.
- **Loading skeleton:** `dataReady()` (`firstStudentsLoaded && firstRecordsLoaded`) gates
  whether the student list / log show a pulsing skeleton or a genuine "no data" empty-state,
  so the brief sync window right after login no longer looks like "you have zero students."
- **Modal accessibility:** all three modals (`student-modal`, `wa-modal`, `stars-modal`) have
  `role="dialog"`/`aria-modal`; a generic `MutationObserver`-based handler moves focus into
  whichever modal just gained `.open`, Escape closes it, and Tab is trapped inside it while
  open — implemented once, generically, not per-modal.
- **Copy button** on the WhatsApp preview modal (`copyWaMessage()`, Clipboard API with an
  `execCommand` fallback for non-secure contexts).
- Viewport no longer sets `maximum-scale=1.0` (was blocking pinch-zoom, an accessibility
  problem for low-vision users); all `.field input/select/textarea` are `font-size:16px` to
  compensate (below 16px, iOS auto-zooms on focus regardless of the viewport meta tag).
- Ayah placeholder numerals standardized to Latin digits, matching the rest of the app.

---

## Known code-level gotchas
- **`.save-btn` is not a unique class** — the login screen's submit button and the record
  screen's save button both have it. Any `document.querySelector('.save-btn')` silently grabs
  the login button (earlier in DOM order) instead of the intended one. Always scope to
  `#screen-record .save-btn` explicitly. (Found via automated testing — the H3 double-submit
  *guard* still worked correctly since it's a pure JS flag check, but the visual disabled/
  loading feedback was being applied to the wrong, invisible button until this was fixed.)
- **Toasts have `pointer-events:none` by default** (so a passing success/error toast doesn't
  block clicks on content underneath). The undo-toast's button needs
  `.undo-toast.show { pointer-events:auto; }` specifically, or its "تراجع" button is visible
  but permanently unclickable.
- `getWeekStart()` and the session-date default both need **local-time** date formatting, not
  `.toISOString().slice(0,10)` (which reports UTC) — Egypt is UTC+2/+3, so a session recorded
  between midnight and ~2–3am would otherwise silently save under yesterday's date. Use
  `localDateStr(d)` (subtracts `getTimezoneOffset()` before calling `toISOString`).

## Not implemented / deliberately deferred
- Per-student unique parent-form links (token-based access) — `parent-form.html` still shows
  every student to any visitor. Deferred by explicit choice, not an oversight; revisit if it
  becomes a real concern.
- Automatic annual grade promotion — no such logic exists anywhere in the code despite older
  notes suggesting otherwise.
- Live-listener performance at scale (`M2`): `.on('value')` reloads the *entire* `records`
  node on every single change; fine at current volume, would need `orderByChild('date')` +
  pagination if the dataset grows much larger.
- Concurrent-edit protection (`M10`): last-write-wins with no version check. Low real risk for
  a small admin team; would need a proper design pass (e.g. optimistic concurrency via a
  version/timestamp field) if more admins start editing the same records simultaneously.
- Multi-mosque / multi-tenant support was scoped and written up as a separate architecture
  plan (mosque → halaqa → students/records nesting, per-mosque Firebase rules) but explicitly
  deprioritized by Muhammad on 2026-07-03 — not started.

---

## Key JS Patterns
```javascript
// Robust student↔record matching — prefer studentId, fall back to name for
// records that predate it. Never compare by name directly elsewhere.
function studentMatch(rec, student) {
  if (rec.studentId && student.id) return rec.studentId === student.id;
  return rec.student === getStudentName(student);
}
function displayStudentName(rec) {
  if (rec.studentId) {
    const s = students.find(st => st.id === rec.studentId);
    if (s) return getStudentName(s);
  }
  return rec.student || '—';
}

// Distinguish "not evaluated" from "evaluated as zero"
function hasScore(o) { return !!o && o.score != null; }

// Local (not UTC) date string
function localDateStr(d) {
  d = d || new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Escape before injecting into innerHTML — required for any value that can
// originate from user input (names, notes, phone numbers)
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Firebase save pattern — direct set() by sanitized id, no push()/merge
function saveRecordToFirebase(rec) { return db.ref('records/' + fbKey(rec.id)).set(rec); }
function saveStudentToFirebase(s)  { return db.ref('students/' + fbKey(s.id)).set(s); }
```

---

## Testing
No test framework is committed to the repo, but this app has been thoroughly tested with
Playwright + a hand-rolled Firebase compat-SDK mock (necessary since `*.gstatic.com` and
`*.firebaseio.com` aren't reachable from a sandboxed environment). The pattern:
1. A mock `firebase` global (`window.firebase.auth()`/`.database()`) is served in place of the
   real gstatic script tags via Playwright route interception, backed by a plain in-memory
   object (`window.__mockDb`) with `.on()`/`.set()`/`.update()`/`.remove()` that mimic the
   real compat SDK closely enough for the app's actual code to run unmodified.
2. Seed data is injected via `page.add_init_script()` **before** navigation, so the app's
   first sync sees it immediately, matching how a real returning session behaves (data
   already present in Firebase by the time the listener attaches) — injecting it via
   `page.evaluate()` after the fact creates a timing sequence that doesn't happen in reality
   and produces false test results (self-heal functions guard against re-running, so if they
   fire once against still-empty seed data before your real test data lands, they never fire
   again for that page load).
3. Give the mock's `set()`/`update()` a small artificial delay (~150ms) rather than resolving
   instantly — otherwise transient UI states (disabled buttons, loading labels) resolve back
   to normal before Playwright's next assertion can observe them, producing false passes.
- 74 assertions across 7 test files covered auth, XSS, all H/M/U fixes, and the PWA files as
  of 2026-07-04. None of this is committed to the repo (lived in the sandbox only) — if
  regression testing is wanted going forward, rebuilding this harness is the fastest path,
  not writing one from scratch.

---

## Students List (reference only — Firebase is the source of truth)
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
