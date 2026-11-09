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
