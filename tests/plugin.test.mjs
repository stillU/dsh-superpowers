import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const SKILLS_DIR = path.join(pkgRoot, 'skills');
const LIB = await import('../lib/index.js');

const EXPECTED_NAMES = [
  'brainstorming',
  'dispatching-parallel-agents',
  'executing-plans',
  'finishing-a-development-branch',
  'receiving-code-review',
  'requesting-code-review',
  'subagent-driven-development',
  'systematic-debugging',
  'test-driven-development',
  'using-git-worktrees',
  'using-superpowers',
  'verification-before-completion',
  'writing-plans',
  'writing-skills',
].sort();

function mkTempSkills() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-tests-'));
  const write = (name, content) => {
    const d = path.join(dir, name);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'SKILL.md'), content, 'utf8');
  };
  write('good-one', '---\nname: good-one\ndescription: A proper skill\n---\n# Body\n');
  write('missing-name', '---\ndescription: No name here\n---\n# Body\n');
  write('missing-desc', '---\nname: no-desc\n---\n# Body\n');
  write('no-frontmatter', 'Just body text without frontmatter.\n');
  return dir;
}

// ── 1. parseFrontmatter ────────────────────────────────────────────────
test('parseFrontmatter: quoted description/whenToUse + body extraction', () => {
  const input = [
    '---',
    'name: sample-skill',
    'description: "A skill with a, quoted description"',
    "whenToUse: 'Only when explicitly helpful'",
    '---',
    '# Body heading',
    'second line',
    '',
  ].join('\n');
  const { frontmatter, body } = LIB.parseFrontmatter(input);
  assert.equal(frontmatter.name, 'sample-skill');
  assert.equal(frontmatter.description, 'A skill with a, quoted description');
  assert.equal(frontmatter.whenToUse, 'Only when explicitly helpful');
  assert.equal(body, '# Body heading\nsecond line\n');
  assert.ok(!body.startsWith('---'));
});

test('parseFrontmatter: no frontmatter returns empty record and original text', () => {
  const text = 'hello world\nno frontmatter here';
  const { frontmatter, body } = LIB.parseFrontmatter(text);
  assert.deepEqual(frontmatter, {});
  assert.equal(body, text);
});

test('discoverSkills: skips SKILL.md missing name or description', () => {
  const dir = mkTempSkills();
  try {
    const found = LIB.discoverSkills(dir);
    const names = found.map((s) => s.name);
    assert.deepEqual(names, ['good-one']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── 2. guardBraceTemplates ─────────────────────────────────────────────
test('guardBraceTemplates: replaces ASCII braces with full-width', () => {
  const out = LIB.guardBraceTemplates('Hello {{world}} and {{again}}!');
  assert.ok(out.includes('｛｛world｝｝'));
  assert.ok(!out.includes('{{'));
  assert.ok(!out.includes('}}'));
});

test('guardBraceTemplates: no braces returns the input unchanged', () => {
  const input = 'plain text without any template braces';
  assert.equal(LIB.guardBraceTemplates(input), input);
});

// ── 3. discoverSkills('skills') ────────────────────────────────────────
test('discoverSkills: exactly 14 bundled skills, stable sort, valid directories', () => {
  const found = LIB.discoverSkills(SKILLS_DIR);
  assert.equal(found.length, 14);
  const names = found.map((s) => s.name);
  assert.deepEqual(names, EXPECTED_NAMES);
  const sorted = [...found].sort((a, b) => a.name.localeCompare(b.name));
  assert.deepEqual(found, sorted);
  for (const skill of found) {
    assert.equal(skill.directory, path.join(SKILLS_DIR, skill.name));
    assert.equal(skill.path, path.join(skill.directory, 'SKILL.md'));
    assert.ok(typeof skill.description === 'string' && skill.description.length > 0);
  }
});

// ── 4. createSkillsProvider ────────────────────────────────────────────
test('createSkillsProvider: list() returns 14 ranked bundled candidates', async () => {
  const provider = LIB.createSkillsProvider({ rootDir: SKILLS_DIR, providerName: 'test' });
  assert.equal(provider.name, 'test');
  const candidates = await provider.list();
  assert.equal(candidates.length, 14);
  for (const c of candidates) {
    assert.equal(c.rank, 600);
    assert.equal(LIB.BUNDLED_SKILL_RANK, 600);
    assert.equal(c.source, 'bundled');
    assert.equal(c.invocation.modelInvocable, true);
    assert.equal(c.invocation.userInvocable, true);
    assert.equal(c.provider, 'test');
    assert.ok(typeof c.locator.path === 'string' && c.locator.path.length > 0);
    assert.ok(typeof c.locator.directory === 'string' && c.locator.directory.length > 0);
    assert.equal(c.path, c.locator.path);
  }
});

test('createSkillsProvider: get() loads body with directory resourceBase', async () => {
  const provider = LIB.createSkillsProvider({ rootDir: SKILLS_DIR, providerName: 'test' });
  const candidates = await provider.list();
  for (const candidate of candidates) {
    const def = await provider.get(candidate);
    assert.ok(def, 'definition for ' + candidate.name);
    assert.ok(typeof def.content === 'string' && def.content.length > 0, 'content for ' + candidate.name);
    assert.equal(def.resourceBase.kind, 'directory');
    assert.equal(def.resourceBase.path, candidate.locator.directory);
    assert.equal(def.source, 'bundled');
    assert.equal(def.provider, 'test');
    assert.equal(def.invocation.modelInvocable, true);
    assert.equal(def.invocation.userInvocable, true);
    assert.equal(def.name, candidate.name);
  }
});

test('createSkillsProvider: get() returns undefined for a nonexistent path', async () => {
  const provider = LIB.createSkillsProvider({ rootDir: SKILLS_DIR, providerName: 'test' });
  const fake = {
    name: 'ghost',
    description: 'does not exist',
    rank: 600,
    source: 'bundled',
    provider: 'test',
    invocation: { modelInvocable: true, userInvocable: true },
    path: path.join(pkgRoot, 'skills', 'no-such-dir', 'SKILL.md'),
    locator: {
      path: path.join(pkgRoot, 'skills', 'no-such-dir', 'SKILL.md'),
      directory: path.join(pkgRoot, 'skills', 'no-such-dir'),
    },
  };
  const def = await provider.get(fake);
  assert.equal(def, undefined);
});

test('createSkillsProvider: list() returns [] on aborted signal', async () => {
  const provider = LIB.createSkillsProvider({ rootDir: SKILLS_DIR, providerName: 'test' });
  const ctrl = new AbortController();
  ctrl.abort();
  assert.deepEqual(await provider.list({ signal: ctrl.signal }), []);
});

// ── 5. buildBootstrap ──────────────────────────────────────────────────
test('buildBootstrap: marker, mapping and tool names, no ASCII braces', () => {
  const out = LIB.buildBootstrap(SKILLS_DIR);
  assert.ok(out !== undefined, 'bootstrap should build from bundled skills');
  assert.ok(out.includes('<EXTREMELY_IMPORTANT>'));
  assert.ok(out.includes('</EXTREMELY_IMPORTANT>'));
  assert.ok(out.includes('You have superpowers'));
  assert.ok(out.includes('DSH tool mapping'));
  for (const tool of ['subagent', 'subagent_fork', 'todo_write', 'exit_plan_mode', 'web_search', 'bash']) {
    assert.ok(out.includes(tool), 'bootstrap mentions ' + tool);
  }
  assert.ok(!out.includes('{{'));
  assert.ok(!out.includes('}}'));
});

// ── 6. stripFrontmatter ────────────────────────────────────────────────
test('stripFrontmatter: real brainstorming SKILL.md loses its frontmatter', () => {
  const full = fs.readFileSync(path.join(SKILLS_DIR, 'brainstorming', 'SKILL.md'), 'utf8');
  const body = LIB.stripFrontmatter(full);
  assert.ok(!body.startsWith('---'));
  assert.ok(body.trimStart().startsWith('# Brainstorming'));
  assert.ok(body.length < full.length);
  assert.ok(!/^\s*name: brainstorming/m.test(body));
});

// ── 7. index export surface ────────────────────────────────────────────
test('index exports: name, apply, Config, and 7 pure function helpers', () => {
  assert.equal(LIB.name, 'dsh-superpowers');
  assert.equal(typeof LIB.apply, 'function');
  assert.ok(LIB.Config, 'Config schema is exported');
  // Schemastery Schema instances are callable (typeof 'function').
  assert.equal(typeof LIB.Config, 'function');
  for (const fn of [
    'parseFrontmatter',
    'discoverSkills',
    'createSkillsProvider',
    'buildBootstrap',
    'getBootstrap',
    'guardBraceTemplates',
    'stripFrontmatter',
  ]) {
    assert.equal(typeof LIB[fn], 'function', fn + ' is re-exported as a function');
  }
});

// ── 8. apply tolerance ─────────────────────────────────────────────────
test('apply: empty ctx stub with { enabled: false } does not throw', () => {
  const origWarn = console.warn;
  console.warn = () => {};
  try {
    assert.doesNotThrow(() => LIB.apply({}, { enabled: false }));
  } finally {
    console.warn = origWarn;
  }
});

test('apply: ctx stub without services does not throw (warns and skips)', () => {
  const origWarn = console.warn;
  const origLog = console.log;
  const origErr = console.error;
  console.warn = () => {};
  console.log = () => {};
  console.error = () => {};
  try {
    assert.doesNotThrow(() => LIB.apply({ get: () => undefined }, {}));
    assert.doesNotThrow(() => LIB.apply({ get: (k) => (k === 'skills' ? { registerProvider: () => {} } : undefined) }, {}));
  } finally {
    console.warn = origWarn;
    console.log = origLog;
    console.error = origErr;
  }
});

// ── extra: lib artifacts exist (independent sanity) ────────────────────
test('sanity: compiled lib artifacts exist next to src', () => {
  for (const f of ['index.js', 'index.d.ts', 'skills-provider.js', 'bootstrap.js']) {
    assert.ok(fs.existsSync(path.join(pkgRoot, 'lib', f)), 'lib/' + f + ' exists');
  }
});
