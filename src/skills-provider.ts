import fs from 'node:fs';
import path from 'node:path';

/**
 * Minimal YAML frontmatter parser for skill files. Recognizes a leading
 * `---` line, then `key: value` lines terminated by a second `---` line.
 * Values are split at the first colon, trimmed, and paired single/double
 * quotes are stripped. Blank lines and `#` comment lines are skipped.
 * When no frontmatter block is present, an empty record and the original
 * text are returned.
 */
export interface ParsedFrontmatter {
  frontmatter: Record<string, string>;
  body: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

function isQuoteWrapped(value: string): boolean {
  return (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  );
}

export function parseFrontmatter(text: string): ParsedFrontmatter {
  const match = FRONTMATTER_RE.exec(text);
  if (!match) return { frontmatter: {}, body: text };
  const frontmatter: Record<string, string> = {};
  for (const rawLine of match[1].split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim();
    if (!key) continue;
    let value = line.slice(colon + 1).trim();
    if (value.length >= 2 && isQuoteWrapped(value)) value = value.slice(1, -1);
    frontmatter[key] = value;
  }
  return { frontmatter, body: text.slice(match[0].length) };
}

export interface DiscoveredSkill {
  name: string;
  description: string;
  whenToUse?: string;
  path: string;
  directory: string;
}

/**
 * Scan `rootDir` for one-level skill bundles (directories containing a
 * `SKILL.md`). Directories whose SKILL.md lacks a `name` and `description`
 * in frontmatter are skipped with a warning. Results are sorted by name.
 */
export function discoverSkills(rootDir: string): DiscoveredSkill[] {
  const out: DiscoveredSkill[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch (err) {
    console.warn('[dsh-superpowers] cannot read skills root: ' + rootDir + ' (' + String(err) + ')');
    return out;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(rootDir, entry.name);
    const skillPath = path.join(directory, 'SKILL.md');
    let content: string;
    try {
      content = fs.readFileSync(skillPath, 'utf8');
    } catch {
      continue; // no readable SKILL.md → not a skill bundle
    }
    const { frontmatter } = parseFrontmatter(content);
    const name = frontmatter.name?.trim() ?? '';
    const description = frontmatter.description?.trim() ?? '';
    if (!name || !description) {
      console.warn(
        '[dsh-superpowers] skipping ' + entry.name + ': SKILL.md frontmatter is missing name and/or description'
      );
      continue;
    }
    const whenToUse = frontmatter.whenToUse?.trim() || undefined;
    out.push({
      name,
      description,
      ...(whenToUse !== undefined && whenToUse !== '' ? { whenToUse } : {}),
      path: skillPath,
      directory,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export interface SkillInvocationPolicy {
  modelInvocable: true;
  userInvocable: true;
}

/** A discoverable skill summary returned by `list()`. */
export interface SkillCandidate {
  name: string;
  description: string;
  whenToUse?: string;
  rank: number;
  locator: { path: string; directory: string };
  path: string;
  source: 'bundled';
  invocation: SkillInvocationPolicy;
  provider: string;
}

/** A fully loaded skill body returned by `get()`. */
export interface SkillDefinition {
  name: string;
  description: string;
  whenToUse?: string;
  content: string;
  path: string;
  provider: string;
  source: 'bundled';
  invocation: SkillInvocationPolicy;
  resourceBase: { kind: 'directory'; path: string };
}

export interface SkillLookupOptions {
  signal?: AbortSignal;
  cwd?: string;
}

/** Shape of the object registered via `ctx.skills.registerProvider`. */
export interface SkillsProvider {
  name: string;
  list(options?: SkillLookupOptions): Promise<SkillCandidate[]>;
  get(candidate: SkillCandidate, options?: SkillLookupOptions): Promise<SkillDefinition | undefined>;
}

export interface CreateSkillsProviderOptions {
  rootDir: string;
  providerName: string;
  rank?: number;
}

/** Default rank for bundled skills: project/user skills win over these. */
export const BUNDLED_SKILL_RANK = 600;

const INVOCATION: SkillInvocationPolicy = { modelInvocable: true, userInvocable: true };

/**
 * Build a static filesystem-backed skills provider for `ctx.skills`.
 * Content is immutable, so no watcher or invalidate wiring is needed;
 * `list()` returns a complete-observation shorthand (a plain array) and
 * `get()` loads the SKILL.md body on demand, honoring abort signals.
 */
export function createSkillsProvider(options: CreateSkillsProviderOptions): SkillsProvider {
  const rank = options.rank ?? BUNDLED_SKILL_RANK;
  return {
    name: options.providerName,
    async list(lookup) {
      if (lookup?.signal?.aborted) return [];
      const discovered = discoverSkills(options.rootDir);
      if (lookup?.signal?.aborted) return [];
      return discovered.map((skill) => ({
        name: skill.name,
        description: skill.description,
        ...(skill.whenToUse !== undefined ? { whenToUse: skill.whenToUse } : {}),
        rank,
        locator: { path: skill.path, directory: skill.directory },
        path: skill.path,
        source: 'bundled' as const,
        invocation: INVOCATION,
        provider: options.providerName,
      }));
    },
    async get(candidate, lookup) {
      if (lookup?.signal?.aborted) return undefined;
      let content: string;
      try {
        content = await fs.promises.readFile(candidate.locator.path, {
          encoding: 'utf8',
          signal: lookup?.signal,
        });
      } catch {
        return undefined;
      }
      const { frontmatter, body } = parseFrontmatter(content);
      const name = frontmatter.name?.trim() || candidate.name;
      const description = frontmatter.description?.trim() || candidate.description;
      const whenToUse = frontmatter.whenToUse?.trim() || candidate.whenToUse;
      return {
        name,
        description,
        ...(whenToUse !== undefined && whenToUse !== '' ? { whenToUse } : {}),
        content: body,
        path: candidate.locator.path,
        provider: options.providerName,
        source: 'bundled' as const,
        invocation: INVOCATION,
        resourceBase: { kind: 'directory' as const, path: candidate.locator.directory },
      };
    },
  };
}
