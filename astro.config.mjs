import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import emdash, { local } from 'emdash/astro';
import { sqlite } from 'emdash/db';
import { d1, r2, access } from '@emdash-cms/cloudflare';
import { fileURLToPath } from 'node:url';

const edge = process.env.CATALOG_TARGET === 'cloudflare';
const teamDomain = process.env.CF_ACCESS_TEAM_DOMAIN?.trim() || '';

export default defineConfig({
  output: 'server',
  site: 'https://blobster.dev',
  adapter: edge
    ? cloudflare({
        configPath: './cloudflare/wrangler.jsonc',
        imageService: 'passthrough',
      })
    : node({ mode: 'standalone' }),
  devToolbar: { enabled: false },
  integrations: [
    react(),
    emdash({
      siteUrl: edge ? 'https://blobster.dev' : undefined,
      ...(edge && teamDomain
        ? {
            auth: access({
              teamDomain,
              audienceEnvVar: 'CF_ACCESS_AUDIENCE',
              defaultRole: 20,
            }),
          }
        : {}),
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
