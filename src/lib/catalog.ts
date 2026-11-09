import { getEmDashCollection, getEmDashEntry } from 'emdash';
import { publicHttpsLink } from './validation';

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

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function normalizeEntry(raw: { id: string; data: Record<string, unknown> }): TemplateRecord {
  const d = raw.data;
  const slug = str(d.slug, raw.id.replace(/^(workshop|official)-/, ''));
  return {
    id: raw.id,
    slug,
    title: str(d.title, slug),
    coordinate: str(d.coordinate, `@community/${slug}`),
    owner_handle: str(d.owner_handle, 'community'),
    version: str(d.pkg_version, str(d.version, '0.1.0')),
    channel: str(d.channel, 'Community'),
    category: str(d.category, 'Engineering'),
    scan_status: str(d.scan_status, 'clean'),
    avatar_tier: str(d.avatar_tier, '24px Vector Blobster SVG'),
    summary: str(d.summary),
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
    skill_name: str(d.skill_name),
    skill_md: str(d.skill_md),
    design_json: str(d.design_json),
    cron_summary: str(d.cron_summary, 'On-demand'),
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
  if (!configured) return 'https://blobsterfactory.com';
  const u = new URL(configured);
  if (u.protocol !== 'https:' || u.username || u.password || u.pathname !== '/' || u.search || u.hash) {
    throw new Error('CATALOG_ORIGIN must be an HTTPS origin');
  }
  return u.origin;
}

export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
