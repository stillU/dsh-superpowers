#!/usr/bin/env node
// dsh-superpowers dev helper: runs npm install detached and records a .install.done marker.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '..');
const log = fs.openSync(path.join(base, '.install.log'), 'w');
const errLog = fs.openSync(path.join(base, '.install.err.log'), 'w');
const npmCli = 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js';
const child = spawn(process.execPath, [npmCli, 'install', '--no-audit', '--no-fund'], {
  cwd: base,
  detached: true,
  stdio: ['ignore', log, errLog, 'ignore'],
  windowsHide: true,
});
fs.writeFileSync(path.join(base, '.install.pid'), String(child.pid));
child.on('exit', (code, signal) => {
  fs.writeFileSync(path.join(base, '.install.done'), JSON.stringify({ code, signal: signal ?? null, ts: Date.now() }));
  fs.closeSync(log);
  fs.closeSync(errLog);
});
child.on('error', (err) => {
  fs.writeFileSync(path.join(base, '.install.done'), JSON.stringify({ code: -1, error: String(err), ts: Date.now() }));
});
child.unref();
