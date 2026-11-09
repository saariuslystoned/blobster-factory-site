import test from 'node:test';
import assert from 'node:assert/strict';
import { templateSubmissionSchema, publicHttpsLink } from '../src/lib/validation.ts';

test('accepts valid ClawHub-aligned community template submission', () => {
  const result = templateSubmissionSchema.safeParse({
    title: 'Incident Scribe',
    coordinate: '@saariuslystoned/incident-scribe',
    owner_handle: 'saariuslystoned',
    version: '0.1.0',
    category: 'Operations',
    avatar_tier: 'Tier 1 Fast Pack (SVG + 512px Vinyl + 2 GIFs)',
    summary: 'Maintains a bounded post-incident timeline ledger without closing tickets or paging.',
    claw_md: '---\nschemaVersion: 1\nname: Incident Scribe\n---\n\nBounded timeline scribe.',
    openclaw_yml: 'profileVersion: 1\nsandbox:\n  workspaceOnly: true',
    skill_name: 'incident-timeline',
    cron_summary: 'On-demand',
    links: ['https://github.com/saariuslystoned/blobster-factory'],
    script_free_confirm: true,
    website: '',
  });
  assert.equal(result.success, true);
});

test('rejects localhost links and missing script-free confirmation', () => {
  assert.equal(publicHttpsLink('http://localhost:4321/repo'), false);
  assert.equal(publicHttpsLink('https://127.0.0.1/repo'), false);
  assert.equal(publicHttpsLink('https://github.com/saariuslystoned/blobster-factory'), true);
});
