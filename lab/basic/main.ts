// Every import below is typed by motherload's content mapper (`tsc --runExternalCode`) and loaded
// by its preload (`node --import motherload/register main.ts`) or its esbuild plugin.
import config, { literal as configLiteral, raw as configRaw } from "./config.toml";
import app from "./app.yaml";
import multi from "./multi.yaml";
import settings from "./settings.jsonc";
import data from "./data.json5";
import env from "./.env";
import user, { type Type as User } from "./user.schema.json";
import plain from "./plain.json" with { type: "json" };

// Exact equality of two types, not mere assignability.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const expect = <T extends true>() => {};

// The default export is widened, as resolveJsonModule widens a .json import (compare `plain`).
expect<Equal<typeof plain, { port: number }>>();
expect<Equal<typeof config, { name: string; port: number; ratio: number; debug: boolean; tags: string[]; mixed: (number | string)[]; big: bigint; started: Date; day: string; server: { host: string } }>>();
// `literal` is the same object typed as `as const` would type it.
expect<Equal<typeof configLiteral.port, 8080>>();
expect<Equal<typeof configLiteral.tags, readonly ["a", "b"]>>();
expect<Equal<typeof configLiteral.big, 9007199254740993n>>();
// `raw` is the file's text.
expect<Equal<typeof configRaw, string>>();

expect<Equal<typeof app.production, { retries: number; timeout: number; host: string }>>();
expect<Equal<typeof app.yes_is_a_string, string>>();
// A file of several YAML documents is the list of them.
expect<Equal<typeof multi, ({ kind: string } | { kind: string; replicas: number })[]>>();
expect<Equal<typeof settings, { "editor.fontSize": number; "files.exclude": string[] }>>();
expect<Equal<typeof data, { unquoted: string; hex: number; infinite: number; list: number[] }>>();
expect<Equal<typeof env, { DATABASE_URL: string; PORT: string; GREETING: string }>>();

expect<Equal<User, { name: string; email?: string; role: "admin" | "member"; tags?: string[] }>>();
expect<Equal<ReturnType<typeof user.parse>, User>>();

// @ts-expect-error port is a number
const wrong: string = config.port;
// @ts-expect-error the file has no such key
config.missing;

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
    production: app.production,
    multi: multi.length,
    settings: settings["editor.fontSize"],
    infinite: data.infinite,
    port_env: env.PORT,
    valid: valid.name,
    invalid,
    standardIssues: "issues" in standard ? standard.issues?.length : 0,
  }),
);
