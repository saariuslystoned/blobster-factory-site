import { homedir } from 'node:os';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const port = Number(process.env.PLAYGROUND_PORT || '4332');
const gatewayUrl = process.env.OPENCLAW_PLAYGROUND_GATEWAY_URL || 'http://127.0.0.1:19011';
const tokenFile =
  process.env.OPENCLAW_PLAYGROUND_TOKEN_FILE ||
  resolve(homedir(), '.openclaw-blobster-dev', '.playground-gateway.token');

const gatewayToken =
  process.env.OPENCLAW_PLAYGROUND_GATEWAY_TOKEN?.trim() ||
  readFileSync(tokenFile, 'utf8').trim();

const runtimeDir = resolve(root, '.wrangler/local-playground');
mkdirSync(runtimeDir, { recursive: true });

// Write git-ignored .dev.vars inside dist/server so workerd receives the local Forge gateway credentials
const distServerDir = resolve(root, 'dist/server');
mkdirSync(distServerDir, { recursive: true });
const devVarsPath = resolve(distServerDir, '.dev.vars');
writeFileSync(
  devVarsPath,
  [
    `OPENCLAW_PLAYGROUND_GATEWAY_URL=${gatewayUrl}`,
    `OPENCLAW_PLAYGROUND_GATEWAY_TOKEN=${gatewayToken}`,
    `OPENCLAW_PLAYGROUND_AGENT_ID=blobster-smith`,
    `OPENCLAW_PLAYGROUND_ENABLED_COLLECTIONS=templates`,
    `OPENCLAW_PLAYGROUND_LOCK=1`,
  ].join('\n') + '\n',
  { mode: 0o600 },
);

const child = spawn(
  resolve(root, 'node_modules/.bin/wrangler'),
  [
    'dev',
    '--config',
    resolve(distServerDir, 'wrangler.json'),
    '--ip',
    '127.0.0.1',
    '--port',
    String(port),
    '--persist-to',
    resolve(runtimeDir, 'state'),
  ],
  {
    cwd: root,
    stdio: 'inherit',
  },
);

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
