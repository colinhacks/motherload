import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loader as toml } from "../packages/toml/src/loader.ts";
import { loader as yaml } from "../packages/yaml/src/loader.ts";
import { loader as env } from "../packages/env/src/loader.ts";
import { loader as csv } from "../packages/csv/src/loader.ts";
import { loader as txt } from "../packages/txt/src/loader.ts";
import { loader as md } from "../packages/md/src/loader.ts";
import type { LoaderPlugin } from "../packages/core/src/universal.ts";
import { evaluate } from "./helpers.ts";

const LOADERS: Record<string, LoaderPlugin> = { toml, yaml, env, csv, tsv: csv, txt, md };

/** A data file's module, both texts, from its format's package. Every data format types synchronously. */
function dataModule(format: string, source: string, path: string) {
  const loader = LOADERS[format]!;
  const { code } = loader.load(source, path);
  const { types, problems } = loader.types(source, path) as { types: string; problems: { message: string; start: number; length: number; code: number }[] };
  return { code, types, problems };
}

test("a data module exports the data, typed as `as const` would type it", async () => {
  const source = 'name = "demo"\nport = 8080\n';
  const { code, types, problems } = dataModule("toml", source, "/app/config.toml");
  assert.deepEqual(problems, []);
  const mod = await evaluate(code);
  assert.deepEqual(Object.keys(mod), ["default"]);
  assert.deepEqual(mod.default, { name: "demo", port: 8080 });
  assert.equal(types, 'declare const data: { readonly name: "demo"; readonly port: 8080 };\nexport default data;\n');
});

test("a .env module loads the file into process.env when it runs, and its types hold no value", async () => {
  const dir = mkdtempSync(join(tmpdir(), "motherload-env-"));
  const path = join(dir, ".env");
  writeFileSync(path, "MOTHERLOAD_TEST_TOKEN=secret\nMOTHERLOAD_TEST_SET=from-file\n");
  process.env.MOTHERLOAD_TEST_SET = "from-environment";
  const { code, types, problems } = dataModule("env", "MOTHERLOAD_TEST_TOKEN=secret\nMOTHERLOAD_TEST_SET=from-file\n", path);
  assert.deepEqual(problems, []);
  assert.doesNotMatch(code, /secret|from-file/);
  assert.doesNotMatch(types, /secret|from-file/);
  assert.match(types, /^declare global \{\n {2}namespace NodeJS \{\n {4}interface ProcessEnv \{\n/);
  assert.match(types, /^ {6}MOTHERLOAD_TEST_TOKEN: string;$/m);
  assert.match(types, /^ {6}MOTHERLOAD_TEST_SET: string;$/m);
  // Evaluated from a data: URL, the module is not the file, so it reads the path from the working directory.
  const mod = await evaluate(code);
  assert.deepEqual(Object.keys(mod), []);
  assert.equal(process.env.MOTHERLOAD_TEST_TOKEN, "secret");
  assert.equal(process.env.MOTHERLOAD_TEST_SET, "from-environment");
});

test("a .env module whose file is gone loads nothing", async () => {
  const { code } = dataModule("env", "A=1\n", join(tmpdir(), "motherload-missing", ".env"));
  await evaluate(code);
});

test("a file that does not parse has quiet types and its problems", () => {
  const { types, problems } = dataModule("yaml", "a: [1\n", "/app/a.yaml");
  assert.ok(problems.length > 0);
  assert.match(types, /declare const data: any;/);
});

test("a .csv module is the array of its rows, typed by the header's columns with string values", async () => {
  const { code, types, problems } = dataModule("csv", 'name,zip,"e-mail"\nAda,02134,ada@example.com\nBob,10001,bob@example.com\n', "/app/users.csv");
  assert.deepEqual(problems, []);
  const mod = await evaluate(code);
  assert.deepEqual(mod.default, [
    { name: "Ada", zip: "02134", "e-mail": "ada@example.com" },
    { name: "Bob", zip: "10001", "e-mail": "bob@example.com" },
  ]);
  assert.equal(types, 'declare const data: readonly { readonly name: string; readonly zip: string; readonly "e-mail": string }[];\nexport default data;\n');
});

test("a .csv module of a header only, and of an empty file", async () => {
  const header = dataModule("csv", "a,b\n", "/app/a.csv");
  assert.deepEqual((await evaluate(header.code)).default, []);
  assert.equal(header.types, "declare const data: readonly { readonly a: string; readonly b: string }[];\nexport default data;\n");
  const empty = dataModule("csv", "", "/app/b.csv");
  assert.deepEqual((await evaluate(empty.code)).default, []);
  assert.equal(empty.types, "declare const data: readonly never[];\nexport default data;\n");
});

test("a .tsv module is read as tab-separated rows", async () => {
  const { code, types } = dataModule("tsv", "player\tscore\nAda\t42\n", "/app/scores.tsv");
  assert.deepEqual((await evaluate(code)).default, [{ player: "Ada", score: "42" }]);
  assert.equal(types, "declare const data: readonly { readonly player: string; readonly score: string }[];\nexport default data;\n");
});

test("a .txt module is the file's text", async () => {
  const source = 'Line one\n"quoted"   line\n';
  const { code, types, problems } = dataModule("txt", source, "/app/notes.txt");
  assert.deepEqual(problems, []);
  assert.equal((await evaluate(code)).default, source);
  assert.equal(types, "declare const data: string;\nexport default data;\n");
});

test("a .md module is { md, frontmatter }, each also a named export, the frontmatter typed as `as const` would type it", async () => {
  const { code, types, problems } = dataModule("md", "---\ntitle: Hello\ntags: [a, b]\n---\n# Hello\n", "/app/post.md");
  assert.deepEqual(problems, []);
  const mod = await evaluate(code);
  assert.deepEqual(Object.keys(mod).sort(), ["default", "frontmatter", "md"]);
  assert.deepEqual(mod.default, { md: "# Hello\n", frontmatter: { title: "Hello", tags: ["a", "b"] } });
  assert.equal(mod.md, mod.default.md);
  assert.equal(mod.frontmatter, mod.default.frontmatter);
  const frontmatter = '{ readonly title: "Hello"; readonly tags: readonly ["a", "b"] }';
  assert.equal(types, `export declare const md: string;\nexport declare const frontmatter: ${frontmatter};\ndeclare const data: { readonly md: string; readonly frontmatter: ${frontmatter} };\nexport default data;\n`);
  const plain = dataModule("md", "# Hello\n", "/app/plain.md");
  assert.deepEqual((await evaluate(plain.code)).default, { md: "# Hello\n", frontmatter: {} });
  assert.match(plain.types, /^export declare const frontmatter: \{\};$/m);
});

test("a .csv or .md file that does not parse has quiet types and its problems", () => {
  const csv = dataModule("csv", "a,b\n1\n", "/app/a.csv");
  assert.equal(csv.problems.length, 1);
  assert.match(csv.types, /declare const data: any;/);
  const md = dataModule("md", "---\na: [\n---\n", "/app/a.md");
  assert.ok(md.problems.length > 0);
  assert.match(md.types, /^export declare const frontmatter: any;$/m);
  assert.match(md.types, /^declare const data: \{ readonly md: string; readonly frontmatter: any \};\nexport default data;$/m);
});
