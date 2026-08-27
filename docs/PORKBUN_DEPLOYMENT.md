# NOVELLE — Porkbun Deployment Automation

## Goal

`main` is the source branch. Every successful push to `main` builds NOVELLE and publishes only the compiled `dist/` files to the `production` branch. Porkbun Static Hosting should be connected to the `production` branch.

```text
main (source)
  -> GitHub Actions
  -> npm ci
  -> npm run build
  -> dist/
  -> force-publish to production
  -> Porkbun GitHub Connect
  -> live site
```

## GitHub side

Configured in:

- `.github/workflows/publish-production.yml`

Behavior:

- triggers on every push to `main`;
- can also be run manually with `workflow_dispatch`;
- uses Node.js 22;
- runs `npm ci`;
- runs `npm run build`;
- publishes the contents of `dist/` to the root of `production`;
- does not update `production` if installation/build fails.

The `production` branch is intentionally generated output. Do not edit it manually.

## One-time Porkbun setup

These steps follow Porkbun's Static Hosting GitHub Connect flow.

1. Sign in to Porkbun.
2. Open **Account -> Domain Management**.
3. Locate the domain that owns the NOVELLE Static Hosting account.
4. Under the **WEBSITE** column, open its **Static Hosting** page.
5. Scroll to **GitHub Connect**.
6. Click **connect**.
7. GitHub opens. Choose **Only select repositories**.
8. Select `kornellvarga/novelle_reader`.
9. Click **Install** and complete GitHub verification/2FA if requested.
10. Return to Porkbun's Static Hosting page.
11. Scroll to **GitHub Connect** again.
12. In **Repository**, choose `kornellvarga/novelle_reader`.
13. In **Branch**, choose `production` — not `main`.
14. Save/confirm the connection if Porkbun presents a confirmation control.
15. Wait for Porkbun to sync the branch and load the live site.

After this setup, normal publishing is automatic: merge/push source changes to `main`; GitHub builds them; the workflow updates `production`; Porkbun notices the `production` commit and refreshes hosting.

## Verification

After connecting Porkbun:

1. Open the GitHub repository's **Actions** tab.
2. Open **Publish production branch**.
3. Confirm the newest run is green.
4. Open the `production` branch and verify it contains built files such as `index.html` and `assets/`, rather than `src/`.
5. Open the live NOVELLE URL in a private/incognito browser window.
6. If an older build appears briefly, hard-refresh after Porkbun has finished syncing.

## If the GitHub Action cannot push `production`

The workflow requests `contents: write`. If GitHub organization/repository policy blocks workflow writes:

1. Repository -> **Settings** -> **Actions** -> **General**.
2. Find **Workflow permissions**.
3. Select **Read and write permissions** if available.
4. Save.
5. Re-run **Publish production branch** from the Actions tab.

## Rollback

A bad source change should normally fail before `production` changes if the build fails. For a build that succeeds but is functionally bad:

1. Revert the bad commit on `main` (or restore the last good source commit).
2. Push/merge the revert to `main`.
3. The workflow rebuilds and replaces `production` with the reverted site.

Do not manually revert generated files on `production`; treat `main` as the source of truth.
