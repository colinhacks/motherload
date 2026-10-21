// Builds every publishable package into dist/, one directory each, published with
// `npm publish dist/<dir>` (DESIGN.md, "Packaging"): dist/motherload, dist/core and one per format.
// Each holds its sources compiled to JavaScript with their declarations, a README
// and a package.json whose exports and content mapper name the compiled files, because Node strips
// no types under node_modules. Every dependency is at an exact version: a Motherload package at the
// release's version, any other at the version installed here. The repository's own package.json
// files keep pointing at the sources, so the tests and the labs run them without a build, and every
// one of them is private, so that none can be published by mistake.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const dist = join(root, "dist");
const tsc = join(dist, ".tsc");
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const rootPkg = read(join(root, "package.json"));
const version: string = rootPkg.version;

rmSync(dist, { recursive: true, force: true });
execFileSync(join(root, "node_modules/.bin/tsc"), ["-p", join(root, "tsconfig.build.json")], { stdio: "inherit" });

/** The installed version of an npm dependency, which must satisfy the range the package declares (`^x.y.z`). */
function installed(dep: string, range: string, from: string): string {
  const found: string = read(join(root, "node_modules", dep, "package.json")).version;
  const [want, have] = [range.replace(/^\^/, ""), found].map((v) => v.split(".").map(Number)) as [number[], number[]];
  const ok = range.startsWith("^") ? have[0] === want[0] && (have[1]! > want[1]! || (have[1] === want[1] && have[2]! >= want[2]!)) : found === range;
  if (!ok) throw new Error(`${from}: ${dep} is ${found} here, outside the range ${range}`);
  return found;
}

const js = (path: string) => path.replace(/\.ts$/, ".js");
const types = (path: string) => path.replace(/\.ts$/, ".d.ts");

/** A source manifest as published: compiled exports, the compiled mapper, exact dependencies. */
function publishable(pkg: Record<string, any>, dependencies: Record<string, string>) {
  const { private: _private, scripts: _scripts, devDependencies: _dev, ...rest } = pkg;
  const exports = Object.fromEntries(
    Object.entries(pkg.exports as Record<string, string | { types: string }>).map(([key, path]) => [key, typeof path === "string" ? { types: types(path), default: js(path) } : path]),
  );
  const built: Record<string, unknown> = { ...rest, exports, dependencies };
  if (pkg.typescript) built.typescript = { ...pkg.typescript, contentMapper: { ...pkg.typescript.contentMapper, exec: (pkg.typescript.contentMapper.exec as string[]).map(js) } };
  return built;
}

const PACKAGES = readdirSync(join(root, "packages")).sort();

function readme(pkg: Record<string, any>): string {
  if (pkg.name === "@motherload/core") {
    return `# @motherload/core\n\n${pkg.description} Install [\`motherload\`](https://www.npmjs.com/package/motherload), or the package of each format a project reads, not this one: they depend on it.\n\nDocs: https://motherload.dev\n`;
  }
  return `# ${pkg.name}\n\n${pkg.description}\n\nOne of [Motherload](https://motherload.dev)'s packages: a TypeScript 7.1 content mapper, a preload, an esbuild plugin and a webpack loader for this format alone. [\`motherload\`](https://www.npmjs.com/package/motherload) reads every format.\n\nSetup: https://motherload.dev/#loaders-a-la-carte\n`;
}

function emit(dir: string, from: string, pkg: Record<string, any>, dependencies: Record<string, string>, readmeText: string) {
  const to = join(dist, dir);
  mkdirSync(to, { recursive: true });
  cpSync(join(tsc, from), join(to, "src"), { recursive: true });
  const built = publishable(pkg, dependencies);
  writeFileSync(join(to, "package.json"), JSON.stringify(built, null, 2) + "\n");
  writeFileSync(join(to, "README.md"), readmeText);
  // Nothing TypeScript ships but declarations, and every file the manifest names exists.
  const files = readdirSync(to, { recursive: true, encoding: "utf8" });
  const sources = files.filter((f) => /\.(c|m)?ts$/.test(f) && !/\.d\.(c|m)?ts$/.test(f));
  if (sources.length) throw new Error(`dist/${dir} holds TypeScript sources: ${sources.join(", ")}`);
  const named = [...Object.values(built.exports as Record<string, Record<string, string>>).flatMap((e) => Object.values(e)), ...((built.typescript as any)?.contentMapper.exec.slice(1) ?? [])];
  for (const file of named) if (!existsSync(join(to, file))) throw new Error(`dist/${dir}: ${file} is named in package.json and missing`);
  console.log(`dist/${dir}: ${built.name}@${built.version}, ${files.length} files, dependencies ${Object.entries(dependencies).map(([d, v]) => `${d}@${v}`).join(" ") || "none"}`);
}

for (const dir of PACKAGES) {
  const pkg = read(join(root, "packages", dir, "package.json"));
  if (pkg.version !== version) throw new Error(`packages/${dir}/package.json is ${pkg.version}, and motherload is ${version}; they move together`);
  const dependencies = Object.fromEntries(
    Object.entries((pkg.dependencies ?? {}) as Record<string, string>).map(([dep, range]) => [dep, dep.startsWith("@motherload/") ? version : installed(dep, range, pkg.name)]),
  );
  emit(dir, join("packages", dir, "src"), pkg, dependencies, readme(pkg));
}

// motherload: the format packages behind one mapper, one preload and one plugin. It imports
// nothing but them; the parsers the root package.json also lists are there for their sources.
const combined = Object.fromEntries(PACKAGES.map((dir) => [`@motherload/${dir}`, version]));
for (const name of Object.keys(combined)) if (rootPkg.dependencies[name] !== `link:packages/${name.slice("@motherload/".length)}`) throw new Error(`package.json: ${name} is not linked from packages/`);
emit("motherload", "src", rootPkg, combined, readFileSync(join(root, "README.md"), "utf8"));

rmSync(tsc, { recursive: true, force: true });
