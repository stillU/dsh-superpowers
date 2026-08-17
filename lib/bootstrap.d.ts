/**
 * Escape ASCII brace-template sequences so DSH's strict prompt-variable
 * renderer treats `{{...}}` as literal text instead of throwing on unknown
 * or malformed variable references. If either `{{` or `}}` appears anywhere,
 * both are replaced with full-width equivalents and a warning is emitted.
 */
export declare function guardBraceTemplates(text: string): string;
/** Return the text after a leading `---` frontmatter block; the original text when absent. */
export declare function stripFrontmatter(text: string): string;
/**
 * Assemble the session bootstrap: the `using-superpowers` skill body
 * (already loaded — do NOT load it again via the skill tool) plus the DSH
 * tool mapping, wrapped in the upstream `<EXTREMELY_IMPORTANT>` convention.
 * Returns `undefined` when either source file is missing.
 */
export declare function buildBootstrap(skillsDir: string): string | undefined;
/** `buildBootstrap` with a module-level per-directory cache. */
export declare function getBootstrap(skillsDir: string): string | undefined;
