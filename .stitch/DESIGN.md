# DESIGN.md — Blobster Factory (EmDash + OpenClaw Agent Templates)

## 1. Visual Theme & Atmosphere
Tactile Foundry & Precision Agent Workbench. Blends archival vellum drafting tables (`#f3f0e8`) and deep obsidian carapace telemetry panels (`#0b0d11`) with crisp 1px architectural rules, a subtle 24px blueprint coordinate grid, a 12px Bayer dither texture strip, and OpenClaw's signature lobster-crimson (`#e5243b`), steel-cyan (`#5ab6d8`), and amber-forge (`#ffc233`) accents. Feels like an industrial toy foundry crossed with a Swiss technical manual.

## 2. Color Palette & Roles
- **Canvas Background:** `#f3f0e8` (Light Vellum) / `#0b0d11` (Dark Obsidian)
- **Elevated Surface:** `#faf8f3` (Light Card) / `#12161d` (Dark Panel)
- **Inset / Blueprint Stage:** `#eae5d7` (Light Well) / `#08090c` (Dark Stage)
- **Primary Ink:** `#161513` (Light Soot) / `#eef1f6` (Dark Bone)
- **Secondary Muted Ink:** `#5d584f` (Light Graphite) / `#8e98a8` (Dark Steel)
- **Hairline Border / Rule:** `#d8d1c2` (Light Rule) / `#252c38` (Dark Rule)
- **Primary Accent (`knot` Crimson):** `#d91e36` (Light) / `#e5243b` (Dark)
- **Secondary Accent (`tide` Cyan):** `#0284c7` (Light) / `#5ab6d8` (Dark)
- **Forge Highlight (`beacon` Amber):** `#b45309` (Light) / `#ffc233` (Dark)
- **Semantic Audit Clean:** `#15803d` (Light) / `#4ade80` (Dark)

## 3. Typography Rules
- **Display Serif:** `Instrument Serif`, weight `400`, line-height `1.02`, letter-spacing `-0.02em` for hero statements and section titles.
- **UI Sans:** `Geist` (fallback `Inter`, system-ui), weights `400`, `500`, `600`, line-height `1.5` for catalog descriptions, navigation, and controls.
- **Technical Monospace:** `JetBrains Mono`, weights `500`, `600`, `font-variant-numeric: tabular-nums` for `.eyebrow` headers (`11px`, uppercase, `0.08em` tracking), `@scope/slug` coordinates, `openclaw templates` CLI commands, and pixel-scale badges (`24px · 64px · 256px`).

## 4. Layout, Rhythm & Viewport Budget
- **Design Dial Targets:** Density `6/10`, Layout Variance `6/10`.
- **Container Max Width:** `1240px` centered with `24px` horizontal padding (`16px` on mobile) and visible `1px` structural grid divisions where appropriate.
- **Above-the-Fold Budget (`1440x900` Desktop):** Top bar (`60px`) + asymmetrical 2-column hero (`520px` max: editorial statement + primary `Add to OpenClaw` CTA on left; live `24px / 64px / 256px` Blobster inspection stage on right) + visible top edge of the filterable OpenClaw Templates catalog below.

## 5. Component & Surface Vocabulary
- **Header:** Compact ruled bar (`1px solid`), monospace `[b/f]` inverted foundry mark, 4 crisp nav links (`Catalog`, `Forge Pipeline`, `Submit Template`, `GitHub`), OpenClaw preset switcher (`Knot · Tide · Beacon`), and Light/Dark switch.
- **Catalog Cards:** Sharp `2px`–`4px` corners, `1px` solid border, subtle `3px 3px 0` hard offset shadow on hover, `64px` crisp Blobster cutout stage, `@ownerHandle` monospace coordinate, `Official` vs. `Workshop` / `Community` badge, `scanStatus: clean` pill, OpenClaw category tag, and 1-click `Add / Copy Prompt` action.
- **Collapsible Disclosure Blocks:** Native EmDash `<details>` / `<summary>` ruled accordion blocks for `Workspace files` (`CLAW.md`, `SOUL.md`, `AGENTS.md`, `profiles/openclaw.yml`), `Skills` (`SKILL.md`), and `Automations`.
- **3-Way Add-to-Gateway Bar:** Tabbed/segmented terminal strip offering (1) `Copy OpenClaw Prompt`, (2) `curl blobster.dev/t/<slug>.tgz + openclaw templates add`, and (3) `@saariuslystoned/<slug>` ClawHub coordinate + `.tgz` receipt.

## 6. Signature Visual Motifs
- **24px Blueprint Coordinate Stage:** Subtle `24px x 24px` ruled grid backdrop behind Blobster avatars proving sidebar legibility at `24x24`, `64x64`, and `256x256` on both Dark (`#0D1117`) and Light (`#F8FAFC`) swatches.
- **12px Bayer Dither Divider Strip:** Architectural `--fx-dots` dither rule separating major catalog and forge sections.
- **Dry-Ink Audit Stamp:** `[INSPECTED · CLEAN]` / `[SCRIPT-FREE PKG]` monospace verification badge.

## 7. Responsive Behavior (`390px` Mobile)
- Asymmetrical hero stacks cleanly into a single column without horizontal overflow; avatar stage remains crisp and interactive above the catalog search/chips.
- Category filter chips scroll horizontally with clean snap or wrap cleanly with `36px+` tap targets.

## 8. Accessibility & Contrast
- Minimum WCAG AA (`4.5:1`) contrast across both Vellum Light and Obsidian Dark modes (`beacon` preset reaches AAA high-contrast).
- Respect `prefers-reduced-motion: reduce` across animated GIF previews and stage transitions.

## 9. Explicit Anti-Patterns (Banned)
- NO purple/blue/violet AI SaaS gradients or glowing orb backgrounds.
- NO `backdrop-filter: blur()` glassmorphism cards or `999px` bubbly SaaS hero pills.
- NO generic stock photography, human avatars, fake star ratings, or invented download counts.
