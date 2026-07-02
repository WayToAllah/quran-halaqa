# متابعة حفظ القرآن — Project Context

## Overview
A mobile-first web app for tracking a Quran memorization circle (~50 students).
Single HTML file, no build tools, works in any browser.

**Live URL:** https://mredwan214-code.github.io/quran-halaqa
**GitHub Repo:** https://github.com/mredwan214-code/quran-halaqa (branch `main`)

---

## Tech Stack
- **Frontend:** Vanilla HTML + CSS + JS (single `index.html`)
- **Realtime DB:** Firebase Realtime Database — **single source of truth**, no localStorage anywhere
- **Sheets Sync:** Google Apps Script (fire-and-forget, best-effort logging only — not read from)
- **Hosting:** GitHub Pages
- **Optional lib:** `html2canvas` (CDN) — used only for downloading the "نجوم الحضور" attendance-stars card as a PNG

> **Architecture note:** The app was rebuilt to eliminate multi-device sync bugs. There is
> now exactly one way data enters the UI: a live Firebase `.on('value', …)` listener on
> `students` and `records` that rebuilds the in-memory arrays and re-renders on every change.
> There is no localStorage cache, no merge logic, and no deleted-ID tracking — writes go
> straight to Firebase (`set()`/`remove()`), and the listener does the rest on every device.

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
Note: `quran-app-abe52-default-rtdb.firebaseio.com` is **not** reachable from this sandbox's
network egress allowlist, so Claude cannot query live DB contents directly — only the code
that reads/writes it can be reviewed.

## Google Apps Script URL
```
https://script.google.com/macros/s/AKfycbzw3X51RGVsjg0IhXbD1Tbv0ZZ09bUP8jiM4ufEU3fVRw2Ow3nbQqVosvzeAQId1_zQjQ/exec
```

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
  (via `fbKey()`, which sanitizes `. # $ [ ] /`) and as the reference on records (`studentId`).
- Students are looked up by **name** in most UI code (`getStudentName`), but edit/delete now
  key off `id`, not array index — fixes the old bug where deleting/reordering shifted indices.

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
- **`newLoh` and `newMadi` are now arrays** (multiple suras per session are supported for
  *both* اللوح and الماضي, not just الماضي as before).
- **Key logic (unchanged):** each session stores the **evaluation of the previous task**
  (`loh.score` / `madi.score`) AND the **new task** for next session (`newLoh` / `newMadi`).
  When a student is selected, the app auto-loads their last session's `newLoh`/`newMadi` as
  the items to evaluate today (`onStudentChange`, using `byNewest` sort — see below).
- Tajweed has **no numeric score input in the UI** — only a 5-star rating. `tajweed.score`
  stays `0` in practice; `score-tajweed` is referenced defensively in the JS (`if(el)`/`&&`
  guards) but no such input element exists in the HTML. This is intentional dead code, not a
  bug — harmless, but could be cleaned up later.
- Records are **editable and deletable** from the السجل (Log) screen (`editRecord`/
  `deleteRecord`), writing/removing directly in Firebase.

### Attendance-only Record (legacy)
```json
{
  "id": "att_زيد احمد_2026-06-06",
  "date": "2026-06-06",
  "student": "زيد احمد",
  "attendance_only": true,
  "note": "مستورد من سجل الحضور"
}
```
- These were bulk-imported once (~250 records, one per student per historical attendance day)
  and have **no `loh`/`madi`/`newLoh`/`newMadi` fields at all**.
- The import script and seed data (`IMPORTED_ATTENDANCE`, `DEFAULT_STUDENTS`,
  `importAttendanceIfNeeded`) have since been **removed from `index.html`** — there is no
  code path left that creates new `attendance_only` records. Any that still exist are
  whatever wasn't manually deleted from the Log screen.
- ⚠️ **Because these records are missing `.loh`, any stats code that reads `r.loh.score` or
  `r.loh.stars` without first checking `r.loh &&` will throw for a student who has one of
  these mixed in with real sessions.** One such unguarded access was found and fixed in the
  per-student average calculation inside `renderStats()` (2026-07-02) — see Known Issues.

---

## Screens
| Screen | Purpose |
|--------|---------|
| تسجيل (Record) | Evaluate previous task + assign new task (supports multiple suras per اللوح/الماضي) |
| الطلاب (Students) | Add/edit/delete student profiles; top-70%-attendance badge shown per student |
| السجل (Log) | Last 40 sessions, newest first (by `byNewest`); each session is editable/deletable |
| إحصاءات (Stats) | Summary cards, weekly session bar chart, score distribution, top-3 ayat leaderboard, top attendance leaderboard (ranked, ties share a rank), searchable/sortable per-student detail list, "نجوم الحضور" (attendance stars) share card with WhatsApp share + PNG download |

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
- In-app star display (`renderStarsHTML`) renders true half-fill stars via a clipped overlay span.
- **WhatsApp message text uses whole stars only** (`starsText`) — WhatsApp's half-star glyph
  (`⯨`) renders inconsistently across phones, so the message rounds to the nearest whole star.

---

## Attendance Calculation
- Total halaqa days = unique dates that have ANY record (not fixed days of week), **excluding
  `2026-06-04`** (bonus/makeup day, deliberately excluded from the denominator).
- Attendance % per student = their unique session dates ÷ total halaqa days, capped at 100%.
- Ranking (`getAttendanceRanking`): students are ranked by attendance %, **ties share the same
  rank** (dense ranking, no skipped numbers) — students ≥70% get a badge (👑 / 🥈 / 🥉 / `#n`)
  shown next to their name on the Students screen and in the Stats leaderboard.

---

## Quran Data
- All 114 suras stored in `SURAS` array: `[name, ayat_count]`.
- Search dropdown is ordered reversed (الناس → الفاتحة), filterable by typing.
- Ayah range validated per sura (`validateAyah`) using `suraMap`.

---

## WhatsApp Message (current spec, verified against live code)
- Greeting → `📅 *تقييم <first name> اليوم*` + date → **18-char** `─` separator line
  (shortened for mobile so it doesn't wrap).
- "ما تم تسميعه اليوم" section pulls the **previous session's** `newLoh`/`newMadi` (i.e. what
  was actually assigned last time) and pairs it with today's `loh.score`/`madi.score`.
- Multiple suras in one section are joined Arabic-style via `joinSuraNames()`
  — e.g. `الناس والفلق`, `الناس، الفلق، والإخلاص`. **No "سورة" prefix** anywhere in the
  WhatsApp text (the in-app "ما سمعناه النهارده" preview card still uses the "سورة" prefix
  for readability — that's a different function, `fmtSura`, used only for on-screen display).
- Tajweed section uses stars only (score is always 0 — see Tajweed note above).
- Send button is hidden if the student has no phone number on file (`wa-send-btn` display
  toggled based on `waPhone`).

---

## Known Issues / Recent Fixes
- **[Fixed 2026-07-02]** `renderStats()` per-student average calculation accessed
  `r.loh.score` / `r.loh.stars` without checking `r.loh` exists first. Any student with a
  legacy `attendance_only` record mixed into their session history would crash the entire
  Stats screen (the whole leaderboard + detail list silently failed to render past that
  point). Fixed by filtering with `r.loh && r.loh.score` first, matching the guard pattern
  already used everywhere else in the file. Pushed to `main`.
- No other unguarded `.loh`/`.madi` property accesses were found (all other reads in the
  codebase already use `r.loh && …` / `Array.isArray(r.madi) ? … : (r.madi && r.madi.sura …)`
  guards).
- All `onclick`/`onchange`/etc. handlers in the HTML were cross-checked against defined JS
  functions — no missing handlers found.
- No duplicate function definitions found.
- `node --check` passes on the extracted `<script>` block.

## Not Implemented (despite earlier notes suggesting otherwise)
- **Automatic annual grade promotion (October 1st)** — there is no such logic anywhere in the
  current `index.html` (no date-based grade-bump code, no October/promotion strings at all).
  If this is still wanted, it needs to be built from scratch.
- No Firebase Authentication — the app is fully open (anyone with the URL can read/write).
- No auto-deploy pipeline beyond manual pushes via the GitHub Contents API.
- No Excel/CSV export feature.

---

## Key JS Patterns
```javascript
// Score → half-stars (0–5 in 0.5 steps)
function scoreToHalfStars(score) {
  const s = Math.min(100, Math.max(0, parseInt(score)||0));
  return Math.round(s / 10) * 0.5;
}

// Sortable creation time embedded in the record id (r_<ms>_<rand>)
function recTime(r) { const m = String(r && r.id).match(/^r_(\d+)/); return m ? Number(m[1]) : 0; }

// Newest first: latest date, then latest creation time on same-day ties
function byNewest(a, b) {
  const da = a.date || '', dbb = b.date || '';
  if (da !== dbb) return da < dbb ? 1 : -1;
  return recTime(b) - recTime(a);
}

// Firebase keys can't contain . # $ [ ] / — sanitize before using as a key
function fbKey(id) { return String(id).replace(/[.#$\[\]\/]/g, '_'); }

// Total halaqa days (excludes the 2026-06-04 bonus day)
const totalHalaqaDays = new Set(
  records.map(r => r.date).filter(d => d && d !== '2026-06-04')
).size;

// Get student name (supports both legacy string and object shapes)
function getStudentName(s) { return typeof s === 'string' ? s : s.name; }

// Firebase save pattern — direct set() by sanitized id, no push()/merge
function saveRecordToFirebase(rec) {
  return db.ref('records/' + fbKey(rec.id)).set(rec);
}
function saveStudentToFirebase(student) {
  return db.ref('students/' + fbKey(student.id)).set(student);
}
```

---

## Pending Features
- [ ] Firebase Authentication (email/password login) — DB is currently open-read/open-write
- [ ] Automatic annual grade promotion (October 1st) — not implemented, was previously
      assumed done but isn't in the code
- [ ] Export sessions to Excel/CSV
- [ ] Clean up vestigial `score-tajweed` references (harmless but unused)

---

## Students List (50 students, as of last known roster)
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

> This roster is now managed live in Firebase (`students` node) via the الطلاب screen — this
> list is a point-in-time reference, not the source of truth.
