import { homedir } from 'node:os';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
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

// Local-only settings seed (encryption key + admission cookie signing), kept
// stable across restarts so open sandboxes stay readable.
const seedFile = resolve(runtimeDir, 'settings-seed');
if (!existsSync(seedFile)) writeFileSync(seedFile, randomBytes(32).toString('base64url'), { mode: 0o600 });
const settingsSeed = process.env.PLAYGROUND_SETTINGS_SEED?.trim() || readFileSync(seedFile, 'utf8').trim();

// Write git-ignored .dev.vars inside dist-playground/server so workerd receives the local Forge gateway credentials
const distServerDir = resolve(root, 'dist-playground/server');
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
    `PLAYGROUND_SETTINGS_SEED=${settingsSeed}`,
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
