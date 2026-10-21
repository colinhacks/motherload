// Checks the packages scripts/build.ts wrote to dist/ as a project installs them: each packed into
// a tarball, installed from the tarballs into a project outside the repository (so nothing
// resolves to the repository's own links), then type-checked through the installed mappers, run
// under the installed preloads and bundled with the installed esbuild plugins. Two projects: a copy
// of lab/basic on `motherload`, and a copy of lab/packages on three format packages alone. Needs the
// npm registry for TypeScript, esbuild and the parsers. Run `nub run build` first.
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const dist = join(root, "dist");
const work = mkdtempSync(join(tmpdir(), "motherload-check-dist-"));
const tarballs = join(work, "tarballs");
const run = (command: string, args: string[], cwd: string) => execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const dirs = readdirSync(dist).filter((d) => !d.startsWith("."));
for (const dir of dirs) run("nub", ["pack", "--pack-destination", tarballs], join(dist, dir));
const tarball = (dir: string) => `file:${join(tarballs, dir === "motherload" ? "motherload-0.0.0.tgz" : `motherload-${dir}-0.0.0.tgz`)}`;
// Every Motherload package a dependency names comes from its tarball, not the registry.
const overrides = Object.fromEntries(dirs.filter((d) => d !== "motherload").map((d) => [`@motherload/${d}`, tarball(d)]));

function project(lab: string, dependencies: string[], commands: [string, string[], string][]) {
  const dir = join(work, lab);
  cpSync(join(root, "lab", lab), dir, { recursive: true });
  rmSync(join(dir, "dist"), { recursive: true, force: true });
  const pkg = {
    name: `check-dist-${lab}`,
    private: true,
    type: "module",
    dependencies: Object.fromEntries(dependencies.map((name) => [name, tarball(name === "motherload" ? name : name.slice("@motherload/".length))])),
    devDependencies: { typescript: "7.1.0-dev.20261002.1", "@types/node": "^26.6.1", esbuild: "^0.28.2" },
    overrides,
  };
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  run("nub", ["install"], dir);
  const checked = run(join(dir, "node_modules/.bin/tsc"), ["-p", "tsconfig.json", "--noEmit", "--runExternalCode"], dir);
  if (checked !== "") throw new Error(`${lab}: the type check printed\n${checked}`);
  for (const [command, args, expected] of commands) {
    const out = run(command, args, dir);
    if (!out.includes(expected)) throw new Error(`${lab}: ${command} ${args.join(" ")} printed\n${out}`);
  }
  console.log(`${lab}: type-checked, ran under the preload and bundled, from ${dependencies.join(", ")}`);
}

// What each lab prints, as tests/lab.test.ts checks it in the repository.
const BASIC = '"port":8080,"big":"9007199254740993","started":"1979-05-27T07:32:00.000Z","day":"1979-05-27","raw":"# A TOML file with each kind of value.","tags":2';
const TEAM = '"team":[true,false,false]';
const EVENTS = '"events":[true,true,false,false,false],"described":"3,4","clickX":5';
const PACKAGES = '{"name":"packages","raw":"# A TOML file read by @motherload/toml alone.","fontSize":14,"ada":{"name":"Ada","role":"admin"},"valid":true,"invalid":false}';
project("basic", ["motherload"], [
  [process.execPath, ["--import", "motherload/register", "main.ts"], BASIC],
  [process.execPath, ["--import", "motherload/register", "main.ts"], TEAM],
  [process.execPath, ["--import", "motherload/register", "main.ts"], EVENTS],
  [process.execPath, ["build-esbuild.ts"], "errors=0 inputs=17 node_modules=0"],
  [process.execPath, ["dist/main.mjs"], BASIC],
  [process.execPath, ["dist/main.mjs"], TEAM],
  [process.execPath, ["dist/main.mjs"], EVENTS],
]);
project("packages", ["@motherload/toml", "@motherload/jsonc", "@motherload/schema"], [
  [process.execPath, ["--import", "@motherload/schema/register", "--import", "@motherload/jsonc/register", "--import", "@motherload/toml/register", "main.ts"], PACKAGES],
  [process.execPath, ["build-esbuild.ts"], "errors=0 inputs=5 node_modules=0"],
  [process.execPath, ["dist/main.mjs"], PACKAGES],
]);
rmSync(work, { recursive: true, force: true });
