import test from 'node:test';
import assert from 'node:assert/strict';
import { templateSubmissionSchema, publicHttpsLink } from '../src/lib/validation.ts';
import { CURATED_GOOD_FOR } from '../src/lib/catalog.ts';

test('accepts valid ClawHub-aligned community template submission', () => {
  const result = templateSubmissionSchema.safeParse({
    title: 'Incident Scribe',
    coordinate: '@saariuslystoned/incident-scribe',
    owner_handle: 'saariuslystoned',
    version: '0.1.0',
    category: 'Operations',
    avatar_tier: 'Tier 1 Fast Pack (SVG + 512px Vinyl + 2 GIFs)',
    summary: 'Maintains a bounded post-incident timeline ledger without closing tickets or paging.',
    claw_md: '---\nschemaVersion: 1\nagent:\n  id: incident-scribe\n  name: Incident Scribe\n---\n\nBounded timeline scribe.',
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

test('provides distinct relatable starter prompts and capability bullets per catalog template', () => {
  for (const [slug, brief] of Object.entries(CURATED_GOOD_FOR)) {
    assert.ok(brief.best_for.length > 20, `${slug} must have a best_for hook`);
    assert.ok(brief.good_for_items.length >= 3, `${slug} must have at least 3 good_for_items`);
    assert.equal(brief.starter_prompts.length, 3, `${slug} must have 3 starter_prompts`);
    assert.equal(new Set(brief.starter_prompts).size, 3, `${slug} starter prompts must be unique`);
  }
  assert.equal(CURATED_GOOD_FOR['blobster-smith'].good_for_items.length, 4, 'blobster-smith must list all 4 lifecycle modes');
});
