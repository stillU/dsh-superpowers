import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from './skills-provider.js';
const FULL_WIDTH_OPEN = '｛｛';
const FULL_WIDTH_CLOSE = '｝｝';
/**
 * Escape ASCII brace-template sequences so DSH's strict prompt-variable
 * renderer treats `{{...}}` as literal text instead of throwing on unknown
 * or malformed variable references. If either `{{` or `}}` appears anywhere,
 * both are replaced with full-width equivalents and a warning is emitted.
 */
export function guardBraceTemplates(text) {
    if (!text.includes('{{') && !text.includes('}}'))
        return text;
    const openCount = text.match(/\{\{/g)?.length ?? 0;
    const closeCount = text.match(/\}\}/g)?.length ?? 0;
    const result = text
        .split('{{')
        .join(FULL_WIDTH_OPEN)
        .split('}}')
        .join(FULL_WIDTH_CLOSE);
    console.warn('[dsh-superpowers] escaped ' + (openCount + closeCount) + ' brace template occurrence(s) ' +
        '(' + openCount + ' "{{", ' + closeCount + ' "}}") to full-width equivalents');
    return result;
}
/** Return the text after a leading `---` frontmatter block; the original text when absent. */
export function stripFrontmatter(text) {
    return parseFrontmatter(text).body;
}
/**
 * Assemble the session bootstrap: the `using-superpowers` skill body
 * (already loaded — do NOT load it again via the skill tool) plus the DSH
 * tool mapping, wrapped in the upstream `<EXTREMELY_IMPORTANT>` convention.
 * Returns `undefined` when either source file is missing.
 */
export function buildBootstrap(skillsDir) {
    const skillFile = path.join(skillsDir, 'using-superpowers', 'SKILL.md');
    const mappingFile = path.join(skillsDir, 'using-superpowers', 'references', 'dsh-tools.md');
    let skillContent;
    try {
        skillContent = fs.readFileSync(skillFile, 'utf8');
    }
    catch {
        return undefined;
    }
    let mappingContent;
    try {
        mappingContent = fs.readFileSync(mappingFile, 'utf8');
    }
    catch {
        return undefined;
    }
    const skillBody = stripFrontmatter(skillContent).trim();
    const toolMapping = mappingContent.trim();
    const bootstrap = [
        '<EXTREMELY_IMPORTANT>',
        'You have superpowers.',
        '',
        'You are now following the using-superpowers skill. Its full content is included below and is ALREADY LOADED - do NOT load it again via the skill tool.',
        '',
        skillBody,
        '',
        '## DSH tool mapping',
        toolMapping,
        '</EXTREMELY_IMPORTANT>',
    ].join('\n');
    return guardBraceTemplates(bootstrap);
}
const bootstrapCache = new Map();
/** `buildBootstrap` with a module-level per-directory cache. */
export function getBootstrap(skillsDir) {
    const key = path.resolve(skillsDir);
    if (bootstrapCache.has(key))
        return bootstrapCache.get(key);
    const value = buildBootstrap(key);
    bootstrapCache.set(key, value);
    return value;
}
