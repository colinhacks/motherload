#!/usr/bin/env node
// Copies docs-kit into a site, as `<site>/docs-kit/`, which the site depends on as
// `"docs-kit": "link:./docs-kit"` (README.md, "How a site consumes it").
//
//   node src/sync.mjs <site-dir>          copy this checkout's package.json, README.md and src/
//   node src/sync.mjs <site-dir> --check  only check the copy: exit 1 if a file in it was edited
//                                         there, and say whether docs-kit has changed since
//   node src/sync.mjs <site-dir> --force  copy over a copy that was edited in place
//
// The copy holds this script too, so a site checks its copy with `node docs-kit/src/sync.mjs .
// --check`, which compares it with the docs-kit checkout it came from when that is on the machine.
//
// The copy carries `.synced.json`: the commit of docs-kit it came from and a hash of every file.
// A sync refuses to overwrite a copy whose files no longer match those hashes, because an edit made
// in a site's copy belongs in docs-kit, where every site gets it; --check is the gate a site runs
// for the same reason.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const kit = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const site = args.find((arg) => !arg.startsWith('--'));
const check = args.includes('--check');
const force = args.includes('--force');
if (!site) {
  console.error('usage: node src/sync.mjs <site-dir> [--check | --force]');
  process.exit(2);
}
const target = path.resolve(site, 'docs-kit');
const MANIFEST = '.synced.json';

/** The files of a docs-kit tree, relative to it: package.json, README.md and everything in src/. */
function files(root) {
  const out = ['package.json', 'README.md'].filter((file) => existsSync(path.join(root, file)));
  const walk = (dir) => {
    for (const name of readdirSync(path.join(root, dir)).sort()) {
      if (name.startsWith('.')) continue;
      const rel = path.join(dir, name);
      if (statSync(path.join(root, rel)).isDirectory()) walk(rel);
      else out.push(rel);
    }
  };
  if (existsSync(path.join(root, 'src'))) walk('src');
  return out;
}

const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const hashes = (root) => Object.fromEntries(files(root).map((file) => [file, hash(path.join(root, file))]));

function commit() {
  try {
    const head = execFileSync('git', ['-C', kit, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const dirty = execFileSync('git', ['-C', kit, 'status', '--porcelain', '--', 'package.json', 'README.md', 'src'], { encoding: 'utf8' }).trim();
    return dirty ? `${head}+uncommitted` : head;
  } catch {
    return 'unknown';
  }
}

/** The files of the copy that differ from the hashes it was synced with. */
function edited() {
  const manifestFile = path.join(target, MANIFEST);
  if (!existsSync(manifestFile)) return existsSync(target) ? ['(no .synced.json: not a synced copy)'] : [];
  const { files: recorded } = JSON.parse(readFileSync(manifestFile, 'utf8'));
  const now = hashes(target);
  const names = new Set([...Object.keys(recorded), ...Object.keys(now)]);
  return [...names].filter((name) => recorded[name] !== now[name]).sort();
}

const changed = edited();
if (check) {
  if (changed.length) {
    console.error(`docs-kit: ${target} was edited in place; make the change in docs-kit (${kit}) and sync:\n  ${changed.join('\n  ')}`);
    process.exit(1);
  }
  const { from: origin, commit: from, files: recorded } = JSON.parse(readFileSync(path.join(target, MANIFEST), 'utf8'));
  // The checkout the copy came from, when it is on this machine (and is not the copy itself).
  const source = [origin, kit].find((dir) => dir && existsSync(path.join(dir, 'src')) && path.resolve(dir) !== target);
  const behind = source && JSON.stringify(recorded) !== JSON.stringify(hashes(source));
  console.log(`docs-kit: ${target} matches docs-kit ${from}${behind ? `; ${source} has changed since, so a sync would update it` : ''}`);
  process.exit(0);
}
if (changed.length && !force) {
  console.error(`docs-kit: ${target} was edited in place, so it is not overwritten (--force overwrites it):\n  ${changed.join('\n  ')}`);
  process.exit(1);
}
rmSync(target, { recursive: true, force: true });
const recorded = hashes(kit);
for (const file of Object.keys(recorded)) {
  mkdirSync(path.dirname(path.join(target, file)), { recursive: true });
  writeFileSync(path.join(target, file), readFileSync(path.join(kit, file)));
}
const from = commit();
writeFileSync(path.join(target, MANIFEST), JSON.stringify({ from: kit, commit: from, files: recorded }, null, 2) + '\n');
console.log(`docs-kit: copied ${Object.keys(recorded).length} files of docs-kit ${from} to ${target}`);
