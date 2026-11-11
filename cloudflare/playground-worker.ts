import astroHandler from '@astrojs/cloudflare/entrypoints/server';
import { EmDashPreviewDB } from '@emdash-cms/cloudflare/db/playground';
import { PluginBridge } from '@emdash-cms/cloudflare/worker';
import {
  applyPlaygroundNoIndex,
  canRewriteBody,
  CLEAR_PLAYGROUND_COOKIE,
  derivePlaygroundEncryptionKey,
  dropRewrittenBodyHeaders,
  injectPlaygroundNoIndex,
  injectTurnstileIntoLoadingPage,
  isPlaygroundInitFailure,
  isUsablePlaygroundSession,
  PLAYGROUND_COOKIE_NAME,
  readPlaygroundSession,
  recoverFromPlaygroundInitFailure,
  retargetPlaygroundDeployLink,
  withoutPlaygroundSession,
} from '../src/lib/playground-contract';

export { EmDashPreviewDB, PluginBridge };

interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export default {
  async fetch(
    request: Request,
    env: Record<string, unknown>,
    ctx: WorkerExecutionContext,
  ): Promise<Response> {
    const session = readPlaygroundSession(request);
    const staleSession = session !== undefined && !isUsablePlaygroundSession(session);
    if (staleSession) {
      request = withoutPlaygroundSession(request);
    }

    const url = new URL(request.url);
    const requestOrigin = url.origin;
    // Public origin from config, not from whichever request reached the
    // isolate first; the request origin is only a last resort.
    const configuredSiteUrl =
      typeof env.PLAYGROUND_SITE_URL === 'string' ? env.PLAYGROUND_SITE_URL.trim() : '';
    process.env.EMDASH_SITE_URL ||= configuredSiteUrl || requestOrigin;
    if (!process.env.EMDASH_ENCRYPTION_KEY) {
      try {
        process.env.EMDASH_ENCRYPTION_KEY = await derivePlaygroundEncryptionKey(env);
      } catch (error) {
        console.error('[blobster-playground]', error);
        return Response.json(
          { error: { code: 'PLAYGROUND_MISCONFIGURED', message: 'The playground is not configured yet.' } },
          { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } },
        );
      }
    }

    let response = await (
      astroHandler as {
        fetch(
          req: Request,
          workerEnv: Record<string, unknown>,
          execCtx: WorkerExecutionContext,
        ): Promise<Response>;
      }
    ).fetch(request, env, ctx);

    if (await isPlaygroundInitFailure(response)) {
      console.error('[blobster-playground] init failed; resetting visitor session');
      response = recoverFromPlaygroundInitFailure(request, response);
    }

    const headers = new Headers(response.headers);
    applyPlaygroundNoIndex(headers);

    if (
      staleSession &&
      !headers.getSetCookie().some((cookie) => cookie.startsWith(`${PLAYGROUND_COOKIE_NAME}=`))
    ) {
      headers.append('Set-Cookie', CLEAR_PLAYGROUND_COOKIE);
    }

    if (!headers.get('content-type')?.includes('text/html') || !canRewriteBody(request, response)) {
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    let html = retargetPlaygroundDeployLink(injectPlaygroundNoIndex(await response.text()));
    const turnstileSiteKey =
      typeof env.TURNSTILE_SITE_KEY === 'string' ? env.TURNSTILE_SITE_KEY.trim() : '';
    if (url.pathname === '/playground' && turnstileSiteKey) {
      html = injectTurnstileIntoLoadingPage(html, turnstileSiteKey);
    }

    dropRewrittenBodyHeaders(headers);
    headers.set('x-blobster-playground', '1');
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
