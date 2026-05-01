# Master Site Roadmap

## Completed

- [x] Create static GitHub Pages-ready site shell.
- [x] Add premium dark-mode landing page.
- [x] Add responsive project card grid.
- [x] Add search.
- [x] Add filters for All, iOS Apps, Web Apps, Games, Tools, and Creative / Custom3D.
- [x] Sort featured projects first, then by `sortOrder`, then by name.
- [x] Add loading, empty, and fallback states.
- [x] Generate `projects.json` from public GitHub repos.
- [x] Add GitHub Action for push, daily, and manual refresh.
- [x] Avoid refresh loops by committing only changed generated output.
- [x] Add `site-manifest.schema.json`.
- [x] Add example manifests for DoorCodes, SwiftTerm, Zen Wisdom, DontSpeed, and FlowGuru.
- [x] Add GitHub Pages setup documentation.
- [x] Add automatic real icon discovery from project manifests, web app manifests, HTML icon links, CNAME-backed sites, and common icon paths.
- [x] Add automatic App Store URL discovery from launched project homepage links.
- [x] Add `ninjatom-project-site` and `app-website` topics to existing public project website repos.
- [x] Add custom preview image support to the manifest schema, discovery script, project data, and cards.
- [x] Add optional Launch Board sections for featured launches and newest project site updates.
- [x] Add a visual smoke workflow for desktop/mobile homepage screenshots.
- [x] Enable GitHub Pages from `main` `/` and verify the public site loads project data.
- [x] Restyle the public hub against the neon portfolio reference with product-wall hero cards, a compact filter/search deck, image-first project cards, mobile polish, and a multi-column footer.
- [x] Fix tablet hero headline formatting so `NinjaTom` never breaks mid-word.
- [x] Add explicit preview image and icon manifests/assets to the remaining public project site repos.
- [x] Add deterministic pixel-baseline visual regression for desktop, tablet, mobile, and project-grid views.
- [x] Choose and configure DNS for `ninjatomapps.com`.
- [x] Add repo-side `CNAME`, canonical URL, sitemap, robots, Open Graph URL, and support email for `ninjatomapps.com`.
- [x] Add a 1200x630 social preview image and Open Graph/Twitter image metadata for `ninjatomapps.com`.
- [x] Add a lightweight press/media kit page with downloadable preview assets.
- [x] Add accessible mobile navigation so project, press, GitHub, Custom3D.Art, and about links remain reachable on phones.
- [x] Add favicon, Apple touch icon, install manifest, and branded app icon assets.
- [x] Remove the featured launch carousel so the project browser starts with the filter/search controls.
- [x] Add tasteful project-card tilt/parallax, animated neon focus rings, and visible status badges.
- [x] Update the `ashtag-site` fallback to QuitGentle so fallback data stays current.
- [x] Add a branded GitHub Pages `404.html` fallback.
- [x] Add project detail drawers with screenshots, App Store/support/privacy links, repo metadata, and shareable hash routes.
- [x] Add a live discovery status panel with indexed repo count, manifest count, and refresh timing.
- [x] Add recently-updated ribbons for fresh project cards.
- [x] Extend subtle pointer-follow motion to the hero project wall with visual-test and reduced-motion safeguards.
- [x] Add per-project screenshot galleries inside project detail drawers.
- [x] Add project-level JSON-LD structured data for the hub catalog.
- [x] Add launch notes and version highlights to project drawers.
- [x] Add a Recently Launched project filter.
- [x] Generate `feed.xml` as an RSS feed from discovered project sites.
- [x] Add Lighthouse CI for accessibility, SEO, best practices, and performance audits.
- [x] Add JSON-LD validation notes to the README.
- [x] Add repo-tree screenshot discovery so public project screenshot folders can power drawer galleries automatically.
- [x] Add a public `changelog.html` page for hub launch notes.
- [x] Add category hash routes such as `#category/ios-apps` and `#category/games`.
- [x] Add a downloadable press/media-kit ZIP bundle.
- [x] Add subtle neon cursor spotlights across cards, controls, and press surfaces.
- [x] Add a compact Latest Updates strip, richer drawer snapshot stats, stronger gallery previews, media-count card badges, and upgraded 404 recovery shortcuts.
- [x] Add a keyboard quick-find palette for category jumps, project details, and quick site launch.
- [x] Add platform icons to project cards and Studio Notes.
- [x] Add reduced-motion-safe scroll reveal animations for project cards.
- [x] Add a compact Studio Notes section with curated launch blurbs.
- [x] Add GitHub stars/forks metadata to generated project data, cards, and drawers.
- [x] Remove the visible Command button and tighten the filter row so Creative / Custom3D stays with the primary filters on desktop.

## Future

- [ ] Add missing App Store links to project homepages as each remaining app launches.
- [ ] Work through the highest-impact ideas in `NEXT_23_SITE_IDEAS.md`.

## Blocked / Needs Owner Choice

- [ ] Choose a privacy-friendly analytics provider and account before adding analytics.
