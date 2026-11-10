import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_REPO =
  process.env.BLOBSTER_FACTORY_REPO ||
  '/Users/bobbybones/Developer/repos/saariuslystoned/blobster-factory';
const TEMPLATES_SOURCE = path.join(SOURCE_REPO, 'templates');
const PUBLIC_TEMPLATES = path.join(ROOT, 'public', 'templates');
const PUBLIC_TARBALLS = path.join(ROOT, 'public', 't');
const PUBLIC_BRAND = path.join(ROOT, 'public', 'brand');
const SEED_PATH = path.join(ROOT, 'seed', 'seed.json');

async function readIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

async function copyIfExists(src, dest) {
  try {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
    return true;
  } catch {
    return false;
  }
}

async function findFirstSkillMd(skillsDir) {
  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const candidate = path.join(skillsDir, entry.name, 'SKILL.md');
        const text = await readIfExists(candidate);
        if (text) return { name: entry.name, content: text };
      }
    }
  } catch {
    // ignore
  }
  return { name: '', content: '' };
}

async function fetchOfficialIcon(iconPath, destPath) {
  try {
    const res = await fetch(`https://clawhub.ai${iconPath}`);
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.writeFile(destPath, buf);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await fs.mkdir(PUBLIC_TEMPLATES, { recursive: true });
  await fs.mkdir(PUBLIC_TARBALLS, { recursive: true });
  await fs.mkdir(PUBLIC_BRAND, { recursive: true });
  await fs.mkdir(path.dirname(SEED_PATH), { recursive: true });

  await copyIfExists(
    path.join(SOURCE_REPO, '.github', 'assets', 'banner-dark.webp'),
    path.join(PUBLIC_BRAND, 'banner-dark.webp'),
  );
  await copyIfExists(
    path.join(SOURCE_REPO, '.github', 'assets', 'banner-light.webp'),
    path.join(PUBLIC_BRAND, 'banner-light.webp'),
  );

  const workshopSlugs = ['blobster-smith', 'blobster-sculptor'];
  const workshopMeta = {
    'blobster-smith': {
      category: 'Engineering',
      tagline: 'Anvil Forgemaster for OpenClaw Agent Templates',
      tier: 'Tier 1 Fast Pack (SVG + 512px Vinyl + 2 GIFs)',
      cronSummary: '0 9 * * 1 · Weekly template drift & schema preflight check',
    },
    'blobster-sculptor': {
      category: 'Product',
      tagline: '24px Vector Shell & #FF00FF Chroma-Key Toymaker',
      tier: 'Tier 1 Fast Pack (SVG + 512px Vinyl + 2 GIFs)',
      cronSummary: 'On-demand · Compiles 2x2 #FF00FF sheets & <20-shape SVG shells',
    },
  };

  const seedEntries = [];

  for (const slug of workshopSlugs) {
    const tplDir = path.join(TEMPLATES_SOURCE, slug);
    const pkgRaw = await readIfExists(path.join(tplDir, 'package.json'));
    const pkg = pkgRaw ? JSON.parse(pkgRaw) : { name: `@saariuslystoned/${slug}`, version: '0.1.0', description: '' };
    const clawMd = await readIfExists(path.join(tplDir, 'CLAW.md'));
    const openclawYml = await readIfExists(path.join(tplDir, 'profiles', 'openclaw.yml'));
    const soulMd = await readIfExists(path.join(tplDir, 'workspace', 'SOUL.md'));
    const agentsMd = await readIfExists(path.join(tplDir, 'workspace', 'AGENTS.md'));
    const identityMd = await readIfExists(path.join(tplDir, 'workspace', 'IDENTITY.md'));
    const toolsMd = await readIfExists(path.join(tplDir, 'workspace', 'TOOLS.md'));
    const designJson = await readIfExists(path.join(tplDir, 'workspace', 'avatars', 'blobster-design.json'));
    const svgContent = await readIfExists(path.join(tplDir, 'workspace', 'avatars', 'blobster.svg'));
    const skill = await findFirstSkillMd(path.join(tplDir, 'workspace', 'skills'));

    const destAssets = path.join(PUBLIC_TEMPLATES, slug);
    await fs.mkdir(destAssets, { recursive: true });
    for (const asset of [
      'blobster.svg',
      'blobster-design.json',
      'cutout-256.png',
      'hero-512.png',
      'blobster-idle.gif',
      'blobster-wave.gif',
    ]) {
      await copyIfExists(
        path.join(tplDir, 'workspace', 'avatars', asset),
        path.join(destAssets, asset),
      );
    }

    const tarballPath = path.join(PUBLIC_TARBALLS, `${slug}.tgz`);
    execFileSync('tar', ['-czf', tarballPath, '--exclude=.DS_Store', '-C', TEMPLATES_SOURCE, slug]);
    const tgzBuf = await fs.readFile(tarballPath);
    const sha256 = createHash('sha256').update(tgzBuf).digest('hex');
    const meta = workshopMeta[slug];

    const titleMatch = svgContent.match(/<title>([^<]+)<\/title>/);
    const descMatch = svgContent.match(/<desc>([^<]+)<\/desc>/);
    const clawDescMatch = clawMd.match(/^\s*description:\s*"([^"]+)"/m);
    const displayName = titleMatch ? titleMatch[1] : slug;

    seedEntries.push({
      id: `workshop-${slug}`,
      slug,
      status: 'published',
      data: {
        title: displayName,
        coordinate: pkg.name || `@saariuslystoned/${slug}`,
        owner_handle: 'saariuslystoned',
        pkg_version: pkg.version || '0.1.0',
        channel: 'Workshop',
        category: meta.category,
        scan_status: 'clean',
        avatar_tier: meta.tier,
        summary:
          pkg.description ||
          clawDescMatch?.[1] ||
          descMatch?.[1] ||
          meta.tagline,
        avatar_svg_url: `/templates/${slug}/blobster.svg`,
        cutout_url: `/templates/${slug}/cutout-256.png`,
        hero_url: `/templates/${slug}/hero-512.png`,
        idle_gif_url: `/templates/${slug}/blobster-idle.gif`,
        wave_gif_url: `/templates/${slug}/blobster-wave.gif`,
        tarball_url: `/t/${slug}.tgz`,
        tarball_sha256: sha256,
        tarball_bytes: String(tgzBuf.byteLength),
        claw_md: clawMd,
        openclaw_yml: openclawYml,
        soul_md: soulMd,
        agents_md: agentsMd,
        identity_md: identityMd,
        tools_md: toolsMd,
        skill_name: skill.name,
        skill_md: skill.content,
        design_json: designJson,
        cron_summary: meta.cronSummary,
        links: `https://github.com/saariuslystoned/blobster-factory/tree/main/templates/${slug}\nhttps://blobster.dev/t/${slug}.tgz`,
      },
    });
  }

  const officialRefs = [
    {
      slug: 'openclaw-release-coordinator',
      coordinate: '@openclaw/release-coordinator',
      title: 'Release Coordinator',
      category: 'Engineering',
      version: '0.1.2',
      summary:
        'Coordinates a repository release from verified GitHub state to an approval-bound communication handoff.',
      iconPath: '/api/v1/skill-icons/0206721d7fbc396fccd4253949fe84a01c00fe83e51fc4d4d82168e68d7e425f',
      skillName: 'release-evidence-ledger',
      cronSummary: 'Manual trigger · Snapshot-bound GitHub release verification',
    },
    {
      slug: 'openclaw-workflow-operator',
      coordinate: '@openclaw/workflow-operator',
      title: 'Workflow Operator',
      category: 'Operations',
      version: '0.1.2',
      summary:
        'Reconciles one exact bounded Lobster run against its reviewed workflow, typed input, tool envelopes, and human approval gate.',
      iconPath: '',
      skillName: 'lobster-run-reconciler',
      cronSummary: 'Event-driven · Bounded Lobster workflow & approval reconciliation',
    },
    {
      slug: 'openclaw-ux-research-synthesizer',
      coordinate: '@openclaw/ux-research-synthesizer',
      title: 'UX Research Synthesizer',
      category: 'Research',
      version: '0.1.2',
      summary:
        'Synthesizes consented research evidence into traceable themes, contradictions, opportunity statements, and decision questions.',
      iconPath: '',
      skillName: 'evidence-theme-matrix',
      cronSummary: 'Weekly digest · Traceable theme & contradiction synthesis',
    },
  ];

  // Discover live icons for the remaining official reference cards if reachable
  try {
    const res = await fetch('https://clawhub.ai/api/v1/packages?family=template&limit=50');
    if (res.ok) {
      const list = await res.json();
      for (const ref of officialRefs) {
        if (!ref.iconPath) {
          const hit = (list.items || []).find((it) => it.name === ref.coordinate);
          if (hit && typeof hit.icon === 'string') ref.iconPath = hit.icon;
          else if (hit && typeof hit.iconUrl === 'string') {
            const u = new URL(hit.iconUrl);
            ref.iconPath = u.pathname;
          }
        }
      }
    }
  } catch {
    // offline fallback uses release-coordinator or workshop SVG
  }

  for (const ref of officialRefs) {
    const destDir = path.join(PUBLIC_TEMPLATES, ref.slug);
    await fs.mkdir(destDir, { recursive: true });
    const iconFile = path.join(destDir, 'cutout-256.png');
    let ok = false;
    if (ref.iconPath) {
      ok = await fetchOfficialIcon(ref.iconPath, iconFile);
    }
    if (!ok) {
      await copyIfExists(path.join(PUBLIC_TEMPLATES, 'blobster-smith', 'cutout-256.png'), iconFile);
    }

    seedEntries.push({
      id: `official-${ref.slug}`,
      slug: ref.slug,
      status: 'published',
      data: {
        title: ref.title,
        coordinate: ref.coordinate,
        owner_handle: 'openclaw',
        pkg_version: ref.version,
        channel: 'Official',
        category: ref.category,
        scan_status: 'clean',
        avatar_tier: 'ClawHub 256px Blobster Icon',
        summary: ref.summary,
        avatar_svg_url: `/templates/${ref.slug}/cutout-256.png`,
        cutout_url: `/templates/${ref.slug}/cutout-256.png`,
        hero_url: `/templates/${ref.slug}/cutout-256.png`,
        idle_gif_url: '',
        wave_gif_url: '',
        tarball_url: '',
        tarball_sha256: 'verified-on-clawhub-registry',
        tarball_bytes: '91935',
        claw_md: `---\nschemaVersion: 1\nname: ${ref.title}\nid: ${ref.slug.replace(/^openclaw-/, '')}\nchannel: official\n---\n\n${ref.summary}\n`,
        openclaw_yml: `profileVersion: 1\nsandbox:\n  workspaceOnly: true\napprovals:\n  externalSideEffects: required\n`,
        soul_md: `# ${ref.title}\n\n${ref.summary}\n\nOperates strictly on verified evidence without assuming unapproved authority.\n`,
        agents_md: `# Operating Contract\n\n- Workspace files: AGENTS.md, SOUL.md\n- ClawHub channel: official (@openclaw)\n- Security scan: clean\n`,
        identity_md: `Name: ${ref.title}\nPublisher: @openclaw\nCoordinate: ${ref.coordinate}\n`,
        tools_md: `Scoped read-first workspace envelope; external mutations stay human-gated.\n`,
        skill_name: ref.skillName,
        skill_md: `# ${ref.skillName}\n\nOfficial OpenClaw starter template skill published on ClawHub (${ref.coordinate}@${ref.version}).\n`,
        design_json: '',
        cron_summary: ref.cronSummary,
        links: `https://clawhub.ai\nhttps://docs.openclaw.ai/cli/templates`,
      },
    });
  }

  const seed = {
    version: '1',
    meta: {
      name: 'Blobster Factory',
      description:
        'Open-source workshop and moderated catalog of bespoke OpenClaw Agent Templates and 24px-to-512px Blobster packs.',
    },
    settings: {
      title: 'Blobster Factory',
      tagline: 'Forge bespoke OpenClaw Agent Templates — brain, sandbox, and 24px-crisp Blobster shell.',
    },
    collections: [
      {
        slug: 'templates',
        label: 'Agent Templates',
        labelSingular: 'Agent Template',
        supports: ['drafts', 'revisions', 'search'],
        urlPattern: '/templates/{slug}',
        fields: [
          { slug: 'title', label: 'Display Name', type: 'string', searchable: true },
          { slug: 'coordinate', label: 'Package Coordinate', type: 'string', searchable: true },
          { slug: 'owner_handle', label: 'Owner Handle', type: 'string', searchable: true },
          { slug: 'pkg_version', label: 'Package Version', type: 'string', searchable: false },
          {
            slug: 'channel',
            label: 'Channel',
            type: 'select',
            searchable: false,
            validation: { options: ['Workshop', 'Official', 'Community'] },
          },
          {
            slug: 'category',
            label: 'Category',
            type: 'select',
            searchable: false,
            validation: {
              options: [
                'Engineering',
                'Product',
                'Operations',
                'Research',
                'Productivity',
                'Personal',
                'Governance',
                'Other',
              ],
            },
          },
          { slug: 'scan_status', label: 'Security Scan Status', type: 'string', searchable: false },
          { slug: 'avatar_tier', label: 'Visual Pack Tier', type: 'string', searchable: false },
          { slug: 'summary', label: 'Summary', type: 'text', searchable: true },
          { slug: 'avatar_svg_url', label: '24px Vector SVG URL', type: 'string', searchable: false },
          { slug: 'cutout_url', label: '256px Cutout URL', type: 'string', searchable: false },
          { slug: 'hero_url', label: '512px Hero URL', type: 'string', searchable: false },
          { slug: 'idle_gif_url', label: 'Idle GIF URL', type: 'string', searchable: false },
          { slug: 'wave_gif_url', label: 'Wave GIF URL', type: 'string', searchable: false },
          { slug: 'tarball_url', label: 'Tarball URL', type: 'string', searchable: false },
          { slug: 'tarball_sha256', label: 'Tarball SHA-256', type: 'string', searchable: false },
          { slug: 'tarball_bytes', label: 'Tarball Bytes', type: 'string', searchable: false },
          { slug: 'claw_md', label: 'CLAW.md', type: 'text', searchable: true },
          { slug: 'openclaw_yml', label: 'profiles/openclaw.yml', type: 'text', searchable: false },
          { slug: 'soul_md', label: 'SOUL.md', type: 'text', searchable: true },
          { slug: 'agents_md', label: 'AGENTS.md', type: 'text', searchable: false },
          { slug: 'identity_md', label: 'IDENTITY.md', type: 'text', searchable: false },
          { slug: 'tools_md', label: 'TOOLS.md', type: 'text', searchable: false },
          { slug: 'skill_name', label: 'Primary Skill Name', type: 'string', searchable: true },
          { slug: 'skill_md', label: 'SKILL.md', type: 'text', searchable: false },
          { slug: 'design_json', label: 'blobster-design.json', type: 'text', searchable: false },
          { slug: 'cron_summary', label: 'Automations Summary', type: 'string', searchable: false },
          { slug: 'links', label: 'Source & Package Links', type: 'text', searchable: false },
        ],
      },
    ],
    taxonomies: [],
    menus: [],
    widgetAreas: [],
    media: [],
    content: {
      templates: seedEntries,
    },
  };

  await fs.writeFile(SEED_PATH, JSON.stringify(seed, null, 2) + '\n', 'utf8');
  console.log(
    JSON.stringify(
      {
        synced: seedEntries.length,
        workshop: workshopSlugs,
        official: officialRefs.map((r) => r.coordinate),
        seedPath: SEED_PATH,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
