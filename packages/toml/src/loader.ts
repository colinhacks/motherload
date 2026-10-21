// A `.toml` file's module: its data, typed as `as const` would type it. TOML 1.1, read with
// smol-toml (DESIGN.md, "The TOML parser: smol-toml" and "TOML dates").
import { parse as parseToml, TomlDate, TomlError } from "smol-toml";
import { carry, fail, moduleLoader, offsetOf, valueModule, type Parsed } from "@motherload/core";

/** TOML's dates: an offset date-time is an instant and becomes a `Date`; a local date-time, date or time names no instant and stays its ISO text. */
function tomlDates(value: unknown): unknown {
  if (value instanceof TomlDate) return value.isLocal() ? value.toISOString() : new Date(value.getTime());
  if (Array.isArray(value)) return value.map(tomlDates);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(value)) out[key] = tomlDates((value as Record<string, unknown>)[key]);
    return out;
  }
  return value;
}

export function parseTomlFile(source: string): Parsed {
  try {
    return carry(tomlDates(parseToml(source, { integersAsBigInt: "asNeeded" })));
  } catch (error) {
    if (error instanceof TomlError) return fail(error.message.split("\n")[0]!, offsetOf(source, error.line, error.column), 1);
    throw error;
  }
}

export const loader = moduleLoader("@motherload/toml", [".toml"], /\.toml$/, (source) => valueModule(parseTomlFile(source)));
