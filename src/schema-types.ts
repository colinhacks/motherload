// A JSON Schema as TypeScript declarations (DESIGN.md, "The schema loader: types"). The root is
// `Type`, and each entry of the root's `$defs` (or draft-07 `definitions`) is a named type of its
// own, its key in PascalCase, so `{ "$ref": "#/$defs/person" }` is `Person` and a recursive schema
// stays finite. Keywords that only narrow a value TypeScript cannot narrow (`minLength`, `format`,
// `pattern`, `multipleOf`, ...) are left out; one the emitter does not cover (`not`,
// `if`/`then`/`else`, a `$ref` it cannot resolve) widens that part of the type to `unknown`.
import { literal, propertyName, type Value } from "./serialize.ts";

type Obj = { readonly [key: string]: Value };

const isObj = (value: Value | undefined): value is Obj => typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);
const strings = (value: Value | undefined): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

/** A union, with `unknown` absorbing every other member and `never` dropped. */
function union(members: string[]): string {
  const unique = [...new Set(members)].filter((member) => member !== "never");
  if (unique.includes("unknown")) return "unknown";
  return unique.length ? unique.join(" | ") : "never";
}

/** Whether `type` has a `|` or `&` outside brackets and strings, so it needs parentheses inside `T[]` or `A & B`. */
function compound(type: string): boolean {
  let depth = 0;
  for (let i = 0; i < type.length; i++) {
    const c = type[i]!;
    if (c === '"') {
      for (i++; i < type.length && type[i] !== '"'; i++) if (type[i] === "\\") i++;
    } else if ("{[(<".includes(c)) depth++;
    else if ("}])>".includes(c)) depth--;
    else if (depth === 0 && (c === "|" || c === "&")) return true;
  }
  return false;
}

const paren = (type: string) => (compound(type) || type.startsWith("readonly ") ? `(${type})` : type);
const arrayOf = (type: string) => `${paren(type)}[]`;

/** Whether `type` is one object type literal, `{ ... }` and nothing around it: what an interface can declare. */
function objectLiteral(type: string): boolean {
  if (!type.startsWith("{")) return false;
  let depth = 0;
  for (let i = 0; i < type.length; i++) {
    const c = type[i]!;
    if (c === '"') {
      for (i++; i < type.length && type[i] !== '"'; i++) if (type[i] === "\\") i++;
    } else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i === type.length - 1;
  }
  return false;
}

function doc(schema: Value | undefined, indent: string): string {
  if (!isObj(schema) || typeof schema["description"] !== "string") return "";
  const lines = schema["description"].replace(/\*\//g, "*\\/").split(/\r?\n/);
  if (lines.length === 1) return `${indent}/** ${lines[0]} */\n`;
  return `${indent}/**\n${lines.map((line) => `${indent} *${line ? ` ${line}` : ""}`).join("\n")}\n${indent} */\n`;
}

/** A definition's key as a type name: PascalCase, a valid identifier, and unique. */
function typeName(key: string, taken: Set<string>): string {
  let name = key.split(/[^A-Za-z0-9_$]+/).filter(Boolean).map((word) => word[0]!.toUpperCase() + word.slice(1)).join("") || "Definition";
  if (/^[0-9]/.test(name)) name = `_${name}`;
  let unique = name;
  for (let n = 2; taken.has(unique); n++) unique = `${name}${n}`;
  taken.add(unique);
  return unique;
}

/** The root `Type` and one named declaration per definition, as module text. */
export function schemaDeclarations(root: Value): string {
  const taken = new Set(["Type", "__MotherloadSchema"]);
  const names = new Map<string, string>();
  const definitions: [string, Value][] = [];
  if (isObj(root)) {
    for (const keyword of ["$defs", "definitions"]) {
      const group = root[keyword];
      if (!isObj(group)) continue;
      for (const [key, schema] of Object.entries(group)) {
        const name = typeName(key, taken);
        names.set(`${keyword}\0${key}`, name);
        definitions.push([name, schema]);
      }
    }
  }
  // JSON Pointers into the schema other than a definition are inlined; `inlining` stops a pointer
  // that leads back into itself.
  const inlining = new Set<string>();

  /** A `#/...` reference as its JSON Pointer segments, unescaped (RFC 6901, inside a URI fragment). */
  function segments(ref: string): string[] | undefined {
    try {
      return ref.slice(2).split("/").map((raw) => decodeURIComponent(raw).replace(/~1/g, "/").replace(/~0/g, "~"));
    } catch {
      return undefined; // a malformed percent escape, which ajv reports
    }
  }

  function refType(ref: string, indent: string): string {
    if (ref === "#" || ref === "") return "Type";
    // A reference to another file or a URL is ajv's problem to report; its type is unknown.
    if (!ref.startsWith("#/") || inlining.has(ref)) return "unknown";
    const path = segments(ref);
    if (!path) return "unknown";
    const named = path.length === 2 ? names.get(`${path[0]}\0${path[1]}`) : undefined;
    if (named) return named;
    let target: Value | undefined = root;
    for (const segment of path) target = Array.isArray(target) ? target[Number(segment)] : isObj(target) && Object.hasOwn(target, segment) ? target[segment] : undefined;
    if (target === undefined) return "unknown";
    inlining.add(ref);
    const type = emit(target, indent);
    inlining.delete(ref);
    return type;
  }

  function objectType(schema: Obj, indent: string): string {
    const inner = `${indent}  `;
    const properties = isObj(schema["properties"]) ? schema["properties"] : {};
    const required = new Set(strings(schema["required"]));
    const lines: string[] = [];
    const valueTypes: string[] = [];
    for (const [key, property] of Object.entries(properties)) {
      const type = emit(property, inner);
      const optional = !required.has(key);
      valueTypes.push(type, ...(optional ? ["undefined"] : []));
      lines.push(`${doc(property, inner)}${inner}${propertyName(key)}${optional ? "?" : ""}: ${type};`);
    }
    for (const key of required) if (!Object.hasOwn(properties, key)) lines.push(`${inner}${propertyName(key)}: unknown;`);
    // Keys outside `properties`: an index signature, unless `additionalProperties` (or, without it,
    // `unevaluatedProperties`) is false. Its type covers the named properties too, as TypeScript requires.
    const additional = schema["additionalProperties"];
    const closed = additional === false || (additional === undefined && schema["unevaluatedProperties"] === false);
    const extra = isObj(schema["patternProperties"]) ? Object.values(schema["patternProperties"]).map((pattern) => emit(pattern, inner)) : [];
    if (!closed) extra.push(additional === undefined || additional === true ? "unknown" : emit(additional, inner));
    if (extra.length) lines.push(`${inner}[key: string]: ${union([...extra, ...valueTypes])};`);
    else if (!lines.length) lines.push(`${inner}[key: string]: never;`);
    return `{\n${lines.join("\n")}\n${indent}}`;
  }

  function arrayType(schema: Obj, indent: string): string {
    // 2020-12 spells a tuple `prefixItems` and the rest `items`; drafts 06 to 2019-09 spell them
    // `items` (an array) and `additionalItems`.
    const prefix = schema["prefixItems"];
    const items = schema["items"];
    const tuple = Array.isArray(prefix) ? prefix : Array.isArray(items) ? items : undefined;
    const rest = Array.isArray(prefix) ? items : Array.isArray(items) ? schema["additionalItems"] : items;
    const restType = rest === undefined || rest === true ? "unknown" : emit(rest, indent);
    if (!tuple) return arrayOf(restType);
    const min = typeof schema["minItems"] === "number" ? schema["minItems"] : 0;
    const elements = tuple.map((element, i) => `${emit(element, indent)}${i < min ? "" : "?"}`);
    if (rest !== false) elements.push(`...${arrayOf(restType)}`);
    return `[${elements.join(", ")}]`;
  }

  function typeOf(name: string, schema: Obj, indent: string): string {
    switch (name) {
      case "string":
        return "string";
      case "number":
      case "integer":
        return "number";
      case "boolean":
        return "boolean";
      case "null":
        return "null";
      case "object":
        return objectType(schema, indent);
      case "array":
        return arrayType(schema, indent);
      default:
        return "unknown";
    }
  }

  function emit(schema: Value, indent: string): string {
    if (schema === true) return "unknown";
    if (schema === false) return "never";
    if (!isObj(schema)) return "unknown";
    const parts: string[] = [];
    if (typeof schema["$ref"] === "string") parts.push(refType(schema["$ref"], indent));
    if (Object.hasOwn(schema, "const")) parts.push(literal(schema["const"]!));
    else if (Array.isArray(schema["enum"])) parts.push(union(schema["enum"].map((value) => literal(value))));
    else {
      // Without `type`, the keywords that apply to one type stand for it, as they do in most schemas.
      const declared = typeof schema["type"] === "string" ? [schema["type"]] : strings(schema["type"]);
      const types = declared.length
        ? declared
        : ["properties", "required", "additionalProperties", "patternProperties"].some((k) => Object.hasOwn(schema, k))
          ? ["object"]
          : ["items", "prefixItems", "additionalItems"].some((k) => Object.hasOwn(schema, k))
            ? ["array"]
            : [];
      if (types.length) parts.push(union(types.map((name) => typeOf(name, schema, indent))));
    }
    for (const member of Array.isArray(schema["allOf"]) ? schema["allOf"] : []) parts.push(emit(member, indent));
    for (const keyword of ["anyOf", "oneOf"]) {
      const members = schema[keyword];
      if (Array.isArray(members)) parts.push(union(members.map((member) => emit(member, indent))));
    }
    const meaningful = parts.filter((part) => part !== "unknown");
    if (parts.includes("never")) return "never";
    if (!meaningful.length) return "unknown";
    return meaningful.length === 1 ? meaningful[0]! : meaningful.map(paren).join(" & ");
  }

  const declare = (name: string, schema: Value) => {
    const type = emit(schema, "");
    return objectLiteral(type) ? `${doc(schema, "")}export interface ${name} ${type}` : `${doc(schema, "")}export type ${name} = ${type};`;
  };
  return [declare("Type", root), ...definitions.map(([name, schema]) => declare(name, schema))].join("\n\n");
}
