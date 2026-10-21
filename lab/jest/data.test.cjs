// CommonJS: Jest's own require() loads each data file through motherload/jest.
const config = require("../basic/config.toml").default;
const app = require("../basic/app.yaml").default;
const users = require("../basic/users.csv").default;
const notes = require("../basic/notes.txt").default;
const { frontmatter, md } = require("../basic/post.md");
require("../basic/.env");

test("lab/basic's data files, required by a CommonJS test", () => {
  expect(config.port).toBe(8080);
  expect(config.big).toBe(9007199254740993n);
  expect(config.started.toISOString()).toBe("1979-05-27T07:32:00.000Z");
  expect(app.production).toEqual({ retries: 3, timeout: 1.5, host: "example.com" });
  expect(users[1].name).toBe("Hopper, Grace");
  expect(notes.split("\n")[0]).toBe("Notes from the lab.");
  expect(frontmatter.title).toBe("Hello, Motherload");
  expect(md.split("\n")[0]).toBe("# Hello");
  expect(process.env.GREETING).toBe("hello world");
});
