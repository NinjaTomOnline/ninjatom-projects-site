# NinjaTom Apps Project Hub — Repository Instructions

Follow the global NinjaTom Mission Control instructions first, then these repository-specific rules.

## Repository purpose

This public repository powers `ninjatomapps.com`, the static GitHub Pages portfolio and automatically generated project catalog for NinjaTomOnline apps, games, tools, and project sites.

## Start of every run

1. State the global and repository instruction files loaded.
2. State the selected Development Hub ID and current branch.
3. Work one bounded Hub item only.
4. Read `README.md`, the relevant workflow files, and the directly affected scripts/assets before editing.
5. Treat `README.md` and `.github/workflows/` as the canonical description of discovery, generation, deployment, and validation behavior.

## Architecture

- Plain static root site: `index.html`, `styles.css`, `app.js`, shared scripts, and static assets.
- `projects.json` is the generated portfolio index used by the frontend.
- `data/projects.json` is the broader generated GitHub organization index.
- `scripts/discover-projects.js` discovers public project-site repositories and reads `site-manifest.json` when present.
- `scripts/fetch-repos.mjs`, `scripts/write-deploy-status.mjs`, and `scripts/generate-project-share-assets.mjs` generate deployment/index metadata and share assets.
- GitHub Actions deploys the static site to GitHub Pages and preserves the `ninjatomapps.com` custom domain.

Do not replace the current static/GitHub Pages architecture unless the selected Hub item explicitly requires an architectural change and evidence justifies it.

## Canonical commands

Run from the repository root.

### Local preview

```bash
python3 -m http.server 8080
```

### Data generation and validation

Commands that query GitHub require an appropriate token:

```bash
GITHUB_TOKEN="$(gh auth token)" node scripts/discover-projects.js
GITHUB_TOKEN="$(gh auth token)" GITHUB_ORG=NinjaTomOnline node scripts/fetch-repos.mjs
node scripts/write-deploy-status.mjs
node scripts/generate-project-share-assets.mjs
```

### Visual validation

```bash
node scripts/visual-smoke.mjs
node scripts/visual-regression.mjs
npx --yes @lhci/cli@0.15.1 autorun
```

Use `node scripts/visual-regression.mjs --update-baselines` only when the design change is intentional and the new baselines have been reviewed.

Run the smallest relevant checks first, then the complete affected user path. For catalog, layout, metadata, navigation, drawer, status, 404, accessibility, or responsive changes, static inspection alone is insufficient.

## Generated files and manifests

- Prefer correcting a project's own `site-manifest.json`, website metadata, icons, screenshots, or public links at the source when that is authoritative.
- Understand which files are generated before editing them manually.
- Regenerate and review `projects.json`, `data/projects.json`, `feed.xml`, `projects/*.html`, `assets/project-og/*`, and deploy metadata through the documented scripts when applicable.
- Do not invent project status, App Store availability, release dates, support links, or privacy links. Verify them from authoritative public/project sources.
- Exclude private, retired, duplicate, placeholder, or internal projects unless the selected Hub item explicitly says otherwise.

## Operations safety

- Never commit GitHub tokens, DNS credentials, email credentials, private repository data, or local-machine configuration.
- Do not change GitHub Pages settings, DNS, `CNAME`, HTTPS enforcement, redirect domains, support-email routing, repository visibility, workflow permissions, or production deployment settings without explicit authorization and rollback notes.
- Do not manually trigger or merge a production deployment merely because code checks pass.
- Preserve canonical URLs, accessibility, social metadata, structured data, responsive behavior, and reduced-motion behavior.
- Keep changes focused and review generated diffs for accidental portfolio-wide churn.

## Development Hub handoff

Mission Control sources:

- Development Hub: https://docs.google.com/document/d/1pRB7IY7B-UWQec7l3LlPKmvYoaHtuQjJ_LkCNergKrY/edit
- Development Standards: https://docs.google.com/document/d/1Wlh43v2xAph6DO50h92dW1QBcSDGn5vFwJqvbJFV8kQ/edit

Work exactly one explicitly selected Hub ID; never implement the whole backlog automatically. Read the complete live item and Development Standards through authenticated Google Drive access. If Drive is unavailable, use only the supplied item and return a structured handoff for Mission Control to write back; never claim a live read or write.

Follow `Open` → `Investigating` → `In Progress` → `Ready to Test` → `Done`. Use `Blocked` only for a named dependency, decision, credential, device, account, or external service. Move active implementation to `In Progress`; at completion, move the selected item to `Ready to Test` and report:

- stale/missing/incorrect findings or root cause;
- source files and generated files changed;
- generation, visual, accessibility, link, workflow, and deployment checks run;
- evidence for canonical domain/HTTPS/redirect behavior when in scope;
- remaining DNS, email, permissions, or external-service risks;
- exact human review and deployment steps.

Include the branch, commit, and pull-request reference. Never mark the item `Done`; only Tom may do that after human verification.
