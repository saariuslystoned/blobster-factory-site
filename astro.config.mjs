import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import emdash, { local } from 'emdash/astro';
import { sqlite } from 'emdash/db';
import { d1, r2, access } from '@emdash-cms/cloudflare';
import { fileURLToPath } from 'node:url';

const edge = process.env.CATALOG_TARGET === 'cloudflare';
if (edge && !process.env.CF_ACCESS_TEAM_DOMAIN) {
  throw new Error('CF_ACCESS_TEAM_DOMAIN is required for the production Cloudflare build');
}

export default defineConfig({
  output: 'server',
  site: 'https://blobsterfactory.com',
  adapter: edge ? cloudflare() : node({ mode: 'standalone' }),
  devToolbar: { enabled: false },
  integrations: [
    react(),
    emdash({
      siteUrl: edge ? 'https://blobsterfactory.com' : undefined,
      auth: edge
        ? access({
            teamDomain: process.env.CF_ACCESS_TEAM_DOMAIN,
            audienceEnvVar: 'CF_ACCESS_AUDIENCE',
            defaultRole: 20,
          })
        : undefined,
      database: edge
        ? d1({ binding: 'DB', session: 'auto' })
        : sqlite({ url: process.env.CATALOG_DATABASE || 'file:./catalog.db' }),
      storage: edge
        ? r2({ binding: 'MEDIA' })
        : local({ directory: './uploads', baseUrl: '/_emdash/api/media/file' }),
      plugins: [
        {
          id: 'blobster-submissions',
          version: '0.1.0',
          entrypoint: fileURLToPath(new URL('./src/lib/plugin.ts', import.meta.url)),
          adminPages: [{ path: '/review', label: 'Review templates', icon: 'clipboard-check' }],
        },
      ],
    }),
  ],
});
