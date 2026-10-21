// lab/basic's data files, bundled through motherload/webpack by webpack
// (webpack.config.mjs) and Rspack (rspack.config.mjs). JavaScript, so that neither needs a loader
// for TypeScript; lab/basic's main.ts checks the types. It prints what lab/basic prints.
import config from "../basic/config.toml";
import app from "../basic/app.yaml";
import multi from "../basic/multi.yaml";
import settings from "../basic/settings.jsonc";
import data from "../basic/data.json5";
import "../basic/.env";
import users from "../basic/users.csv";
import scores from "../basic/scores.tsv";
import notes from "../basic/notes.txt";
import post, { frontmatter } from "../basic/post.md";

console.log(
  JSON.stringify({
    port: config.port,
    big: String(config.big),
    started: config.started.toISOString(),
    day: config.day,
    tags: config.tags.length,
    production: app.production,
    multi: multi.length,
    settings: settings["editor.fontSize"],
    infinite: data.infinite,
    greeting: process.env.GREETING,
    zip: users[0]?.zip,
    grace: users[1]?.name,
    score: scores[1]?.score,
    notes: notes.split("\n")[0],
    title: frontmatter.title,
    body: post.md.split("\n")[0],
  }),
);
