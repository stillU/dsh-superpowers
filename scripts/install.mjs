#!/usr/bin/env node
// dsh-superpowers installer - installs this package into a dsh profile.
//
//   node scripts/install.mjs --help
//   node scripts/install.mjs                        # dry-run, profile=web
//   node scripts/install.mjs --profile web --yes    # actually install
//   node scripts/install.mjs --yes --preset         # also copy the agent preset
//
// --yes executes the install via the dsh CLI (env DSH_CLI overrides the
//   dsh binary/script; otherwise PATH lookup, then the npx cache copy).
// --preset additionally copies preset/superpowers to
//   $DSH_HOME/.agent-presets/superpowers (default $DSH_HOME=~/.dsh).
// Exit codes: 0 ok, 1 usage error, 2 install failed.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(scriptDir, '..');
const presetSrc = path.join(pkgRoot, 'preset', 'superpowers');
const dshHome = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const presetDest = path.join(dshHome, '.agent-presets', 'superpowers');

function fail(code, message) {
  console.error(message);
  process.exitCode = code;
}

function usage() {
  console.log([
    'dsh-superpowers installer',
    '',
    'Usage:',
    '  node scripts/install.mjs [options]',
    '',
    'Options:',
    '  --profile <name>   Target profile (default: web).',
    '  --yes              Actually run the install (default: dry-run only).',
    '  --preset           Also copy preset/superpowers into $DSH_HOME/.agent-presets/',
    '                     The agent preset then appears in the new-session picker.',
    '  --help             Show this help.',
    '',
    'Environment:',
    '  DSH_CLI   Path to the dsh CLI script or binary (overrides PATH + npx-cache lookup).',
    '  DSH_HOME  Config root (default: ~/.dsh).',
    '',
    'Examples:',
    '  node scripts/install.mjs',
    '  node scripts/install.mjs --profile web --yes',
    '  node scripts/install.mjs --yes --preset',
  ].join(String.fromCharCode(10)));
}

function parseArgs(argv) {
  const args = { profile: 'web', yes: false, preset: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--yes') args.yes = true;
    else if (a === '--preset') args.preset = true;
    else if (a === '--profile') {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new Error('--profile requires a profile name');
      args.profile = v;
    } else throw new Error('unknown option: ' + a);
  }
  return args;
}

/** Locate a usable dsh CLI invocation: { cmd, baseArgs } or null. */
function resolveDsh() {
  if (process.env.DSH_CLI) {
    const p = process.env.DSH_CLI.trim();
    if (/\\.js$/i.test(p)) return { cmd: process.execPath, baseArgs: [p] };
    return { cmd: p, baseArgs: [] };
  }
  // 1) PATH lookup.
  for (const bin of process.platform === 'win32' ? ['dsh.cmd', 'dsh.bat', 'dsh'] : ['dsh']) {
    const probe = spawnSync(bin, ['--version'], { encoding: 'utf8', timeout: 15000 });
    if (probe.status === 0) return { cmd: bin, baseArgs: [] };
  }
  // 2) npx cache copy of the installed dsh CLI.
  const npxRoots = process.platform === 'win32'
    ? [path.join(os.homedir(), 'AppData', 'Local', 'npm-cache', '_npx')]
    : [path.join(os.homedir(), '.npm', '_npx')];
  const candidate = [];
  for (const root of npxRoots) {
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root)) {
      const binPath = path.join(root, entry, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
      if (fs.existsSync(binPath)) candidate.push(binPath);
    }
  }
  if (candidate.length > 0) return { cmd: process.execPath, baseArgs: [candidate[0]] };
  return null;
}

function dshRun(dsh, args) {
  const full = dsh.baseArgs.concat(args);
  const res = spawnSync(dsh.cmd, full, { encoding: 'utf8', stdio: 'inherit', timeout: 300000 });
  return res.status ?? 1;
}

function copyPreset() {
  if (!fs.existsSync(presetSrc)) throw new Error('preset not built: ' + presetSrc + ' (run node scripts/generate-preset.mjs first)');
  fs.rmSync(presetDest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(presetDest), { recursive: true });
  fs.cpSync(presetSrc, presetDest, { recursive: true });
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    usage();
    fail(1, '[install] error: ' + err.message);
    return;
  }
  if (args.help) {
    usage();
    return;
  }

  const dsh = resolveDsh();
  const addCmd = dsh
    ? (dsh.cmd === process.execPath ? dsh.cmd + ' ' + dsh.baseArgs[0] : dsh.cmd) + ' plugin --profile ' + args.profile + ' add ' + pkgRoot
    : 'dsh plugin --profile ' + args.profile + ' add ' + pkgRoot;

  if (!args.yes) {
    console.log('[install] DRY RUN (add --yes to execute)');
    console.log('  profile      : ' + args.profile);
    console.log('  package      : ' + pkgRoot);
    if (dsh) console.log('  dsh cli      : ' + (dsh.cmd === process.execPath ? dsh.cmd + ' ' + dsh.baseArgs[0] : dsh.cmd));
    console.log('  command      : ' + addCmd);
    if (args.preset) {
      console.log('  preset copy  : ' + presetSrc + '  ->  ' + presetDest);
    }
    console.log('  after install: restart the dsh web process (host plugin layers load at boot)');
    return;
  }

  const failures = [];

  if (args.preset) {
    try {
      copyPreset();
      console.log('[install] preset copied to ' + presetDest);
    } catch (err) {
      failures.push('[preset] ' + err.message);
    }
  }

  if (!dsh) {
    failures.push('[dsh] dsh CLI not found on PATH or in the npx cache; run manually: ' + addCmd);
  } else {
    const status = dshRun(dsh, ['plugin', '--profile', args.profile, 'add', pkgRoot]);
    if (status !== 0) {
      failures.push('[dsh] dsh plugin add exited with status ' + status + '; run manually: ' + addCmd);
    } else {
      console.log('[install] dsh plugin add completed for profile ' + args.profile);
    }
  }

  console.log('[install] restart the dsh web process now so the new bundle layer is loaded.');
  if (failures.length > 0) {
    for (const f of failures) console.error(f);
    fail(2, '[install] finished with ' + failures.length + ' error(s)');
    return;
  }
  console.log('[install] done.');
}

main();
