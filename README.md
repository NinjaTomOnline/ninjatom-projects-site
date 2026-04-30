# NinjaTom Apps Project Hub

Master public website for NinjaTomOnline app, tool, game, and Custom3D.Art project websites.

The site is static and GitHub Pages-friendly: `index.html`, `styles.css`, and `app.js` render a polished project grid from `projects.json`. A GitHub Action refreshes `projects.json` by discovering public repos under `NinjaTomOnline`.

Live site: `https://ninjatomonline.github.io/ninjatom-projects-site/`

## How Automatic Discovery Works

The workflow in `.github/workflows/discover-projects.yml` runs:

- on push
- daily at `09:23 UTC`
- manually with `workflow_dispatch`

It runs `node scripts/discover-projects.js`, which queries the GitHub API for public repos under `NinjaTomOnline`.

Repos are included when at least one rule matches:

- repo name ends with `-site`
- repo has the topic `ninjatom-project-site`
- repo has the topic `app-website`

The master repo, `ninjatom-projects-site`, is excluded.

For each included repo, the script tries to read `site-manifest.json` from the repo default branch. If the manifest exists, its data powers the project card. If it does not exist, the script infers a basic card from the repo name, repo topics, the default GitHub Pages URL, and any `CNAME` file.

The script also discovers real project icons automatically. It checks, in order:

- `site-manifest.json` `icon`
- `site.webmanifest` icons, largest first
- `index.html` icon links such as `apple-touch-icon` and `favicon`
- `index.html` images with `app-icon` or `brand-icon` classes
- common repo paths such as `assets/app-icon.png`, `assets/icon-512.png`, and `screenshots/app-icon.png`

The script also picks up App Store links from each project site's `index.html` when a manifest does not specify `appStoreUrl`. This keeps launched app cards current as long as the public site links to the App Store.

The action commits `projects.json` only when project data changes. Generated commits include `[skip ci]`, and the workflow ignores pushes that only change `projects.json` to avoid update loops.

## Add A New Project

1. Create a public project site repo under `NinjaTomOnline`.
2. Name it with the `-site` suffix, or add one of these GitHub topics:
   - `ninjatom-project-site`
   - `app-website`
3. Add a `site-manifest.json` file to the root of that repo, or at minimum expose normal web app icon metadata through `site.webmanifest` or `<link rel="apple-touch-icon">`.
4. Wait for the daily refresh, push to this repo, or manually run the workflow.

Minimum useful manifest:

```json
{
  "name": "DoorCodes Vault",
  "tagline": "Save door codes and surface them when you arrive.",
  "category": "iOS App",
  "status": "Live",
  "website": "https://doorcodesapp.com",
  "supportUrl": "https://doorcodesapp.com/support.html",
  "privacyUrl": "https://doorcodesapp.com/privacy.html",
  "appStoreUrl": "",
  "icon": "",
  "accent": "#38BDF8",
  "featured": true,
  "sortOrder": 10
}
```

Example manifests live in `examples/site-manifests/`.

## Manifest Fields

- `name`: public project name
- `tagline`: one-sentence card description
- `category`: `iOS App`, `Web App`, `Game`, `Tool`, `Creative / Custom3D`, or another display label
- `status`: `Live`, `Beta`, `TestFlight`, `Coming Soon`, `Archived`, etc.
- `website`: primary public site
- `supportUrl`: optional support page
- `privacyUrl`: optional privacy page
- `appStoreUrl`: optional App Store link. If this is blank, the hub attempts to discover an `apps.apple.com` link from the project homepage.
- `icon`: optional absolute icon URL. If this is blank, the hub attempts to discover a real icon from the project site.
- `previewImage`: optional absolute card preview image URL. If this is blank, the hub attempts to discover an Open Graph image or common screenshot path.
- `previewImageAlt`: optional alt text for the preview image
- `accent`: six-digit hex color
- `featured`: featured projects appear first
- `sortOrder`: lower numbers appear earlier within featured/non-featured groups

The schema is in `site-manifest.schema.json`.

## Manual Refresh

In GitHub:

1. Open the `ninjatom-projects-site` repo.
2. Go to `Actions`.
3. Select `Refresh project index`.
4. Click `Run workflow`.

Locally:

```bash
GITHUB_TOKEN="$(gh auth token)" node scripts/discover-projects.js
```

## GitHub Pages Setup

GitHub Pages is currently configured for this repo:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`
- Live URL: `https://ninjatomonline.github.io/ninjatom-projects-site/`

If the Pages configuration ever needs to be recreated, use:

1. Go to `Settings` -> `Pages`.
2. Set source to `Deploy from a branch`.
3. Choose branch `main`.
4. Choose folder `/ (root)`.
5. Save.

Also confirm `Settings` -> `Actions` -> `General` allows workflows to read and write repository contents, because the refresh workflow commits `projects.json`.

No DNS is configured here. Later, a domain such as `apps.ninjatomonline.com`, `ninjatomapps.com`, or `projects.custom3d.art` can point at this Pages site.

## Local Preview

Static file preview:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

Run the screenshot smoke check:

```bash
node scripts/visual-smoke.mjs
```

The smoke check starts a temporary static server, captures desktop and mobile Chrome screenshots, verifies PNG dimensions and file size, and writes screenshots to `artifacts/visual-smoke/`.

## Project Structure

- `index.html`: static page markup
- `styles.css`: responsive dark-mode visual system
- `app.js`: project loading, search, filters, rendering, and fallback sample data
- Launch board: `app.js` automatically renders featured projects and recently updated repos from the same generated project index.
- `projects.json`: generated project index consumed by the frontend
- `scripts/discover-projects.js`: GitHub API discovery script
- `.github/workflows/discover-projects.yml`: scheduled/manual/push refresh automation
- `.github/workflows/visual-smoke.yml`: desktop/mobile screenshot smoke check
- `site-manifest.schema.json`: metadata contract
- `examples/site-manifests/`: copy/paste manifest starters
