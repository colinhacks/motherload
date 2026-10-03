import { test } from "node:test";
import assert from "node:assert/strict";
import { formatOf, parseEnvFile, parseJson5File, parseJsoncFile, parseJsonFile, parseTomlFile, parseYamlFile } from "../src/formats.ts";

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
