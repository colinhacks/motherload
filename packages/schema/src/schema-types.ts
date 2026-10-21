// A JSON Schema as TypeScript declarations (DESIGN.md, "The schema loader: types"). The root is
// `Type`, and each entry of the root's `$defs` (or draft-07 `definitions`) is a named type of its
// own, its key in PascalCase, so `{ "$ref": "#/$defs/person" }` is `Person` and a recursive schema
// stays finite. Keywords that only narrow a value TypeScript cannot narrow (`minLength`, `format`,
// `pattern`, `multipleOf`, ...) are left out; one the emitter does not cover (`not`,
// `if`/`then`/`else`, a `$ref` it cannot resolve) widens that part of the type to `unknown`. A
// `$ref` to another schema file is a type imported from that file's own module (refs.ts).
import { basename } from "node:path";
import { literal, propertyName, type Value } from "@motherload/core";
import { fileOf, pointer, pointTo, specifierOf } from "./refs.ts";

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

/** The names a schema's module declares: one per entry of its `$defs` and `definitions`, keyed `<keyword>\0<key>`, besides `Type`. */
function definitionNames(root: Value): { names: Map<string, string>; definitions: [string, Value][]; taken: Set<string> } {
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
  return { names, definitions, taken };
}

/** The other schema files a schema's `$ref`s reach, so that a reference to one is typed by its module. */
export interface SchemaFiles {
  /** The path of the file the root schema was read from. */
  path: string;
  /** The schema in another file, or undefined when it cannot be read (a problem reported at the reference). */
  read(path: string): Value | undefined;
}

/** A schema file whose pointers a reference can follow: the root's own, or another file's, whose names are imported. */
type Document = { schema: Value; path: string | undefined; names: Map<string, string>; own: boolean };

/** The drafts whose keywords differ for a type: draft-06 reads as draft-07. */
export type Draft = "draft-07" | "2019-09" | "2020-12";

/**
 * The root `Type` and one named declaration per definition, as module text. With `files`, a `$ref`
 * to another schema file is typed by that file's module: its `Type`, or the type it declares for
 * the definition the reference points to, imported under a name of this module's choosing; a
 * pointer to anything else there is inlined from the file. Without `files`, such a `$ref` is `unknown`.
 * With `draft`, a keyword is read only in the drafts that have it, as ajv reads it: `prefixItems`
 * in 2020-12 alone, a list of `items` and `additionalItems` before it, `unevaluatedProperties` from
 * 2019-09; without, every keyword is read.
 */
export function schemaDeclarations(root: Value, files?: SchemaFiles, draft?: Draft): string {
  const prefixItems = draft === undefined || draft === "2020-12";
  const itemLists = draft === undefined || draft !== "2020-12";
  const unevaluated = draft === undefined || draft !== "draft-07";
  const { names, definitions, taken } = definitionNames(root);
  const main: Document = { schema: root, path: files?.path, names, own: true };
  const documents = new Map<string, Document>();
  // The types imported from other files: specifier, then exported name, then the name used here.
  const imports = new Map<string, Map<string, string>>();
  // JSON Pointers other than a definition are inlined, from the document the reference reached;
  // `inlining` stops a pointer that leads back into itself.
  const inlining = new Set<string>();
  let current = main;

  function documentAt(path: string): Document | undefined {
    if (path === files!.path) return main;
    let document = documents.get(path);
    if (!document) {
      const schema = files!.read(path);
      if (schema === undefined) return undefined;
      document = { schema, path, names: definitionNames(schema).names, own: false };
      documents.set(path, document);
    }
    return document;
  }

  /** `exported`, a name `document`'s module declares, as a name in this module: itself, or the name it is imported under. */
  function nameIn(document: Document, exported: string): string {
    if (document.own) return exported;
    const specifier = specifierOf(files!.path, document.path!);
    let byName = imports.get(specifier);
    if (!byName) imports.set(specifier, (byName = new Map()));
    let local = byName.get(exported);
    if (local === undefined) {
      // Another file's `Type` is named for the file: `./address.schema.jsonc` gives `Address`.
      local = typeName(exported === "Type" ? basename(document.path!).replace(/\.schema\.json[c5]$/, "") : exported, taken);
      byName.set(exported, local);
    }
    return local;
  }

  function refType(ref: string, indent: string): string {
    let document = current;
    let fragment = ref === "" ? "" : ref.startsWith("#") ? ref.slice(1) : undefined;
    if (fragment === undefined) {
      // Another file, when the files are known; a URL, or a file that cannot be read, is unknown.
      const target = files && current.path !== undefined ? fileOf(ref, current.path) : undefined;
      const reached = target && documentAt(target.path);
      if (!target || !reached) return "unknown";
      [document, fragment] = [reached, target.fragment];
    }
    // An `$anchor` name or a malformed pointer is unknown, as ajv reports the latter.
    const path = pointer(fragment);
    if (!path) return "unknown";
    if (path.length === 0) return nameIn(document, "Type");
    const named = path.length === 2 ? document.names.get(`${path[0]}\0${path[1]}`) : undefined;
    if (named) return nameIn(document, named);
    const key = `${document.path}#${fragment}`;
    const target = inlining.has(key) ? undefined : pointTo(document.schema, path);
    if (target === undefined) return "unknown";
    inlining.add(key);
    const outer = current;
    current = document;
    const type = emit(target, indent);
    current = outer;
    inlining.delete(key);
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
    const closed = additional === false || (additional === undefined && unevaluated && schema["unevaluatedProperties"] === false);
    const extra = isObj(schema["patternProperties"]) ? Object.values(schema["patternProperties"]).map((pattern) => emit(pattern, inner)) : [];
    if (!closed) extra.push(additional === undefined || additional === true ? "unknown" : emit(additional, inner));
    if (extra.length) lines.push(`${inner}[key: string]: ${union([...extra, ...valueTypes])};`);
    else if (!lines.length) lines.push(`${inner}[key: string]: never;`);
    return `{\n${lines.join("\n")}\n${indent}}`;
  }

  function arrayType(schema: Obj, indent: string): string {
    // 2020-12 spells a tuple `prefixItems` and the rest `items`; drafts 06 to 2019-09 spell them
    // `items` (an array) and `additionalItems`. Each is read only in the drafts that have it.
    const prefix = prefixItems ? schema["prefixItems"] : undefined;
    const items = schema["items"];
    const list = itemLists && Array.isArray(items);
    const tuple = Array.isArray(prefix) ? prefix : list ? (items as Value[]) : undefined;
    const rest = Array.isArray(prefix) ? items : list ? schema["additionalItems"] : items;
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
      // OpenAPI 3.0's `nullable: true`, which ajv reads beside `type`, admits null too.
      if (types.length) parts.push(union([...types.map((name) => typeOf(name, schema, indent)), ...(schema["nullable"] === true ? ["null"] : [])]));
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
  const declarations = [declare("Type", root), ...definitions.map(([name, schema]) => declare(name, schema))].join("\n\n");
  const lines = [...imports].map(([specifier, byName]) => `import type { ${[...byName].map(([exported, local]) => (exported === local ? exported : `${exported} as ${local}`)).join(", ")} } from ${JSON.stringify(specifier)};`);
  return lines.length ? `${lines.join("\n")}\n\n${declarations}` : declarations;
}
