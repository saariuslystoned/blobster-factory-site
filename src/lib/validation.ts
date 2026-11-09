import { z } from 'zod';

export const TEMPLATE_CATEGORIES = [
  'Engineering',
  'Product',
  'Operations',
  'Research',
  'Productivity',
  'Personal',
  'Governance',
  'Other',
] as const;

export const TEMPLATE_CHANNELS = ['Workshop', 'Official', 'Community'] as const;

export function publicHttpsLink(value: string): boolean {
  try {
    const u = new URL(value.trim());
    if (u.protocol !== 'https:' || u.username || u.password) return false;
    const host = u.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export const templateSubmissionSchema = z.object({
  title: z.string().trim().min(3, 'Enter a template display name (3+ chars).').max(80),
  coordinate: z
    .string()
    .trim()
    .regex(
      /^@[a-z0-9][a-z0-9-]{1,38}\/[a-z0-9][a-z0-9-]{1,60}$/,
      'Use a scoped ClawHub coordinate like @handle/template-slug.',
    ),
  owner_handle: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]{1,38}$/, 'Enter a lowercase GitHub / ClawHub handle without @.'),
  version: z
    .string()
    .trim()
    .regex(/^\d+\.\d+\.\d+$/, 'Use exact SemVer like 0.1.0.'),
  category: z.enum(TEMPLATE_CATEGORIES),
  avatar_tier: z
    .enum([
      'Tier 1 Fast Pack (SVG + 512px Vinyl + 2 GIFs)',
      'Tier 2 Full Pet Rig (73-frame Sprite + Manifest)',
      '24px Vector Blobster SVG Only',
    ])
    .default('Tier 1 Fast Pack (SVG + 512px Vinyl + 2 GIFs)'),
  summary: z.string().trim().min(20, 'Describe what the agent does and refuses to do (20+ chars).').max(400),
  claw_md: z
    .string()
    .trim()
    .min(24, 'Paste the CLAW.md frontmatter + summary.')
    .max(12000),
  openclaw_yml: z
    .string()
    .trim()
    .min(10, 'Paste profiles/openclaw.yml (workspaceOnly: true recommended).')
    .max(8000),
  skill_name: z.string().trim().max(80).default(''),
  cron_summary: z.string().trim().max(160).default('On-demand · No scheduled cron jobs'),
  links: z
    .array(z.string().trim().refine(publicHttpsLink, 'Provide public HTTPS GitHub or ClawHub URLs only.'))
    .min(1, 'Include at least one public HTTPS repository or package link.')
    .max(5),
  script_free_confirm: z.literal(true, {
    error: () => 'Confirm package.json has zero lifecycle scripts, symlinks, or secret paths.',
  }),
  website: z.string().max(0, 'Leave this field empty.').default(''),
});

export type TemplateSubmissionInput = z.infer<typeof templateSubmissionSchema>;

export const submissionFieldLabels: Record<string, string> = {
  summary: 'Agent Summary & Authority Boundary',
  avatar_tier: 'Blobster Visual Pack Tier',
  skill_name: 'Primary Skill',
  cron_summary: 'Scheduled Automations',
};
