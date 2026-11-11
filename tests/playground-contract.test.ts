import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ulid } from 'ulidx';
import {
  applyPlaygroundNoIndex,
  checkPlaygroundChatLimit,
  checkPlaygroundInitLimit,
  canRewriteBody,
  clientRateKey,
  derivePlaygroundEncryptionKey,
  missingPlaygroundLimiters,
  openclawPlaygroundEnv,
  exceedsBodyLimit,
  isAdmittedPlaygroundSession,
  isOpenclawPluginPost,
  normalizeGatePath,
  recoverFromPlaygroundInitFailure,
  signPlaygroundAdmission,
  injectPlaygroundNoIndex,
  injectTurnstileIntoLoadingPage,
  isUsablePlaygroundSession,
  PLAYGROUND_COOKIE_NAME,
  readPlaygroundSession,
  retargetPlaygroundDeployLink,
  verifyTurnstileIfConfigured,
  withoutPlaygroundSession,
} from '../src/lib/playground-contract';

describe('Blobster Factory EmDash Playground Contract', () => {
  it('validates ULID playground session cookies within the 1-hour TTL and strips expired ones', () => {
    const fresh = ulid();
    assert.equal(isUsablePlaygroundSession(fresh), true);
    assert.equal(isUsablePlaygroundSession('not-a-ulid'), false);
    assert.equal(isUsablePlaygroundSession(fresh, Date.now() + 3601 * 1000), false);

    const req = new Request('https://dev.blobster.dev/', {
      headers: { cookie: `foo=bar; ${PLAYGROUND_COOKIE_NAME}=${fresh}; theme=dark` },
    });
    assert.equal(readPlaygroundSession(req), fresh);
    const cleaned = withoutPlaygroundSession(req);
    assert.equal(readPlaygroundSession(cleaned), undefined);
    assert.match(cleaned.headers.get('cookie') || '', /foo=bar/);
  });

  it('enforces per-IP and global creation rate limits and chat payload/rate limits', async () => {
    const req = new Request('https://dev.blobster.dev/_playground/init', {
      method: 'POST',
      headers: { 'cf-connecting-ip': '203.0.113.10' },
    });

    const blockedIp = await checkPlaygroundInitLimit(req, {
      perIp: { limit: async () => ({ success: false }) },
    });
    assert.equal(blockedIp?.status, 429);

    const allowed = await checkPlaygroundInitLimit(req, {
      perIp: { limit: async () => ({ success: true }) },
      global: { limit: async () => ({ success: true }) },
    });
    assert.equal(allowed, undefined);

    const oversizedChat = new Request('https://dev.blobster.dev/_emdash/api/plugins/dinkus-openclaw/chat', {
      method: 'POST',
      headers: { 'content-length': '65536' },
    });
    const chat413 = await checkPlaygroundChatLimit(oversizedChat);
    assert.equal(chat413?.status, 413);

    const limitedChat = await checkPlaygroundChatLimit(
      new Request('https://dev.blobster.dev/_emdash/api/plugins/dinkus-openclaw/chat', { method: 'POST' }),
      { limit: async () => ({ success: false }) },
    );
    assert.equal(limitedChat?.status, 429);
  });

  it('verifies Cloudflare Turnstile fail-closed when configured and skips cleanly in local dev', async () => {
    const reqNoToken = new Request('https://dev.blobster.dev/_playground/init', { method: 'POST' });
    assert.equal(await verifyTurnstileIfConfigured(reqNoToken, {}), undefined);

    const partial = await verifyTurnstileIfConfigured(reqNoToken, { TURNSTILE_SITE_KEY: 'site_123' });
    assert.equal(partial?.status, 503);

    const missingToken = await verifyTurnstileIfConfigured(reqNoToken, {
      TURNSTILE_SITE_KEY: 'site_123',
      TURNSTILE_SECRET_KEY: 'sec_123',
    });
    assert.equal(missingToken?.status, 403);

    const reqWithToken = new Request('https://dev.blobster.dev/_playground/init', {
      method: 'POST',
      headers: { 'x-turnstile-token': 'tok_valid' },
    });
    const verified = await verifyTurnstileIfConfigured(
      reqWithToken,
      { TURNSTILE_SITE_KEY: 'site_123', TURNSTILE_SECRET_KEY: 'sec_123' },
      (async () => Response.json({ success: true })) as unknown as typeof fetch,
    );
    assert.equal(verified, undefined);
  });

  it('injects noindex, retargets the toolbar CTA to blobster.dev, and derives 32-byte encryption keys', async () => {
    const headers = new Headers();
    applyPlaygroundNoIndex(headers);
    assert.equal(headers.get('X-Robots-Tag'), 'noindex, nofollow');

    const sampleHtml = `<!doctype html><html><head><title>Test</title></head><body><div class="pg-error"></div><script>fetch("/_playground/init", { method: "POST", credentials: "same-origin" })</script><a class="ec-pg-btn ec-pg-btn--deploy" href="https://github.com/emdash-cms/emdash" target="_blank">Deploy your own</a></body></html>`;
    const rewritten = retargetPlaygroundDeployLink(
      injectTurnstileIntoLoadingPage(injectPlaygroundNoIndex(sampleHtml), '0x4AAAAAA_site'),
    );
    assert.match(rewritten, /noindex, nofollow/);
    assert.match(rewritten, /https:\/\/blobster\.dev/);
    assert.match(rewritten, /Open live Blobster Factory/);
    assert.match(rewritten, /challenges\.cloudflare\.com\/turnstile/);

    const key = await derivePlaygroundEncryptionKey({ PLAYGROUND_SETTINGS_SEED: 'test-seed' });
    assert.match(key, /^emdash_enc_v1_[A-Za-z0-9_-]{43}$/);
    assert.equal(Buffer.from(key.slice('emdash_enc_v1_'.length), 'base64url').byteLength, 32);
    await assert.rejects(derivePlaygroundEncryptionKey({}), /PLAYGROUND_SETTINGS_SEED/);
    assert.equal(
      await derivePlaygroundEncryptionKey({ EMDASH_ENCRYPTION_KEY: 'emdash_enc_v1_explicit' }),
      'emdash_enc_v1_explicit',
    );
  });

  it('adds the Turnstile token even when EmDash changes its loading-page markup', () => {
    const html = '<!doctype html><html><head><title>x</title></head><body><script>doInit()</script></body></html>';
    const out = injectTurnstileIntoLoadingPage(html, '0x4AAAAAA_site');
    assert.match(out, /<head><script src="https:\/\/challenges\.cloudflare\.com/);
    assert.match(out, /x-turnstile-token/);
    assert.equal(injectTurnstileIntoLoadingPage(out, '0x4AAAAAA_site'), out);
  });

  it('measures chunked chat bodies that carry no Content-Length', async () => {
    const big = new Uint8Array(40_000);
    const chunked = new Request('https://dev.blobster.dev/x', {
      method: 'POST',
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(big);
          controller.close();
        },
      }),
      // @ts-expect-error Node requires duplex for stream bodies.
      duplex: 'half',
    });
    assert.equal(chunked.headers.get('content-length'), null);
    assert.equal(await exceedsBodyLimit(chunked, 32_768), true);
    assert.equal((await checkPlaygroundChatLimit(chunked))?.status, 413);
    const small = new Request('https://dev.blobster.dev/x', { method: 'POST', body: 'hi' });
    assert.equal(await exceedsBodyLimit(small, 32_768), false);
    assert.equal(await small.text(), 'hi');
  });

  it('matches OpenClaw plugin POSTs however the path is spelled', () => {
    for (const raw of [
      '/_emdash/api/plugins/dinkus-openclaw/chat',
      '/_emdash/api/plugins/dinkus-openclaw/chat/',
      '/_emdash/api/plugins/dinkus-openclaw/%63hat',
      '//_emdash//api/plugins/DINKUS-OPENCLAW/chat',
    ]) {
      const path = normalizeGatePath(raw);
      assert.ok(path && isOpenclawPluginPost('POST', path), raw);
    }
    assert.equal(isOpenclawPluginPost('GET', '/_emdash/api/plugins/dinkus-openclaw/chat'), false);
    assert.equal(isOpenclawPluginPost('POST', '/_emdash/api/plugins/dinkus-openclawx/chat'), false);
    assert.equal(normalizeGatePath('/%E0%A4%A'), undefined);
  });

  it('admits only session tokens signed by the init gate', async () => {
    const env = { PLAYGROUND_SETTINGS_SEED: 'test-seed' };
    const token = ulid();
    const sig = await signPlaygroundAdmission(token, env);
    assert.equal(await isAdmittedPlaygroundSession(token, sig, env), true);
    assert.equal(await isAdmittedPlaygroundSession(ulid(), sig, env), false);
    assert.equal(await isAdmittedPlaygroundSession(token, undefined, env), false);
    assert.equal(await isAdmittedPlaygroundSession(token, sig, { PLAYGROUND_SETTINGS_SEED: 'other' }), false);
  });

  it('sends a failed GET back to a fresh playground session', () => {
    const failure = Response.json({ error: { code: 'PLAYGROUND_INIT_ERROR' } }, { status: 500 });
    const res = recoverFromPlaygroundInitFailure(new Request('https://dev.blobster.dev/'), failure);
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('Location'), '/playground');
    assert.match(res.headers.get('Set-Cookie') || '', /Max-Age=0/);
  });

  it('counts only model turns, per playground session', async () => {
    const keys: string[] = [];
    const limiter = { limit: async ({ key }: { key: string }) => (keys.push(key), { success: true }) };
    const post = (body: unknown) =>
      new Request('https://dev.blobster.dev/_emdash/api/plugins/dinkus-openclaw/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': '198.51.100.7' },
        body: JSON.stringify(body),
      });
    assert.equal(await checkPlaygroundChatLimit(post({ action: 'get_workspace' }), limiter, 'tok'), undefined);
    assert.equal(await checkPlaygroundChatLimit(post({ action: 'record_proposal_receipt' }), limiter, 'tok'), undefined);
    assert.deepEqual(keys, []);
    await checkPlaygroundChatLimit(post({ action: 'send_message', prompt: 'hi' }), limiter, 'tok');
    await checkPlaygroundChatLimit(post({ action: 'steer_turn' }), limiter);
    await checkPlaygroundChatLimit(post({ nonsense: true }), limiter, 'tok');
    await checkPlaygroundChatLimit(post({ action: ' send_message\n' }), limiter, 'tok');
    await checkPlaygroundChatLimit(post({ action: 'some_new_action' }), limiter, 'tok');
    assert.equal(await checkPlaygroundChatLimit(post({ action: ' get_workspace ' }), limiter, 'tok'), undefined);
    assert.deepEqual(keys, [
      'blobster-playground:chat:session:tok',
      'blobster-playground:chat:ip:198.51.100.7',
      'blobster-playground:chat:session:tok',
      'blobster-playground:chat:session:tok',
      'blobster-playground:chat:session:tok',
    ]);
  });

  it('keys IPv6 clients on their /64', () => {
    const req = (ip: string) => new Request('https://dev.blobster.dev/', { headers: { 'cf-connecting-ip': ip } });
    assert.equal(clientRateKey(req('2001:db8:1:2:aaaa::1')), '2001:db8:1:2::/64');
    assert.equal(clientRateKey(req('2001:db8:1:2:ffff:ffff:ffff:ffff')), '2001:db8:1:2::/64');
    assert.equal(clientRateKey(req('2001:db8::1')), '2001:db8:0:0::/64');
    assert.equal(clientRateKey(req('203.0.113.9')), '203.0.113.9');
    assert.equal(clientRateKey(req('::ffff:203.0.113.9')), '203.0.113.9');
  });

  it('signs admissions with EMDASH_ENCRYPTION_KEY when no seed is set, and refuses with neither', async () => {
    const env = { EMDASH_ENCRYPTION_KEY: 'emdash_enc_v1_explicit' };
    const token = ulid();
    const sig = await signPlaygroundAdmission(token, env);
    assert.equal(await isAdmittedPlaygroundSession(token, sig, env), true);
    assert.equal(await isAdmittedPlaygroundSession(token, 'not*base64', env), false);
    await assert.rejects(signPlaygroundAdmission(token, {}), /PLAYGROUND_SETTINGS_SEED/);
  });

  it('leaves body-less responses alone and exposes only OpenClaw playground settings', () => {
    const get = new Request('https://dev.blobster.dev/');
    assert.equal(canRewriteBody(get, new Response(null, { status: 304 })), false);
    assert.equal(canRewriteBody(new Request('https://dev.blobster.dev/', { method: 'HEAD' }), new Response('x')), false);
    assert.equal(canRewriteBody(get, new Response('<html></html>')), true);
    assert.deepEqual(
      openclawPlaygroundEnv({
        OPENCLAW_PLAYGROUND_AGENT_ID: 'blobster-smith',
        OPENCLAW_PLAYGROUND_GATEWAY_TOKEN: 'gw',
        TURNSTILE_SECRET_KEY: 'secret',
        PLAYGROUND_SETTINGS_SEED: 'seed',
        PLAYGROUND_DB: {},
      }),
      { OPENCLAW_PLAYGROUND_AGENT_ID: 'blobster-smith', OPENCLAW_PLAYGROUND_GATEWAY_TOKEN: 'gw' },
    );
  });

  it('caps model turns per address across sessions, and fails closed without limiter bindings', async () => {
    const send = () =>
      new Request('https://dev.blobster.dev/_emdash/api/plugins/dinkus-openclaw/chat', {
        method: 'POST',
        headers: { 'cf-connecting-ip': '2001:db8:9:9::5' },
        body: JSON.stringify({ action: 'send_message' }),
      });
    const ipKeys: string[] = [];
    const ok = { limit: async () => ({ success: true }) };
    const ipFull = { limit: async ({ key }: { key: string }) => (ipKeys.push(key), { success: false }) };
    const ipRefusal = await checkPlaygroundChatLimit(send(), ok, 'fresh-session', ipFull);
    assert.equal(ipRefusal?.status, 429);
    assert.match(((await ipRefusal!.json()) as { error: string }).error, /60\/min/);
    assert.deepEqual(ipKeys, ['blobster-playground:chat:ip:2001:db8:9:9::/64']);

    assert.deepEqual(missingPlaygroundLimiters({ PLAYGROUND_CREATION_LIMITER: ok, PLAYGROUND_GLOBAL_LIMITER: ok }), [
      'PLAYGROUND_CHAT_LIMITER',
      'PLAYGROUND_CHAT_IP_LIMITER',
    ]);
  });
});
