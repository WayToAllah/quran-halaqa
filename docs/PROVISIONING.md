# Provisioning workflow — MANUAL SETUP REQUIRED

The deploy token used by the assistant is **Contents-only**: it cannot write to
`.github/workflows/` and cannot dispatch workflows. So this one file has to be
added by hand, once.

## Step 1 — add the workflow file

Create `.github/workflows/provision.yml` on the `rebuild-v2-multitenant`
branch (GitHub web UI → Add file → Create new file) with exactly this content:

```yaml
name: Provision mosques & halaqat

on:
  workflow_dispatch:
    inputs:
      config_json:
        description: 'Provisioning config (JSON). See provision.example.json'
        required: true
      dry_run:
        description: 'Dry run (no writes)? true or false'
        required: true
        default: 'true'
      deploy_rules:
        description: 'Also deploy firestore.rules first? true or false'
        required: true
        default: 'false'

jobs:
  provision:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci

      - name: Write service account credentials
        env:
          SERVICE_ACCOUNT_JSON: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
        run: printf '%s' "$SERVICE_ACCOUNT_JSON" > /tmp/service-account.json

      - name: Deploy Firestore rules
        if: ${{ github.event.inputs.deploy_rules == 'true' }}
        env:
          GOOGLE_APPLICATION_CREDENTIALS: /tmp/service-account.json
        run: npx firebase deploy --only firestore:rules --project quran-app-abe52 --non-interactive

      - name: Write provisioning config
        env:
          CONFIG_JSON: ${{ github.event.inputs.config_json }}
        run: printf '%s' "$CONFIG_JSON" > /tmp/provision.json

      - name: Provision
        env:
          GOOGLE_APPLICATION_CREDENTIALS: /tmp/service-account.json
          DRY_RUN: ${{ github.event.inputs.dry_run }}
        run: |
          ARGS="--config /tmp/provision.json"
          if [ "$DRY_RUN" = "true" ]; then
            ARGS="$ARGS --dry-run"
          fi
          npx tsx scripts/provision-mosque.ts $ARGS
```

## Step 2 — run it

Actions tab → "Provision mosques & halaqat" → **Run workflow**, and make sure
**"Use workflow from"** is set to `rebuild-v2-multitenant` (not `main` — only
this branch has the script).

Recommended first run:

| input | value |
|---|---|
| `config_json` | paste your config (see `provision.example.json`) |
| `dry_run` | `true` |
| `deploy_rules` | `true` |

That deploys the `admins/{uid}` rule and prints exactly what *would* be
written, without touching any data. Read the log, confirm it looks right, then
run it again with `dry_run = false`.

## Notes

- The config is passed as a workflow input, so UIDs never get committed.
- The script is idempotent (merge-writes by id) and never deletes anything,
  so re-running is safe.
- It never touches `students` or `records`.
