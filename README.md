# NinjaTom Apps Project Hub

[![Auto index and deploy](https://github.com/NinjaTomOnline/ninjatom-projects-site/actions/workflows/auto-index-deploy.yml/badge.svg)](https://github.com/NinjaTomOnline/ninjatom-projects-site/actions/workflows/auto-index-deploy.yml)

Master public website for NinjaTomOnline app, tool, game, and Custom3D.Art project websites.

The site is static and GitHub Pages-friendly: `index.html`, `styles.css`, and `app.js` render a polished project grid from `projects.json`, enriched by the broader GitHub org index at `data/projects.json`. GitHub Actions refresh both data sources by discovering public repos under `NinjaTomOnline`.

The public UI is designed as a dark, cyberpunk-adjacent indie studio portfolio: a large NinjaTom Apps hero, layered project mockups, a compact icon-led filter/search/sort deck with an App Store filter, a grid-first project browser, iPhone-optimized card and drawer layouts, a keyboard quick-find palette, Latest Updates folded into Studio Notes, image-first project cards that prefer real screenshots over generic previews, GitHub metadata, App Store live badges, progress-based release projections, tasteful motion, and neon cursor spotlights, shareable project detail drawers with snapshot stats, screenshot galleries, launch notes, and release forecasts, per-project Open Graph share pages, category hash routes, responsive mobile navigation, JSON-LD project structured data, a branded 404 page, RSS project updates, a public changelog, a public status page, and a footer with deploy freshness, Custom3D.Art, GitHub, and support links.

Live site: `https://ninjatomapps.com/`

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

Projects with a valid `appStoreUrl` are marked `On the App Store` on cards and in the detail drawer. Projects without an App Store URL get a projected release date and progress score estimated from public signals such as manifest status, website availability, support/privacy pages, screenshots, GitHub releases, and recent repo updates. You can override the estimate with manifest fields when you know the real target.

The script also builds each drawer gallery. It prefers `site-manifest.json` `screenshots`, then `site.webmanifest` screenshots, then screenshot-like images from the project homepage, then screenshot/preview files found by scanning the repo tree, then known common screenshot paths. If no explicit gallery exists, the project preview image is still used as a one-image fallback. If a repo has screenshots but no explicit preview image, the first screenshot becomes the card preview so the grid stays visual.

The script includes GitHub repository metadata from the same public API response, including `stargazersCount` and `forksCount`. The separate org repo index in `data/projects.json` adds `license`, `default_branch`, `open_issues_count`, and `latest_release` where GitHub exposes them. The frontend shows that metadata compactly on project cards and in drawer metadata.

The script writes `projects.json`, `feed.xml`, generated project share pages under `projects/`, and per-project Open Graph assets under `assets/project-og/`. The action commits those generated files only when project data, RSS output, or share assets change. Generated commits include `[skip ci]`, and the workflow ignores pushes that only change generated catalog files to avoid update loops.

## Auto Index And Pages Deploy

The workflow in `.github/workflows/auto-index-deploy.yml` adds a GitHub Pages artifact deploy path for the app hub.

It runs:

- on push to `main`
- weekly on Mondays at `10:17 UTC`
- manually with `workflow_dispatch`

It runs `node scripts/fetch-repos.mjs`, writes `data/projects.json`, generates project Open Graph share assets, writes `data/deploy-status.json`, stages the plain static site into `_pages`, uploads that single directory with `actions/upload-pages-artifact`, and deploys with `actions/deploy-pages`.

The repo is currently a plain static root site, not Eleventy, Vite, VitePress, or Next. GitHub Pages is configured to deploy through GitHub Actions.

Full setup and troubleshooting notes are in `docs/auto-index-deploy.md`.

The public status page at `https://ninjatomapps.com/status.html` reads `data/deploy-status.json`, `data/projects.json`, `feed.xml`, and the latest public GitHub Actions run to show deploy, workflow, repo-index, and feed freshness. It also exposes download/copy actions for the generated JSON catalogs.

## Add A New Project

1. Create a public project site repo under `NinjaTomOnline`.
2. Name it with the `-site` suffix, or add one of these GitHub topics:
   - `ninjatom-project-site`
   - `app-website`
3. Add a `site-manifest.json` file to the root of that repo, or at minimum expose normal web app icon metadata through `site.webmanifest` or `<link rel="apple-touch-icon">`.
4. Add screenshots to a normal repo path such as `screenshots/`, `screenshots/web/`, `screenshots/6.9-inch/`, or `assets/screenshots/`. The hub scans public repo trees and can build a drawer gallery without editing this master repo.
5. Wait for the daily refresh, push to this repo, or manually run the workflow.

Minimum useful manifest:

```json
{
  "name": "DoorCodes",
  "tagline": "Access codes, ready on arrival with privacy-safe reminders and Secure Reveal.",
  "category": "iOS App",
  "status": "Live",
  "website": "https://doorcodesapp.com/",
  "supportUrl": "https://doorcodesapp.com/support.html",
  "privacyUrl": "https://doorcodesapp.com/privacy.html",
  "appStoreUrl": "https://apps.apple.com/us/app/doorcodes-vault/id6761863570",
  "icon": "",
  "launchedAt": "2026-04-30T00:00:00Z",
  "version": "Live",
  "launchNotes": "DoorCodes is live with App Store, support, privacy, and launch artwork connected.",
  "versionHighlights": [
    "App Store listing connected",
    "Support and privacy pages available",
    "Premium screenshot gallery ready"
  ],
  "progressPercent": 100,
  "screenshots": [
    {
      "src": "https://doorcodesapp.com/assets/doorcodes-social-preview.png",
      "alt": "DoorCodes launch preview artwork.",
      "caption": "Launch preview"
    }
  ],
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
- `screenshots`: optional array for the project detail drawer. Each item may be an absolute URL string or an object with `src`, `alt`, and `caption`.
- `launchedAt`: optional ISO date used by the "Recently Launched" filter, drawer metadata, JSON-LD `datePublished`, and RSS ordering
- `version`: optional public version or release label shown in the drawer and JSON-LD
- `launchNotes`: optional release note shown in the drawer and RSS feed
- `versionHighlights`: optional short bullet list shown under launch notes in the drawer
- `projectedReleaseDate`: optional ISO date-time used as the manual projected release date when `appStoreUrl` is blank. `estimatedReleaseDate` and `targetReleaseDate` are accepted aliases.
- `progressPercent`: optional manual release-progress override from 0 to 100. `progress` and `completionPercent` are accepted aliases. If omitted, the hub estimates progress from public project signals.
- `releaseProjectionNote`: optional note shown in the release projection drawer section. `progressNote` is accepted as an alias.
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

To refresh the broader GitHub org repo index locally:

```bash
GITHUB_TOKEN="$(gh auth token)" GITHUB_ORG=NinjaTomOnline node scripts/fetch-repos.mjs
```

To regenerate deploy metadata and per-project share pages locally:

```bash
node scripts/write-deploy-status.mjs
node scripts/generate-project-share-assets.mjs
```

## GitHub Pages Setup

GitHub Pages is currently configured for this repo:

- Source: `GitHub Actions`
- Custom domain: `ninjatomapps.com`
- Live URL: `https://ninjatomapps.com/`
- GitHub Pages fallback URL: `https://ninjatomonline.github.io/ninjatom-projects-site/`

If the Pages configuration ever needs to be recreated, use:

1. Go to `Settings` -> `Pages`.
2. Set source to `GitHub Actions`.
3. Set custom domain to `ninjatomapps.com`.
4. Save.
5. Turn on `Enforce HTTPS` after DNS and certificate provisioning are ready.

Also confirm `Settings` -> `Actions` -> `General` allows workflows to read and write repository contents, because the refresh workflow commits `projects.json`.

The artifact deploy workflow preserves the custom domain, `CNAME`, canonical metadata, Open Graph image, and HTTPS enforcement.

Canonical host files are committed in this repo:

- `CNAME`: `ninjatomapps.com`
- `robots.txt`: points crawlers to `https://ninjatomapps.com/sitemap.xml`
- `sitemap.xml`: lists the canonical public pages
- `index.html`: includes canonical and Open Graph URL metadata for `https://ninjatomapps.com/`
- `404.html`: branded GitHub Pages not-found page that links visitors back to the project hub, press kit, and GitHub profile
- `changelog.html`: public hub release notes
- `status.html`: public automation, feed, deploy, and repo-index freshness page
- `feed.xml`: generated RSS feed of new and updated project websites
- `data/deploy-status.json`: generated deploy timestamp and workflow metadata shown in the footer and status page
- `data/projects.json`: generated public GitHub org repository index
- `projects/*.html`: generated per-project share pages with Open Graph/Twitter metadata that redirect into the matching project drawer
- `assets/project-og/*.png` and `assets/project-og/*.svg`: generated per-project 1200x630 share images
- `assets/ninjatomapps-social-preview.png`: Open Graph and Twitter preview image for shared links
- `assets/ninjatomapps-icon.svg`, favicon PNGs, and `site.webmanifest`: browser tab, bookmark, and mobile home-screen identity
- `assets/ninjatomapps-media-kit.zip`: downloadable press/media-kit bundle
- `press.html`: lightweight press/media kit page with public brand links and downloadable preview assets
- `index.html` plus `app.js`: emits Organization, WebSite, CollectionPage, ItemList, and project-level JSON-LD structured data for the canonical domain

Current IONOS DNS points the apex domain at GitHub Pages with the standard four `A` records and four `AAAA` records. `www.ninjatomapps.com` is a `CNAME` to `ninjatomonline.github.io`.

## RSS Feed

The public RSS feed is generated at `https://ninjatomapps.com/feed.xml`.

Each item uses the project name, primary website URL, category, latest project update date, and launch notes. The homepage also advertises the feed with an RSS `<link rel="alternate">` tag so readers can discover it automatically.

## JSON-LD Validation

The homepage ships a static JSON-LD seed in `index.html`, then `app.js` replaces it after `projects.json` loads with Organization, WebSite, CollectionPage, ItemList, and project-level entries.

Validation checklist:

1. Open `https://validator.schema.org/`.
2. Test `https://ninjatomapps.com/`.
3. Confirm the Organization, WebSite, CollectionPage, ItemList, and SoftwareApplication/VideoGame/CreativeWork entries parse without syntax errors.
4. Treat unsupported-type warnings as informational if the JSON-LD is valid Schema.org.
5. After changing structured data locally, run the visual smoke check and inspect the rendered DOM for `ItemList` or project names.

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

The smoke check starts a temporary static server, waits for the JavaScript-rendered project UI, captures desktop, mobile, category-route, project-detail, command palette, changelog, status, and 404 Chrome screenshots, verifies PNG dimensions and file size, and writes screenshots to `artifacts/visual-smoke/`.

Run the stricter pixel-baseline visual regression check:

```bash
node scripts/visual-regression.mjs
```

When the design intentionally changes, update the committed baselines:

```bash
node scripts/visual-regression.mjs --update-baselines
```

The regression check uses `?visual-test=1` to render deterministic code-native previews and stable timestamps, then compares desktop, tablet, mobile, project-grid, category-route, project-detail, command-palette, changelog, status, and 404 screenshots against `tests/visual-baselines/`. The default threshold allows normal macOS/Linux font rasterization differences; override with `VISUAL_CHANGED_THRESHOLD` or `VISUAL_AVG_THRESHOLD` when tightening or debugging.

Run the Lighthouse CI audit locally:

```bash
npx --yes @lhci/cli@0.15.1 autorun
```

The Lighthouse config starts a local static server and audits the homepage, press kit, changelog, status, and 404 page for accessibility, SEO, best practices, and performance. Reports are written to `artifacts/lighthouse/`.

## Project Structure

- `index.html`: static page markup
- `press.html`: press/media kit page for the hub
- `changelog.html`: public release notes for hub updates and launch infrastructure
- `status.html`: public deploy, workflow, RSS, and repo-index status page
- `404.html`: branded GitHub Pages fallback page for missing routes
- `CNAME`: GitHub Pages custom-domain file for `ninjatomapps.com`
- `robots.txt` and `sitemap.xml`: canonical crawler hints for the public domain
- `feed.xml`: generated RSS feed for project updates
- `data/projects.json`: broader public GitHub org repo index
- `data/deploy-status.json`: deploy timestamp and workflow metadata generated during Pages deploy
- `projects/`: generated per-project Open Graph pages that redirect into the project drawer
- `assets/project-og/`: generated 1200x630 project share images in SVG and PNG form
- `assets/ninjatomapps-social-preview.svg` and `.png`: source and rendered social preview art
- `assets/media-kit/README.txt` and `assets/ninjatomapps-media-kit.zip`: downloadable brand/media-kit bundle contents
- `assets/ninjatomapps-icon.svg`, `favicon.ico`, favicon PNGs, and `site.webmanifest`: app icon and install metadata
- `styles.css`: responsive dark-mode visual system for the hero, keyboard quick-find palette, combined Studio Notes / Latest Updates panel, controls, cards, detail drawer, status page, 404 page, and footer
- `site-nav.js`: accessible mobile navigation toggle, deploy-status footer text, and reduced-motion-safe neon cursor spotlights shared across pages
- `app.js`: project loading, hero showcase rendering, keyboard quick-find palette, compact latest updates inside Studio Notes, discovery status, Recently Launched filtering, category hash routes, shareable project drawers with screenshot galleries and launch notes, JSON-LD structured data, search, filters, sorting, load-more behavior, scroll-reveal and pointer-follow card motion, and fallback sample data
- `status.js`: public status page loader for deploy metadata, latest workflow run, repo-index freshness, RSS freshness, and JSON copy actions
- Project cards: `app.js` uses real preview images when available, prefers screenshot-like project media over generic social/preview artwork, makes non-button card areas open the project site, shows gallery-count badges for media-rich projects, and falls back to generated code-native preview panels when a project does not expose a screenshot yet.
- Project drawers: use hash routes such as `#project/doorcodes-site`, and generated pages such as `projects/doorcodes-site.html` provide Open Graph metadata before redirecting into the matching drawer. Category filters use routes such as `#category/ios-apps` and `#category/games`. Drawer galleries are powered by each project's `screenshots` array, with `previewImage` as the fallback, and now include quick snapshot stats, GitHub repo-index metadata, plus a larger featured screenshot.
- `projects.json`: generated project index consumed by the frontend
- `data/projects.json`: generated GitHub org repository index consumed as an enrichment and fallback data source
- `scripts/discover-projects.js`: GitHub API discovery script
- `scripts/fetch-repos.mjs`: Node 20 GitHub REST repo indexer for `.github/workflows/auto-index-deploy.yml`
- `scripts/write-deploy-status.mjs`: writes workflow/deploy metadata to `data/deploy-status.json`
- `scripts/generate-project-share-assets.mjs`: generates `projects/*.html` share pages and `assets/project-og/*` images
- `scripts/visual-regression.mjs`: pixel-baseline regression check with no npm dependencies
- `scripts/visual-smoke.mjs`: screenshot smoke check for homepage, project grid, project drawer, and 404 states
- `lighthouserc.json`: Lighthouse CI audit thresholds and local static-server config
- `.github/workflows/discover-projects.yml`: scheduled/manual/push refresh automation
- `.github/workflows/auto-index-deploy.yml`: Node 20 org index generation, single-path Pages artifact upload, deploy-pages deployment, and DNS/HTTPS verification artifact
- `.github/workflows/visual-smoke.yml`: desktop/mobile screenshot smoke check plus pixel-baseline comparison
- `.github/workflows/lighthouse.yml`: Lighthouse CI checks for accessibility, SEO, best practices, and performance
- `site-manifest.schema.json`: metadata contract
- `examples/site-manifests/`: copy/paste manifest starters
- `tests/visual-baselines/`: committed screenshot baselines for regression checks
- `NEXT_23_SITE_IDEAS.md`: prioritized ideas for future polish and special effects
- `docs/auto-index-deploy.md`: custom Pages workflow setup, optional `ORG_PAT`, manual run, repo topic/homepage, and troubleshooting notes
