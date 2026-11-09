import handler, { createScheduledHandler, PluginBridge } from '@emdash-cms/cloudflare/worker';

export { PluginBridge };

const REDIRECT_HOSTS = new Set([
  'blobsterfactory.com',
  'www.blobsterfactory.com',
  'www.blobster.dev',
]);

const PUBLIC_SUBMISSION_PATH = '/_emdash/api/plugins/blobster-submissions/submit';

function isProtectedEmdashRequest(request: Request, url: URL): boolean {
  const raw = url.pathname;
  if (request.method === 'POST' && raw === PUBLIC_SUBMISSION_PATH) {
    return false;
  }
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return true;
  }
  const normalized = decoded.replace(/\/+/g, '/').toLowerCase();
  return normalized === '/_emdash' || normalized.startsWith('/_emdash/');
}

export default {
  ...handler,
  async fetch(request: Request, env: Record<string, unknown>, ctx: unknown): Promise<Response> {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();

    if (REDIRECT_HOSTS.has(host)) {
      const target = `https://blobster.dev${url.pathname}${url.search}`;
      return new Response(null, {
        status: 301,
        headers: {
          Location: target,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    if (isProtectedEmdashRequest(request, url)) {
      const teamDomain = typeof env.CF_ACCESS_TEAM_DOMAIN === 'string' ? env.CF_ACCESS_TEAM_DOMAIN.trim() : '';
      const audience = typeof env.CF_ACCESS_AUDIENCE === 'string' ? env.CF_ACCESS_AUDIENCE.trim() : '';
      const assertion = request.headers.get('cf-access-jwt-assertion')?.trim() || '';
      if (!teamDomain || !audience || !assertion) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Cloudflare Access authentication required.' }),
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-store',
            },
          },
        );
      }
    }

    if (!handler.fetch) {
      return new Response('Worker handler unavailable', { status: 500 });
    }
    const response = await handler.fetch(request, env, ctx as never);
    const rev = typeof env.BLOBSTER_REVISION === 'string' && env.BLOBSTER_REVISION ? env.BLOBSTER_REVISION : 'edge';
    const headers = new Headers(response.headers);
    headers.set('x-blobster-revision', rev);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
  scheduled: createScheduledHandler(),
};
