import { test } from "node:test";
import assert from "node:assert/strict";
import { formatOf, parseCsvFile, parseEnvFile, parseJson5File, parseJsoncFile, parseJsonFile, parseMarkdownFile, parseTomlFile, parseTsvFile, parseYamlFile } from "../src/formats.ts";

const value = (parsed: ReturnType<typeof parseTomlFile>) => {
  if (!parsed.ok) assert.fail(JSON.stringify(parsed.problems));
  return parsed.value as any;
};

test("formats are chosen by the longest suffix", () => {
  assert.equal(formatOf("/a/user.schema.json"), "schema");
  assert.equal(formatOf("/a/b.toml"), "toml");
  assert.equal(formatOf("/a/b.yml"), "yaml");
  assert.equal(formatOf("/a/b.json5"), "json5");
  assert.equal(formatOf("/a/b.jsonc"), "jsonc");
  assert.equal(formatOf("/a/.env"), "env");
  assert.equal(formatOf("/a/.env.local"), "env");
  assert.equal(formatOf("/a/prod.env"), "env");
  assert.equal(formatOf("/a/users.csv"), "csv");
  assert.equal(formatOf("/a/scores.tsv"), "tsv");
  assert.equal(formatOf("/a/notes.txt"), "txt");
  assert.equal(formatOf("/a/post.md"), "md");
  assert.equal(formatOf("/a/page.mdx"), undefined);
  assert.equal(formatOf("/a/b.json"), undefined);
  assert.equal(formatOf("/a/b.ini"), undefined);
});

test("TOML: offset date-times are Dates, local ones their ISO text, large integers bigints", () => {
  const v = value(parseTomlFile("a = 1979-05-27T07:32:00-08:00\nb = 1979-05-27T07:32:00\nc = 1979-05-27\nd = 07:32:00\nbig = 9007199254740993\nsmall = 1\nf = nan"));
  assert.ok(v.a instanceof Date);
  assert.equal(v.a.toISOString(), "1979-05-27T15:32:00.000Z");
  assert.equal(v.b, "1979-05-27T07:32:00.000");
  assert.equal(v.c, "1979-05-27");
  assert.equal(v.d, "07:32:00.000");
  assert.equal(v.big, 9007199254740993n);
  assert.equal(v.small, 1);
  assert.ok(Number.isNaN(v.f));
});

test("TOML: an error is placed at its line and column", () => {
  const source = "a = 1\nb = nope\n";
  const parsed = parseTomlFile(source);
  assert.ok(!parsed.ok);
  assert.equal(parsed.problems[0]!.start, source.indexOf("nope"));
});

test("YAML: merge keys, YAML 1.2 scalars, several documents, an empty file", () => {
  assert.deepEqual(value(parseYamlFile("base: &b {x: 1}\nm:\n  <<: *b\n  y: 2\nflag: yes\n")), { base: { x: 1 }, m: { x: 1, y: 2 }, flag: "yes" });
  assert.deepEqual(value(parseYamlFile("a: 1\n---\nb: 2\n")), [{ a: 1 }, { b: 2 }]);
  assert.equal(value(parseYamlFile("")), null);
});

test("YAML: a duplicate key is an error at the key", () => {
  const source = "a: 1\na: 2\n";
  const parsed = parseYamlFile(source);
  assert.ok(!parsed.ok);
  assert.equal(parsed.problems[0]!.start, 5);
});

test("JSON5: its extensions, and an error at its place", () => {
  assert.deepEqual(value(parseJson5File("{a: 'x', b: 0x10, c: [1,],}")), { a: "x", b: 16, c: [1] });
  const parsed = parseJson5File("{a: 1,\n b: ?}");
  assert.ok(!parsed.ok);
  assert.equal(parsed.problems[0]!.start, 11);
});

test("JSONC: comments and trailing commas; a __proto__ key is kept as a property", () => {
  const v = value(parseJsoncFile('{\n // c\n "__proto__": 1, "a": [1,],\n}'));
  assert.deepEqual(Object.keys(v), ["__proto__", "a"]);
  assert.equal(Object.getPrototypeOf(v), Object.prototype);
  const parsed = parseJsoncFile('{"a": 1 "b": 2}');
  assert.ok(!parsed.ok);
  assert.equal(parsed.problems[0]!.message, "Comma Expected");
  assert.equal(parsed.problems[0]!.start, 8);
});

test("JSON (schemas): comments and trailing commas are errors", () => {
  assert.ok(!parseJsonFile('{"a": 1,}').ok);
  assert.ok(!parseJsonFile('{"a": 1 /* c */}').ok);
});

test(".env: strings, quotes, export, no expansion", () => {
  assert.deepEqual(value(parseEnvFile('A=1\nB="two words"\nexport C=3\nD=${A}\n# comment\n')), { A: "1", B: "two words", C: "3", D: "${A}" });
});

const table = (parsed: ReturnType<typeof parseCsvFile>) => {
  if (!parsed.ok) assert.fail(JSON.stringify(parsed.problems));
  return parsed;
};

test("CSV: RFC 4180 quoting, CRLF and LF in one file, every value a string, blank lines skipped", () => {
  const source = 'name,zip,note\r\n"Doe, Jane",02134,"said ""hi"""\n\nBob,10001,"two\nlines"\n\n';
  const { columns, rows } = table(parseCsvFile(source));
  assert.deepEqual(columns, ["name", "zip", "note"]);
  assert.deepEqual(rows, [
    { name: "Doe, Jane", zip: "02134", note: 'said "hi"' },
    { name: "Bob", zip: "10001", note: "two\nlines" },
  ]);
});

test("CSV: a header only, an empty file, a byte order mark, a __proto__ column", () => {
  assert.deepEqual(table(parseCsvFile("a,b\n")), { ok: true, columns: ["a", "b"], rows: [] });
  assert.deepEqual(table(parseCsvFile("")), { ok: true, columns: [], rows: [] });
  assert.deepEqual(table(parseCsvFile("﻿a\n1\n")).rows, [{ a: "1" }]);
  const [row] = table(parseCsvFile("__proto__,b\n1,2\n")).rows;
  assert.deepEqual(Object.keys(row!), ["__proto__", "b"]);
  assert.equal(Object.getPrototypeOf(row), Object.prototype);
});

test("CSV: a row with another field count than the header is a problem at that row", () => {
  const source = "a,b\nÉ,1,2\n3,4\n5\n";
  const parsed = parseCsvFile(source);
  assert.ok(!parsed.ok);
  assert.deepEqual(
    parsed.problems.map((p) => [p.message, p.start, p.length]),
    [
      ["This row has 3 fields; the header has 2.", source.indexOf("É"), 5],
      ["This row has 1 field; the header has 2.", source.indexOf("5"), 1],
    ],
  );
});

test("CSV: an empty or repeated column name is a problem at the header", () => {
  const parsed = parseCsvFile("a,a,\n1,2,3\n");
  assert.ok(!parsed.ok);
  assert.deepEqual(
    parsed.problems.map((p) => [p.message, p.start, p.length]),
    [
      ['The header names the column "a" twice.', 0, 4],
      ["Column 3 of the header has no name.", 0, 4],
    ],
  );
});

test("CSV: a quoting error is a problem at the row that has it", () => {
  const unclosed = 'a,b\nÉ,1\n"x,y\n3,4\n';
  const parsed = parseCsvFile(unclosed);
  assert.ok(!parsed.ok);
  assert.equal(parsed.problems[0]!.message, "Quote Not Closed: the parsing is finished with an opening quote");
  assert.equal(parsed.problems[0]!.start, unclosed.indexOf('"x'));
  const stray = 'a,b\n1,2\n3,x"y\n';
  const straying = parseCsvFile(stray);
  assert.ok(!straying.ok);
  assert.match(straying.problems[0]!.message, /^Invalid Opening Quote/);
  assert.equal(straying.problems[0]!.start, stray.indexOf("3,x"));
});

test("TSV: tab-separated, no quoting, so a quote is an ordinary character", () => {
  const { columns, rows } = table(parseTsvFile('name\tquote\r\nAda\t"hi" she said\n\n'));
  assert.deepEqual(columns, ["name", "quote"]);
  assert.deepEqual(rows, [{ name: "Ada", quote: '"hi" she said' }]);
  const parsed = parseTsvFile("a\tb\n1,2\n");
  assert.ok(!parsed.ok);
  assert.equal(parsed.problems[0]!.start, 4);
});

test("Markdown: the frontmatter is YAML as a .yaml file reads it, and the body follows its closing line", () => {
  const parsed = parseMarkdownFile("---\ntitle: Hello\ndraft: yes\nbase: &b {x: 1}\nm:\n  <<: *b\n---\n# Hello\n");
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.frontmatter, { title: "Hello", draft: "yes", base: { x: 1 }, m: { x: 1 } });
  assert.equal(parsed.body, "# Hello\n");
  assert.deepEqual(parseMarkdownFile("---\r\na: 1\r\n---\r\nbody\r\n"), { ok: true, frontmatter: { a: 1 }, body: "body\r\n" });
});

test("Markdown: no frontmatter, or an empty one, is {}; a --- line elsewhere is body", () => {
  assert.deepEqual(parseMarkdownFile("# Title\n---\nmore\n"), { ok: true, frontmatter: {}, body: "# Title\n---\nmore\n" });
  assert.deepEqual(parseMarkdownFile("\n---\na: 1\n---\n"), { ok: true, frontmatter: {}, body: "\n---\na: 1\n---\n" });
  assert.deepEqual(parseMarkdownFile("---\n---\nbody"), { ok: true, frontmatter: {}, body: "body" });
});

test("Markdown: a frontmatter error is placed in the file, and an unclosed or non-mapping frontmatter is a problem", () => {
  const source = "---\ntitle: x\ntitle: y\n---\nbody\n";
  const parsed = parseMarkdownFile(source);
  assert.ok(!parsed.ok);
  assert.equal(parsed.problems[0]!.message, "Map keys must be unique");
  assert.equal(parsed.problems[0]!.start, source.indexOf("title: y"));
  const unclosed = parseMarkdownFile("---\ntitle: x\n");
  assert.ok(!unclosed.ok);
  assert.deepEqual([unclosed.problems[0]!.start, unclosed.problems[0]!.length], [0, 3]);
  const list = parseMarkdownFile("---\n- a\n---\n");
  assert.ok(!list.ok);
  assert.equal(list.problems[0]!.message, "The frontmatter must be a YAML mapping of keys to values.");
  assert.equal(list.problems[0]!.start, 4);
});
