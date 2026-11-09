# FEATURE_MAP.md — Blobster Factory EmDash Functional Hooks

Every Stitch translation and visual refinement MUST preserve these exact routes, EmDash CMS bindings, and interactive selectors:

## Routes
- `/` — Filterable Agent Templates Catalog + Live `24px / 64px / 256px` Blobster Hero Stage (`src/pages/index.astro`)
- `/templates/[slug]` — Template Detail, 3-Way Add-to-OpenClaw Bar, Multi-Scale Avatar Stage, and Collapsible `<details>` Manifest Blocks (`src/pages/templates/[slug].astro`)
- `/pipeline` — 3-Stage Forge & Spec Lab + Interactive `#FF00FF` QA Contact Sheet + Progressive Smith & Sculptor Animation Stage (`src/pages/pipeline.astro`)
- `/submit` — Moderated Community Template Submission Form (`src/pages/submit.astro` -> `POST /_emdash/api/plugins/blobster-submissions/submit`)
- `/_emdash/admin/review` — Owner-gated EmDash Block Kit Moderation Queue with collapsible `accordion` blocks (`src/lib/plugin.ts`)

## Required DOM & Data Hooks
- `[data-content-source="emdash"]` — Present on CMS-backed template cards and detail views
- `[data-theme-toggle]` & `[data-preset-select]` — Dual-mode (`light`/`dark`) and OpenClaw theme (`knot`/`tide`/`beacon`) controls persisted to `localStorage`
- `[data-copy-prompt]` / `[data-copy-cli]` / `[data-copy-clawhub]` — 3-way Add-to-OpenClaw clipboard actions with thermal receipt feedback
- `[data-avatar-stage]` — Multi-scale (`24px`, `64px`, `256px`) + surface (`dark` `#0D1117` / `light` `#F8FAFC`) + mode (`svg` / `hero` / `idle-gif` / `wave-gif`) switcher
- `[data-qa-sheet]` — Interactive `Clean` vs. `Simulate Bad Sheet` `#FF00FF` chroma-key QA contact sheet on `/pipeline`
- `[data-forge-motion-slot]` — Scoped mount container for the progressive `emdash-motion-studio` Smith + Sculptor forging animation
- `form[data-template-submit-form]` — Community submission form posting JSON to `/_emdash/api/plugins/blobster-submissions/submit`
