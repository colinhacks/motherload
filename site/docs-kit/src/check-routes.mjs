#!/usr/bin/env node
// Checks that a built docs site still answers every address it has ever served, the way a lockfile
// holds a project to what it once resolved. A page removed or renamed without a redirect breaks every
// link to it from elsewhere (a search result, a post, an agent's notes), which no check of the site's
// own links can see. Run after the build, on its output:
//
//   node docs-kit/src/check-routes.mjs build/client --lock routes.lock [--vercel vercel.json]
//
// - The lockfile lists one address per line, sorted. Every page the build serves goes in it (each
//   .html file, by the address a link names it with), and so does every redirect's source.
// - An address in the lockfile must be a page of the build, or the source of a redirect whose
//   destination is a page or file of the build. `--vercel <file>` reads the redirects from a Vercel config:
//   its `redirects` (a source with `:name` segments matches any segment there, `:name*` any rest),
//   and its `routes` that answer with a 3xx status and a `Location`.
// - An address the build serves that the lockfile lacks is added to it, as an install adds to a
//   lockfile. Under CI (`CI` set, as Vercel and GitHub Actions set it), the file is never written:
//   a missing address fails the check, so a new page is locked by the commit that adds it.
// - An address leaves the lockfile only by hand, when nothing should answer it any more.
// It prints each address the build no longer answers, and exits 1 if there is one.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const dir = args.find((a, i) => !a.startsWith('--') && !['--lock', '--vercel'].includes(args[i - 1]));
const lockFile = flag('--lock');
const vercelFile = flag('--vercel');
if (!dir || !lockFile) {
  console.error('usage: check-routes.mjs <build dir> --lock routes.lock [--vercel vercel.json]');
  process.exit(2);
}
const root = path.resolve(dir);
const frozen = Boolean(process.env.CI);

/** Every page of the build, by the address a link names it with. */
const pages = new Set();
const walk = (at) => {
  for (const name of readdirSync(at)) {
    const file = path.join(at, name);
    if (statSync(file).isDirectory()) walk(file);
    else if (name.endsWith('.html')) {
      const rel = '/' + path.relative(root, file).split(path.sep).join('/');
      if (/^\/(404|__spa-fallback)(\/index)?\.html$/.test(rel)) continue;
      pages.add(rel.endsWith('/index.html') ? rel.slice(0, -'index.html'.length).replace(/(.)\/$/, '$1') : rel.slice(0, -'.html'.length));
    }
  }
};
walk(root);

/** The redirects, each a pattern on the path, its destination, and the source to lock when it names one address. */
const redirects = [];
if (vercelFile) {
  const config = JSON.parse(readFileSync(vercelFile, 'utf8'));
  for (const r of config.redirects ?? []) {
    const literal = !/[:(*]/.test(r.source);
    const pattern = new RegExp(`^${r.source.replace(/\./g, '\\.').replace(/\/:[\w]+\*/g, '(?:/.*)?').replace(/:[\w]+/g, '[^/]+')}$`);
    redirects.push({ pattern, destination: r.destination, source: literal ? r.source : null });
  }
  for (const r of config.routes ?? []) {
    const location = r.headers?.Location ?? r.headers?.location;
    if (!(r.status >= 300 && r.status < 400 && location)) continue;
    const source = r.src.replace(/^\^/, '').replace(/\$$/, '');
    redirects.push({ pattern: new RegExp(r.src), destination: location, source: /^[\w/.-]+$/.test(source) ? source : null });
  }
}

/** The page an address reaches, following redirects (a few at most), or null. */
function reach(address, seen = 0) {
  if (pages.has(address)) return address;
  const file = path.join(root, address);
  if (file.startsWith(root + path.sep) && existsSync(file) && statSync(file).isFile()) return address;
  if (seen > 5) return null;
  const r = redirects.find((r) => r.pattern.test(address));
  if (!r) return null;
  if (/^https?:\/\//.test(r.destination)) return r.destination;
  return reach(r.destination.replace(/[?#].*$/, '').replace(/(.)\/$/, '$1') || '/', seen + 1);
}

const locked = existsSync(lockFile) ? readFileSync(lockFile, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) : [];
const lockedSet = new Set(locked);
const gone = locked.filter((address) => !reach(address));
const fresh = [...pages, ...redirects.flatMap((r) => (r.source ? [r.source] : []))].filter((address) => !lockedSet.has(address));

for (const address of gone) console.error(`check-routes: ${address} is in ${lockFile} but the build no longer answers it: add a redirect to the page that took its place`);
if (fresh.length && frozen) {
  for (const address of fresh) console.error(`check-routes: ${address} is not in ${lockFile}: build the site locally and commit the file`);
}
if (fresh.length && !frozen) {
  const all = [...new Set([...locked, ...fresh])].sort();
  writeFileSync(lockFile, all.join('\n') + '\n');
}
if (gone.length || (fresh.length && frozen)) process.exit(1);
console.log(`check-routes: ${locked.length + (frozen ? 0 : fresh.length)} addresses, each answered${fresh.length && !frozen ? `; ${fresh.length} added to ${lockFile}` : ''}`);
