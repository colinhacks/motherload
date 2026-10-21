// lab/basic's data files, imported by a server component and, in Team, by a client component, so
// that the loader makes modules for both bundles. The types are motherload's content mapper's.
import config from "../../basic/config.toml";
import app from "../../basic/app.yaml";
import multi from "../../basic/multi.yaml";
import settings from "../../basic/settings.jsonc";
import data from "../../basic/data.json5";
import users from "../../basic/users.csv";
import scores from "../../basic/scores.tsv";
import notes from "../../basic/notes.txt";
import post, { frontmatter } from "../../basic/post.md";
import { Team } from "./team";

const port: 8080 = config.port;
// @ts-expect-error the file has no such key
config.missing;

export default function Page() {
  const server = {
    port,
    big: String(config.big),
    started: config.started.toISOString(),
    day: config.day,
    tags: config.tags.length,
    production: app.production,
    multi: multi.length,
    settings: settings["editor.fontSize"],
    infinite: data.infinite,
    zip: users[0]?.zip,
    grace: users[1]?.name,
    score: scores[1]?.score,
    notes: notes.split("\n")[0],
    title: frontmatter.title,
    body: post.md.split("\n")[0],
  };
  return (
    <main>
      <pre id="server">{JSON.stringify(server)}</pre>
      <Team />
    </main>
  );
}
