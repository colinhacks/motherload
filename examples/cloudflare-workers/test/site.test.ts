import { exports } from "cloudflare:workers";
import { expect, test } from "vitest";
import config from "../config.toml";
import { site } from "../site";

const expected = {
  title: "Motherload example",
  port: 8080,
  users: ["Ada Lovelace", "Hopper, Grace"],
  post: "Hello, Motherload",
};

test("each data file is a typed module", () => {
  expect(site()).toEqual(expected);
  // @ts-expect-error config.toml has no `missing` key
  expect(config.missing).toBeUndefined();
});

test("the Worker answers with the values", async () => {
  const res = await exports.default.fetch("http://example.com/");
  expect(await res.json()).toEqual(expected);
});
