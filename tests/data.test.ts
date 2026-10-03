import { test } from "node:test";
import assert from "node:assert/strict";
import { dataModule } from "../src/data.ts";
import { evaluate } from "./helpers.ts";

test("a data module exports the data, the same object as literal, and the text", async () => {
  const source = 'name = "demo"\nport = 8080\n';
  const { code, types, problems } = dataModule("toml", source);
  assert.deepEqual(problems, []);
  const mod = await evaluate(code);
  assert.deepEqual(mod.default, { name: "demo", port: 8080 });
  assert.equal(mod.literal, mod.default);
  assert.equal(mod.raw, source);
  assert.equal(types, ["declare const data: { name: string; port: number };", "export default data;", 'export declare const literal: { readonly name: "demo"; readonly port: 8080 };', "export declare const raw: string;", ""].join("\n"));
});

test("a .env module has no literal, so no value reaches the type text", async () => {
  const { code, types } = dataModule("env", "TOKEN=secret\n");
  assert.doesNotMatch(types, /secret/);
  assert.doesNotMatch(types, /literal/);
  const mod = await evaluate(code);
  assert.deepEqual(Object.keys(mod).sort(), ["default", "raw"]);
});

test("a file that does not parse has quiet types and its problems", () => {
  const { types, problems } = dataModule("yaml", "a: [1\n");
  assert.ok(problems.length > 0);
  assert.match(types, /declare const data: any;/);
});
