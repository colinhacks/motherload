// Checks the packages scripts/build.ts wrote to dist/ as a project installs them: each packed into
// a tarball, installed from the tarballs into a project outside the repository (so nothing
// resolves to the repository's own links), then type-checked through the installed mappers, run
// under the installed preloads, bundled with the installed esbuild plugins, webpack loader and Vite
// plugin, and tested with the installed Jest transformer.
// Five projects: a copy of lab/basic on `motherload`, a copy of lab/packages on two format packages
// alone, and copies of lab/bundlers (webpack, Rspack, Vite, Rollup and Rolldown), lab/nextjs (Next.js
// with Turbopack and with webpack) and lab/jest (Jest and Vitest) on `motherload`. Needs the npm
// registry for TypeScript, the bundlers, Next.js, Jest and the parsers. Run `nub run build` first.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const dist = join(root, "dist");
const work = mkdtempSync(join(tmpdir(), "motherload-check-dist-"));
const tarballs = join(work, "tarballs");
/** A command's output, stdout and then stderr; throws with both when it exits non-zero. */
function run(command: string, args: string[], cwd: string): string {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const out = `${result.stdout}${result.stderr}`;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} exited with ${result.status} in ${cwd}\n${out}`);
  return out;
}

const dirs = readdirSync(dist).filter((d) => !d.startsWith("."));
for (const dir of dirs) run("nub", ["pack", "--pack-destination", tarballs], join(dist, dir));
const version: string = JSON.parse(readFileSync(join(dist, "motherload", "package.json"), "utf8")).version;
const tarball = (dir: string) => `file:${join(tarballs, dir === "motherload" ? `motherload-${version}.tgz` : `motherload-${dir}-${version}.tgz`)}`;
// Every Motherload package a dependency names comes from its tarball, not the registry.
const overrides = Object.fromEntries(dirs.filter((d) => d !== "motherload").map((d) => [`@motherload/${d}`, tarball(d)]));

/** The lab's own dependencies beyond TypeScript and esbuild, as its package.json in the repository names them. */
const labDependencies = (lab: string): Record<string, string> => {
  try {
    const pkg = JSON.parse(readFileSync(join(root, "lab", lab, "package.json"), "utf8"));
    return { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    return {};
  }
};

/** `extra` names dependencies beyond the lab's own, and `prepare` changes the copy before it is installed. */
function project(lab: string, dependencies: string[], commands: [string, string[], string][], { extra = {}, prepare }: { extra?: Record<string, string>; prepare?: (dir: string) => void } = {}) {
  const dir = join(work, lab);
  cpSync(join(root, "lab", lab), dir, { recursive: true, filter: (from) => !/[\\/](node_modules|dist|\.next)$/.test(from) });
  prepare?.(dir);
  const pkg = {
    name: `check-dist-${lab}`,
    private: true,
    type: "module",
    dependencies: Object.fromEntries(dependencies.map((name) => [name, tarball(name === "motherload" ? name : name.slice("@motherload/".length))])),
    devDependencies: { typescript: "7.1.0-dev.20261002.1", "@types/node": "^26.6.1", esbuild: "^0.28.2", ...labDependencies(lab), ...extra },
    overrides,
  };
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  rmSync(join(dir, "pnpm-lock.yaml"), { force: true });
  run("nub", ["install"], dir);
  if (existsSync(join(dir, "tsconfig.json"))) {
    // A Next.js app's layout reads the route types `next typegen` writes.
    if (existsSync(join(dir, "next.config.ts"))) run(join(dir, "node_modules/.bin/next"), ["typegen"], dir);
    const checked = run(join(dir, "node_modules/.bin/tsc"), ["-p", "tsconfig.json", "--noEmit", "--runExternalCode"], dir);
    if (checked !== "") throw new Error(`${lab}: the type check printed\n${checked}`);
  }
  for (const [command, args, expected] of commands) {
    const out = run(command, args, dir);
    if (!out.includes(expected)) throw new Error(`${lab}: ${command} ${args.join(" ")} printed\n${out}`);
    // Node's own notice that Jest's ES modules (`--experimental-vm-modules`) are experimental is not a tool's warning.
    if (/\bwarning\b/i.test(out.replace(/^.*(ExperimentalWarning|--trace-warnings).*$/gm, ""))) throw new Error(`${lab}: ${command} ${args.join(" ")} warned\n${out}`);
  }
  console.log(`${lab}: ${existsSync(join(dir, "tsconfig.json")) ? "type-checked, and " : ""}${commands.length} commands passed, from ${dependencies.join(", ")}`);
}

// What each lab prints, as tests/lab.test.ts checks it in the repository.
const BASIC = '"port":8080,"big":"9007199254740993","started":"1979-05-27T07:32:00.000Z","day":"1979-05-27","tags":2';
const TABLES = '"zip":"02134","grace":"Hopper, Grace","score":"37","notes":"Notes from the lab.","title":"Hello, Motherload","body":"# Hello"';
const PACKAGES = '{"name":"packages","port":8080,"fontSize":14}';
project("basic", ["motherload"], [
  [process.execPath, ["--import", "motherload/register", "main.ts"], BASIC],
  [process.execPath, ["--import", "motherload/register", "main.ts"], TABLES],
  [process.execPath, ["build-esbuild.ts"], "errors=0 inputs=11 node_modules=0"],
  [process.execPath, ["dist/main.mjs"], BASIC],
  [process.execPath, ["dist/main.mjs"], TABLES],
]);
project("packages", ["@motherload/toml", "@motherload/jsonc"], [
  [process.execPath, ["--import", "@motherload/jsonc/register", "--import", "@motherload/toml/register", "main.ts"], PACKAGES],
  [process.execPath, ["build-esbuild.ts"], "errors=0 inputs=3 node_modules=0"],
  [process.execPath, ["dist/main.mjs"], PACKAGES],
]);
// lab/bundlers reads lab/basic's files, copied beside it above; the bundlers come from the registry.
const BUNDLED = '"greeting":"hello world"';
const bundle = (bundler: string, file: string): [string, string[], string][] => [
  [process.execPath, ["build.mjs", bundler], "errors=0 warnings=0 node_modules=0"],
  [process.execPath, [`dist/${bundler}/${file}`], BASIC],
  [process.execPath, [`dist/${bundler}/${file}`], TABLES],
  [process.execPath, [`dist/${bundler}/${file}`], BUNDLED],
];
project("bundlers", ["motherload"], [...bundle("webpack", "main.cjs"), ...bundle("rspack", "main.cjs"), ...bundle("vite", "main.mjs"), ...bundle("rollup", "main.mjs"), ...bundle("rolldown", "main.mjs")], {
  extra: { webpack: "^5.112.0", "@rspack/core": "^2.2.9", vite: "^8.3.0", rollup: "^4.64.0", rolldown: "^1.2.0" },
});
// lab/jest: Jest's CommonJS and ES module runs through motherload/jest, and Vitest through motherload/vite.
const jest = join(work, "jest/node_modules/.bin/jest");
project("jest", ["motherload"], [
  [jest, ["-c", "jest.cjs.config.cjs", "--ci"], "Tests:       1 passed, 1 total"],
  ["env", ["NODE_OPTIONS=--experimental-vm-modules", jest, "-c", "jest.esm.config.cjs", "--ci"], "Tests:       2 passed, 2 total"],
  [join(work, "jest/node_modules/.bin/vitest"), ["run"], "Tests  1 passed (1)"],
]);
// lab/nextjs, built with Turbopack and then with webpack. Turbopack's root is the lab's parent's
// parent in the repository, and here the work directory, which holds the copy of lab/basic.
const NEXT = '&quot;port&quot;:8080,&quot;big&quot;:&quot;9007199254740993&quot;';
const next = (args: string[]): [string, string[], string][] => [[join(work, "nextjs/node_modules/.bin/next"), ["build", ...args], "prerendered as static content"], ["cat", [".next/server/app/index.html"], NEXT]];
project("nextjs", ["motherload"], [...next([]), ...next(["--webpack"])], {
  prepare(dir) {
    const config = readFileSync(join(dir, "next.config.ts"), "utf8");
    if (!config.includes('join(import.meta.dirname, "../..")')) throw new Error("lab/nextjs/next.config.ts no longer sets Turbopack's root to the repository");
    writeFileSync(join(dir, "next.config.ts"), config.replace('join(import.meta.dirname, "../..")', 'join(import.meta.dirname, "..")'));
  },
});
rmSync(work, { recursive: true, force: true });
