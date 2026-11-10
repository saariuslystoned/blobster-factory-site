# Blobster Factory — Design Contract (`blobster.dev`, `blobsterfactory.com` → `301` redirect)

## Aesthetic Posture
Fuses Ryan's tactile EmDash editorial craft (`reverse-engineer-lab` vellum workbench, 1px ruled hairlines, 24px blueprint grid, hard 4px offset telemetry frames) with OpenClaw's real Control UI theming (`knot` crimson `#e5243b`, `tide` steel cyan `#5ab6d8`, `beacon` high-contrast amber `#ffc233`).

## Dual-Mode Palette & OpenClaw Theme Presets
- **Light Mode ("Vellum Workbench"):** Warm drafting vellum `#f3f0e8`, elevated card `#faf8f3`, deep soot ink `#161513`, muted slate `#5d584f`, crisp rule `#d8d1c2`.
- **Dark Mode ("Obsidian Telemetry Bench"):** Deep carapace `#0b0d11`, elevated panel `#12161d`, bone text `#eef1f6`, muted steel `#8e98a8`, crisp rule `#252c38`.
- **OpenClaw Preset Accents (`data-preset`):**
  - `knot` (default): `#e5243b` (OpenClaw crimson) + `#b8bdc4` steel silver
  - `tide`: `#5ab6d8` (OpenClaw steel cyan) + `#7dd3fc`
  - `beacon`: `#d97706` light / `#ffc233` dark (OpenClaw AAA amber)

## Typography
- **Display:** `Instrument Serif` (editorial foundry headlines, tight negative tracking)
- **UI & Body:** `Geist` (matching OpenClaw Control UI)
- **Technical / CLI / Coordinates:** `JetBrains Mono` (`tabular-nums`, uppercase `.eyebrow` tags, `openclaw templates` commands, SHA-256 digests)

## Non-Goals & Anti-Slop Invariants
- Zero purple/indigo SaaS mesh gradients, neon glassmorphism, floating glow orbs, or rounded pill soup.
- Zero fake install counters or invented testimonials; surface only verifiable `CLAW.md` manifests, `24px/64px/256px` Blobster cutouts, SHA-256 tarball digests, and ClawHub security-preflight rules.
- Progressive animation (`emdash-motion-studio`) mounts strictly on `/pipeline` hero only (`g2-motion-placement` locked), using Overhead 3D Chain Hoist & Cast-Iron Hook Multiplane Occlusion depth-plate layering (`src/components/PipelineMultiplaneStage.astro` + `public/pipeline-plates/`) with `C³` `smooth7` horizontal trajectory and damped Newtonian pendulum sway.

## Stitch & Motion Visual Decision Record (Project `5620316938785958966`)

| Round | Surface / Variable | Candidate Full Screen IDs | Selected Full Screen ID | Rationale & Stripped Items | Status | Implemented In |
| --- | --- | --- | --- | --- | --- | --- |
| `R1` → `R2` | Homepage Layout & Global Chrome (`/`, `/templates/[slug]`, `/submit`) | `3c36fedf412144bd897d7d7a6dc3d944` (`C1`), `d6e8b870ec264eb6831e040219806d14` (`C2`), `47a863f7d641479182dcb7bd9f63ad85` (`C3`), `0371dc9429bb4725a3371327f4b50991` (`C4`), `62ad9cb5d032485999aee2463b4e85fe` (`C5`), `14010156567637161529` (`R2 v1`), `11637266979287648165` (`R2 Hybrid`) | `11637266979287648165` | Owner locked `R2 · Homepage Hybrid`: fuses `C4` Dual-Chamber Obsidian (`#0b0d11`) + `12px` Bayer dither divider + Warm Vellum (`#f3f0e8`) catalog bench, `C2` Blueprint Calibration Stage Hero Banner, uncrowded `232px` `C3` left filter rail, dialed header with `template-store` GitHub/OpenClaw SVG icons + `ThemeSwitch`, and Foundry Colophon Footer with `feTurbulence` Pigment Drift wash + bottom `Theme`/`Preset` swatch dock. Stripped crowded telemetry noise from `C3` sidebar and verified `390px` mobile centering (`scrollWidth === 390`). | `implemented` | `src/layouts/Layout.astro`, `src/pages/index.astro`, `src/pages/templates/[slug].astro`, `src/pages/submit.astro`, `src/styles/tokens.css`, `src/styles/site.css` |
| `R2` | Pipeline Multiplane Forge Stage (`/pipeline` `[data-forge-motion-slot]`) | `Plane0 Workshop Bg`, `Plane1 Claw Stages`, `Plane2 Foreground Mask` → Overhead Chain Hoist & Hook Multiplane Stage | `g2-motion-framework` + `g2-motion-placement` (`just pipeline`) | Owner locked pure ambient 3-plane 3D shadowbox (`1344×768`) driven by overhead cast-iron trolley, unspooling forged chain, hook, and pincer lifting bridle carrying the Claw from Smith's anvil behind the foreground steel girder to Sculptor's glazing wheel (`377 KB` static plates in `public/pipeline-plates/`). Stripped all development HUD chrome (`01`–`04` stop buttons, timeline scrubber, Play/Pause/3D Layers toolbar, stage counter). | `implemented` | `src/components/PipelineMultiplaneStage.astro`, `src/pages/pipeline.astro`, `public/pipeline-plates/` |
| `R1` → `R2` | Template Detail "What is this agent good for?" Dossier (`/templates/[slug]`) | `c1-field-brief-cards`, `c2-request-outcome-ledger`, `c3-good-for-vs-not-for`, `c4-hero-strip-scenarios`, `c5-foundry-job-ticket` → `r2-c1`..`r2-c5` | `r2-c1-dossier-bullets-chips` (`g4-template-good-for`) | Owner favored `C5` + `C3` without a negative "What it refuses" block and locked `R2-C1` with relatable, multi-domain human starter prompts (`Best For`, `Reach For It To` bold-lead `✓` bullets, and 3 clickable `Starter Prompts` chips). Also fixed `sync-templates.mjs` and `catalog.ts` so Workshop templates display their functional `CLAW.md` `agent.description` in the Obsidian hero lede. | `implemented` | `src/pages/templates/[slug].astro`, `src/lib/catalog.ts`, `scripts/sync-templates.mjs`, `src/styles/site.css` |

