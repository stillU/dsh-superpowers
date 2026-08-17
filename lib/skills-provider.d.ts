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
export declare function parseFrontmatter(text: string): ParsedFrontmatter;
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
export declare function discoverSkills(rootDir: string): DiscoveredSkill[];
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
    locator: {
        path: string;
        directory: string;
    };
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
    resourceBase: {
        kind: 'directory';
        path: string;
    };
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
export declare const BUNDLED_SKILL_RANK = 600;
/**
 * Build a static filesystem-backed skills provider for `ctx.skills`.
 * Content is immutable, so no watcher or invalidate wiring is needed;
 * `list()` returns a complete-observation shorthand (a plain array) and
 * `get()` loads the SKILL.md body on demand, honoring abort signals.
 */
export declare function createSkillsProvider(options: CreateSkillsProviderOptions): SkillsProvider;
