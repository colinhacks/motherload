// Sets the version every Motherload package is released at (DESIGN.md, "Releasing"): `nub run bump
// 0.2.0` writes it into the root package.json, which is `motherload`'s, into each
// packages/<name>/package.json, and into every dependency one of them has on another, since they move
// together and tests/packages.test.ts and scripts/build.ts refuse a manifest that differs. The files
// are edited as text, so their layout is kept.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const next = process.argv[2] ?? "";
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(next)) throw new Error(`usage: nub run bump <version>, a semver such as 0.2.0; got "${next}"`);

const manifests = ["package.json", ...readdirSync(join(root, "packages")).sort().map((dir) => join("packages", dir, "package.json"))];
for (const file of manifests) {
  const path = join(root, file);
  const text = readFileSync(path, "utf8");
  const bumped = text.replace(/^( {2}"version": )"[^"]*"/m, `$1"${next}"`).replace(/^( {4}"@motherload\/[a-z0-9]+": )"(?!link:)[^"]*"/gm, `$1"${next}"`);
  if (JSON.parse(bumped).version !== next) throw new Error(`${file}: no top-level "version" to set`);
  writeFileSync(path, bumped);
  console.log(`${file}: ${next}`);
}
