# متابعة حفظ القرآن — Project Context

## 🚧 ACTIVE TASK as of 2026-07-04 (read this first in a new session)

**Muhammad wants multi-mosque support**, added on top of the current single-halaqa app.
Confirmed decisions so far:
- **Full 3-level hierarchy**: `mosque → halaqa → students/records` (not a flattened
  mosque-only model) — he confirmed this explicitly by saying his mosque "has its halaqat"
  (plural), matching the recommendation in the architecture plan below.
- **First real mosque to migrate**: "مسجد التيسير" — this is the one currently live with all
  existing students/records.
- **Its current halaqa**: he described it as "a single halaqa for now" but has **not given it
  an explicit name** — pick a sensible placeholder (e.g. "الحلقة الأساسية") during migration
  unless he specifies one when you pick this back up.
- A full written architecture plan already exists covering data model, security rules, admin
  roles, migration steps, cost/scale analysis, and a phased rollout — it was delivered to him
  as `multi-mosque-architecture-plan.md` on 2026-07-03. **Re-read that plan's reasoning before
  writing any code** — don't redesign from scratch.
- **A dedicated backup branch `backup-2026-07-04-pre-multi-mosque`** was created right before
  this work started, pointing at the last known-good single-mosque commit. If anything about
  the migration goes wrong, that branch has the working single-mosque app to revert to.
- **Migration has NOT started yet** as of this note — Muhammad was asked to export the live
  Firebase data (Console → Realtime Database → Export JSON) as an extra safety net before the
  actual data migration runs; confirm that happened before touching Firebase data structure.
- Recommended sequence (from the architecture plan): finish the new schema + security rules +
  migration script for مسجد التيسير ALONE first, verify it works exactly like today, before
  adding any second mosque or building the mosque-switcher UI.

---

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
> **This single-tree structure (`/students`, `/records`) is exactly what the multi-mosque
> migration above needs to restructure into `/mosques/{id}/halaqat/{id}/students` etc.**

---

## Auth & Security — COMPLETE as of 2026-07-04

- **Admin app (`index.html`):** full-screen login gate (`#login-screen`) blocks the UI until
  `firebase.auth().onAuthStateChanged` reports a signed-in user. Email/Password only — new
  admins are added via Firebase Console → Authentication → Users (no in-app invite flow).
  Logout button (🚪) in the header calls `firebase.auth().signOut()`.
- **`parent-form.html`:** signs in **anonymously** on load before touching the DB. It still
  shows **every** student to any visitor (no per-student token) — deliberate, deferred
  trade-off, not an oversight.
- **Realtime Database security rules** (set in Firebase Console, not in this repo):
  ```json
  { "rules": { ".read": "auth != null", ".write": "auth != null" } }
  ```
  Root-level. **This will need to become per-mosque path rules** as part of the multi-mosque
  work (see architecture plan) — currently any authenticated user can read/write everything,
  which is fine for one mosque but not once multiple mosques' admins share the same DB.
- **XSS:** every value that can originate from user input (student names, notes, phone
  numbers, sura fields restored during edit) goes through `esc()` before `innerHTML`. Sura
  names from the hardcoded `SURAS` array are the only unescaped strings (not user-controllable).
- **`setup.html` was removed (2026-07-04)** — a one-time destructive wipe/reseed tool with 51
  real student names hardcoded in plaintext, no auth of its own. Preserved in the
  `backup-2026-07-03-pre-security` branch if ever needed for reference.
- **GitHub PAT rotated (2026-07-04).** The old classic token (shared in an earlier chat
  context) has been revoked by Muhammad. Current deploys use a fine-grained token scoped only
  to this repo (Contents: read/write). **The token itself is not written down here** — a fresh
  session will need Muhammad to provide a working token again (or generate a new one) before
  it can push commits.
- **Google Apps Script (`SHEETS_URL`) is now protected (2026-07-04).** The app sends a shared
  secret (`SHEETS_SECRET` constant in `index.html`) with every sync request; the Apps Script
  checks it against its own `SHARED_SECRET` constant and rejects mismatches. **The secret value
  is not repeated in this doc** — see the `SHEETS_SECRET` constant in the live `index.html` if
  you need it (e.g. to help Muhammad rotate it later).
  - While fixing this, two long-standing **silent data bugs** in the Apps Script were also
    fixed: it read `s.phoneMom`/`s.phoneDad` (fields that haven't existed since the student
    shape became `phonePrimary`/`phoneSecondary`/`phoneType`), and it read `r.loh.sura`/
    `r.madi.sura` directly (those fields haven't held sura info since `newLoh`/`newMadi`
    arrays were introduced — `loh`/`madi` are now evaluation-only `{score, stars}`). Both had
    been silently writing blank columns to the "طلاب"/"جلسات" Sheets for a while before this
    session. Fixed script now reads the correct current fields.

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
Note: `quran-app-abe52-default-rtdb.firebaseio.com` and `*.gstatic.com`/`*.script.google.com`
are **not** reachable from the Claude sandbox's network egress allowlist. Testing this app
therefore requires a local Firebase mock (see Testing section) rather than the live DB, and
the Apps Script endpoint can't be curled directly from the sandbox either — verification of
that fix relied on Muhammad's own confirmation of deploying + testing it.

## Google Apps Script URL
```
https://script.google.com/macros/s/AKfycbzw3X51RGVsjg0IhXbD1Tbv0ZZ09bUP8jiM4ufEU3fVRw2Ow3nbQqVosvzeAQId1_zQjQ/exec
```
Now requires the shared secret (see Auth & Security above) — a bare POST without it gets
rejected with `'unauthorized'`.

---

## GitHub Pages deployment — known flakiness (2026-07-04)

GitHub's Pages deploy step has failed transiently **multiple times** in this project, in two
distinct ways — neither is a code problem:
1. **Build succeeds, deploy step fails** with GitHub's own generic message "Deployment
   failed, try again later." Fix: push a small trivial commit (e.g. append an HTML comment to
   `index.html`) to trigger a fresh run.
2. **No workflow run gets triggered at all** for a push that landed correctly on `main` (rare,
   happened once). Same fix: push a trivial follow-up commit.

**Always verify a deploy actually succeeded** by checking BOTH:
```
GET /repos/{owner}/{repo}/git/ref/heads/main            → note the sha
GET /repos/{owner}/{repo}/deployments?per_page=1        → note its sha AND id
GET /repos/{owner}/{repo}/deployments/{id}/statuses     → confirm the LATEST entry is "success"
```
A deployment *record* existing with the right sha does **not** mean it succeeded — its own
status history can still end in "failure". Don't trust workflow-run "conclusion: success"
alone either if a `deploy` job exists as a separate step; check that job's own conclusion.

Also relevant: `sw.js`'s navigation fetch now uses `{cache: 'no-store'}` (bumped to
`CACHE_NAME = 'quran-halaqa-v2'`) because GitHub Pages' own `Cache-Control` header could
serve a stale cached HTML response for several minutes even under a "network-first" fetch
that doesn't explicitly bypass HTTP caching. If Muhammad reports "I don't see the update,"
check deployment success first (per above), then suggest a hard-close-and-reopen of the PWA
or an incognito tab before assuming it's still a caching issue on his device.

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
- **Renaming a student is completely safe.** All lookups resolve via `studentId` first (see
  `studentMatch()` / `displayStudentName()` / `recordsForStudent()`); the stored `student`
  name on a record is only a fallback display value for legacy records that predate
  `studentId`. A one-time self-heal (`backfillStudentIds()`) retroactively links legacy
  records automatically.
- Renaming to a name that collides with another existing student is blocked with an alert
  (checked on edit too, not just when adding).
- Deleting a student warns with the exact count of linked sessions, then goes through a
  5-second undoable-delete flow rather than firing immediately.

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
- **`loh.score` / `madi.score` are `null`, not `0`, when no evaluation was entered** — a real
  "إعادة" (zero) grade must be distinguishable from "nothing was evaluated." All such checks
  use `hasScore(o)` (`!!o && o.score != null`), never a plain truthy check.
- `newLoh`/`newMadi` are arrays (multiple suras per session supported for both). **When
  displaying multiple suras in one place, join them with `joinSuraNames()`** (e.g. "الإخلاص
  والفلق") rather than one line per sura — this is the pattern used in both the WhatsApp
  message and the log screen as of 2026-07-04.
- **When a sura has no ayah range entered, show just the sura name** — use `ayahRange(from, to)`
  (returns `''` if both empty, `' (from–to)'` if both present, `' (من from)'` if only `from`)
  rather than a `||'?'` fallback that produces an ugly "(?–?)".
- Each session stores the **evaluation of the previous task** (`loh.score`/`madi.score`) AND
  the **new task** for next time (`newLoh`/`newMadi`). Selecting a student auto-loads their
  last session's `newLoh`/`newMadi` as today's items to evaluate (`onStudentChange`).
- **Editing an old (non-latest) session is safe in every place that looks up "the previous
  session," not just one:**
  - Switching the student dropdown mid-edit cancels edit mode instead of silently reassigning
    the old session to the newly-picked student (`onStudentSelectManualChange`).
  - The WhatsApp "previous session" lookup (`prevRecs` in `showWhatsAppPrompt`) only considers
    sessions chronologically *before* the one being edited (`byNewest(r, rec) > 0`).
  - **`onStudentChange()`'s own "last session" lookup has the same guard** (added 2026-07-04,
    same bug class as the WhatsApp one but missed in the first pass): when
    `editingRecordId !== null`, it excludes the record being edited and only considers records
    strictly before it. Without this, editing a student's *latest* session — a very common
    case — made that session "the previous session for itself," so the "ما سمعناه النهارده"
    card showed the exact same content as the "المهمة الجديدة" section right below it. This
    was reported directly by Muhammad from live usage, not caught by the original test suite
    (which didn't specifically test editing the *latest* session for a student).
  - **The log's display of `newMadi` had a separate, longstanding bug** (also found via live
    usage, not the original audit): it checked `Array.isArray(r.madi)`, which is never true
    under the current schema (`r.madi` is only `{score, stars}`) — so "الماضي الجديد" silently
    never appeared in the log at all, and there was no "تقييم الماضي" score line either (only
    "تقييم اللوح" existed). Both fixed 2026-07-04. The stats/ayat-counting functions had
    already been checking `newMadi` correctly — only the log's *visual* rendering was wrong,
    so historical stats/totals were never actually affected by this bug.
- A completely empty session (no loh, no madi, no tajweed, no note) asks for confirmation
  before saving.
- Saving is guarded against double-submit (`savingRecord` flag + disabled button, correctly
  scoped to `#screen-record .save-btn` — see gotcha below) and against silent Firebase
  failures (`.then()`/`.catch()`, red toast + form stays filled on failure).

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
- Now creatable from the UI via "✅ تسجيل حضور جماعي" on the تسجيل screen — checklist of all
  students for a chosen date, batch-creates one record per checked student, greys out/disables
  students who already have any record that date.
- Five specific "ghost" name variants from the historical import (double spaces, ي/ى spelling)
  were confirmed by Muhammad on 2026-07-03 to be typos, and are auto-merged on load
  (`CONFIRMED_NAME_MERGES` in `mergeGhostNames()`).

---

## Screens
| Screen | Purpose |
|--------|---------|
| تسجيل (Record) | Evaluate previous task + assign new task; searchable student picker; "تسجيل حضور جماعي" button |
| الطلاب (Students) | Add/edit/delete student profiles; top-70%-attendance badge; skeleton loading state |
| السجل (Log) | Sessions newest-first; search box filters by student name; each session editable/deletable with undo; multi-sura lines joined with "و"; empty ayah ranges show sura name alone |
| إحصاءات (Stats) | Summary cards, weekly bar chart, score distribution, top-3 leaderboards, per-student detail, "نجوم الحضور" share card |

Student picker (`#student-search-input` + hidden `#student-select` + `#student-search-dropdown`)
resolves selections by **array index** into `studentDropdownList`, not by embedding the name in
the `onclick` string — student names are user-editable, unlike the fixed 114-sura list.

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
- `hasScore(o)` (`!!o && o.score != null`) — never a plain truthy check on `.score`.

---

## Attendance Calculation
- Total halaqa days = unique dates with any record, excluding `EXCLUDED_HALAQA_DATES`
  (currently just `2026-06-04`) — one constant, not duplicated inline.
- Badge threshold is `ATTENDANCE_BADGE_THRESHOLD` (70) — one constant, used everywhere.
- Ranking (`getAttendanceRanking`) uses dense ranking (ties share a rank, no gaps).

---

## UX additions (2026-07-04)
- **PWA:** installable via "Add to Home Screen" — see deployment section above for the
  cache/no-store fix.
- **Undoable delete:** deleting a student or session hides it immediately (optimistic UI via
  `pendingDeleteStudentIds`/`pendingDeleteRecordIds`), 5-second "تراجع" toast before the actual
  Firebase delete fires.
- **Loading skeleton:** `dataReady()` gates whether the student list/log show a pulsing
  skeleton or a genuine empty-state.
- **Modal accessibility:** all three modals have `role="dialog"`/`aria-modal`; a generic
  `MutationObserver` moves focus in, Escape closes, Tab is trapped — implemented once,
  generically.
- **Copy button** on the WhatsApp preview (`copyWaMessage()`).
- Viewport no longer blocks pinch-zoom; all field inputs are `font-size:16px` to prevent iOS
  auto-zoom-on-focus as a result.
- Ayah placeholder numerals and all sura/ayah-range display standardized (Latin digits;
  `ayahRange()`/`joinSuraNames()` used consistently — see Session Record section above).

---

## Known code-level gotchas
- **`.save-btn` is not a unique class** — the login screen's submit button and the record
  screen's save button both have it. Always scope to `#screen-record .save-btn` explicitly, or
  `document.querySelector('.save-btn')` silently grabs the login button instead.
- **Toasts have `pointer-events:none` by default.** The undo-toast's button needs
  `.undo-toast.show { pointer-events:auto; }` specifically or it's visible but unclickable.
- Any date formatting must use `localDateStr(d)`, never `.toISOString().slice(0,10)` (reports
  UTC; Egypt is UTC+2/+3, so a session recorded just after midnight would silently save under
  yesterday's date).
- **Any "find the previous/most-recent session" lookup must account for edit mode** — check
  `editingRecordId` and exclude/reorder relative to the record being edited. This bug class has
  now bitten twice (WhatsApp preview, then `onStudentChange`'s own lookup) — if a third such
  lookup is ever added, apply the same guard from the start.
- **Any place that reads `r.loh`/`r.madi` for *sura* info is reading the wrong field** — those
  are evaluation-only (`{score, stars}`) under the current schema. Sura/from/to for the *new*
  assignment lives in `newLoh`/`newMadi` (arrays). This mistake has been found and fixed twice
  now (once in the Apps Script, once in the log's own rendering) — grep for `.loh.sura` or
  `.madi.sura` outside of legacy-fallback branches if this bug class needs auditing again.

## Not implemented / deliberately deferred
- Per-student unique parent-form links (token-based access) — still shows every student to any
  visitor. Deferred by choice; revisit if it becomes a real concern.
- Automatic annual grade promotion — no such logic exists anywhere despite older notes.
- Live-listener performance at scale (`M2`): `.on('value')` reloads the *entire* `records` node
  on every change; fine at current volume.
- Concurrent-edit protection (`M10`): last-write-wins, no version check. Low real risk for a
  small admin team.
- **Multi-mosque/multi-tenant is no longer deferred — see the ACTIVE TASK section at the very
  top of this document.** It was scoped and deprioritized on 2026-07-03, then explicitly
  reactivated by Muhammad on 2026-07-04.

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

// Ayah range / multi-sura display (used in both the WhatsApp message and the log)
function ayahRange(from, to) { return (from && to) ? ' (' + from + '–' + to + ')' : from ? ' (من ' + from + ')' : ''; }
function joinSuraNames(list) {
  const parts = list.map(m => m.sura + ayahRange(m.from, m.to));
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join('، ') + ' و' + parts[parts.length - 1];
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
`*.firebaseio.com` aren't reachable from a sandboxed environment). Key lessons:
1. A mock `firebase` global is served in place of the real gstatic script tags via Playwright
   route interception, backed by `window.__mockDb` with `.on()`/`.set()`/`.update()`/`.remove()`.
2. **Seed data must be injected via `page.add_init_script()` before navigation**, not
   `page.evaluate()` after the fact — the app's one-time self-heal functions
   (`backfillStudentIds`, `mergeGhostNames`) guard against re-running, so if they fire once
   against empty seed data before real test data lands, they never fire again for that load.
3. Give the mock's `set()`/`update()` a small artificial delay (~150ms) so transient UI states
   (disabled buttons, loading labels) are actually observable before Playwright's next
   assertion runs.
4. **Test the specific scenario a user reports, not just the general case.** The original 74
   automated tests all passed, yet two real bugs (`onStudentChange` duplicate-content on
   editing the *latest* session; `newMadi` never displaying) were still live — because no test
   specifically covered "edit the most recent session" or "a record whose newMadi has entries
   but whose legacy `madi` field only holds a score." When Muhammad reports something's wrong,
   write a test that reproduces his exact words before fixing blind.
- 91 assertions across 9 test files as of 2026-07-04 (16+10+7+5+9+17+10+3+5, before the
  ayahRange/newMadi/joinSuraNames fixes added their own suite). None of this is committed to
  the repo (lived in the sandbox only) — rebuilding the harness is the fastest path if
  regression testing is wanted in a future session, not writing one from scratch.

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

---

## Related documents (not in this repo, delivered directly to Muhammad)
- `multi-mosque-architecture-plan.md` (2026-07-03) — full data model, security rules sketch,
  admin-role design, migration steps, Firebase free-tier scale analysis, phased rollout for
  the multi-mosque work described in the ACTIVE TASK section at the top of this document.
