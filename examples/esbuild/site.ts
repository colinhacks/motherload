import config from "./config.toml";
import users from "./users.csv";
import post from "./post.md";

/** What every Motherload example shows: a value from each data file. */
export function site() {
  return {
    title: config.title,
    port: config.server.port,
    users: users.map((user) => user.name),
    post: post.frontmatter.title,
  };
}
