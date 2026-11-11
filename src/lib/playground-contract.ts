export const PLAYGROUND_COOKIE_NAME = 'emdash_playground';
export const PLAYGROUND_TTL_SECONDS = 60 * 60;
export const PLAYGROUND_CREATION_LIMITER_BINDING = 'PLAYGROUND_CREATION_LIMITER';
export const PLAYGROUND_GLOBAL_LIMITER_BINDING = 'PLAYGROUND_GLOBAL_LIMITER';
export const PLAYGROUND_CHAT_LIMITER_BINDING = 'PLAYGROUND_CHAT_LIMITER';

export interface RateLimiterBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface PlaygroundInitLimiters {
  perIp?: RateLimiterBinding;
  global?: RateLimiterBinding;
}

export function extractClientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip')?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1'
  );
}

/**
 * Rate-limit key for the client address. IPv6 clients are keyed on their /64,
 * since one subscriber usually holds a whole /64 and could rotate addresses.
 */
export function clientRateKey(request: Request): string {
  const ip = extractClientIp(request);
  if (!ip.includes(':')) return ip;
  const [head, tail = ''] = ip.toLowerCase().split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = ip.includes('::') && tail ? tail.split(':') : [];
  const fill = ip.includes('::') ? Array(Math.max(0, 8 - headParts.length - tailParts.length)).fill('0') : [];
  const groups = [...headParts, ...fill, ...tailParts].map((g) => g.replace(/^0+(?=.)/, ''));
  return `${groups.slice(0, 4).join(':')}::/64`;
}

export async function checkPlaygroundInitLimit(
  request: Request,
  limiters: PlaygroundInitLimiters,
): Promise<Response | undefined> {
  const clientKey = clientRateKey(request);

  if (
    limiters.perIp &&
    !(await limiters.perIp.limit({ key: `blobster-playground:init:ip:${clientKey}` })).success
  ) {
    return Response.json(
      {
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many playground sandboxes created from this IP. Please try again in a minute.',
        },
      },
      {
        status: 429,
        headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' },
      },
    );
  }

  if (
    limiters.global &&
    !(await limiters.global.limit({ key: 'blobster-playground:init:global' })).success
  ) {
    return Response.json(
      {
        error: {
          code: 'RATE_LIMITED',
          message: 'Playground sandbox initialization is busy. Please retry in a moment.',
        },
      },
      {
        status: 429,
        headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' },
      },
    );
  }

  return undefined;
}

export const PLAYGROUND_CHAT_MAX_BYTES = 32_768;

/**
 * True when the request body is larger than `maxBytes`. Content-Length is a
 * fast path only; a missing or chunked length is measured by reading a clone
 * of the stream, stopping as soon as the cap is passed.
 */
export async function exceedsBodyLimit(request: Request, maxBytes: number): Promise<boolean> {
  const declared = request.headers.get('content-length');
  if (declared !== null && /^\d+$/.test(declared.trim())) {
    // The runtime holds the body to its declared length, so this is exact.
    return Number(declared) > maxBytes;
  }
  if (!request.body) return false;
  const reader = request.clone().body!.getReader();
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return false;
      total += value.byteLength;
      if (total > maxBytes) return true;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

const OPENCLAW_PLUGIN_API_PREFIX = '/_emdash/api/plugins/dinkus-openclaw/';

/**
 * Canonical form of a request path for gate matching: percent-decoded,
 * repeated slashes collapsed, lowercased, trailing slash dropped. Returns
 * undefined when the path cannot be decoded, which callers must refuse.
 */
export function normalizeGatePath(pathname: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  const collapsed = decoded.replace(/\/+/g, '/').toLowerCase();
  return collapsed.length > 1 ? collapsed.replace(/\/$/, '') : collapsed;
}

/** Any POST into the OpenClaw plugin's routes (chat, pair, approvals...). */
export function isOpenclawPluginPost(method: string, normalizedPath: string): boolean {
  return method === 'POST' && `${normalizedPath}/`.startsWith(OPENCLAW_PLUGIN_API_PREFIX);
}

/** OpenClaw chat actions that run a model turn on the Forge gateway. */
export const PLAYGROUND_COSTLY_CHAT_ACTIONS = new Set([
  'send_message',
  'steer_turn',
  'revise_proposal',
  'probe_gateway',
]);

async function readChatAction(request: Request): Promise<string | undefined> {
  try {
    const body = (await request.clone().json()) as { action?: unknown };
    return typeof body?.action === 'string' ? body.action : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 32 KiB cap on every OpenClaw plugin POST, plus the Forge turn limiter on
 * the actions that reach the model. UI bookkeeping (get_workspace, receipts,
 * create_thread...) is not counted. The limiter is keyed on the playground
 * session when there is one, so people behind one office IP each get their
 * own budget; requests without a session fall back to the client address.
 */
export async function checkPlaygroundChatLimit(
  request: Request,
  limiter?: RateLimiterBinding,
  sessionToken?: string,
): Promise<Response | undefined> {
  if (await exceedsBodyLimit(request, PLAYGROUND_CHAT_MAX_BYTES)) {
    return Response.json(
      {
        ok: false,
        error: 'Prompt payload exceeds the 32 KiB Playground limit.',
      },
      { status: 413, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (!limiter) return undefined;
  const action = await readChatAction(request);
  // Unknown or unreadable actions count, so nothing reaches the model uncounted.
  if (action !== undefined && !PLAYGROUND_COSTLY_CHAT_ACTIONS.has(action)) return undefined;
  const key = sessionToken
    ? `blobster-playground:chat:session:${sessionToken}`
    : `blobster-playground:chat:ip:${clientRateKey(request)}`;
  const allowed = await limiter.limit({ key });
  if (!allowed.success) {
    return Response.json(
      {
        ok: false,
        error: 'Playground Forge rate limit reached (12 turns/min). Wait a moment and try again.',
      },
      {
        status: 429,
        headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' },
      },
    );
  }
  return undefined;
}

export async function verifyTurnstileIfConfigured(
  request: Request,
  env: Record<string, unknown>,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<Response | undefined> {
  const siteKey = typeof env.TURNSTILE_SITE_KEY === 'string' ? env.TURNSTILE_SITE_KEY.trim() : '';
  const secretKey = typeof env.TURNSTILE_SECRET_KEY === 'string' ? env.TURNSTILE_SECRET_KEY.trim() : '';

  if (!siteKey && !secretKey) {
    return undefined;
  }
  if (!siteKey || !secretKey) {
    return Response.json(
      {
        error: {
          code: 'TURNSTILE_MISCONFIGURED',
          message: 'Playground bot protection is partially configured; refusing open initialization.',
        },
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const token = request.headers.get('x-turnstile-token')?.trim() || '';
  if (!token) {
    return Response.json(
      {
        error: {
          code: 'TURNSTILE_REQUIRED',
          message: 'Verification challenge required to initialize a new playground session.',
        },
      },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const form = new FormData();
    form.set('secret', secretKey);
    form.set('response', token);
    form.set('remoteip', extractClientIp(request));
    const verifyRes = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    if (!verifyRes.ok) {
      return Response.json(
        {
          error: {
            code: 'TURNSTILE_UNAVAILABLE',
            message: 'Verification service temporarily unavailable. Please retry.',
          },
        },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const outcome = (await verifyRes.json()) as { success?: boolean };
    if (outcome.success !== true) {
      return Response.json(
        {
          error: {
            code: 'TURNSTILE_FAILED',
            message: 'Automated browser check did not pass. Please refresh and try again.',
          },
        },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return undefined;
  } catch {
    return Response.json(
      {
        error: {
          code: 'TURNSTILE_ERROR',
          message: 'Could not verify browser session. Please retry.',
        },
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export function injectTurnstileIntoLoadingPage(html: string, siteKey: string): string {
  const cleanKey = siteKey.trim().replace(/[^A-Za-z0-9_-]/g, '');
  if (!cleanKey) return html;
  if (html.includes('id="bf-turnstile-init"')) return html;

  // Wrap window.fetch so the init POST carries a Turnstile token, whatever
  // markup EmDash's loading page uses. It must run before the page's own script.
  const snippet = `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script><script id="bf-turnstile-init">(function(){
  var originalFetch = window.fetch.bind(window);
  function getToken() {
    return new Promise(function(resolveToken, rejectToken) {
      var mount = document.getElementById("bf-turnstile-mount");
      if (!mount) {
        mount = document.createElement("div");
        mount.id = "bf-turnstile-mount";
        mount.style.minHeight = "1px";
        (document.body || document.documentElement).appendChild(mount);
      }
      var waited = 0;
      (function mountWidget() {
        if (window.turnstile && typeof window.turnstile.render === "function") {
          window.turnstile.render(mount, {
            sitekey: "${cleanKey}",
            appearance: "interaction-only",
            callback: function(tok) { resolveToken(tok); },
            "error-callback": function() { rejectToken(new Error("Verification check failed. Please retry.")); }
          });
          return;
        }
        waited += 100;
        if (waited > 8000) { rejectToken(new Error("Verification script timed out. Check content blockers and retry.")); return; }
        setTimeout(mountWidget, 100);
      })();
    });
  }
  window.fetch = function(input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var path = url;
    try { path = new URL(url, location.href).pathname; } catch (e) {}
    var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
    if (path !== "/_playground/init" || method !== "POST") return originalFetch(input, init);
    return getToken().then(function(token) {
      var next = Object.assign({}, init || {});
      var headers = new Headers((init && init.headers) || (input && input.headers) || undefined);
      headers.set("x-turnstile-token", token);
      next.headers = headers;
      return originalFetch(input, next);
    });
  };
})();</script>`;

  if (/<head(\s[^>]*)?>/i.test(html)) {
    return html.replace(/<head(\s[^>]*)?>/i, (head) => `${head}${snippet}`);
  }
  return `${snippet}${html}`;
}

/** True when the response may carry an HTML body that is safe to rewrite. */
export function canRewriteBody(request: Request, response: Response): boolean {
  if (request.method === 'HEAD' || response.body === null) return false;
  return ![101, 204, 205, 304].includes(response.status);
}

/**
 * Only the OpenClaw playground settings, for @dinkuskit/openclaw's
 * `globalThis.__openclawPlaygroundEnv`. Other secrets (Turnstile, the settings
 * seed) stay out of reach of code that reads that global.
 */
export function openclawPlaygroundEnv(env: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('OPENCLAW_PLAYGROUND_') && typeof value === 'string') out[key] = value;
  }
  return out;
}

export function applyPlaygroundNoIndex(headers: Headers): void {
  headers.set('X-Robots-Tag', 'noindex, nofollow');
}

export function dropRewrittenBodyHeaders(headers: Headers): void {
  headers.delete('Content-Length');
  headers.delete('ETag');
}

const PLAYGROUND_CLEARANCE_STYLE = `<style id="bf-playground-clearance">body:has(#emdash-playground-toolbar:not(.ec-pg-hidden)) div:has(> openclaw-emdash-chat){height:calc(100svh - 118px)!important;min-height:calc(100svh - 118px)!important;}</style>`;

export function injectPlaygroundNoIndex(html: string): string {
  const withRobots = /<meta\s+name=["']robots["']/i.test(html)
    ? html.replace(
        /<meta\s+name=["']robots["'][^>]*>/i,
        '<meta name="robots" content="noindex, nofollow" />',
      )
    : html.replace(
        /<head(\s[^>]*)?>/i,
        (head) => `${head}<meta name="robots" content="noindex, nofollow" />`,
      );

  if (withRobots.includes('id="bf-playground-clearance"')) return withRobots;
  return withRobots.replace('</head>', `${PLAYGROUND_CLEARANCE_STYLE}</head>`);
}

const EMDASH_DEPLOY_LINK =
  /(<a class="ec-pg-btn ec-pg-btn--deploy" href=")https:\/\/github\.com\/emdash-cms\/emdash("[^>]*>\s*)Deploy your own/;

export function retargetPlaygroundDeployLink(html: string): string {
  return html.replace(EMDASH_DEPLOY_LINK, '$1https://blobster.dev$2Open live Blobster Factory');
}

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SESSION_CLOCK_SKEW_MS = 60_000;

export function playgroundSessionCreatedAt(token: string): number | undefined {
  if (!ULID_PATTERN.test(token)) return undefined;
  let time = 0;
  for (const char of token.slice(0, 10).toUpperCase()) {
    time = time * 32 + ULID_ALPHABET.indexOf(char);
  }
  return time;
}

export function isUsablePlaygroundSession(token: string, now = Date.now()): boolean {
  const createdAt = playgroundSessionCreatedAt(token);
  if (createdAt === undefined) return false;
  return (
    createdAt <= now + SESSION_CLOCK_SKEW_MS &&
    now - createdAt < PLAYGROUND_TTL_SECONDS * 1000
  );
}

export function readPlaygroundSession(request: Request): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === PLAYGROUND_COOKIE_NAME) {
      return part.slice(index + 1).trim();
    }
  }
  return undefined;
}

export function withoutPlaygroundSession(request: Request): Request {
  const header = request.headers.get('cookie') ?? '';
  const kept = header
    .split(';')
    .filter((part) => part.split('=')[0]?.trim() !== PLAYGROUND_COOKIE_NAME)
    .join(';')
    .trim();
  const headers = new Headers(request.headers);
  if (kept) headers.set('cookie', kept);
  else headers.delete('cookie');
  return new Request(request, { headers });
}

export const CLEAR_PLAYGROUND_COOKIE = `${PLAYGROUND_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`;

export async function isPlaygroundInitFailure(response: Response): Promise<boolean> {
  if (response.status !== 500) return false;
  if (!response.headers.get('content-type')?.includes('application/json')) return false;
  try {
    const body = (await response.clone().json()) as { error?: { code?: unknown } };
    return body?.error?.code === 'PLAYGROUND_INIT_ERROR';
  } catch {
    return false;
  }
}

export function recoverFromPlaygroundInitFailure(
  request: Request,
  failure: Response,
): Response {
  if (request.method === 'GET' || request.method === 'HEAD') {
    // Drop the broken session and start over on EmDash's loading page.
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/playground',
        'Set-Cookie': CLEAR_PLAYGROUND_COOKIE,
        'Cache-Control': 'no-store',
      },
    });
  }
  const headers = new Headers(failure.headers);
  headers.append('Set-Cookie', CLEAR_PLAYGROUND_COOKIE);
  headers.set('Cache-Control', 'no-store');
  return new Response(failure.body, { status: failure.status, headers });
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function settingsSeed(env: Record<string, unknown>): string {
  const seed =
    typeof env.PLAYGROUND_SETTINGS_SEED === 'string' ? env.PLAYGROUND_SETTINGS_SEED.trim() : '';
  if (!seed) {
    throw new Error(
      'PLAYGROUND_SETTINGS_SEED is not set. Set it as a Worker secret (or in dist-playground/server/.dev.vars locally).',
    );
  }
  return seed;
}

/**
 * EmDash encryption key for the playground, in EmDash's
 * `emdash_enc_v1_<43 base64url chars>` format. Uses EMDASH_ENCRYPTION_KEY when
 * set, otherwise derives one from the secret PLAYGROUND_SETTINGS_SEED. There is
 * no built-in fallback seed: a seed in public source would be a public key.
 * Admission cookies are signed with the seed, or with EMDASH_ENCRYPTION_KEY
 * when only that is set (see playgroundAdmissionKey).
 */
export async function derivePlaygroundEncryptionKey(
  env: Record<string, unknown>,
): Promise<string> {
  const explicit =
    typeof env.EMDASH_ENCRYPTION_KEY === 'string' ? env.EMDASH_ENCRYPTION_KEY.trim() : '';
  if (explicit) return explicit;
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`blobster-playground:encryption:${settingsSeed(env)}`),
  );
  return `emdash_enc_v1_${toBase64Url(new Uint8Array(digest))}`;
}

// --- Admission: every sandbox must be created through the gated init POST ---

export const PLAYGROUND_ADMIT_COOKIE_NAME = 'blobster_playground_admit';

function admissionSecret(env: Record<string, unknown>): string {
  const seed =
    typeof env.PLAYGROUND_SETTINGS_SEED === 'string' ? env.PLAYGROUND_SETTINGS_SEED.trim() : '';
  if (seed) return `seed:${seed}`;
  const explicit =
    typeof env.EMDASH_ENCRYPTION_KEY === 'string' ? env.EMDASH_ENCRYPTION_KEY.trim() : '';
  if (explicit) return `key:${explicit}`;
  throw new Error(
    'Set PLAYGROUND_SETTINGS_SEED (or EMDASH_ENCRYPTION_KEY) as a Worker secret before serving the playground.',
  );
}

const admitKeys = new Map<string, Promise<CryptoKey>>();

/**
 * HMAC key for admission cookies. Throws when no secret is configured, so the
 * middleware checks it before EmDash can create any sandbox.
 */
export function playgroundAdmissionKey(env: Record<string, unknown>): Promise<CryptoKey> {
  const secret = admissionSecret(env);
  let key = admitKeys.get(secret);
  if (!key) {
    key = crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(`blobster-playground:admit:${secret}`),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    );
    admitKeys.set(secret, key);
  }
  return key;
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | undefined {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return undefined;
  try {
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return undefined;
  }
}

/** Signature binding a playground session token to a passed init gate. */
export async function signPlaygroundAdmission(
  token: string,
  env: Record<string, unknown>,
): Promise<string> {
  const key = await playgroundAdmissionKey(env);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(token));
  return toBase64Url(new Uint8Array(sig));
}

export async function isAdmittedPlaygroundSession(
  token: string,
  admission: string | undefined,
  env: Record<string, unknown>,
): Promise<boolean> {
  if (!admission) return false;
  const sig = fromBase64Url(admission);
  if (!sig) return false;
  const key = await playgroundAdmissionKey(env);
  return crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(token));
}

export function admissionCookie(value: string, secure: boolean): string {
  return `${PLAYGROUND_ADMIT_COOKIE_NAME}=${value}; Max-Age=${PLAYGROUND_TTL_SECONDS}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim() || undefined;
  }
  return undefined;
}
