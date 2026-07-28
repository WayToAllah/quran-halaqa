# متابعة حفظ القرآن — Project Reference

Mobile-first Quran memorization circle (halaqa) tracker for ~50 students at مسجد التيسير.
This document describes the project **as it currently stands** — a reference for future
development work, not a changelog.

**Two parallel versions are live and in use — read §0 first.**

**Repo:** https://github.com/WayToAllah/quran-halaqa
(migrated from the old `mredwan214-code` account; old URLs are dead.)
**Live site:** https://waytoallah.github.io/quran-halaqa/
**Firebase project:** `quran-app-abe52` · **Mosque ID:** `altayseer` · **Halaqa ID:** `main`

> **Operational note:** The GitHub deploy token, Google Apps Script shared secret, and any
> other credentials are **never stored in this file** (it lives in the repo). A session that
> needs to push commits or run scripts must be given a working token/secret fresh.

---

## 0. The two versions (important)

| | Production (`main`) | Rebuild (`rebuild-v2`) |
|---|---|---|
| Stack | Single-file `index.html`, vanilla JS | TypeScript + Preact + Vite + Tailwind v4 |
| Data | Firebase **Realtime Database (RTDB)** | Firebase **Firestore** |
| Status | **Still the live admin system** | Strategic future; deployed additively at `/v2/` |
| Parent page | `child.html` (RTDB) | `child.html` (Firestore REST, `?t=` token) |

- **Production** (`index.html` on `main`, RTDB) is what the halaqa is actually run on today.
- **v2** (`rebuild-v2`, Firestore) is deployed alongside production at
  `https://waytoallah.github.io/quran-halaqa/v2/`. It is a full rewrite, not a port.
- **The two do NOT auto-sync.** Production writes to RTDB; v2 writes to Firestore. Moving data
  between them is a manual script run (see §9). Decide which app is the working system at any
  given time to avoid divergence.
- **The two have already diverged on product behaviour, not just stack** — e.g. §5's scoring
  bands and §5's parent-attendance formula. Don't assume a rule holds on both sides just
  because it used to be a straight port; check which app you're actually editing.

### Golden rules for any work
- **Never touch root production files** (`index.html`, `sw.js`, `manifest.json`, `child.html`
  at root, icons) unless the task is explicitly a production change. All v2 work is additive
  under `/v2/` or on the `rebuild-v2` branch.
- **All `main` writes require explicit approval** before executing; narrate what will and
  won't change first.
- **Guarded Trees API deploy is mandatory:** always set `base_tree` to the current branch
  tip's tree SHA when building a commit. Omitting it silently wipes unspecified files
  (including `.github/workflows/`). After building a tree, verify the blob count and that key
  files are still present *before* moving the ref.
- **Verify deploys via raw content URLs** (`raw.githubusercontent.com`), not the Pages builds
  API (which lags). Confirm new assets are present and old/stale assets return 404.
- **The fine-grained PAT is Contents-only** for this repo. It **cannot** write
  `.github/workflows/` paths and **cannot** dispatch workflows (needs `actions: write`).
  Workflow file edits and "Run workflow" clicks must be done by the human.
- **This file itself lives on `main`** (not `rebuild-v2`) and isn't in the protected-root list
  above — it's documentation, not a served asset. It still needs explicit approval like any
  other `main` write, and a fresh pull before editing: a stale attached copy in a chat/project
  is not a substitute for `raw.githubusercontent.com`.

---

## 1. Data migration state (RTDB → Firestore)

**Status: initial migration + cleanup COMPLETE.** As of the last migration run, Firestore
mirrors the live RTDB exactly: **53 students, 322 records** (plus publicStats). 28 stale/test
records that existed only in Firestore (v2 test writes on 1/5/10/14 July — group-attendance
dupes and "احمد حسام" test sessions) were pruned. RTDB was never written to during any of this.
Re-run the forward migration before trusting this count if production has taken new writes
since.

**Target Firestore shape:**
```
mosques/{mosqueId}
  members/{adminUid}         → { role: 'owner' }
  halaqat/{halaqaId}
    students/{studentId}     ← same id, same fields as RTDB
    records/{recordId}       ← same id, same fields as RTDB
publicStats/{token}          ← top-level, same token, same fields
```
Student/record IDs and `parentToken`s are preserved **exactly**, so every `child.html?t={token}`
link already sent on WhatsApp keeps working once an app reads Firestore.

**Scripts (on `rebuild-v2`, run via GitHub Actions — cannot run from the dev sandbox because
Firebase isn't network-reachable there):**
- `scripts/migrate-rtdb-to-firestore.ts` — forward RTDB → Firestore. Idempotent (`set()` by
  id). Flags: `--dry-run` (reads live + reconciles, writes nothing; also lists Firestore
  records absent from RTDB and dumps live RTDB records on the same dates for ID comparison),
  `--prune` (preview extras to delete), `--prune --confirm` (actually delete extras — records
  collection only, never students/publicStats). Verifies counts at the end.
- `scripts/restore-firestore-to-rtdb.ts` — **reverse** Firestore → RTDB (fallback path so v2
  work can be brought back to the old app). The ONLY script that writes to live RTDB, so it is
  deliberately conservative: **non-destructive upsert by default** (never deletes from RTDB);
  `--dry-run` previews; `--prune --confirm` for an explicit mirror. Uses a byte-parity `fbKey()`
  matching the production app so the old app can read what it writes. **A workflow to run this
  does not exist yet** — needs to be added when first needed.
- Shared pure helpers (domain layer, unit-tested): `src/domain/migrationDiff.ts`
  (`idsOnlyInTarget`/`idsOnlyInSource`), `src/domain/rtdbKey.ts` (`fbKey`).

**Workflow:** `.github/workflows/migrate.yml` (lives on both branches; run it with "Use
workflow from: `rebuild-v2`" so the checkout has the build tooling — `main` has no
`package.json`). Inputs: `admin_uid`, `dry_run`, `prune`, `deploy_rules`. When `dry_run=false`
and `prune=true` it passes `--prune --confirm`. The `FIREBASE_SERVICE_ACCOUNT` repo secret is
already configured. Admin UID currently in use: `Hpbu8Nl3NsYAy2WDOVp53b1Y64e2`.

---

## 2. Production tech stack (`main`)

| Layer | Choice |
|---|---|
| Frontend | Vanilla HTML/CSS/JS, single `index.html` (~2000 lines) |
| Data | Firebase Realtime Database — sole source of truth, no localStorage |
| Auth | Firebase Authentication — Email/Password (admin), Anonymous (parent page) |
| External sync | Google Apps Script → Google Sheets (write-only logging) |
| Hosting | GitHub Pages (auto-deploy on push to `main`) |
| PWA | `manifest.json` + `sw.js`, branded icons in `icons/` |
| Optional | `html2canvas` (CDN) — renders the "نجوم الحضور" share card to PNG |

**Files on `main`:** `index.html` (admin app), `child.html` (read-only parent page),
`manifest.json`, `sw.js`, `icons/*`, `BRD.html` (informational), `PROJECT_CONTEXT.md`.
`.github/workflows/migrate.yml` also lives here, plus the deployed `/v2/` build output.

---

## 3. Production architecture & security

One data path: a live `.on('value', …)` listener on `students`/`records` rebuilds in-memory
arrays and re-renders on every change, on every device. All writes go straight to Firebase
(`set()`/`update()`/`remove()`). Sync starts only after a signed-in admin session is confirmed
(`init()`/`startSync()` inside `firebase.auth().onAuthStateChanged`, behind `#login-screen`).

`publicStats` is fully derived from `students`/`records` by the admin app itself —
`recomputePublicStats()` runs (debounced) every time the live listeners fire, rebuilding every
student's summary from scratch and pruning entries for students that no longer exist.
`child.html` never talks to `students`/`records` directly; it only reads its own
`publicStats/{token}` node.

- **Admin app:** email/password login required; new admins added in Firebase Console. Logout
  via 🚪 in the header.
- **Parent page:** signs in anonymously; shows a student view. (Historical `parent-form.html`
  showed every student to any visitor — both `child.html`s today use a per-student `?t=` token.)
- **RTDB rules:** `{".read":"auth != null",".write":"auth != null"}` on `students`/`records`;
  `publicStats/$token` is `{".read": true, ".write": "auth != null"}` — public read of one
  specific token path, write still admin-only. Any authenticated user can still read/write all
  of `students`/`records`; fine for a single halaqa, would need per-mosque/role rules for
  multi-tenant (see §10).
- **XSS:** all user-input values pass through `esc()` before `innerHTML`; the fixed 114-entry
  `SURAS` constant is the only intentionally-unescaped source.
- **Apps Script endpoint:** requires a shared secret (`SHEETS_SECRET` in `index.html` vs
  `SHARED_SECRET` in the Apps Script project).
- **`CHILD_STATS_BASE_URL`** is a hardcoded absolute URL constant in `index.html`
  (`https://waytoallah.github.io/quran-halaqa/child.html`), used to build every student's
  parent link. It does **not** derive from `location.origin` — if the Pages domain ever
  changes again, this constant needs a manual update or new links point at a dead URL.

---

## 4. Data model (shared shape, RTDB and Firestore)

### Student
```json
{ "id": "s_...","name":"...","age":"12","grade":"...","school":"...",
  "phoneType":"أم","phonePrimary":"01...","phoneSecondary":"01...","parentToken":"..." }
```
`id` is generated (`genId('s')`), used as the DB key (via `fbKey()`) and as the `studentId`
records point to. All student↔record matching goes through `studentId`, never the name.
`parentToken` is minted once (`genParentToken()`, ~118 bits of entropy) and never changes —
it's the `?t=` query param in that student's `child.html` link.

### Session Record
```json
{ "id":"r_...","studentId":"s_...","date":"2026-06-29","student":"زيد احمد",
  "loh":{"score":90,"stars":4}, "madi":{"score":85,"stars":4},
  "newLoh":[{"sura":"البقرة","from":"1","to":"10"}],
  "newMadi":[{"sura":"الفاتحة","from":"1","to":"7"}],
  "tajweed":{"sura":"البقرة","from":"1","to":"5","score":0,"stars":5,"note":""},
  "note":"..." }
```
- `loh`/`madi` = **evaluation of the previous session's assignment** (`score` is `null` when
  not evaluated — distinct from a genuine 0 "إعادة"). `student` is a display snapshot;
  `studentId` is authoritative.
- `newLoh`/`newMadi` = **this session's new assignment** (arrays; multi-sura allowed).
  `tajweed` optional, self-contained.
- Sura/range for the *new* assignment lives only in `newLoh`/`newMadi`; `loh`/`madi` are
  evaluation-only (`{score, stars}`).

### Attendance-only Record
```json
{ "id":"att_...","studentId":"s_...","student":"...","date":"...","attendance_only":true,"note":"" }
```
Created individually or in bulk via "✅ تسجيل حضور جماعي".

### Public Stats (`publicStats/{parentToken}`)
Entirely derived, never hand-edited — the payload `child.html` reads. Shape differs slightly
between the two apps (v2 adds a few fields; see §5 for the attendance-percentage difference
specifically). Both versions strip phone numbers from this node (privacy — publicly readable).

---

## 5. Scoring & attendance

**Score bands — production and v2 have diverged:**

| | 5⭐ / ممتاز | 4⭐ / جيد جداً | 3⭐ / جيد | 2⭐ / مقبول | 0⭐ / إعادة |
|---|---|---|---|---|---|
| Production (`scoreName` in `index.html`) | 85+ | 75+ | 65+ | 50+ | else |
| v2 (`scoreName`/`scoreToStars` in `scoring.ts`, since 2026-07-27) | 90+ | 80+ | 70+ | 60+ | else |

- Production stars are continuous (`round(score/10) * 0.5`, 0–5 in half-star steps) and don't
  always agree with the label next to them (a 90 could read "ممتاز" but draw 4.5 stars).
- v2 stars are computed by `scoreToStars()` from the **same** band cut-offs as `scoreName()` —
  whole stars only, tied to the band by construction, so label/stars/colour never disagree.
  `EXCELLENCE_SCORE_THRESHOLD` (v2, 90) and production's equivalent (85) moved together with
  their respective bands, each still meaning "top band = ممتاز" on its own side.
- `hasScore(o) = !!o && o.score != null` on both sides — 0 is a real "إعادة" grade, not "unset".

**Attendance — the admin/ranking number and the parent-facing number are no longer the same
calculation in v2:**

- **Admin ranking & stats screen (both versions unchanged):** total halaqa days = unique dates
  with any record, excluding `EXCLUDED_HALAQA_DATES` (currently `['2026-06-04']`). Per-student
  % = their unique session dates ÷ **that halaqa-wide total**, capped at 100. This is what
  `rank` is based on (dense ranking — ties share a rank, no gaps) and what the "نجم الحضور"
  badge threshold (70) is checked against. Every student is measured on the same calendar here
  on purpose — a leaderboard only makes sense on one shared scale.
- **v2 parent page only (`child.html`, since 2026-07-28):** `attendPct` instead divides by the
  halaqa days **from that student's own first recorded date onward**
  (`enrolledHalaqaDates()`/`firstRecordDate()` in `src/domain/attendance.ts` — an
  attendance-only mark counts as a start date). A student who joined mid-year is no longer
  counted absent for halaqa days before he existed in the system. The new denominator is
  published explicitly as `enrolledHalaqaDays` alongside the still-published, halaqa-wide
  `totalHalaqaDays` (which stays as `rank`'s basis and nothing else). `monthlyStats` follows
  suit — months that ended before the student's first record don't appear at all, rather than
  showing a flat 0%.
- **Production (`index.html`/`child.html` on `main`) does not have this distinction** — its
  parent page still divides by the halaqa-wide total, same as its own admin ranking. Porting
  the v2 behaviour back to production, if ever wanted, is a separate decision.
- Every 10 points = half a star (production only, see above); "نجم الحضور" badge threshold =
  `ATTENDANCE_BADGE_THRESHOLD` (70) on both sides.

---

## 6. Production core patterns (before editing `index.html`)

- **Matching:** prefer stable `studentId`; fall back to name only for pre-`studentId` records.
- **Display name:** resolve via `studentId` to the CURRENT name; fall back to the record's
  captured name if the student was deleted.
- **Local date:** `localDateStr` offsets by timezone before `toISOString().slice(0,10)` (Egypt
  is UTC+2/+3, else late-night sessions roll to the previous day).
- **`fbKey(id)`:** `String(id).replace(/[.#$[\]\/]/g,'_')` — RTDB key sanitizer. v2's
  `src/domain/rtdbKey.ts` is byte-for-byte identical (used by the restore script).
- **"Previous/most recent session"** lookups must exclude the record being edited and only
  consider strictly-earlier records (`byNewest(r, editingRec) > 0`).
- **`.save-btn`** is shared (login submit also has it) — scope to `#screen-record .save-btn`.
- **Toasts** are `pointer-events:none` by default; interactive toasts (undo) need
  `pointer-events:auto` on their own `.show` state.

---

## 7. v2 architecture (`rebuild-v2`)

- **Stack:** TypeScript + Preact + Vite + Tailwind v4 + Firestore. Two entry points:
  `index.html`→admin app, `child.html`→public read-only parent page.
- **Discipline:** no Firebase imports in the domain layer; Repository pattern for all data
  access (`src/data/*.repo.ts`). Everything must pass typecheck + full test suite before commit.
- **Parent page** uses the Firestore **REST** API (keeps the bundle ~14KB gzip vs ~200KB with
  the SDK). Parent page is **strictly read-only** (zero writes) and uses `?t=` token convention.
- **publicStats:** Firestore write is restricted to `isMosqueMember('altayseer')` (not merely
  signed-in — Anonymous auth + email self-signup would otherwise mean "anyone"). Transitional;
  Phase 5 moves the write to a Cloud Function and flips to `write: if false`.
  `republishPublicStatsFor` uses a ref-counted shared session cache
  (`halaqaCache.ts` / `getCachedHalaqaSnapshot()`) instead of full-collection re-reads. It only
  runs when a save/delete/bulk-attendance write triggers it — there is no "republish everyone"
  action, so a stale parent page (e.g. after a formula change) self-heals at that student's next
  save, or immediately for everyone marked in the next group-attendance run.
- **Tests:** Vitest — unit (`src/**/*.test.ts`, 386 tests) + component
  (`vitest.components.config.ts`, Firebase mocked, 193 tests) + rules (`firestore.rules.test.ts`
  via emulator, not runnable from this sandbox). All green as of `rebuild-v2@7ad4518`. CI runs
  on `rebuild-v2` pushes. Java 21+ required by current firebase-tools.
- **Bundles:** admin (`main-*.js`), parent (`child-*.js`), suras chunk, css. Verify live via
  raw URLs after deploy.

---

## 8. Feature parity: production features NOT yet in v2

Recent production (`index.html`/`child.html`) features that would need to be **rewritten** in
v2 (TS/Preact) — not ported:

- **Hijri (Umm al-Qura) date** (`7120f04`) — production shows Hijri as primary alongside
  Gregorian. **Missing in v2** (v2 has Gregorian `localDateStr` only).
- **Whole-sura range mode "🔗 نطاق سور"** (`a818f6a`) — assign "from sura X to sura Y" (whole
  suras, no ayah numbers), stored as `{sura, toSura, range:true}`. **Missing in v2** (v2
  `SuraAssignment` is `sura + from/to` only).
- **Sura ranges displayed in entry order, not mushaf order** (`e8e9a40`) — *needs verification*
  in v2.
- **Parent page: separate today's evaluation from the new assignment + render sura ranges**
  (`59e1f6d`, on `child.html`) — *needs verification* in v2 (depends on the publicStats
  projection).
- **Auto-fill new loh/madi from the student's last session** (`089eab3`) — **already in v2**
  (via `usePreviousSession`). No work needed.

The reverse also now holds and is worth tracking explicitly: **v2's parent-facing attendance
window (§5) and its regraded score bands (§5) are v2-only improvements not present in
production.** Whether either gets ported back is an open product decision, not an oversight.

---

## 9. Deployment notes

- GitHub Pages auto-deploys on push to `main`. The deploy step is occasionally flaky at the
  platform level; retrigger with a fresh commit. Confirm success via the deployment's own
  status history ending in `success` (existence ≠ success), and via raw content URLs.
- Guarded Trees API deploy pattern: `GET /git/ref` → `GET /git/commits/{sha}` for `base_tree`
  → `POST /git/blobs` (write JSON payload to a temp file; use `--data-binary @file` and build
  the payload with a real Python script, not fragile inline one-liners) → `POST /git/trees`
  with `base_tree` (use explicit `null` sha for deletions) → verify blob count/key files →
  `POST /git/commits` → `PATCH /git/refs/heads/{branch}`.
- Sandbox reaches GitHub + npm/pip only; **not** Firebase/Google, and not
  `waytoallah.github.io` itself (proxy blocks the Pages domain even for production URLs — a
  403 there is not a deploy signal either way). So: Firebase reads/writes and migrations run
  via GitHub Actions; deploy verification uses `raw.githubusercontent.com` + the Pages
  builds/deployments API; UI verification uses headless Chromium at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome --no-sandbox`.
- The production service worker uses `{cache:'no-store'}` navigation to bypass Pages HTTP
  caching (true network-first).

---

## 10. On the horizon / not implemented

- **Cutover from production RTDB to v2 Firestore** — parallel-running now; a final decision on
  which becomes the system of record is pending. Re-run the forward migration just before any
  cutover to catch changes made in production since the last sync.
- **Restore workflow** for `restore-firestore-to-rtdb.ts` (not created yet).
- **Multi-mosque / multi-tenant** — v2's `mosques/{id}/halaqat/{id}/…` hierarchy is the
  foundation; rules are single-tenant (`altayseer`) today.
- **Cloud Function for publicStats** (Phase 5) — removes client writes entirely.
- **Tajweed mistake-type tags** — needs a product decision (schema change) first.
- **Photo upload for student avatars** — needs Firebase Storage + privacy handling for public
  parent tokens.
- **Restore deleted student "زيد"** with his original id so historical records re-link.
- **Per-family parent scoping** already exists in v2 (`?t=` token); the old `parent-form.html`
  did not scope.
- **Automatic annual grade promotion**, **query-based pagination**, **concurrent-edit
  protection** — none implemented (last-write-wins is accepted for a few admins).
- **Decide whether v2's regraded score bands and enrollment-window parent attendance (§5) get
  ported back to production**, or production stays on its original formulas until cutover.

---

## 11. Reference data

**Firebase project:** `quran-app-abe52` (RTDB + Firestore + Auth: Email/Password + Anonymous).
**Mosque:** `altayseer` (مسجد التيسير) · **Halaqa:** `main` (الحلقة الرئيسية).
Student roster (~53) lives in the DB; Firebase is the source of truth, not this file.

**Useful external resource:** `zonetecde/mushaf-layout` — per-page Quran layout data;
`verseRange` field is reliable for detecting sura starts.
