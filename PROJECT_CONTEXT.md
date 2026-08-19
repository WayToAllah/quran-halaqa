# متابعة حفظ القرآن — Project Reference

Mobile-first Quran memorization circle (halaqa) tracker, ~50 students, مسجد التيسير.
State-of-the-world reference, not a changelog.

**Repo:** `WayToAllah/quran-halaqa` · **Live:** https://waytoallah.github.io/quran-halaqa/
**Firebase:** `quran-app-abe52` · **Mosque:** `altayseer` · **Halaqa:** `main`

> Credentials (GitHub PAT, Apps Script secret) are **never** in this file — it lives in the
> repo. A session that needs to push must be given a token fresh.

---

## 0. Golden rules

1. **`main` is frozen production.** Never touch `index.html`, `child.html`, `sw.js`,
   `manifest.json`, `icons/` unless the task is an explicit production change. All active
   work is on `rebuild-v2` / under `/v2/`.
2. **Every write to `main` needs explicit approval first.** Narrate what will and won't
   change before executing.
3. **`base_tree` is non-negotiable** in Trees API deploys. Omitting it silently wipes
   unspecified files, including `.github/workflows/`.
4. **Verify deploys via the git API** (`/git/trees` + `/git/blobs`), not
   `raw.githubusercontent.com` (cached) and not the Pages builds API (lags).
   A deployment record existing ≠ success.
5. **Accuracy in Quran rendering is a hard requirement (خط أحمر).** Every Mushaf data
   source is verified against an independent reference before use.
6. **One feature at a time**, no guessing, no unrequested work.
7. **Token economy:** read narrow line ranges, use small `str_replace` anchors, never load
   whole large files.

---

## 1. The three deployed surfaces

| Path | Branch | Stack | Data | Status |
|---|---|---|---|---|
| `/` | `main` | single-file vanilla JS | RTDB | live system, **frozen** |
| `/v2/` | `rebuild-v2` | TS + Preact + Vite + Tailwind v4 | Firestore | active development |
| `/mushaf/` | `main` | standalone page viewer | static JSON | active development |

The two apps **do not auto-sync** — production writes RTDB, v2 writes Firestore. Moving data
between them is a manual script run (§5).

---

## 2. Data model (shared by RTDB and Firestore)

```
mosques/{mosqueId}
  members/{adminUid}      → { role: 'owner' }
  halaqat/{halaqaId}
    students/{studentId}
    records/{recordId}
publicStats/{token}       ← top-level
```

IDs and `parentToken`s are identical across both stores, so every `child.html?t={token}` link
already sent on WhatsApp keeps working. **Parent links must never change** — token rotation
was explicitly rejected.

**Student:** `{ id, name, age, grade, school, phoneType, phonePrimary, phoneSecondary, parentToken }`

**Session record:**
```json
{ "id":"r_…","studentId":"s_…","date":"2026-06-29","student":"زيد احمد",
  "loh":{"score":90,"stars":4}, "madi":{"score":85,"stars":4},
  "newLoh":[{"sura":"البقرة","from":"1","to":"10"}],
  "newMadi":[{"sura":"الفاتحة","from":"1","to":"7"}],
  "tajweed":{"sura":"…","from":"1","to":"5","score":0,"stars":5,"note":""},
  "note":"…" }
```
- `loh`/`madi` = **evaluation of the previous session's assignment**. `score: null` means
  not evaluated — distinct from a real 0 (إعادة). Test: `hasScore(o) = !!o && o.score != null`.
- `newLoh`/`newMadi` = **this session's new assignment** (arrays, multi-sura allowed).
  Sura/range lives only here; `loh`/`madi` are evaluation-only.
- `studentId` is authoritative; `student` is a display snapshot.

**Attendance-only record:** `{ id:"att_…", studentId, student, date, attendance_only:true, note }`

**Memorization order:** الفاتحة first, then descending ١١٤ → ٢ for loh; ascending mushaf
order for madi.

---

## 3. Scoring & attendance

| Score | Label | Stars |
|---|---|---|
| 90+ | ممتاز | 5 |
| 80–89 | جيد جداً | 4 |
| 70–79 | جيد | 3 |
| 60–69 | مقبول | 2 |
| <60 | إعادة | 0 |

- إعادة assignments are excluded from آية مُسمّعة counts and from the page leaderboard.
- Only `newLoh` (not الماضي revision) counts toward distinct memorized pages.
- Halaqa days = unique dates with any record, minus `EXCLUDED_HALAQA_DATES` (`['2026-06-04']`).
- Attendance % = unique session dates ÷ halaqa days, capped at 100. "نجم الحضور" ≥ 70.
  Ranking is dense (ties share a rank, no gaps).
- `arabicPlural()` in `text.ts`: صفحة واحدة / صفحتين / ٥ صفحات / ١٢ صفحة.

---

## 4. v2 architecture (`rebuild-v2`)

- TS + Preact + Vite + Tailwind v4 + Firestore. Entries: `index.html` (admin),
  `child.html` (public parent page).
- **No Firebase imports in the domain layer.** Repository pattern for all data access
  (`src/data/*.repo.ts`).
- Parent page uses the Firestore **REST** API (~14 KB gzip vs ~200 KB with the SDK) and is
  **strictly read-only**.
- `persistentLocalCache` (IndexedDB) enabled, guarded for environments without it.
- `publicStats` write is restricted to `isMosqueMember('altayseer')`. Transitional — Phase 5
  moves it to a Cloud Function and flips to `write: if false`.
- `republishPublicStatsFor` is **fire-and-forget** with a ref-counted session cache
  (`halaqaCache.ts`); corrected values propagate gradually. A batch republish tool is needed.
- `commitPendingSave` uses an 8s `raceTimeout` and WhatsApp dispatches regardless of write
  confirmation — **successful WhatsApp ≠ guaranteed persisted record.**
- Student deletion is removed from the UI; `deleteStudent()` survives for scripts only.
- `HIDDEN_BADGE_KEYS` in `src/domain/badges.ts` suppresses `ayat100`/`ayat200` pending
  rework; `ayat500` is active.
- `src/domain/pages.ts`: 604-page Madinah table, `completedPages()`, `computeTopPages()`.

**Full gate before every commit:**
`npm run typecheck` → `npm run test` → `npm run test:components` → `npx prettier --check`
→ production build. **Red-before-green always** — confirm the test fails, then fix, then
confirm it passes.

---

## 5. Migration tooling

**Status: complete.** Firestore mirrors live RTDB (53 students, 322 records + publicStats).
28 Firestore-only test records were pruned. RTDB has never been written to by the forward path.

- `scripts/migrate-rtdb-to-firestore.ts` — forward, idempotent. `--dry-run` reconciles,
  `--prune --confirm` deletes extras (records only).
- `scripts/restore-firestore-to-rtdb.ts` — reverse, the **only** script that writes live
  RTDB. Non-destructive upsert by default. **No workflow exists for it yet.**
- Helpers: `src/domain/migrationDiff.ts`, `src/domain/rtdbKey.ts` (`fbKey`, byte-identical
  to production's).
- `.github/workflows/migrate.yml` — run with **"Use workflow from: `rebuild-v2`"** (`main`
  has no `package.json`). Inputs: `admin_uid`, `dry_run`, `prune`, `deploy_rules`.
  Admin UID: `Hpbu8Nl3NsYAy2WDOVp53b1Y64e2`.

---

## 6. Mushaf viewer (`/mushaf/`)

Standalone page viewer with a teacher-facing mistake counter. QCF **V4** fonts (47 files,
~36 MB) + coordinate-based line placement. `mushaf/data/` holds all 604 pages.

- **V2 glyph codes are corrupt** on 25/604 pages — V4 from `MohamadHajjRabee/quran-qcf4`
  was verified against `risan/quran-json` (1,005 verses, zero consonant-skeleton diffs).
- Join glyphs **directly, not space-separated** — brings the gap-to-line-height ratio from
  0.31 to 0.08, matching the printed Mushaf.
- `sw.js` excludes `/mushaf/` from the admin app-shell cache. `navigateFallbackDenylist`
  regex must account for query strings (`?t=TOKEN`) — a `$` anchor won't match, because
  Workbox tests `pathname + search` combined.
- **Outstanding:** deploy the local build containing `startEmbedded()` + URL-parameter
  parsing, so the viewer opens directly on the student's ward instead of a selection screen.

---

## 7. Feature parity gaps (in production, not yet in v2)

Must be **rewritten** in TS/Preact, not ported:

- **Hijri (Umm al-Qura) date** — confirmed missing.
- **Whole-sura range mode "🔗 نطاق سور"** — `{sura, toSura, range:true}`; confirmed missing.
- **Sura ranges in entry order, not mushaf order** — needs verification.
- **Parent page: evaluation separated from new assignment** — needs verification.
- *(Auto-fill from last session via `usePreviousSession` is already in v2.)*

---

## 8. Deployment

Guarded Trees API sequence (no `git push`, no CLI):
`GET /git/ref` → `GET /git/commits/{sha}` for `base_tree` → `POST /git/blobs` → `POST /git/trees`
with `base_tree` (explicit `"sha": null` for deletions) → **verify recursive tree diff**
(zero missing files, only expected additions, nothing outside the target prefix, root
sentinel files byte-identical) → `POST /git/commits` → `PATCH /git/refs/heads/{branch}` →
poll deployment status → verify via git API.

- **Stale hashed assets in `v2/assets/` must be explicitly deleted** — Vite rehashes every
  build and bundles accumulate.
- Write blob payloads with a real Python script, `--data-binary @file`; not inline one-liners.
- Unicode-heavy Arabic files: read via `/git/blobs/{sha}` + base64 decode.
- Pages deploys are occasionally flaky; retrigger with a fresh commit.
- **The PAT is Contents-only.** It cannot write `.github/workflows/` and cannot dispatch
  workflows. Those are manual, human-side actions.
- The sandbox reaches GitHub + npm/pip only — **not Firebase/Google**. Firebase operations
  run through GitHub Actions. UI checks use headless Chromium at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome --no-sandbox`
  (430×932, `deviceScaleFactor` 2, mobile true; wait 2500 ms for fonts).
  Live testing is preferred over screenshots where possible.
- Tajawal does not load during SVG→PNG export — use the base64-embedded font subset.

---

## 9. On the horizon

- Deploy the local Mushaf build (`startEmbedded()` + URL params).
- Close the §7 parity gaps.
- **Juz/ayat memorization card + completion celebration** — pending decisions: (a) whether to
  add a "memorized before enrollment" baseline field; (b) how to handle the "next juz" bar
  stalling (21 of 30 juz boundaries fall mid-sura; worst case ~2 months frozen). Options:
  track the juz that moved last session / aggregate-only progress / current-sura progress.
- Restore `ayat100` + `ayat200` badges once award logic is reworked (just remove the keys).
- Attendance stars card design direction (parchment / podium / night-sky). Supports both
  4:5 poster (1080×1350) and 9:16 story (1080×1920).
- Batch republish tool for `publicStats`.
- Restore workflow for `restore-firestore-to-rtdb.ts`.
- Cutover decision: which app becomes the system of record. Re-run the forward migration
  immediately before any cutover.
- Cloud Function for `publicStats` (Phase 5).
- Deferred: student lifecycle / "الحفظة والناشئين" grouping, multi-tenant rules, tajweed
  mistake-type tags, avatar upload, annual grade promotion, pagination, concurrent-edit
  protection.
- Dead weight in the repo: `v2-preview/` (11 files, 750 KB) is an old deploy with **zero**
  inbound references — safe to delete.

---

## 10. Production internals (only if a production change is ever needed)

`main` is a single 180 KB `index.html`: vanilla JS, RTDB via one live `.on('value')`
listener, Firebase Auth (email/password admin, anonymous parent), Apps Script → Sheets
write-only logging, PWA. RTDB rules are `auth != null` for both read and write. All
user input passes `esc()` before `innerHTML`.

Gotchas if editing it: `localDateStr` offsets by timezone before `toISOString().slice(0,10)`;
"previous session" lookups must exclude the record being edited and consider only strictly
earlier records; `.save-btn` is shared with login, so scope to `#screen-record .save-btn`;
toasts are `pointer-events:none` unless the `.show` state overrides it.

**Read narrow line ranges only. Never load the whole file.**
