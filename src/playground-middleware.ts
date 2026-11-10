// @ts-expect-error Supplied by Cloudflare Workers runtime in Worker builds.
import { env } from 'cloudflare:workers';
import { defineMiddleware } from 'astro:middleware';
import { onRequest as emdashPlayground } from '@emdash-cms/cloudflare/db/playground-middleware';
import {
  checkPlaygroundChatLimit,
  checkPlaygroundInitLimit,
  PLAYGROUND_CHAT_LIMITER_BINDING,
  PLAYGROUND_CREATION_LIMITER_BINDING,
  PLAYGROUND_GLOBAL_LIMITER_BINDING,
  verifyTurnstileIfConfigured,
  type RateLimiterBinding,
} from './lib/playground-contract';

const PLAYGROUND_USER_CREATED_AT = '2026-11-09T00:00:00.000Z';

export const onRequest = defineMiddleware(async (context, next) => {
  const runtimeEnv: Record<string, unknown> = {
    ...(typeof process !== 'undefined' && process.env ? process.env : {}),
    ...((env as Record<string, unknown>) ?? {}),
  };

  (globalThis as { __openclawPlaygroundEnv?: Record<string, unknown> }).__openclawPlaygroundEnv =
    runtimeEnv;

  const pathname = context.url.pathname;
  const method = context.request.method.toUpperCase();

  if (pathname === '/_playground/init' && method === 'POST') {
    const turnstileBlocked = await verifyTurnstileIfConfigured(context.request, runtimeEnv);
    if (turnstileBlocked) return turnstileBlocked;

    const initLimited = await checkPlaygroundInitLimit(context.request, {
      perIp: runtimeEnv[PLAYGROUND_CREATION_LIMITER_BINDING] as RateLimiterBinding | undefined,
      global: runtimeEnv[PLAYGROUND_GLOBAL_LIMITER_BINDING] as RateLimiterBinding | undefined,
    });
    if (initLimited) return initLimited;
  }

  if (pathname === '/_emdash/api/plugins/dinkus-openclaw/chat' && method === 'POST') {
    const chatLimited = await checkPlaygroundChatLimit(
      context.request,
      runtimeEnv[PLAYGROUND_CHAT_LIMITER_BINDING] as RateLimiterBinding | undefined,
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

  return response ?? new Response(null, { status: 204 });
});
