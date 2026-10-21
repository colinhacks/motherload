// Checks the packages scripts/build.ts wrote to dist/ as a project installs them: each packed into
// a tarball, installed from the tarballs into a project outside the repository (so nothing
// resolves to the repository's own links), then type-checked through the installed mappers, run
// under the installed preloads and bundled with the installed esbuild plugins. Three projects: a copy
// of lab/basic on `motherload`, a copy of lab/packages on three format packages alone, and lab/basic
// again in a hoisted layout beside ajv 6. Needs the npm registry for TypeScript, esbuild and the
// parsers. Run `nub run build` first.
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const dist = join(root, "dist");
const work = mkdtempSync(join(tmpdir(), "motherload-check-dist-"));
const tarballs = join(work, "tarballs");
const run = (command: string, args: string[], cwd: string) => execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const dirs = readdirSync(dist).filter((d) => !d.startsWith("."));
for (const dir of dirs) run("nub", ["pack", "--pack-destination", tarballs], join(dist, dir));
const version: string = JSON.parse(readFileSync(join(dist, "motherload", "package.json"), "utf8")).version;
const tarball = (dir: string) => `file:${join(tarballs, dir === "motherload" ? `motherload-${version}.tgz` : `motherload-${dir}-${version}.tgz`)}`;
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
const BASIC = '"port":8080,"big":"9007199254740993","started":"1979-05-27T07:32:00.000Z","day":"1979-05-27","tags":2';
const TEAM = '"team":[true,false,false]';
const EVENTS = '"events":[true,true,false,false,false],"described":"3,4","clickX":5';
const VALIDATE = '"valid":"Ada","invalid":"name: must NOT have fewer than 1 characters; email: must match format \\"email\\"; role: must be equal to one of the allowed values","keywords":["minLength","format","enum"],"standard":[true,["role"]],"memberPath":["members",1,"name"]';
const PACKAGES = '{"name":"packages","fontSize":14,"ada":{"name":"Ada","role":"admin"},"valid":true,"invalid":false}';
project("basic", ["motherload"], [
  [process.execPath, ["--import", "motherload/register", "main.ts"], BASIC],
  [process.execPath, ["--import", "motherload/register", "main.ts"], TEAM],
  [process.execPath, ["--import", "motherload/register", "main.ts"], EVENTS],
  [process.execPath, ["--import", "motherload/register", "main.ts"], VALIDATE],
  [process.execPath, ["build-esbuild.ts"], "errors=0 inputs=15 node_modules=0"],
  [process.execPath, ["dist/main.mjs"], BASIC],
  [process.execPath, ["dist/main.mjs"], TEAM],
  [process.execPath, ["dist/main.mjs"], EVENTS],
  [process.execPath, ["dist/main.mjs"], VALIDATE],
]);
project("packages", ["@motherload/toml", "@motherload/jsonc", "@motherload/schema"], [
  [process.execPath, ["--import", "@motherload/schema/register", "--import", "@motherload/jsonc/register", "--import", "@motherload/toml/register", "main.ts"], PACKAGES],
  [process.execPath, ["build-esbuild.ts"], "errors=0 inputs=4 node_modules=0"],
  [process.execPath, ["dist/main.mjs"], PACKAGES],
]);
// One more project, on its own: lab/basic in a hoisted (npm-style) layout beside ajv 6, as npm lays
// out a project with eslint (which depends on ajv ^6): ajv 6 at the top, ajv 8 under
// @motherload/schema and again under ajv-formats. Until 2026-10-20 ajv-formats wrote the formats'
// code with its own copy, which the compiling copy wrote out as JSON, and every format it checks
// with a function (event.schema.jsonc's date-time and uri) threw when it ran.
{
  const dir = join(work, "basic-hoisted-ajv6");
  cpSync(join(root, "lab", "basic"), dir, { recursive: true });
  rmSync(join(dir, "dist"), { recursive: true, force: true });
  const pkg = { name: "check-dist-basic-hoisted-ajv6", private: true, type: "module", dependencies: { motherload: tarball("motherload"), ajv: "6.12.6" }, devDependencies: { typescript: "7.1.0-dev.20261002.1", "@types/node": "^26.6.1", esbuild: "^0.28.2" }, overrides };
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  run("nub", ["install", "--node-linker", "hoisted"], dir);
  const version = (at: string) => run(process.execPath, ["-p", `require(${JSON.stringify(`./${at}/package.json`)}).version`], dir).trim();
  const versions = ["node_modules/ajv", "node_modules/@motherload/schema/node_modules/ajv", "node_modules/ajv-formats/node_modules/ajv"].map(version);
  if (!versions[0]!.startsWith("6.") || !versions[1]!.startsWith("8.") || !versions[2]!.startsWith("8.")) throw new Error(`basic-hoisted-ajv6: expected ajv 6 at the top and ajv 8 twice below it, found ${versions.join(", ")}`);
  const checked = run(join(dir, "node_modules/.bin/tsc"), ["-p", "tsconfig.json", "--noEmit", "--runExternalCode"], dir);
  if (checked !== "") throw new Error(`basic-hoisted-ajv6: the type check printed\n${checked}`);
  for (const [command, args, expected] of [
    [process.execPath, ["--import", "motherload/register", "main.ts"], EVENTS],
    [process.execPath, ["--import", "motherload/register", "main.ts"], VALIDATE],
    [process.execPath, ["build-esbuild.ts"], "node_modules=0"],
    [process.execPath, ["dist/main.mjs"], EVENTS],
    [process.execPath, ["dist/main.mjs"], VALIDATE],
  ] as [string, string[], string][]) {
    const out = run(command, args, dir);
    if (!out.includes(expected)) throw new Error(`basic-hoisted-ajv6: ${command} ${args.join(" ")} printed\n${out}`);
  }
  console.log(`basic-hoisted-ajv6: type-checked, ran under the preload and bundled, from motherload, hoisted beside ajv ${versions[0]}, with ajv ${versions[1]} and ${versions[2]} below it`);
}
rmSync(work, { recursive: true, force: true });
