# Deployment — `blobster.dev` & `blobsterfactory.com` Redirect

## Production Topology (Cloudflare Personal Account `cddb32366789cab1bdf4c25584dc1920`)

| Surface | Worker | Custom Domains | Storage / Bindings |
| --- | --- | --- | --- |
| Canonical Storefront & Tarball Edge | `blobster-factory` (`cloudflare/wrangler.jsonc`) | `blobster.dev` | D1 `blobster-factory-cms` (`5fb0cae9-8153-4773-8313-9ebf506ac5ee`), R2 `blobster-factory-media`, KV `blobster-factory-session` (`2ab21a12a69049178446ba0916449a74`) |
| Canonical Redirect Edge | `blobsterfactory-redirect` (`cloudflare/redirect/wrangler.jsonc`) | `blobsterfactory.com`, `www.blobsterfactory.com`, `www.blobster.dev` | Stateless `301` redirect preserving path & query to `https://blobster.dev` |

Both Workers ship with `workers_dev: false` and `preview_urls: false`.

## `/_emdash` Security Posture

1. `cloudflare/worker.ts` enforces a fail-closed outer guard on `/_emdash` and `/_emdash/*`:
   - `POST /_emdash/api/plugins/blobster-submissions/submit` is open for moderated public template submissions (saves `pending` drafts only; never publishes directly).
   - Every other `/_emdash` path (`/_emdash/admin*`, `/_emdash/api/setup*`, `/_emdash/api/auth*`, `/_emdash/api/plugins/blobster-submissions/admin*`) returns `401 Unauthorized` unless `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUDIENCE`, and a `Cf-Access-Jwt-Assertion` header are present.
2. To open `/_emdash/admin` for moderation:
   - Create a self-hosted Cloudflare Zero Trust Access application for `blobster.dev/_emdash*` restricted to the owner's email.
   - Set `CF_ACCESS_AUDIENCE` via `npx wrangler secret put CF_ACCESS_AUDIENCE --profile ryan --config dist/server/wrangler.json`.
   - Build and deploy with `CF_ACCESS_TEAM_DOMAIN=<team>.cloudflareaccess.com npm run build:cloudflare`.
   - Sign in at `https://blobster.dev/_emdash/admin` once to claim the initial Admin role.

## Release Sequence

```sh
npm run typecheck
npm test
npm run build:cloudflare
REV=$(git rev-parse --short HEAD)
./node_modules/.bin/wrangler deploy --dry-run --config dist/server/wrangler.json --var "BLOBSTER_REVISION:$REV"
./node_modules/.bin/wrangler deploy --profile ryan --config dist/server/wrangler.json --var "BLOBSTER_REVISION:$REV"
./node_modules/.bin/wrangler deploy --profile ryan --config cloudflare/redirect/wrangler.jsonc
SITE_ORIGIN=https://blobster.dev node bin/verify-site.mjs https://blobster.dev
```

## Zero-Login Maintainer Playground — `dev.blobster.dev`

`dev.blobster.dev` runs as a completely separate Cloudflare Worker (`blobster-factory-playground` in `cloudflare/wrangler.playground.jsonc`) using EmDash's per-visitor SQLite Durable Object Playground (`EmDashPreviewDB`), isolated from production `blobster.dev` D1/R2/KV:

1. **Per-Visitor CMS Sandbox**: Every visitor gets a disposable 1-hour SQLite Durable Object (`emdash_playground` cookie), auto-signed-in Playground Admin UI (`/_emdash/admin`), live visual editing toolbar, and `noindex, nofollow` headers.
2. **Abuse & Bot Hardening (Zero Login for 20+ Contributors)**:
   - Cloudflare Edge Rate Limiters: `PLAYGROUND_CREATION_LIMITER` (`5/min` per IPv4 address or IPv6 /64), `PLAYGROUND_GLOBAL_LIMITER` (`100/min`; Workers rate limits count per Cloudflare location, so this is a per-location cap, not a worldwide one), `PLAYGROUND_CHAT_LIMITER` (`12` model turns/min per playground session: `send_message`, `steer_turn`, `revise_proposal`, `probe_gateway`; UI bookkeeping calls are not counted) and `PLAYGROUND_CHAT_IP_LIMITER` (`60` model turns/min per address across all its sessions). A missing limiter binding fails closed with a 503. Every OpenClaw plugin POST has a `32 KiB` body cap, matched on the decoded, normalized path.
   - Optional Cloudflare Turnstile (`TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`) verified fail-closed on `POST /_playground/init`, after the rate limiters.
   - Every sandbox is created through that gated `POST /_playground/init`: it sets a signed `blobster_playground_admit` cookie, and any other request carrying a session cookie without a valid admission is sent back to `/_playground/reset` (or refused with 403), so a made-up session cookie cannot create a sandbox.
   - Required secret `PLAYGROUND_SETTINGS_SEED` (32+ random bytes, e.g. `openssl rand -base64 32`): derives EmDash's `EMDASH_ENCRYPTION_KEY` (unless that is set) and signs admission cookies. If only `EMDASH_ENCRYPTION_KEY` is set, admission cookies are signed with it instead. With neither, every request gets a 503 before any sandbox is created. `npm run dev:playground` creates a local one in `.wrangler/local-playground/settings-seed`.
3. **Locked `Blobster Smith` ("Forge") Bridge (`cloudflare-account-split.md`)**:
   - `OPENCLAW_PLAYGROUND_LOCK=1` locks `@dinkuskit/openclaw` settings, disables `/pair` and host exec approvals, hashes `emdash_playground` per visitor into isolated OpenClaw `sessionKey`s, and connects over a Cloudflare Access Service-Token–protected tunnel (`sm0ky.dev` in the Agent account) to `spark-1`'s tool-locked `Blobster Smith` profile backed by `$0` `nemotron-3.5-super-vl`.
   - Local preview (`http://127.0.0.1:4332`): `npm run build:playground && npm run dev:playground`. The playground builds into `dist-playground/`, never `dist/`, so `npm run deploy` only ever ships the production site.
