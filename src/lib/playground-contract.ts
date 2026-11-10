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

export async function checkPlaygroundInitLimit(
  request: Request,
  limiters: PlaygroundInitLimiters,
): Promise<Response | undefined> {
  const clientIp = extractClientIp(request);

  if (
    limiters.perIp &&
    !(await limiters.perIp.limit({ key: `blobster-playground:init:ip:${clientIp}` })).success
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

export async function checkPlaygroundChatLimit(
  request: Request,
  limiter?: RateLimiterBinding,
): Promise<Response | undefined> {
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(contentLength) && contentLength > 32_768) {
    return Response.json(
      {
        ok: false,
        error: 'Prompt payload exceeds the 32 KiB Playground limit.',
      },
      { status: 413, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (!limiter) return undefined;
  const clientIp = extractClientIp(request);
  const allowed = await limiter.limit({ key: `blobster-playground:chat:ip:${clientIp}` });
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

  const headSnippet = `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>`;
  const containerSnippet = `<div id="bf-turnstile-mount" style="min-height:1px"></div>`;
  const fetchTarget = `fetch("/_playground/init", { method: "POST", credentials: "same-origin" })`;
  const fetchReplacement = `new Promise(function(resolveToken, rejectToken) {
      var waited = 0;
      function mountWidget() {
        if (window.turnstile && typeof window.turnstile.render === "function") {
          window.turnstile.render("#bf-turnstile-mount", {
            sitekey: "${cleanKey}",
            appearance: "interaction-only",
            callback: function(tok) { resolveToken(tok); },
            "error-callback": function() { rejectToken(new Error("Verification check failed. Please retry.")); }
          });
          return;
        }
        waited += 100;
        if (waited > 8000) {
          rejectToken(new Error("Verification script timed out. Check content blockers and retry."));
          return;
        }
        setTimeout(mountWidget, 100);
      }
      mountWidget();
    }).then(function(turnstileToken) {
      return fetch("/_playground/init", {
        method: "POST",
        credentials: "same-origin",
        headers: { "x-turnstile-token": turnstileToken }
      });
    })`;

  if (!html.includes(fetchTarget)) return html;
  return html
    .replace('</head>', `${headSnippet}</head>`)
    .replace('<div class="pg-error"', `${containerSnippet}<div class="pg-error"`)
    .replace(fetchTarget, fetchReplacement);
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

const PLAYGROUND_INIT_FAILED_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="robots" content="noindex, nofollow" /><title>Playground unavailable</title></head>
<body><h1>The playground couldn't start</h1><p><a href="/playground">Try again</a></p></body></html>`;

export function recoverFromPlaygroundInitFailure(
  request: Request,
  failure: Response,
): Response {
  if (request.method === 'GET' || request.method === 'HEAD') {
    if (new URL(request.url).searchParams.get('retry') === '1') {
      return new Response(PLAYGROUND_INIT_FAILED_HTML, {
        status: 503,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Set-Cookie': CLEAR_PLAYGROUND_COOKIE,
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      });
    }
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/playground?retry=1',
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

let cachedFallbackKey: string | undefined;

export async function derivePlaygroundEncryptionKey(
  env: Record<string, unknown>,
): Promise<string> {
  const explicit =
    typeof env.EMDASH_ENCRYPTION_KEY === 'string' ? env.EMDASH_ENCRYPTION_KEY.trim() : '';
  if (explicit) return explicit;
  const seed =
    typeof env.PLAYGROUND_SETTINGS_SEED === 'string' && env.PLAYGROUND_SETTINGS_SEED.trim()
      ? env.PLAYGROUND_SETTINGS_SEED.trim()
      : 'blobster-factory-disposable-playground-v1';
  if (cachedFallbackKey && seed === 'blobster-factory-disposable-playground-v1') {
    return cachedFallbackKey;
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const encoded = btoa(binary);
  if (seed === 'blobster-factory-disposable-playground-v1') {
    cachedFallbackKey = encoded;
  }
  return encoded;
}
