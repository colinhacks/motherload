// What every parser hands back: a value, or problems placed in the text. Each format's parser is
// in its own package; these are the pieces they share.
import { assertValue, UnsupportedValue, type Value } from "./serialize.ts";

/** A problem in the source. `start` and `length` count UTF-16 code units, as JavaScript strings do; the mapper converts them to the UTF-8 bytes the protocol speaks. */
export type Problem = { message: string; start: number; length: number; code: number };

export type Parsed = { ok: true; value: Value } | { ok: false; problems: Problem[] };

// Diagnostic codes, shown as `motherload<code>` by the type check.
export const CODES = { syntax: 1, unsupported: 2, unknownFormat: 3 } as const;

/** A byte order mark, which a CSV or Markdown file may start with. */
export const BOM = "﻿";

/** The UTF-16 offset of a 1-based line and column. */
export function offsetOf(source: string, line: number, column: number): number {
  let offset = 0;
  for (let l = 1; l < line; l++) {
    const next = source.indexOf("\n", offset);
    if (next === -1) return source.length;
    offset = next + 1;
  }
  return Math.min(offset + Math.max(column - 1, 0), source.length);
}

export const fail = (message: string, start: number, length: number, code: number = CODES.syntax): Parsed => ({ ok: false, problems: [{ message, start, length: Math.max(length, 1), code }] });

/** Wraps a parser's result in the module's value check, so a value no module can carry is a problem at the file's start. */
export function carry(value: unknown): Parsed {
  try {
    assertValue(value);
    return { ok: true, value };
  } catch (error) {
    if (!(error instanceof UnsupportedValue)) throw error;
    const where = error.path.length ? ` at ${error.path.map(String).join(".")}` : "";
    return fail(`${error.message}${where}.`, 0, 1, CODES.unsupported);
  }
}
