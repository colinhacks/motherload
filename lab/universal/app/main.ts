import config, { loadedBy } from "./config.toml";

// Exact-type checks: assignable both ways means the inferred type equals the expected one.
type Expected = { name: string; port: number; debug: boolean; tags: string[]; server: { host: string } };
const a: Expected = config;
const b: typeof config = null! as Expected;
const c: "universal-toml" = loadedBy;
// @ts-expect-error port is a number, not a string
const d: string = config.port;

console.log(JSON.stringify({ loadedBy, port: config.port, host: config.server.host }));
