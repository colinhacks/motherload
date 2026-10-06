// Every import below is typed by motherload's content mapper (`tsc --runExternalCode`) and loaded
// by its preload (`node --import motherload/register main.ts`) or its esbuild plugin.
import config from "./config.toml";
import configRaw from "./config.toml?raw";
import app from "./app.yaml";
import multi from "./multi.yaml";
import settings from "./settings.jsonc";
import data from "./data.json5";
import "./.env";
import user, { type Type as User } from "./user.schema.json";
import plain from "./plain.json" with { type: "json" };
import users from "./users.csv";
import scores from "./scores.tsv";
import notes from "./notes.txt";
import post, { frontmatter } from "./post.md";
import postRaw from "./post.md?raw";

// Exact equality of two types, not mere assignability.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const expect = <T extends true>() => {};

// The default export is the data typed as `as const` would type it; a .json import, which stays
// TypeScript's, is widened by resolveJsonModule.
expect<Equal<typeof plain, { port: number }>>();
expect<Equal<typeof config, { readonly name: "demo"; readonly port: 8080; readonly ratio: 0.5; readonly debug: true; readonly tags: readonly ["a", "b"]; readonly mixed: readonly [1, "two"]; readonly big: 9007199254740993n; readonly started: Date; readonly day: "1979-05-27"; readonly server: { readonly host: "localhost" } }>>();
// `?raw` is the file's text, typed by motherload/client (tsconfig `types`).
expect<Equal<typeof configRaw, string>>();

expect<Equal<typeof app.production, { readonly retries: 3; readonly timeout: 1.5; readonly host: "example.com" }>>();
expect<Equal<typeof app.yes_is_a_string, "yes">>();
// A file of several YAML documents is the list of them.
expect<Equal<typeof multi, readonly [{ readonly kind: "Service" }, { readonly kind: "Deployment"; readonly replicas: 2 }]>>();
expect<Equal<typeof settings, { readonly "editor.fontSize": 14; readonly "files.exclude": readonly ["dist", "node_modules"] }>>();
expect<Equal<typeof data, { readonly unquoted: "single quotes"; readonly hex: 16; readonly infinite: number; readonly list: readonly [1, 2, 3] }>>();
// `import "./.env"` declares the file's variables on process.env.
expect<Equal<typeof process.env.DATABASE_URL, string>>();
expect<Equal<typeof process.env.GREETING, string>>();

// A .csv or .tsv file is its rows, typed by the header's columns, every value a string.
expect<Equal<typeof users, readonly { readonly name: string; readonly email: string; readonly zip: string }[]>>();
expect<Equal<typeof scores, readonly { readonly player: string; readonly score: string }[]>>();
// A .txt file is its text; a .md file is its body, with its frontmatter typed as `as const` would type it.
expect<Equal<typeof notes, string>>();
expect<Equal<typeof post, string>>();
expect<Equal<typeof frontmatter, { readonly title: "Hello, Motherload"; readonly draft: false; readonly tags: readonly ["data", "types"] }>>();
expect<Equal<typeof postRaw, string>>();

expect<Equal<User, { name: string; email?: string; role: "admin" | "member"; tags?: string[] }>>();
expect<Equal<ReturnType<typeof user.parse>, User>>();

// @ts-expect-error port is a number
const wrong: string = config.port;
// @ts-expect-error a readonly tuple is not a mutable array
const tags: string[] = config.tags;
// @ts-expect-error the file has no such key
config.missing;
// @ts-expect-error the CSV header has no such column
users[0]?.phone;

const valid = user.parse({ name: "Ada", role: "admin", email: "ada@example.com" });
let invalid = "";
try {
  user.parse({ name: "", role: "owner", email: "not an email" });
} catch (error) {
  invalid = (error as Error).message;
}
const standard = user["~standard"].validate({ name: "Ada" });

console.log(
  JSON.stringify({
    port: config.port,
    big: String(config.big),
    started: config.started.toISOString(),
    day: config.day,
    raw: configRaw.split("\n")[0],
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
    body: post.split("\n")[0],
    postRaw: postRaw.split("\n")[0],
    valid: valid.name,
    invalid,
    standardIssues: "issues" in standard ? standard.issues?.length : 0,
  }),
);
