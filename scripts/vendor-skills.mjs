#!/usr/bin/env node
// dsh-superpowers vendor script — copies ../superpowers/skills verbatim,
// adds the DSH tool-mapping reference, validates the vendored tree, and
// writes SOURCES.md. Idempotent. Zero third-party dependencies.
//   node scripts/vendor-skills.mjs            # copy + validate + write SOURCES.md
//   node scripts/vendor-skills.mjs --validate # validate only (no copy)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(pkgRoot, "..");
const srcRoot = path.join(repoRoot, "superpowers");
const srcSkills = path.join(srcRoot, "skills");
const destSkills = path.join(pkgRoot, "skills");
const packedRefsFile = path.join(srcRoot, ".git", "packed-refs");
const sourcesFile = path.join(pkgRoot, "SOURCES.md");
const toolsRefRel = "using-superpowers/references/dsh-tools.md";
const toolsRefSource = path.join(pkgRoot, "references", "dsh-tools.md");

const EXPECTED_SKILLS = [
  "brainstorming",
  "dispatching-parallel-agents",
  "executing-plans",
  "finishing-a-development-branch",
  "receiving-code-review",
  "requesting-code-review",
  "subagent-driven-development",
  "systematic-debugging",
  "test-driven-development",
  "using-git-worktrees",
  "using-superpowers",
  "verification-before-completion",
  "writing-plans",
  "writing-skills",
];
const EXPECTED_ORIGIN_SHA = "b36e0829c6d0140e93cfef2ca599b1b07d4a7797";

const mode = process.argv.slice(2).includes("--validate") ? "validate" : "copy";
const toRel = (abs, base) => path.relative(base, abs).split(path.sep).join("/");

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

function readOriginMainSha() {
  if (!fs.existsSync(packedRefsFile)) throw new Error("packed-refs not found: " + packedRefsFile);
  const line = fs.readFileSync(packedRefsFile, "utf8").split("\n").find((l) => l.includes(" refs/remotes/origin/main"));
  if (!line) throw new Error("refs/remotes/origin/main not found in packed-refs");
  const sha = line.trim().split(/\s+/)[0];
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error("unexpected origin/main SHA: " + sha);
  return sha;
}

function parseFrontmatter(content) {
  // Minimal frontmatter parser: leading --- block, per-line key: value, quoted values unwrapped.
  const text = content.replace(/\r\n/g, "\n");
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return null;
  const fm = {};
  for (const raw of m[1].split("\n")) {
    const i = raw.indexOf(":");
    if (i <= 0) continue;
    const key = raw.slice(0, i).trim();
    let value = raw.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) fm[key] = value;
  }
  return fm;
}

function assertSame(a, b, label) {
  const ba = fs.readFileSync(a);
  const bb = fs.readFileSync(b);
  if (!ba.equals(bb)) throw new Error("byte mismatch: " + label + "\n  source: " + a + "\n  dest:   " + b);
}

function validate() {
  if (!fs.existsSync(srcSkills)) throw new Error("vendor source skills dir not found: " + srcSkills);
  if (!fs.existsSync(destSkills)) throw new Error("vendored skills dir missing — run without --validate first: " + destSkills);

  const dirs = fs.readdirSync(srcSkills, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  if (dirs.length !== EXPECTED_SKILLS.length || EXPECTED_SKILLS.some((d, i) => d !== dirs[i])) {
    throw new Error("skill directory set mismatch\nexpected: " + EXPECTED_SKILLS.join(", ") + "\nactual:   " + dirs.join(", "));
  }

  for (const dir of dirs) {
    const srcSkillMd = path.join(srcSkills, dir, "SKILL.md");
    const destSkillMd = path.join(destSkills, dir, "SKILL.md");
    if (!fs.existsSync(srcSkillMd)) throw new Error("missing source SKILL.md: " + srcSkillMd);
    if (!fs.existsSync(destSkillMd)) throw new Error("missing vendored SKILL.md: " + destSkillMd);
    const fm = parseFrontmatter(fs.readFileSync(srcSkillMd, "utf8"));
    if (!fm) throw new Error("SKILL.md missing frontmatter: " + srcSkillMd);
    if (!fm.name || !String(fm.name).trim()) throw new Error("empty frontmatter name: " + srcSkillMd);
    if (!fm.description || !String(fm.description).trim()) throw new Error("empty frontmatter description: " + srcSkillMd);
    if (fm.name !== dir) {
      console.warn("[warn] frontmatter name " + JSON.stringify(fm.name) + " != directory " + dir);
    }
  }

  const srcFiles = listFiles(srcSkills);
  const srcRels = srcFiles.map((f) => toRel(f, srcSkills));
  const destFiles = listFiles(destSkills);
  const destRels = destFiles.map((f) => toRel(f, destSkills));

  const added = destRels.filter((r) => !srcRels.includes(r));
  const missing = srcRels.filter((r) => !destRels.includes(r));
  if (added.length !== 1 || added[0] !== toolsRefRel) {
    throw new Error("unexpected extra files in vendored skills (expected only " + toolsRefRel + "): " + added.join(", "));
  }
  if (missing.length > 0) throw new Error("missing vendored files: " + missing.join(", "));

  let compared = 0;
  for (const rel of srcRels) {
    assertSame(path.join(srcSkills, rel), path.join(destSkills, rel), rel);
    compared++;
  }
  if (!fs.existsSync(path.join(destSkills, toolsRefRel))) throw new Error("missing added tool mapping: " + toolsRefRel);

  return { dirs, fileCount: srcRels.length, compared };
}

function copyTree() {
  fs.rmSync(destSkills, { recursive: true, force: true });
  fs.mkdirSync(destSkills, { recursive: true });
  for (const f of listFiles(srcSkills)) {
    const rel = toRel(f, srcSkills);
    const dest = path.join(destSkills, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(f, dest);
  }
  const destToolsRef = path.join(destSkills, toolsRefRel);
  fs.mkdirSync(path.dirname(destToolsRef), { recursive: true });
  if (!fs.existsSync(toolsRefSource)) throw new Error("missing canonical tool mapping: " + toolsRefSource);
  fs.copyFileSync(toolsRefSource, destToolsRef);
}

function main() {
  const sha = readOriginMainSha();
  if (sha !== EXPECTED_ORIGIN_SHA) console.warn("[warn] origin/main is " + sha + " (expected " + EXPECTED_ORIGIN_SHA + ")");

  if (mode === "copy") {
    copyTree();
    const v = validate();
    const originRel = path.relative(repoRoot, srcRoot).split(path.sep).join("/") || "superpowers";
    const rel = (p) => path.relative(pkgRoot, p).split(path.sep).join("/") || ".";
    const runCmd = "node " + rel(process.argv[1]);
    const sources = [
      "# SOURCES — dsh-superpowers vendor provenance",
      "",
      "- Upstream project: [obra/superpowers](https://github.com/obra/superpowers)",
      "- Version: v6.3.0 (2026-08-12)",
      "- Local vendor source: " + originRel + " (" + srcRoot + ")",
      "- origin/main commit: " + sha,
      "- Skills directories: " + v.dirs.length,
      "- Copied files: " + v.fileCount + " (+ 1 added tool mapping: " + toolsRefRel + ")",
      "- Vendor script: " + rel(process.argv[1]) + "  —  copy: `" + runCmd + "`  |  validate: `" + runCmd + " --validate`",
      "",
    ].join("\n") + "\n";
    fs.writeFileSync(sourcesFile, sources, "utf8");
    console.log("[vendor] copied " + v.fileCount + " files into " + rel(destSkills));
    console.log("[vendor] validated " + v.compared + " files byte-identical (" + v.dirs.length + " skill dirs)");
    console.log("[vendor] origin/main = " + sha);
    console.log("[vendor] wrote " + rel(sourcesFile));
  } else {
    const v = validate();
    console.log("[validate] OK: " + v.dirs.length + " skill dirs, " + v.compared + " files byte-identical, origin/main = " + sha);
  }
}

try {
  main();
} catch (err) {
  console.error("[vendor] FAILED: " + err.message);
  process.exitCode = 1;
}
