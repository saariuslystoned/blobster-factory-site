// @ts-expect-error Supplied by Cloudflare Workers runtime in Worker builds.
import { env } from 'cloudflare:workers';
import { defineMiddleware } from 'astro:middleware';
import { onRequest as emdashPlayground } from '@emdash-cms/cloudflare/db/playground-middleware';
import {
  admissionCookie,
  checkPlaygroundChatLimit,
  checkPlaygroundInitLimit,
  isAdmittedPlaygroundSession,
  isOpenclawPluginPost,
  missingPlaygroundLimiters,
  normalizeGatePath,
  openclawPlaygroundEnv,
  PLAYGROUND_ADMIT_COOKIE_NAME,
  PLAYGROUND_CHAT_IP_LIMITER_BINDING,
  PLAYGROUND_CHAT_LIMITER_BINDING,
  PLAYGROUND_COOKIE_NAME,
  PLAYGROUND_CREATION_LIMITER_BINDING,
  PLAYGROUND_GLOBAL_LIMITER_BINDING,
  playgroundAdmissionKey,
  signPlaygroundAdmission,
  verifyTurnstileIfConfigured,
  type RateLimiterBinding,
} from './lib/playground-contract';

const PLAYGROUND_USER_CREATED_AT = '2026-11-09T00:00:00.000Z';

// Paths EmDash's playground middleware handles before it touches a sandbox.
const UNGATED_PATHS = new Set(['/playground', '/_playground/reset']);
const INIT_PATH = '/_playground/init';

function refuse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const runtimeEnv = (env as Record<string, unknown>) ?? {};

  const g = globalThis as { __openclawPlaygroundEnv?: Record<string, unknown> };
  g.__openclawPlaygroundEnv ??= openclawPlaygroundEnv(runtimeEnv);

  // Fail before EmDash can create a sandbox if no admission secret is set.
  try {
    await playgroundAdmissionKey(runtimeEnv);
  } catch (error) {
    console.error('[blobster-playground]', error);
    return refuse(503, 'PLAYGROUND_MISCONFIGURED', 'The playground is not configured yet.');
  }
  const missingLimiters = missingPlaygroundLimiters(runtimeEnv);
  if (missingLimiters.length > 0) {
    console.error('[blobster-playground] missing rate limiter bindings:', missingLimiters.join(', '));
    return refuse(503, 'PLAYGROUND_MISCONFIGURED', 'The playground is not configured yet.');
  }

  const request = context.request;
  const method = request.method.toUpperCase();
  const pathname = normalizeGatePath(context.url.pathname);
  if (pathname === undefined) return refuse(400, 'BAD_PATH', 'Malformed request path.');

  // EmDash matches its own playground paths on the raw pathname, so gate on
  // the raw form too: "/Playground" must not count as the ungated page.
  const rawPath = context.url.pathname;
  // Read the session the same way EmDash does (Astro cookies, URI-decoded).
  const token = context.cookies.get(PLAYGROUND_COOKIE_NAME)?.value || undefined;
  const isInit = rawPath === INIT_PATH && method === 'POST';

  if (isInit) {
    // Cheap limiters first, so junk tokens cannot drive unlimited siteverify calls.
    const initLimited = await checkPlaygroundInitLimit(request, {
      perIp: runtimeEnv[PLAYGROUND_CREATION_LIMITER_BINDING] as RateLimiterBinding | undefined,
      global: runtimeEnv[PLAYGROUND_GLOBAL_LIMITER_BINDING] as RateLimiterBinding | undefined,
    });
    if (initLimited) return initLimited;

    const turnstileBlocked = await verifyTurnstileIfConfigured(request, runtimeEnv);
    if (turnstileBlocked) return turnstileBlocked;
  } else if (token && !UNGATED_PATHS.has(rawPath)) {
    // EmDash creates and seeds a sandbox for any unseen session cookie on any
    // path. Only sessions that passed the init gate above may reach it.
    const admitted = await isAdmittedPlaygroundSession(
      token,
      context.cookies.get(PLAYGROUND_ADMIT_COOKIE_NAME)?.value || undefined,
      runtimeEnv,
    );
    if (!admitted) {
      if (method === 'GET' || method === 'HEAD') return context.redirect('/_playground/reset');
      return refuse(403, 'PLAYGROUND_NOT_ADMITTED', 'Start a playground session at /playground first.');
    }
  }

  if (isOpenclawPluginPost(method, pathname)) {
    const chatLimited = await checkPlaygroundChatLimit(
      request,
      runtimeEnv[PLAYGROUND_CHAT_LIMITER_BINDING] as RateLimiterBinding | undefined,
      token,
      runtimeEnv[PLAYGROUND_CHAT_IP_LIMITER_BINDING] as RateLimiterBinding | undefined,
    );
    if (chatLimited) return chatLimited;
  }

  const response = await emdashPlayground(context, ((...args: Parameters<typeof next>) => {
    const locals = context.locals as { user?: { createdAt?: unknown } };
    if (locals.user && locals.user.createdAt === undefined) {
      locals.user = { ...locals.user, createdAt: PLAYGROUND_USER_CREATED_AT };
    }
    return next(...args);
  }) as typeof next);

  const result = response ?? new Response(null, { status: 204 });
  if (isInit && token && result.ok) {
    const signed = await signPlaygroundAdmission(token, runtimeEnv);
    const headers = new Headers(result.headers);
    headers.append('Set-Cookie', admissionCookie(signed, context.url.protocol === 'https:'));
    return new Response(result.body, { status: result.status, statusText: result.statusText, headers });
  }
  return result;
});
