import { expect, test } from "bun:test";
import config from "./config.toml";
import { site } from "./site.ts";

test("each data file is a typed module", () => {
  expect(site()).toEqual({
    title: "Motherload example",
    port: 8080,
    users: ["Ada Lovelace", "Hopper, Grace"],
    post: "Hello, Motherload",
  });
  // @ts-expect-error config.toml has no `missing` key
  expect(config.missing).toBeUndefined();
});
