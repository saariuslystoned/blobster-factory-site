import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import emdash from 'emdash/astro';
import { playgroundDatabase } from '@emdash-cms/cloudflare';
import { openclawNativePlugin } from '@dinkuskit/openclaw/native';
import { openclawBridge } from '@dinkuskit/openclaw/astro';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  output: 'server',
  // Separate from dist/ so `npm run deploy` can never ship the playground build.
  outDir: './dist-playground',
  site: 'https://dev.blobster.dev',
  session: {
    driver: 'memory',
  },
  adapter: cloudflare({
    configPath:
      process.env.BLOBSTER_PLAYGROUND_WRANGLER_CONFIG ?? './cloudflare/wrangler.playground.jsonc',
    imageService: 'passthrough',
  }),
  devToolbar: { enabled: false },
  integrations: [
    react(),
    openclawBridge(),
    emdash({
      database: playgroundDatabase({ binding: 'PLAYGROUND_DB' }),
      storage: {
        entrypoint: '@emdash-cms/cloudflare/db/playground',
        config: {},
      },
      playground: {
        middlewareEntrypoint: fileURLToPath(
          new URL('./src/playground-middleware.ts', import.meta.url),
        ),
      },
      plugins: [
        {
          id: 'blobster-submissions',
          version: '0.1.0',
          entrypoint: fileURLToPath(new URL('./src/lib/plugin.ts', import.meta.url)),
          adminPages: [{ path: '/review', label: 'Review templates', icon: 'clipboard-check' }],
        },
        openclawNativePlugin(),
      ],
    }),
  ],
});
