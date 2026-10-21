import config from "./config.toml";
import { site } from "./site.ts";

// @ts-expect-error config.toml has no `missing` key
if (config.missing !== undefined) throw new Error("config.toml has a `missing` key");

console.log(JSON.stringify(site()));
