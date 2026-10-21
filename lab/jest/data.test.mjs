// ESM: Jest's own linker (--experimental-vm-modules) loads each data file through motherload/jest,
// and Vitest through motherload/vite.
import config from "../basic/config.toml";
import app from "../basic/app.yaml";
import settings from "../basic/settings.jsonc";
import data from "../basic/data.json5";
import scores from "../basic/scores.tsv";
import post, { frontmatter } from "../basic/post.md";
import "../basic/.env";

test("lab/basic's data files, imported by an ES module test", () => {
  expect(config.port).toBe(8080);
  expect(config.day).toBe("1979-05-27");
  expect(app.yes_is_a_string).toBe("yes");
  expect(settings["editor.fontSize"]).toBe(14);
  expect(data.hex).toBe(16);
  expect(scores[1].score).toBe("37");
  expect(post.frontmatter).toBe(frontmatter);
  expect(process.env.GREETING).toBe("hello world");
});
