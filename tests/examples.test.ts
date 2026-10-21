// The example projects (examples/README.md): each one's commands that finish by themselves, as its
// README lists them, with what they print. An example's test is skipped until `nub install` has run
// in it, and the Bun example's where Bun is not installed. Its servers (dev servers, `next start`,
// `vite preview`) are checked by hand and recorded in its README.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { stripVTControlCharacters } from "node:util";
import { ROOT } from "./helpers.ts";

/** What every example shows. */
const SITE = '{"title":"Motherload example","port":8080,"users":["Ada Lovelace","Hopper, Grace"],"post":"Hello, Motherload"}';

/** A command of an example, and a part of its output that shows it worked ("" for a type check, which prints nothing). */
type Step = [command: string, args: string[], expect: string];

const EXAMPLES: Record<string, Step[]> = {
  node: [
    ["nub", ["run", "typecheck"], ""],
    ["nub", ["run", "start"], SITE],
    ["nub", ["run", "test"], "ℹ pass 1"],
  ],
  nub: [
    ["nub", ["run", "typecheck"], ""],
    ["nub", ["run", "start"], SITE],
    ["nub", ["run", "test"], "ℹ pass 1"],
  ],
  bun: [
    ["nub", ["run", "typecheck"], ""],
    ["nub", ["run", "start"], SITE],
    ["nub", ["run", "test"], " 1 pass"],
    ["nub", ["run", "build"], "dist/main.js"],
    ["nub", ["run", "start:dist"], SITE],
  ],
  esbuild: [
    ["nub", ["run", "typecheck"], ""],
    ["nub", ["run", "dev"], SITE],
    ["nub", ["run", "test"], "ℹ pass 1"],
    ["nub", ["run", "build"], "built dist/main.mjs"],
    // The bundle holds the data and no parser: it runs alone, with no node_modules above it.
    ["sh", ["-c", 'd=$(mktemp -d) && cp dist/main.mjs "$d" && cd "$d" && nub --node main.mjs'], SITE],
  ],
  vite: [
    ["nub", ["run", "typecheck"], ""],
    ["nub", ["run", "build"], "built in"],
    ["grep", ["-rl", "Hello, Motherload", "dist/assets"], "dist/assets/index-"],
    ["nub", ["run", "test"], "1 passed (1)"],
  ],
  webpack: [
    ["nub", ["run", "typecheck"], ""],
    ["nub", ["run", "build"], "compiled successfully"],
    ["nub", ["--node", "dist/main.mjs"], SITE],
  ],
  rspack: [
    ["nub", ["run", "typecheck"], ""],
    ["nub", ["run", "build"], "Rspack compiled successfully"],
    ["nub", ["--node", "dist/main.mjs"], SITE],
  ],
  jest: [
    ["nub", ["run", "typecheck"], ""],
    ["nub", ["run", "test"], "1 passed, 1 total"],
    ["nub", ["run", "test:cjs"], "1 passed, 1 total"],
  ],
  // The server component's values and the client component's are in the prerendered page, and the
  // client component's in a browser chunk, under Turbopack and then under webpack.
  nextjs: [
    ["nub", ["run", "typecheck"], "Types generated successfully"],
    ["nub", ["run", "build"], "prerendered as static content"],
    ["grep", ["-o", '<pre id="client">[^<]*Hopper, Grace', ".next/server/app/index.html"], '<pre id="client">'],
    ["grep", ["-o", '<pre id="server">[^<]*Hopper, Grace', ".next/server/app/index.html"], '<pre id="server">'],
    ["grep", ["-rl", "Hopper, Grace", ".next/static/chunks"], ".next/static/chunks/"],
    ["nub", ["run", "build:webpack"], "prerendered as static content"],
    ["grep", ["-o", '<pre id="client">[^<]*Hopper, Grace', ".next/server/app/index.html"], '<pre id="client">'],
    ["grep", ["-rl", "Hopper, Grace", ".next/static/chunks"], ".next/static/chunks/"],
  ],
  "cloudflare-workers": [
    ["nub", ["run", "typecheck"], ""],
    ["nub", ["run", "test"], "2 passed (2)"],
    ["nub", ["run", "build"], "dist/motherload_example/index.js"],
    ["grep", ["-o", '"Hopper, Grace"', "dist/motherload_example/index.js"], '"Hopper, Grace"'],
    ["nubx", ["wrangler", "deploy", "--dry-run"], "--dry-run: exiting now."],
  ],
};

/**
 * Runs a command in an example. nub reads no nub.jsonc under NODE_COMPAT, Node's test runner skips
 * its files under the NODE_TEST_CONTEXT this test runs in, and Jest prints only its summary when it
 * sees an agent's variables, so the example runs without them; Vitest and Jest colour their
 * summaries under FORCE_COLOR, so the output is matched without colour codes.
 */
function run(dir: string, [command, args]: Step): { status: number | null; out: string } {
  const env: Record<string, string | undefined> = { ...process.env, NODE_OPTIONS: "", NEXT_TELEMETRY_DISABLED: "1", WRANGLER_SEND_METRICS: "false" };
  for (const name of ["NODE_COMPAT", "NODE_TEST_CONTEXT", "CLAUDECODE", "AI_AGENT"]) delete env[name];
  const result = spawnSync(command, args, { cwd: dir, encoding: "utf8", env });
  return { status: result.status, out: stripVTControlCharacters(`${result.stdout}${result.stderr}`) };
}

const hasBun = spawnSync("bun", ["--version"]).status === 0;

for (const [name, steps] of Object.entries(EXAMPLES)) {
  const dir = `${ROOT}examples/${name}`;
  const skip = !existsSync(`${dir}/node_modules`) ? `examples/${name} is not installed: run \`nub install\` in it` : name === "bun" && !hasBun ? "Bun is not installed" : false;
  test(`examples/${name}: every command its README lists`, { skip }, () => {
    for (const step of steps) {
      const { status, out } = run(dir, step);
      assert.equal(status, 0, `${step[0]} ${step[1].join(" ")}\n${out}`);
      if (step[2]) assert.ok(out.includes(step[2]), `${step[0]} ${step[1].join(" ")} printed\n${out}`);
      else assert.equal(out.replace(/^\$ .*\n/gm, "").trim(), "", `${step[0]} ${step[1].join(" ")} printed\n${out}`);
    }
  });
}

test("control: without the preload, plain Node cannot import the examples' data files", { skip: !existsSync(`${ROOT}examples/node/node_modules`) && "examples/node is not installed" }, () => {
  const { status, out } = run(`${ROOT}examples/node`, ["nub", ["--node", "main.ts"], ""]);
  assert.notEqual(status, 0);
  assert.match(out, /ERR_UNKNOWN_FILE_EXTENSION/);
});

test("every example imports the same data files and site.ts as examples/node", () => {
  for (const name of Object.keys(EXAMPLES).filter((n) => n !== "node")) {
    for (const file of ["config.toml", "users.csv", "post.md", "site.ts", ".vscode/settings.json", ".zed/settings.json"]) {
      assert.equal(readFileSync(`${ROOT}examples/${name}/${file}`, "utf8"), readFileSync(`${ROOT}examples/node/${file}`, "utf8"), `examples/${name}/${file}`);
    }
  }
});
