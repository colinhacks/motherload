// A parsed value as JavaScript source (for the module the runtime and the bundlers load) and as
// TypeScript type text (for the module the type check reads), in two granularities: widened, the
// way `resolveJsonModule` types a `.json` import, and literal, the way `as const` would.

/** What the parsers hand over, after `normalize` in each format: JSON's values plus the few that JSON lacks. */
export type Value = null | boolean | number | bigint | string | Date | readonly Value[] | { readonly [key: string]: Value };

/** A value the module cannot carry (a YAML `!!binary`, a Map with object keys); `path` names where it is. */
export class UnsupportedValue extends Error {
  readonly path: readonly (string | number)[];
  constructor(message: string, path: readonly (string | number)[]) {
    super(message);
    this.path = path;
  }
}

const isPlainObject = (value: object): value is { readonly [key: string]: Value } => {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const describe = (value: unknown): string =>
  value === undefined ? "undefined" : typeof value === "object" && value !== null ? (value.constructor?.name ?? "object") : typeof value;

function check(value: unknown, path: (string | number)[]): asserts value is Value {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "bigint" || typeof value === "string") return;
  if (value instanceof Date) return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => check(item, [...path, i]));
    return;
  }
  if (typeof value === "object" && isPlainObject(value)) {
    for (const key of Object.keys(value)) check(value[key], [...path, key]);
    return;
  }
  throw new UnsupportedValue(`A ${describe(value)} cannot be carried by a module`, path);
}

/** Throws `UnsupportedValue` for anything outside `Value`. */
export function assertValue(value: unknown): asserts value is Value {
  check(value, []);
}

const IDENT = /^[A-Za-z_$][\w$]*$/;
/** A property name in an object type or literal: bare when it can be, quoted otherwise. */
const key = (name: string) => (IDENT.test(name) ? name : JSON.stringify(name));

function number(value: number): string {
  if (Number.isNaN(value)) return "NaN";
  if (value === Infinity) return "Infinity";
  if (value === -Infinity) return "-Infinity";
  if (Object.is(value, -0)) return "-0";
  return String(value);
}

/** JavaScript source that evaluates to `value`. */
export function toJs(value: Value): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return number(value);
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "boolean") return String(value);
  if (value instanceof Date) return `new Date(${JSON.stringify(value.toISOString())})`;
  if (Array.isArray(value)) return `[${value.map(toJs).join(", ")}]`;
  const object = value as { readonly [key: string]: Value };
  // `__proto__: x` in an object literal sets the prototype; a computed key defines the property.
  const entries = Object.keys(object).map((name) => `${name === "__proto__" ? `["__proto__"]` : JSON.stringify(name)}: ${toJs(object[name]!)}`);
  return `{${entries.join(", ")}}`;
}

const union = (members: string[]) => {
  const unique = [...new Set(members)];
  return unique.length === 1 ? unique[0]! : unique.join(" | ");
};

/** The type `resolveJsonModule` would give: literals widen to their primitive, arrays to an array of the union of their items. */
export function widened(value: Value): string {
  if (value === null) return "null";
  if (value instanceof Date) return "Date";
  if (Array.isArray(value)) {
    if (value.length === 0) return "never[]";
    const item = union(value.map(widened));
    return item.includes(" | ") ? `(${item})[]` : `${item}[]`;
  }
  if (typeof value === "object") {
    const object = value as { readonly [key: string]: Value };
    const names = Object.keys(object);
    return names.length === 0 ? "{}" : `{ ${names.map((name) => `${key(name)}: ${widened(object[name]!)}`).join("; ")} }`;
  }
  return typeof value;
}

/** The type `as const` would give: every primitive its literal type, arrays readonly tuples, objects readonly. */
export function literal(value: Value): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return String(value);
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "number") {
    // TypeScript has no literal type for NaN or the infinities, and `-0` is the literal `0`.
    if (!Number.isFinite(value)) return "number";
    return value < 0 ? `-${-value}` : String(value === 0 ? 0 : value);
  }
  if (value instanceof Date) return "Date";
  if (Array.isArray(value)) return `readonly [${value.map(literal).join(", ")}]`;
  const object = value as { readonly [key: string]: Value };
  const names = Object.keys(object);
  return names.length === 0 ? "{}" : `{ ${names.map((name) => `readonly ${key(name)}: ${literal(object[name]!)}`).join("; ")} }`;
}
