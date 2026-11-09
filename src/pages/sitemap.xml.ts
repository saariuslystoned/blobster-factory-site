import type { APIRoute } from 'astro';
import { publishedTemplates, canonicalOrigin } from '../lib/catalog';

export const GET: APIRoute = async () => {
  const origin = canonicalOrigin();
  const entries = await publishedTemplates();
  const staticPaths = ['/', '/pipeline', '/submit'];
  const urls = [
    ...staticPaths.map((p) => `${origin}${p}`),
    ...entries.map((e) => `${origin}/templates/${encodeURIComponent(e.slug)}`),
  ];
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((loc) => `  <url><loc>${loc}</loc></url>`),
    '</urlset>',
  ].join('\n');
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
