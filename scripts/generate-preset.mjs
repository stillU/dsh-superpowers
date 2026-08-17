#!/usr/bin/env node
// dsh-superpowers preset generator - builds preset/superpowers/ (agent
// preset) from the bundled skills and the compiled bootstrap factory.
// Idempotent: the destination is cleared and rebuilt on every run.
// Zero third-party dependencies.
//   node scripts/generate-preset.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBootstrap } from '../lib/bootstrap.js';

const NL = String.fromCharCode(10);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(scriptDir, '..');
const skillsDir = path.join(pkgRoot, 'skills');
const destDir = path.join(pkgRoot, 'preset', 'superpowers');

const PRESET_NAME = 'Superpowers';
const PRESET_ORDER = 5;
const DESCRIPTION =
  '自动技能方法论：brainstorming / TDD / 调试 / 计划 / 子代理驱动开发（obra/superpowers v6.3.0 移植到 DSH）';

function listFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else out.push(p);
    }
  };
  walk(dir);
  return out.sort();
}

/** Replace destDir with a byte-for-byte copy of srcDir. */
function copyTree(srcDir, destDir) {
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });
  let count = 0;
  for (const f of listFiles(srcDir)) {
    const rel = path.relative(srcDir, f);
    const dest = path.join(destDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(f, dest);
    count++;
  }
  return count;
}

/**
 * Indent text as a YAML literal block scalar body. Non-empty lines receive
 * `indent` leading spaces; empty lines stay empty (valid inside a block
 * scalar).
 */
function yamlBlock(text, indent) {
  const pad = ' '.repeat(indent);
  return text.split(NL).map((line) => (line.length === 0 ? '' : pad + line)).join(NL);
}

function main() {
  const bootstrap = getBootstrap(skillsDir);
  if (!bootstrap) {
    throw new Error(
      'bootstrap generation failed: missing skills/using-superpowers/SKILL.md ' +
        'or skills/using-superpowers/references/dsh-tools.md under ' + skillsDir
    );
  }

  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });

  // preset.yml - display metadata only (id/trust come from the roster root).
  const presetYml = [
    'name: ' + PRESET_NAME,
    'description: ' + DESCRIPTION,
    'order: ' + PRESET_ORDER,
    '',
  ].join(NL) + NL;
  fs.writeFileSync(path.join(destDir, 'preset.yml'), presetYml, 'utf8');

  // agent.cordis.yml - the preset assembly. Relative paths here resolve from
  // the preset directory, so the bundled skills/ travels with the preset.
  const contentIndent = 6;
  const agentYml = [
    '# agent preset superpowers - DSH 组装文件（由 scripts/generate-preset.mjs 生成，请勿手改；重跑脚本即可重建）',
    '# 来源：obra/superpowers v6.3.0（MIT）+ dsh-superpowers 的 DSH 适配。',
    '#',
    '# - persona: 注入完整 superpowers bootstrap（using-superpowers 正文 + DSH 工具映射），',
    '#   等价于 Claude Code 的 SessionStart hook；',
    '# - superpowers-skills: 用独立 providerName 挂载本目录 skills/ 的 14 个技能，',
    '#   不扫描用户默认技能根，避免与全局技能目录互相遮蔽。',
    '- id: persona',
    "  name: '@deepseek-ai/dsh-persona'",
    '  config:',
    '    text: |',
    yamlBlock(bootstrap, contentIndent),
    '- id: superpowers-skills',
    "  name: '@deepseek-ai/dsh-skill-filesystem'",
    '  config:',
    "    providerName: 'superpowers'",
    '    includeDefaultRoots: false',
    "    customSkillDirs: ['./skills']",
    '    watch: false',
    '',
  ].join(NL) + NL;
  fs.writeFileSync(path.join(destDir, 'agent.cordis.yml'), agentYml, 'utf8');

  // skills/ - full copy preserving the vendored tree structure.
  const skillsDest = path.join(destDir, 'skills');
  const skillCount = copyTree(skillsDir, skillsDest);
  const skillFiles = listFiles(skillsDest);
  const bootstrapLines = bootstrap.split(NL).length;
  console.log('[preset] generated ' + destDir);
  console.log('[preset] bootstrap: ' + bootstrap.length + ' chars / ' + bootstrapLines + ' lines');
  console.log('[preset] skills: ' + skillCount + ' files copied (' + skillFiles.length + ' on disk)');
  console.log('[preset] agent.cordis.yml: ' + agentYml.split(NL).length + ' lines');
  console.log('[preset] preset.yml: ' + presetYml.split(NL).length + ' lines');
}

try {
  main();
} catch (err) {
  console.error('[preset] FAILED: ' + err.message);
  process.exitCode = 1;
}
