// A JSON Schema as TypeScript declarations (DESIGN.md, "The schema loader: types"). The root is
// `Type`, and each entry of the root's `$defs` (or draft-07 `definitions`) is a named type of its
// own, its key in PascalCase, so `{ "$ref": "#/$defs/person" }` is `Person` and a recursive schema
// stays finite. Keywords that only narrow a value TypeScript cannot narrow (`minLength`, `format`,
// `pattern`, `multipleOf`, ...) are left out; one the emitter does not cover (`not`, an
// `if`/`then`/`else` that does not test a property's listed values, a `$ref` it cannot resolve)
// widens that part of the type to `unknown`. A `$ref` to another schema file is a type imported
// from that file's own module (refs.ts).
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

/**
 * The keywords that evaluate properties in place, beside `properties` and `patternProperties`: a
 * key one of them allows is not refused by `unevaluatedProperties: false`.
 */
const EVALUATING = ["allOf", "anyOf", "oneOf", "if", "then", "else", "dependentSchemas", "$ref", "$dynamicRef", "$recursiveRef"];

const ANNOTATIONS = ["$comment", "title", "description"];

/** The JSON types, in the order a union of them is written. */
const JSON_TYPES = ["object", "array", "string", "number", "boolean", "null"] as const;
type JsonType = (typeof JSON_TYPES)[number];

/** The JSON type a `type` name stands for (`integer` is a number), or undefined for a name JSON Schema does not have. */
const jsonType = (name: string): JsonType | undefined => (name === "integer" ? "number" : (JSON_TYPES as readonly string[]).includes(name) ? (name as JsonType) : undefined);

/** The JSON type of a value in a schema (`const`, `enum`). */
const typeOfValue = (value: Value): JsonType => (value === null ? "null" : Array.isArray(value) ? "array" : typeof value === "object" ? "object" : typeof value === "string" ? "string" : typeof value === "boolean" ? "boolean" : "number");

const OBJECT: ReadonlySet<JsonType> = new Set(["object"]);

type Primitive = string | number | boolean | null;
const isPrimitive = (value: Value): value is Primitive => value === null || ["string", "number", "boolean"].includes(typeof value);

/** Whether `value` is of the JSON type `name`. */
function ofType(value: Primitive, name: string): boolean {
  if (name === "integer") return Number.isInteger(value);
  return name === "null" ? value === null : typeof value === name;
}

/** The values a schema of `const` or `enum` admits, when each is a string, number, boolean or null; `exact` refuses a schema with any other keyword than `type` and annotations. */
function literalsOf(schema: Value | undefined, exact: boolean): Primitive[] | undefined {
  if (!isObj(schema) || (exact && !Object.keys(schema).every((k) => ["const", "enum", "type", ...ANNOTATIONS].includes(k)))) return undefined;
  const listed = Array.isArray(schema["enum"]) ? schema["enum"] : undefined;
  const values = Object.hasOwn(schema, "const") ? [schema["const"]!].filter((value) => !listed || listed.includes(value)) : listed;
  if (!values?.every(isPrimitive)) return undefined;
  const types = typeof schema["type"] === "string" ? [schema["type"]] : strings(schema["type"]);
  return [...new Set(schema["type"] === undefined ? values : values.filter((value) => types.some((name) => ofType(value, name))))];
}

/** An `if` that tests one property's value with `const` or `enum`, and nothing else: the property and the values that pass. */
function propertyTest(test: Value | undefined): { key: string; values: Primitive[] } | undefined {
  if (!isObj(test) || !Object.keys(test).every((k) => ["properties", "required", "type", ...ANNOTATIONS].includes(k))) return undefined;
  if (test["type"] !== undefined && test["type"] !== "object") return undefined;
  const keys = isObj(test["properties"]) ? Object.keys(test["properties"]) : [];
  if (keys.length !== 1) return undefined;
  const key = keys[0]!;
  if (test["required"] !== undefined && !(Array.isArray(test["required"]) && test["required"].every((name) => name === key))) return undefined;
  const values = literalsOf((test["properties"] as Obj)[key], true);
  return values && { key, values };
}

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

  /** Where a `$ref` points: the document and the pointer into it; undefined for a URL, a file that cannot be read, an `$anchor` name or a malformed pointer. */
  function locate(ref: string): { document: Document; fragment: string; path: string[] } | undefined {
    let document = current;
    let fragment = ref === "" ? "" : ref.startsWith("#") ? ref.slice(1) : undefined;
    if (fragment === undefined) {
      // Another file, when the files are known.
      const target = files && current.path !== undefined ? fileOf(ref, current.path) : undefined;
      const reached = target && documentAt(target.path);
      if (!target || !reached) return undefined;
      [document, fragment] = [reached, target.fragment];
    }
    const path = pointer(fragment);
    return path ? { document, fragment, path } : undefined;
  }

  /**
   * The JSON types a value the schema accepts can have, as far as `type`, `const`, `enum`, `allOf`,
   * `anyOf`, `oneOf` and `$ref` tell; every type when they tell nothing. A keyword that applies to
   * one type (`properties`, `items`, `minLength`) restricts nothing: a value of another type passes it.
   */
  function possibleTypes(schema: Value, seen = new Set<Value>()): Set<JsonType> {
    if (schema === false) return new Set();
    if (!isObj(schema) || seen.has(schema)) return new Set(JSON_TYPES);
    seen.add(schema);
    let types = new Set<JsonType>(JSON_TYPES);
    const keep = (allowed: Iterable<JsonType | undefined>) => {
      const set = new Set(allowed);
      types = new Set([...types].filter((type) => set.has(type)));
    };
    if (schema["type"] !== undefined) keep((typeof schema["type"] === "string" ? [schema["type"]] : strings(schema["type"])).map(jsonType));
    if (Object.hasOwn(schema, "const")) keep([typeOfValue(schema["const"]!)]);
    if (Array.isArray(schema["enum"])) keep(schema["enum"].map(typeOfValue));
    for (const member of Array.isArray(schema["allOf"]) ? schema["allOf"] : []) keep(possibleTypes(member, seen));
    for (const keyword of ["anyOf", "oneOf"]) {
      const members = schema[keyword];
      if (Array.isArray(members)) keep(members.flatMap((member) => [...possibleTypes(member, seen)]));
    }
    const at = typeof schema["$ref"] === "string" ? locate(schema["$ref"]) : undefined;
    const target = at && pointTo(at.document.schema, at.path);
    if (at && target !== undefined) {
      const outer = current;
      current = at.document;
      keep(possibleTypes(target, seen));
      current = outer;
    }
    seen.delete(schema);
    return types;
  }

  function refType(ref: string, indent: string): string {
    // A URL, a file that cannot be read, an `$anchor` name or a malformed pointer is unknown, as ajv reports the last.
    const at = locate(ref);
    if (!at) return "unknown";
    const { document, fragment, path } = at;
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
    // `unevaluatedProperties`, when no keyword beside it can allow another key) is false. Its type
    // covers the named properties too, as TypeScript requires.
    const additional = schema["additionalProperties"];
    const closed = additional === false || (additional === undefined && unevaluated && schema["unevaluatedProperties"] === false && !EVALUATING.some((k) => Object.hasOwn(schema, k)));
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

  /** A schema that is a `$ref` within its document, with nothing beside it but annotations, as the schema it points to. */
  function followLocal(schema: Value | undefined): Value | undefined {
    for (let hops = 0; hops < 8 && isObj(schema) && typeof schema["$ref"] === "string" && schema["$ref"].startsWith("#") && Object.keys(schema).every((k) => k === "$ref" || ANNOTATIONS.includes(k)); hops++) {
      const path = pointer(schema["$ref"].slice(1));
      schema = path ? pointTo(current.schema, path) : undefined;
    }
    return schema;
  }

  /**
   * The `if`/`then`/`else` of an object schema, its own and those of `allOf` members that hold
   * nothing else, as a union with one member per value of a required property they test, when that
   * property's schema lists its values (`enum` or `const`) and each `if` tests the value alone. Each
   * member is that value with the `then` of every test it passes and the `else` of every test it
   * fails, so every value the validator accepts is in the member for its own value, and TypeScript
   * narrows the union on the property. A conditional of another shape is not read, and widens.
   */
  function conditionalCases(schema: Obj, indent: string): string | undefined {
    const onlyConditional = (member: Value) => isObj(member) && Object.hasOwn(member, "if") && Object.keys(member).every((k) => ["if", "then", "else", ...ANNOTATIONS].includes(k));
    const conditionals = [schema, ...(Array.isArray(schema["allOf"]) ? schema["allOf"].filter(onlyConditional) : [])].filter((member): member is Obj => isObj(member) && Object.hasOwn(member, "if"));
    const properties = isObj(schema["properties"]) ? schema["properties"] : {};
    const required = new Set(strings(schema["required"]));
    let key: string | undefined;
    let domain: Primitive[] = [];
    const tests: { values: Primitive[]; then: Value | undefined; else: Value | undefined }[] = [];
    for (const conditional of conditionals) {
      const test = propertyTest(conditional["if"]);
      if (!test || !required.has(test.key) || (key !== undefined && test.key !== key)) continue;
      if (key === undefined) {
        const values = literalsOf(followLocal(properties[test.key]), false);
        if (!values) continue;
        [key, domain] = [test.key, values];
      }
      tests.push({ values: test.values, then: conditional["then"], else: conditional["else"] });
    }
    if (key === undefined) return undefined;
    const name = propertyName(key);
    const variants = domain.map((value) => {
      const members = [`{ ${name}: ${literal(value)} }`];
      for (const test of tests) {
        const branch = test.values.includes(value) ? test.then : test.else;
        if (branch !== undefined) members.push(emit(branch, indent, OBJECT));
      }
      return members.includes("never") ? "never" : members.filter((member) => member !== "unknown").map(paren).join(" & ");
    });
    return union(variants.map(paren));
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
      case "object": {
        // An object's `if`/`then`/`else`, when they test a property's listed values.
        const object = objectType(schema, indent);
        const cases = conditionalCases(schema, indent);
        return cases === undefined ? object : cases === "never" ? "never" : `${object} & ${paren(cases)}`;
      }
      case "array":
        return arrayType(schema, indent);
      default:
        return "unknown";
    }
  }

  /**
   * The type of the values `schema` accepts. `within` holds the JSON types the value is known to
   * have already, when the schema is a member of another's `allOf`, `anyOf` or `oneOf` (the other's
   * own), or a `then` or `else` read as an object; the type leaves out every other JSON type.
   */
  function emit(schema: Value, indent: string, within?: ReadonlySet<JsonType>): string {
    if (schema === true) return "unknown";
    if (schema === false) return "never";
    if (!isObj(schema)) return "unknown";
    const possible = new Set([...possibleTypes(schema)].filter((type) => !within || within.has(type)));
    if (!possible.size) return "never";
    const parts: string[] = [];
    if (typeof schema["$ref"] === "string") parts.push(refType(schema["$ref"], indent));
    if (Object.hasOwn(schema, "const")) parts.push(literal(schema["const"]!));
    else if (Array.isArray(schema["enum"])) parts.push(union(schema["enum"].map((value) => literal(value))));
    else {
      // Without `type`, a keyword that applies to one type constrains a value of that type alone,
      // and a value of every other type the schema allows passes it, as the spec has it.
      const declared = typeof schema["type"] === "string" ? [schema["type"]] : strings(schema["type"]);
      const objects = ["properties", "required", "additionalProperties", "patternProperties"].some((k) => Object.hasOwn(schema, k));
      const arrays = ["items", ...(prefixItems ? ["prefixItems"] : []), ...(itemLists ? ["additionalItems"] : [])].some((k) => Object.hasOwn(schema, k));
      // The types the keywords constrain first, then the rest.
      const order = [...(objects ? ["object"] : []), ...(arrays ? ["array"] : []), ...JSON_TYPES.filter((type) => !(objects && type === "object") && !(arrays && type === "array"))] as JsonType[];
      // When neither is possible here, the rest are already the types of `allOf`, `anyOf`, `oneOf`,
      // `$ref` or the enclosing schema, which say them as parts of their own.
      const constrained = (objects && possible.has("object")) || (arrays && possible.has("array"));
      const types = declared.length ? declared.filter((name) => jsonType(name) === undefined || possible.has(jsonType(name)!)) : constrained ? order.filter((type) => possible.has(type)) : [];
      if (types.length) parts.push(union(types.map((name) => typeOf(name, schema, indent))));
    }
    for (const member of Array.isArray(schema["allOf"]) ? schema["allOf"] : []) parts.push(emit(member, indent, possible));
    for (const keyword of ["anyOf", "oneOf"]) {
      const members = schema[keyword];
      if (Array.isArray(members)) parts.push(union(members.map((member) => emit(member, indent, possible))));
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
