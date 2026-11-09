import type { APIRoute } from 'astro';
import { canonicalOrigin } from '../lib/catalog';

export const GET: APIRoute = () => {
  const origin = canonicalOrigin();
  const body = `User-agent: *\nAllow: /\nDisallow: /_emdash/\nSitemap: ${origin}/sitemap.xml\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
