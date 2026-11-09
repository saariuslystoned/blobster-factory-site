import { definePlugin } from 'emdash';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { templateSubmissionSchema, submissionFieldLabels, type TemplateSubmissionInput } from './validation';

const decisionSchema = z.object({
  type: z.literal('form_submit'),
  action_id: z.string().regex(/^decide:[a-f0-9-]{36}$/),
  values: z.object({
    decision: z.enum(['approve', 'deny']),
    reason: z.string().trim().max(1000).default(''),
  }),
});

interface StoredSubmission {
  status: 'pending' | 'approving' | 'approved' | 'denied';
  createdAt: string;
  reviewedAt?: string;
  reason?: string;
  contentId: string;
  data: Omit<TemplateSubmissionInput, 'website' | 'script_free_confirm'>;
}

interface RateCounter {
  count?: number;
}

type BlockNode = Record<string, unknown>;

const sectionBlock = (text: string): BlockNode => ({ type: 'section', text });

export function createPlugin() {
  return definePlugin({
    id: 'blobster-submissions',
    version: '0.1.0',
    capabilities: ['content:read', 'content:write', 'content:publish'],
    storage: {
      submissions: { indexes: ['status', 'createdAt'] },
      limits: { indexes: [] },
    },
    admin: {
      pages: [{ path: '/review', label: 'Review templates', icon: 'clipboard-check' }],
    },
    routes: {
      submit: {
        public: true,
        methods: ['POST'],
        request: { body: 'json', maxBytes: 48000 },
        handler: async (ctx) => {
          const parsed = templateSubmissionSchema.safeParse(ctx.input);
          if (!parsed.success) {
            return {
              ok: false,
              error: 'Review the highlighted fields before submitting.',
              fields: parsed.error.flatten().fieldErrors,
            };
          }
          const origin = ctx.request.headers.get('origin');
          if (!origin || origin !== new URL(ctx.request.url).origin) {
            return { ok: false, error: 'Submit directly from this site.' };
          }

          const hour = Math.floor(Date.now() / 3600000);
          const limitStore = ctx.storage.limits;
          const rateKey = `hour:${hour}`;
          for (let attempt = 0; attempt < 4; attempt += 1) {
            const current = await limitStore.getVersioned(rateKey);
            const count = ((current?.value as RateCounter | undefined)?.count) ?? 0;
            if (count >= 30) {
              return { ok: false, error: 'Submission queue is at hourly capacity. Try again shortly.' };
            }
            const cas = await limitStore.compareAndSet(rateKey, current?.revision ?? null, {
              count: count + 1,
            });
            if (cas.applied) break;
            if (attempt === 3) {
              return { ok: false, error: 'Queue busy; retry in a moment.' };
            }
          }

          const digest = createHash('sha256').update(JSON.stringify(parsed.data)).digest('hex');
          const dupe = await limitStore.compareAndSet(`duplicate:${digest}`, null, { at: Date.now() });
          if (!dupe.applied) {
            return { ok: false, error: 'This exact template manifest is already in the review queue.' };
          }

          const id = crypto.randomUUID();
          const { website: _website, script_free_confirm: _confirm, ...cleanData } = parsed.data;
          const slugCandidate = cleanData.coordinate.split('/')[1] || `community-${id.slice(0, 8)}`;

          try {
            const created = await ctx.content!.create!('templates', {
              title: cleanData.title,
              slug: slugCandidate,
              coordinate: cleanData.coordinate,
              owner_handle: cleanData.owner_handle,
              pkg_version: cleanData.version,
              channel: 'Community',
              category: cleanData.category,
              scan_status: 'pending-review',
              avatar_tier: cleanData.avatar_tier,
              summary: cleanData.summary,
              claw_md: cleanData.claw_md,
              openclaw_yml: cleanData.openclaw_yml,
              skill_name: cleanData.skill_name,
              cron_summary: cleanData.cron_summary,
              links: cleanData.links.join('\n'),
            });
            const record: StoredSubmission = {
              status: 'pending',
              createdAt: new Date().toISOString(),
              contentId: created.id,
              data: cleanData,
            };
            await ctx.storage.submissions.put(id, record);
            return { ok: true, reference: id };
          } catch {
            await limitStore.delete(`duplicate:${digest}`);
            return { ok: false, error: 'Submission could not be saved. Try again shortly.' };
          }
        },
      },
      admin: {
        permission: 'content:publish_any',
        methods: ['POST'],
        handler: async (ctx) => {
          let toast: { type: 'success' | 'error'; message: string } | undefined;
          const parsedDecision = decisionSchema.safeParse(ctx.input);
          if (parsedDecision.success) {
            const id = parsedDecision.data.action_id.slice(7);
            const store = ctx.storage.submissions;
            const existing = await store.getVersioned(id);
            const row = existing?.value as StoredSubmission | undefined;

            if (!row || !['pending', 'approving'].includes(row.status)) {
              toast = { type: 'error', message: 'Submission is already closed.' };
            } else if (parsedDecision.data.values.decision === 'deny' && !parsedDecision.data.values.reason) {
              toast = { type: 'error', message: 'Provide a reason when denying a template.' };
            } else if (row.status === 'approving' && parsedDecision.data.values.decision === 'deny') {
              toast = { type: 'error', message: 'Approval already started; retry approval to finish.' };
            } else if (parsedDecision.data.values.decision === 'deny') {
              const cas = await store.compareAndSet(id, existing!.revision, {
                ...row,
                status: 'denied',
                reason: parsedDecision.data.values.reason,
                reviewedAt: new Date().toISOString(),
              });
              toast = {
                type: cas.applied ? 'success' : 'error',
                message: cas.applied ? 'Denied and recorded.' : 'Concurrent edit detected; refresh.',
              };
            } else {
              const claimed =
                row.status === 'approving' ||
                (await store.compareAndSet(id, existing!.revision, { ...row, status: 'approving' })).applied;
              if (!claimed) {
                toast = { type: 'error', message: 'Concurrent edit detected; refresh.' };
              } else {
                try {
                  const content = await ctx.content!.getVersioned!('templates', row.contentId);
                  if (!content) throw new Error('Missing draft entry');
                  if (content.item.status !== 'published') {
                    await ctx.content!.publish!('templates', row.contentId, { _rev: content._rev });
                  }
                  await store.put(id, {
                    ...row,
                    status: 'approved',
                    reviewedAt: new Date().toISOString(),
                  });
                  toast = { type: 'success', message: 'Approved and published to Blobster Factory.' };
                } catch {
                  toast = { type: 'error', message: 'Publish incomplete; safe to retry approval.' };
                }
              }
            }
          }

          const rawInput = (ctx.input ?? {}) as Record<string, unknown>;
          const activeFilter =
            rawInput.type === 'block_action' &&
            typeof rawInput.value === 'string' &&
            ['pending', 'approved', 'denied'].includes(rawInput.value)
              ? rawInput.value
              : 'pending';

          const results = await ctx.storage.submissions.query({
            where: { status: activeFilter === 'pending' ? { in: ['pending', 'approving'] } : activeFilter },
            orderBy: { createdAt: 'desc' },
            limit: 100,
          });

          const blocks: BlockNode[] = [
            { type: 'header', text: 'Community Agent Template Moderation Queue' },
            sectionBlock(
              'Mirror ClawHub trust rules before approving: verify zero package.json lifecycle scripts, workspaceOnly: true sandbox posture, explicit tool allowlist, and <20-shape 24px SVG clarity.',
            ),
            {
              type: 'actions',
              elements: ['pending', 'approved', 'denied'].map((val) => ({
                type: 'button',
                action_id: 'filter',
                label: val[0].toUpperCase() + val.slice(1),
                value: val,
              })),
            },
          ];

          if (results.items.length === 0) {
            blocks.push({ type: 'empty', title: `No ${activeFilter} template submissions` });
          }

          for (const { id, data: rawRow } of results.items) {
            const row = rawRow as StoredSubmission;
            const d = row.data;
            blocks.push(
              { type: 'divider' },
              { type: 'header', text: `${d.title} (${d.coordinate}@${d.version})` },
              sectionBlock(`@${d.owner_handle} · ${d.category} · Status: ${row.status}`),
            );
            for (const [key, label] of Object.entries(submissionFieldLabels)) {
              const fieldVal = d[key as keyof typeof d];
              if (typeof fieldVal === 'string' && fieldVal.length > 0) {
                blocks.push(sectionBlock(`${label}\n${fieldVal}`));
              }
            }
            blocks.push(
              {
                type: 'accordion',
                label: 'Inspect CLAW.md & profiles/openclaw.yml',
                default_open: false,
                blocks: [
                  { type: 'code', language: 'markdown', code: d.claw_md },
                  { type: 'code', language: 'yaml', code: d.openclaw_yml },
                ],
              },
              sectionBlock(`Source & Package Links\n${d.links.join('\n')}`),
            );
            if (row.reason) {
              blocks.push(sectionBlock(`Denial reason\n${row.reason}`));
            }
            if (['pending', 'approving'].includes(row.status)) {
              blocks.push({
                type: 'form',
                block_id: `review-${id}`,
                fields: [
                  {
                    type: 'select',
                    action_id: 'decision',
                    label: 'Moderation Decision',
                    options: [
                      { label: 'Approve and publish to catalog', value: 'approve' },
                      { label: 'Deny submission', value: 'deny' },
                    ],
                  },
                  {
                    type: 'text_input',
                    action_id: 'reason',
                    label: 'Audit note / Denial reason',
                    multiline: true,
                  },
                ],
                submit: { action_id: `decide:${id}`, label: 'Record decision' },
              });
            }
          }

          return { blocks, ...(toast ? { toast } : {}) };
        },
      },
    },
  });
}

export default createPlugin;
