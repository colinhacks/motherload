import { test } from "node:test";
import assert from "node:assert/strict";
import config from "./config.toml";
import { site } from "./site.ts";

test("each data file is a typed module", () => {
  assert.deepEqual(site(), {
    title: "Motherload example",
    port: 8080,
    users: ["Ada Lovelace", "Hopper, Grace"],
    post: "Hello, Motherload",
  });
  // @ts-expect-error config.toml has no `missing` key
  assert.equal(config.missing, undefined);
});
