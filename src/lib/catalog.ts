import { getEmDashCollection, getEmDashEntry } from 'emdash';
import { publicHttpsLink } from './validation';

export interface GoodForBullet {
  lead: string;
  detail: string;
}

export interface TemplateRecord {
  id: string;
  slug: string;
  title: string;
  coordinate: string;
  owner_handle: string;
  version: string;
  channel: string;
  category: string;
  scan_status: string;
  avatar_tier: string;
  summary: string;
  best_for: string;
  good_for_items: GoodForBullet[];
  starter_prompts: string[];
  avatar_svg_url: string;
  cutout_url: string;
  hero_url: string;
  idle_gif_url: string;
  wave_gif_url: string;
  tarball_url: string;
  tarball_sha256: string;
  tarball_bytes: string;
  claw_md: string;
  openclaw_yml: string;
  soul_md: string;
  agents_md: string;
  identity_md: string;
  tools_md: string;
  skill_name: string;
  skill_md: string;
  design_json: string;
  cron_summary: string;
  links: string[];
}

interface CuratedGoodFor {
  functionalSummary?: string;
  best_for: string;
  good_for_items: GoodForBullet[];
  starter_prompts: string[];
}

export const CURATED_GOOD_FOR: Record<string, CuratedGoodFor> = {
  'blobster-smith': {
    functionalSummary:
      'Anvil Forgemaster who forges solo-ready, schema-verified OpenClaw Agent Templates from a fresh idea, a past working session, or an API/CLI tool—complete with trust gates and zero-exclusion linting.',
    best_for:
      "Turning a plain-English idea, a recurring chore you're tired of doing by hand, or a tool you already use into your own custom OpenClaw agent.",
    good_for_items: [
      {
        lead: 'Build a custom agent from a plain request',
        detail:
          'tell Smith what takes up your time; he asks 2–3 quick questions to lock one clear job, hard anti-jobs, schedule, and what needs your approval before acting.',
      },
      {
        lead: 'Turn past work—or overlapping bots—into a clean skill',
        detail:
          'point him at a past session to make it repeatable, or consolidate redundant bots into one sharp agent with zero leftover tools.',
      },
      {
        lead: 'Connect the tools and apps you already use',
        detail:
          'wires up your CLIs, APIs, and quiet-on-clean schedules that never blind-retry on errors and only ping you when something real needs attention.',
      },
    ],
    starter_prompts: [
      'I want an agent to help me manage my website and handle the day-to-day tasks that I spend time on.',
      'Build me an agent that tracks unpaid invoices and client threads, and drafts follow-ups for my sign-off.',
      'Make me a morning research scout that watches competitors and industry feeds and only alerts me when something big drops.',
    ],
  },
  'blobster-sculptor': {
    functionalSummary:
      'Master Toymaker & Painter (Molt) who crafts 24px-legible OpenClaw layered SVGs, surgical 3D vinyl toy renders, #FF00FF chroma-keyed transparent looping GIF packs, and automated QA contact sheets.',
    best_for:
      'Giving any agent its own recognizable personality and custom character art—from a tiny 24px chat icon to a 3D vinyl toy and animated looping GIFs.',
    good_for_items: [
      {
        lead: 'Create a custom character from a vibe or role',
        detail:
          "describe your agent's personality, outfit, and signature prop, and Molt designs a crisp 24px sidebar icon and 512px 3D vinyl figure.",
      },
      {
        lead: 'Bring your agent to life with looping animations',
        detail:
          'generates transparent idle and wave GIFs that look clean on both dark and light backgrounds.',
      },
      {
        lead: 'Tweak a single detail without starting over',
        detail:
          "swap a hat, change a color palette, or put a different tool in your agent's claw while keeping the rest of the character intact.",
      },
    ],
    starter_prompts: [
      'Design a friendly shopkeeper lobster in a canvas apron holding a clipboard for my daily store-ops agent.',
      'Make a sleuth lobster with a detective trenchcoat and magnifying glass for my security and bug-hunting bot.',
      'Give my personal travel-planner agent a vintage pilot bomber jacket, aviator goggles, and a boarding pass.',
    ],
  },
  'openclaw-release-coordinator': {
    best_for:
      'Keeping software releases on track—checking whether your repo is actually ready to ship, who still needs to sign off, and drafting the announcement.',
    good_for_items: [
      {
        lead: 'Check if a release is ready to go',
        detail:
          'verifies CI checks, build artifacts, and open blockers across GitHub so you do not cut a broken tag.',
      },
      {
        lead: 'Track down missing approvals and owners',
        detail:
          'lists exactly which pull requests or reviewers are still holding up the release without changing repo state.',
      },
      {
        lead: 'Draft release notes and team updates',
        detail:
          'writes the changelog summary and Slack announcement as a draft so you can review before anything goes out.',
      },
    ],
    starter_prompts: [
      "Check if our repo is actually ready to ship v2.4 today and tell me what's still blocking the release.",
      'Draft the release announcement and changelog summary for the team channel so I can review it before posting.',
      'Show me which pull requests landed since our last tag and who still needs to sign off.',
    ],
  },
  'openclaw-workflow-operator': {
    best_for:
      'Running multi-step recurring workflows that pause at the right moment for your approval—and telling you exactly what happened if a step stops.',
    good_for_items: [
      {
        lead: 'Run routine pipelines with a human checkpoint',
        detail:
          'steps through your approved workflow and pauses cleanly before sending messages, billing, or mutating live state.',
      },
      {
        lead: 'Explain what happened when a job pauses or fails',
        detail:
          'shows which steps finished, what changed outside the workspace, and whether it is safe to resume or abort.',
      },
      {
        lead: 'Prevent blind retries and duplicate actions',
        detail:
          'keeps a clear record of verified effects versus unconfirmed steps so you never double-send or guess.',
      },
    ],
    starter_prompts: [
      'Run our Monday morning ops pipeline and pause for my approval before sending any customer notifications.',
      "Check why last night's automated sync paused and tell me whether it's safe to resume or roll back.",
      'Give me a clean summary of what our weekly billing workflow changed and what still needs human sign-off.',
    ],
  },
  'openclaw-ux-research-synthesizer': {
    best_for:
      'Turning a pile of customer interviews, support tickets, survey exports, or usability notes into clear takeaways and next product decisions.',
    good_for_items: [
      {
        lead: 'Spot the real patterns across messy feedback',
        detail:
          'groups interview notes, tickets, and survey responses into themes backed by direct quotes and source links.',
      },
      {
        lead: 'Catch where user feedback contradicts itself',
        detail:
          'flags outlier opinions and gaps between what people say in surveys versus what they do in live sessions.',
      },
      {
        lead: 'Turn complaints into concrete next steps',
        detail:
          'translates raw user friction into clear opportunity statements and questions for your next product planning session.',
      },
    ],
    starter_prompts: [
      'Read through these customer interview notes and pull out the top 3 complaints people keep hitting.',
      'Find where our survey answers contradict what users actually did during the live onboarding sessions.',
      'Turn this folder of support tickets and user feedback into concrete product priorities for next week.',
    ],
  },
};

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function parseGoodForItems(rawJson: unknown, fallback: GoodForBullet[]): GoodForBullet[] {
  if (typeof rawJson === 'string' && rawJson.trim().length > 0) {
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed
          .filter(
            (item): item is GoodForBullet =>
              Boolean(item) &&
              typeof item === 'object' &&
              typeof item.lead === 'string' &&
              typeof item.detail === 'string',
          )
          .map((item) => ({ lead: item.lead.trim(), detail: item.detail.trim() }))
          .filter((item) => item.lead.length > 0 && item.detail.length > 0);
        if (valid.length > 0) return valid;
      }
    } catch {
      // fall through to curated/default
    }
  }
  return fallback;
}

function parseStarterPrompts(rawText: unknown, fallback: string[]): string[] {
  if (typeof rawText === 'string' && rawText.trim().length > 0) {
    const lines = rawText
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/^["']|["']$/g, ''))
      .filter((line) => line.length > 0);
    if (lines.length > 0) return lines;
  }
  return fallback;
}

function defaultGoodForForTemplate(
  slug: string,
  title: string,
  category: string,
  summary: string,
  skillName: string,
  cronSummary: string,
): CuratedGoodFor {
  const curated = CURATED_GOOD_FOR[slug];
  if (curated) return curated;

  return {
    best_for:
      summary ||
      `Handling day-to-day ${category.toLowerCase()} workflows with a clear human approval gate.`,
    good_for_items: [
      {
        lead: `Take over repetitive ${category.toLowerCase()} chores`,
        detail: `runs the ${title} workflow inside an isolated workspace so you can focus on decisions instead of busywork.`,
      },
      {
        lead: skillName ? `Use the bundled ${skillName} skill` : 'Follow a repeatable playbook',
        detail:
          'applies consistent instructions and tool boundaries every time instead of starting from a blank prompt.',
      },
      {
        lead: 'Draft first, act after your sign-off',
        detail: `operates on a ${cronSummary.toLowerCase()} cadence and pauses before external writes or messages.`,
      },
    ],
    starter_prompts: [
      `Help me handle my recurring ${category.toLowerCase()} tasks with ${title} and draft the next actions for my review.`,
      `Show me what ${title} checks first when I point it at a new project folder.`,
      `Run a dry-run check and summarize what needs my attention today.`,
    ],
  };
}

function normalizeEntry(raw: { id: string; data: Record<string, unknown> }): TemplateRecord {
  const d = raw.data;
  const slug = str(d.slug, raw.id.replace(/^(workshop|official)-/, ''));
  const title = str(d.title, slug);
  const category = str(d.category, 'Engineering');
  const skillName = str(d.skill_name);
  const cronSummary = str(d.cron_summary, 'On-demand');
  const rawSummary = str(d.summary);

  const defaults = defaultGoodForForTemplate(
    slug,
    title,
    category,
    rawSummary,
    skillName,
    cronSummary,
  );

  // Replace legacy SVG <desc> outfit descriptions on workshop templates with their functional CLAW.md summary
  const summary =
    defaults.functionalSummary &&
    (!rawSummary ||
      rawSummary.startsWith('Anvil Forgemaster in a charred leather') ||
      rawSummary.startsWith('Master Toymaker & Painter in a navy'))
      ? defaults.functionalSummary
      : rawSummary || defaults.functionalSummary || '';

  return {
    id: raw.id,
    slug,
    title,
    coordinate: str(d.coordinate, `@community/${slug}`),
    owner_handle: str(d.owner_handle, 'community'),
    version: str(d.pkg_version, str(d.version, '0.1.0')),
    channel: str(d.channel, 'Community'),
    category,
    scan_status: str(d.scan_status, 'clean'),
    avatar_tier: str(d.avatar_tier, '24px Vector Blobster SVG'),
    summary,
    best_for: str(d.best_for, defaults.best_for),
    good_for_items: parseGoodForItems(d.good_for_json, defaults.good_for_items),
    starter_prompts: parseStarterPrompts(d.starter_prompts, defaults.starter_prompts),
    avatar_svg_url: str(d.avatar_svg_url, '/templates/blobster-smith/blobster.svg'),
    cutout_url: str(d.cutout_url, '/templates/blobster-smith/cutout-256.png'),
    hero_url: str(d.hero_url, '/templates/blobster-smith/hero-512.png'),
    idle_gif_url: str(d.idle_gif_url),
    wave_gif_url: str(d.wave_gif_url),
    tarball_url: str(d.tarball_url),
    tarball_sha256: str(d.tarball_sha256),
    tarball_bytes: str(d.tarball_bytes),
    claw_md: str(d.claw_md),
    openclaw_yml: str(d.openclaw_yml),
    soul_md: str(d.soul_md),
    agents_md: str(d.agents_md),
    identity_md: str(d.identity_md),
    tools_md: str(d.tools_md),
    skill_name: skillName,
    skill_md: str(d.skill_md),
    design_json: str(d.design_json),
    cron_summary: cronSummary,
    links: parsePublicLinks(d.links),
  };
}

export function parsePublicLinks(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(publicHttpsLink);
}

export async function publishedTemplates(): Promise<TemplateRecord[]> {
  const collected: TemplateRecord[] = [];
  let cursor: string | undefined;
  do {
    const result = await getEmDashCollection('templates', {
      status: 'published',
      limit: 100,
      cursor,
    });
    if (result.error) {
      throw new Error('Template catalog unavailable');
    }
    for (const entry of result.entries) {
      const recordData = entry.data as Record<string, unknown>;
      if (recordData.status === 'published') {
        collected.push(normalizeEntry({ id: entry.id, data: recordData }));
      }
    }
    cursor = result.nextCursor;
  } while (cursor);

  return collected.sort((a, b) => {
    const rank = (ch: string) => (ch === 'Workshop' ? 0 : ch === 'Official' ? 1 : 2);
    return rank(a.channel) - rank(b.channel) || a.title.localeCompare(b.title);
  });
}

export async function getPublishedTemplate(slug: string): Promise<TemplateRecord | null> {
  const direct = await getEmDashEntry('templates', slug);
  if (direct.entry) {
    const data = direct.entry.data as Record<string, unknown>;
    if (data.status === 'published') {
      return normalizeEntry({ id: direct.entry.id, data });
    }
  }
  const all = await publishedTemplates();
  return all.find((item) => item.slug === slug || item.id === slug) ?? null;
}

export function buildAgentPrompt(tpl: TemplateRecord): string {
  if (tpl.tarball_url) {
    return [
      `Install the verified "${tpl.title}" (${tpl.coordinate}@${tpl.version}) OpenClaw Agent Template into my gateway:`,
      `1. Download https://blobster.dev/t/${tpl.slug}.tgz to a temporary directory and verify SHA-256 == ${tpl.tarball_sha256}.`,
      `2. Extract the archive and run: openclaw templates inspect ./${tpl.slug}`,
      `3. Summarize the workspace files, skills, sandbox profile, and cron schedule, then run: openclaw templates add ./${tpl.slug}`,
    ].join('\n');
  }
  return [
    `Inspect and add the official "${tpl.title}" (${tpl.coordinate}@${tpl.version}) OpenClaw Agent Template:`,
    `1. Confirm Settings -> Labs -> Templates is enabled on my OpenClaw gateway.`,
    `2. Open Pages -> Templates, select ${tpl.coordinate} (ClawHub scan: ${tpl.scan_status}), review the plan, and click Add.`,
  ].join('\n');
}

export function buildCliOneLiner(tpl: TemplateRecord): string {
  if (tpl.tarball_url) {
    return `mkdir -p /tmp/blobster && curl -fsSL https://blobster.dev/t/${tpl.slug}.tgz -o /tmp/blobster/${tpl.slug}.tgz && echo "${tpl.tarball_sha256}  /tmp/blobster/${tpl.slug}.tgz" | shasum -a 256 -c - && tar -xzf /tmp/blobster/${tpl.slug}.tgz -C /tmp/blobster && openclaw templates inspect /tmp/blobster/${tpl.slug} && openclaw templates add /tmp/blobster/${tpl.slug}`;
  }
  return `# Published on ClawHub (${tpl.coordinate}@${tpl.version}) — enable Settings -> Labs -> Templates and install via Pages -> Templates`;
}

export function canonicalOrigin(): string {
  const configured = process.env.CATALOG_ORIGIN;
  if (!configured) return 'https://blobster.dev';
  const u = new URL(configured);
  if (u.protocol !== 'https:' || u.username || u.password || u.pathname !== '/' || u.search || u.hash) {
    throw new Error('CATALOG_ORIGIN must be an HTTPS origin');
  }
  return u.origin;
}

export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
