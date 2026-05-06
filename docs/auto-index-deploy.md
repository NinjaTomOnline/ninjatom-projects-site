# Auto Index And Pages Deploy

This repo is a plain static GitHub Pages site. There is no `package.json`, so the custom deploy workflow stages the repository root into a single `_pages` artifact directory and deploys that artifact when GitHub Pages is configured to use GitHub Actions.

## Workflow

The workflow lives at `.github/workflows/auto-index-deploy.yml`.

It runs on:

- manual `workflow_dispatch`
- weekly schedule, Mondays at `10:17 UTC`
- push to `main`

The build job:

1. Checks out the repo.
2. Sets up Node 20.
3. Runs `node scripts/fetch-repos.mjs`.
4. Writes `data/projects.json`.
5. Runs the existing npm build command if a future `package.json` adds one.
6. Stages the static site into `_pages`.
7. Uploads `_pages` with `actions/upload-pages-artifact`.

The deploy job:

- Runs `actions/deploy-pages`.
- Runs only when the repo's Pages `build_type` is `workflow`.
- Skips safely while Pages is still using legacy branch deployment.

The verification job:

- Queries the GitHub Pages REST API.
- Checks that `ninjatomapps.com` is the Pages custom domain.
- Checks that HTTPS is enforced.
- Uploads `pages-dns-https-verification` with `pages-status.json` and a short README.

## Optional Secret

`ORG_PAT` is optional but recommended.

The workflow falls back to the built-in `GITHUB_TOKEN`, which is enough for public repository discovery in most cases. Add `ORG_PAT` if you want a higher API rate limit or if organization visibility rules later require a user token.

Recommended token scope for a fine-grained PAT:

- Resource owner: `NinjaTomOnline`
- Repository access: public repositories, or selected project repositories
- Repository permissions: Metadata read-only

Do not put tokens in files. Add the token in GitHub:

1. Open `NinjaTomOnline/ninjatom-projects-site`.
2. Go to `Settings` -> `Secrets and variables` -> `Actions`.
3. Add repository secret `ORG_PAT`.

## Manual Run

1. Open the repo on GitHub.
2. Go to `Actions`.
3. Select `Auto index and deploy`.
4. Click `Run workflow`.
5. After it finishes, download the `pages-dns-https-verification` artifact if you want the DNS/HTTPS report.

## Tagging Repos

For the existing curated app cards, keep using at least one of:

- `ninjatom-project-site`
- `app-website`

The new org index includes all public, non-fork repositories by default and records each repo's topics into `data/projects.json`. Topics still matter because the frontend displays them on cards and uses them in search/filter matching.

Useful topic examples:

- `ios`
- `web-app`
- `game`
- `tool`
- `custom3d`
- `app-website`
- `ninjatom-project-site`

## Setting A Repo Homepage

The GitHub API exposes the repo homepage field as `homepage`.

To set it:

1. Open the project repo on GitHub.
2. Click the gear icon next to the About panel.
3. Add the public site URL in Website.
4. Save.

Examples:

- `https://doorcodesapp.com/`
- `https://ninjatomonline.github.io/flowguru-site/`
- `https://ninjatomapps.com/`

The hub shows the homepage as the live site link when available and the GitHub repo link separately.

## Pages Source Setting

Current status observed locally before this workflow was added:

- `build_type`: `legacy`
- source: `main` `/`
- custom domain: `ninjatomapps.com`
- HTTPS enforced: `true`

To let `auto-index-deploy.yml` actually deploy:

1. Open repo `Settings` -> `Pages`.
2. Change Source from `Deploy from a branch` to `GitHub Actions`.
3. Keep custom domain `ninjatomapps.com`.
4. Keep `Enforce HTTPS` enabled.
5. Run `Auto index and deploy` manually.

Until that setting changes, the workflow still builds, uploads the Pages artifact, and writes the DNS/HTTPS verification artifact, but the deploy job skips instead of breaking the existing branch-based Pages site.

## Troubleshooting

If repository discovery fails:

- Check the `Generate GitHub org repository index` log.
- Add or refresh the optional `ORG_PAT` secret.
- Confirm the token can read public metadata for `NinjaTomOnline`.
- Re-run the workflow manually.

If topics are missing for one repo:

- The script logs a warning and records `topics: []` for that repo.
- One failed topic request does not fail the full workflow.
- Re-run after API rate limits reset or after adding `ORG_PAT`.

If Pages deploy is skipped:

- Check `Settings` -> `Pages`.
- Source must be `GitHub Actions`, not `Deploy from a branch`.
- Re-run the workflow after changing the setting.

If custom domain or HTTPS verification fails:

- Download the `pages-dns-https-verification` artifact.
- Check `pages-status.json` for `cname`, `https_enforced`, and `html_url`.
- Confirm GitHub Pages still shows `ninjatomapps.com` as the custom domain.
- Do not change IONOS DNS from this repo. DNS changes should be handled separately and intentionally.
