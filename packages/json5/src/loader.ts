// A `.json5` file's module: its data, typed as `as const` would type it, read with json5, the
// JSON5 project's own parser.
import JSON5 from "json5";
import { carry, fail, moduleLoader, offsetOf, valueModule, type Parsed } from "@motherload/core";

export function parseJson5File(source: string): Parsed {
  try {
    return carry(JSON5.parse(source));
  } catch (error) {
    const e = error as SyntaxError & { lineNumber?: number; columnNumber?: number };
    if (typeof e.lineNumber === "number") return fail(e.message.replace(/^JSON5: /, ""), offsetOf(source, e.lineNumber, e.columnNumber ?? 1), 1);
    throw error;
  }
}

export const loader = moduleLoader("@motherload/json5", [".json5"], /\.json5$/, (source) => valueModule(parseJson5File(source)));
