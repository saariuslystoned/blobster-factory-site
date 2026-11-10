import assert from 'node:assert/strict';

const origin = new URL(process.argv[2] || 'http://127.0.0.1:4331').origin;
const queue = ['/', '/pipeline', '/submit'];
const seen = new Set();

while (queue.length) {
  const routePath = queue.shift();
  if (!routePath || seen.has(routePath)) continue;
  seen.add(routePath);
  assert(!/%2f/i.test(routePath));
  const res = await fetch(origin + routePath);
  assert.equal(res.status, 200, `Expected 200 on ${routePath}, got ${res.status}`);
  const html = await res.text();
  if (routePath === '/') {
    assert(html.includes('data-content-source="emdash"'), 'Homepage must render EmDash-backed cards');
  }
  if (/^\/templates\/[^/]+$/.test(routePath)) {
    assert(html.includes('data-good-for-dossier'), `${routePath} must render R2-C1 capability dossier`);
    assert(html.includes('data-copy-starter='), `${routePath} must render clickable starter prompt chips`);
  }
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const rawHref = match[1].replaceAll('&amp;', '&');
    if (rawHref.startsWith('#') || rawHref.startsWith('mailto:')) continue;
    const u = new URL(rawHref, origin);
    if (
      u.origin === origin &&
      !u.pathname.startsWith('/_emdash') &&
      !u.pathname.startsWith('/_astro') &&
      !u.pathname.endsWith('.tgz')
    ) {
      queue.push(u.pathname + u.search);
    }
  }
}

const admin = await fetch(origin + '/_emdash/api/plugins/blobster-submissions/admin', {
  method: 'POST',
  redirect: 'manual',
  headers: { 'Content-Type': 'application/json', 'X-EmDash-Request': '1' },
  body: JSON.stringify({ type: 'page_load', page: '/review' }),
});
assert([401, 403].includes(admin.status));

const tgz = await fetch(origin + '/t/blobster-smith.tgz');
assert.equal(tgz.status, 200, 'Expected downloadable blobster-smith.tgz');

const robots = await (await fetch(origin + '/robots.txt')).text();
assert(robots.includes('Sitemap:'));

console.log(
  JSON.stringify(
    {
      passed: true,
      origin,
      routesChecked: seen.size,
      routes: [...seen],
      anonymousAdminStatus: admin.status,
      tarballVerified: true,
    },
    null,
    2,
  ),
);
