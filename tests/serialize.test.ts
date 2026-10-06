import { test } from "node:test";
import assert from "node:assert/strict";
import { literal, toJs, assertValue, UnsupportedValue } from "../src/serialize.ts";
import { evaluate } from "./helpers.ts";

test("toJs round-trips every value a module carries", async () => {
  const value = { s: "a b", n: -0, nan: NaN, inf: -Infinity, big: 2n ** 64n, d: new Date("2020-01-02T03:04:05.000Z"), list: [1, null, true], nested: { "a-b": [] } };
  const { default: back } = await evaluate(`export default ${toJs(value)};`);
  assert.deepEqual(back, value);
  assert.ok(Object.is(back.n, -0));
});

test("a __proto__ key stays a property and does not set the prototype", async () => {
  const value = JSON.parse('{"__proto__": {"polluted": true}, "a": 1}');
  const { default: back } = await evaluate(`export default ${toJs(value)};`);
  assert.deepEqual(Object.keys(back), ["__proto__", "a"]);
  assert.equal(Object.getPrototypeOf(back), Object.prototype);
  assert.equal(({} as any).polluted, undefined);
});

test("literal types follow as const", () => {
  assert.equal(literal({ a: 1, b: "x", c: [1, "y"], d: -2, e: NaN, f: 3n, g: new Date(0) }), '{ readonly a: 1; readonly b: "x"; readonly c: readonly [1, "y"]; readonly d: -2; readonly e: number; readonly f: 3n; readonly g: Date }');
});

test("a value no module can carry is refused with its path", () => {
  assert.throws(() => assertValue({ a: [1, new Map()] }), (e: unknown) => e instanceof UnsupportedValue && e.path.join(".") === "a.1");
  assert.throws(() => assertValue({ a: undefined }), UnsupportedValue);
});
