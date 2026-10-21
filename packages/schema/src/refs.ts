// A schema's `$ref`s to other files (DESIGN.md, "The schema loader: references to other files").
// A reference's URI part is resolved against the file that holds it, as a relative URL is, so
// `./tag.schema.jsonc`, `tag.schema.jsonc` and `../shared/tag.schema.jsonc#/$defs/tag` each name a
// file near it; one with a scheme of its own (`https:`, `urn:`) is a URL and is not followed. The
// files reached, transitively, are read once each: the types import the other files' modules, and
// ajv compiles the validator from all of them.
import { readFileSync } from "node:fs";
import { dirname, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseJson5File } from "@motherload/json5/loader";
import { parseJsoncFile } from "@motherload/jsonc/loader";
import { CODES, type Parsed, type Problem, type Value } from "@motherload/core";

type Obj = { readonly [key: string]: Value };

const isObj = (value: Value | undefined): value is Obj => typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);

/** The suffixes of the files a `$ref` may name: the schema loader's own. */
export const SCHEMA_SUFFIXES = [".schema.jsonc", ".schema.json5"] as const;

/** A schema is read in the dialect its suffix names: JSON5 for `.schema.json5`, JSON with comments for `.schema.jsonc`. */
export const parseSchemaFile = (source: string, path: string): Parsed => (path.endsWith(".schema.json5") ? parseJson5File(source) : parseJsoncFile(source));

// The keywords whose values are schemas, lists of schemas, or maps of them. Every other keyword's
// value (`const`, `enum`, `default`, `examples`, an unknown keyword) is data and is never searched.
const ONE = ["additionalProperties", "unevaluatedProperties", "items", "additionalItems", "unevaluatedItems", "contains", "propertyNames", "not", "if", "then", "else", "contentSchema"];
const LIST = ["allOf", "anyOf", "oneOf", "prefixItems", "items"];
const MAP = ["properties", "patternProperties", "$defs", "definitions", "dependentSchemas", "dependencies"];

/** A copy of `schema` with `change` applied to it and then to every schema inside it, keyword by keyword, so data (`const`, an unknown keyword) stays as written. */
function mapSchemas(schema: Value, change: (copy: Record<string, Value>) => void): Value {
  if (!isObj(schema)) return schema;
  const copy: Record<string, Value> = { ...schema };
  change(copy);
  for (const key of ONE) if (isObj(copy[key])) copy[key] = mapSchemas(copy[key], change);
  for (const key of LIST) {
    const list = copy[key];
    if (Array.isArray(list)) copy[key] = list.map((item) => mapSchemas(item, change));
  }
  for (const key of MAP) {
    const group = copy[key];
    // A `dependencies` entry that is a list names properties; one that is an object is a schema.
    if (isObj(group)) copy[key] = Object.fromEntries(Object.entries(group).map(([name, item]) => [name, Array.isArray(item) ? item : mapSchemas(item, change)]));
  }
  return copy;
}

/** A copy of `schema` with `map` applied to every `$ref` in it, so data that holds a `$ref` key stays as written. */
const mapRefs = (schema: Value, map: (ref: string) => string): Value =>
  mapSchemas(schema, (copy) => {
    if (typeof copy["$ref"] === "string") copy["$ref"] = map(copy["$ref"]);
  });

/** Calls `visit` with `schema` and then every schema inside it, keyword by keyword, as `mapSchemas` walks them. */
const eachSchema = (schema: Value, visit: (schema: Obj) => void): void => void mapSchemas(schema, visit);

/** A copy of `schema` without `keywords`, in it and in every schema inside it. */
export const withoutKeywords = (schema: Value, keywords: readonly string[]): Value =>
  keywords.length
    ? mapSchemas(schema, (copy) => {
        for (const keyword of keywords) delete copy[keyword];
      })
    : schema;

/** Every `$ref` in `schema`, in document order. */
export function refsIn(schema: Value): string[] {
  const refs: string[] = [];
  mapRefs(schema, (ref) => (refs.push(ref), ref));
  return refs;
}

/** The file a reference names and the fragment it points to there; undefined for a reference within its own file (`#/...`) or to a URL. */
export function fileOf(ref: string, from: string): { path: string; fragment: string } | undefined {
  const hash = ref.indexOf("#");
  const uri = hash === -1 ? ref : ref.slice(0, hash);
  if (uri === "" || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(uri)) return undefined;
  try {
    return { path: fileURLToPath(new URL(uri, pathToFileURL(from))), fragment: hash === -1 ? "" : ref.slice(hash + 1) };
  } catch {
    return undefined; // not a URL at all, which ajv reports
  }
}

/** A fragment's JSON Pointer segments, unescaped (RFC 6901, percent-decoded as a URI fragment is); undefined when it is not a pointer (an `$anchor` name) or is malformed. */
export function pointer(fragment: string): string[] | undefined {
  if (fragment === "") return [];
  if (!fragment.startsWith("/")) return undefined;
  try {
    return fragment.slice(1).split("/").map((raw) => decodeURIComponent(raw).replace(/~1/g, "/").replace(/~0/g, "~"));
  } catch {
    return undefined;
  }
}

/** The value a pointer leads to in `schema`, or undefined when nothing is there. */
export function pointTo(schema: Value, segments: string[]): Value | undefined {
  let target: Value | undefined = schema;
  for (const segment of segments) target = Array.isArray(target) ? target[Number(segment)] : isObj(target) && Object.hasOwn(target, segment) ? target[segment] : undefined;
  return target;
}

/** A module specifier for `to` from the file `from`: relative, with `/` separators. */
export function specifierOf(from: string, to: string): string {
  const path = relative(dirname(from), to).split(sep).join("/");
  return path.startsWith("../") ? path : `./${path}`;
}

/** Where a reference sits in the text of the file that holds it: the reference inside its quotes, or the file's start if it cannot be found. */
function placeOf(source: string, ref: string): { start: number; length: number } {
  for (const quoted of [JSON.stringify(ref), `'${ref}'`]) {
    const at = source.indexOf(quoted);
    if (at !== -1) return { start: at + 1, length: Math.max(ref.length, 1) };
  }
  return { start: 0, length: 1 };
}

export type Files = {
  /** The schema of every file reached from the root, by path, the root's own included. */
  schemas: Map<string, Value>;
  /** For each other file, where the root's text first refers to it, directly or through another file. */
  places: Map<string, { start: number; length: number }>;
  /** Every file a reference named, read or not, for a bundler to watch. */
  watched: string[];
  /** Problems with references, each placed at a reference in the root's text. */
  problems: Problem[];
};

/**
 * The root schema and every file it reaches. `drafts.of` names the draft a schema declares, or
 * undefined when it declares none, and `drafts.none` the draft a root that declares none is read
 * in: ajv compiles every file in the root's draft, so a file that declares another is a problem,
 * while one that declares none is read in the root's. `clean` is applied to each other file as it
 * is read, as the caller applied it to the root, before its references are followed.
 */
export function collect(rootPath: string, root: Value, rootSource: string, drafts: { of: (schema: Value) => string | undefined; none: string }, clean: (schema: Value) => Value = (schema) => schema): Files {
  const schemas = new Map<string, Value>([[rootPath, root]]);
  const places = new Map<string, { start: number; length: number }>();
  const watched: string[] = [];
  const problems: Problem[] = [];
  const failed = new Set<string>();
  const rootDraft = drafts.of(root) ?? drafts.none;
  const queue: { path: string; schema: Value; via?: { start: number; length: number } }[] = [{ path: rootPath, schema: root }];
  for (let next = queue.shift(); next; next = queue.shift()) {
    const { path, schema, via } = next;
    for (const ref of refsIn(schema)) {
      const target = fileOf(ref, path);
      if (!target) continue;
      const place = via ?? placeOf(rootSource, ref);
      // A problem in a file the root reaches through another is reported at the root's reference, naming that file.
      const where = via ? `${specifierOf(rootPath, path)}: ` : "";
      const report = (message: string) => problems.push({ message: `${where}${message}`, ...place, code: CODES.schema });
      if (failed.has(target.path)) continue;
      let schemaThere = schemas.get(target.path);
      if (schemaThere === undefined) {
        if (!SCHEMA_SUFFIXES.some((suffix) => target.path.endsWith(suffix))) {
          report(`The $ref "${ref}" names a file that is not a schema: a $ref to another file names a .schema.jsonc or .schema.json5 file.`);
          failed.add(target.path);
          continue;
        }
        watched.push(target.path);
        let text: string;
        try {
          text = readFileSync(target.path, "utf8");
        } catch (error) {
          report((error as NodeJS.ErrnoException).code === "ENOENT" ? `The $ref "${ref}" names a file that does not exist.` : `The $ref "${ref}" names a file that cannot be read: ${(error as Error).message}`);
          failed.add(target.path);
          continue;
        }
        const parsed = parseSchemaFile(text, target.path);
        if (!parsed.ok) {
          report(`The $ref "${ref}" names a file that does not parse: ${parsed.problems[0]!.message}`);
          failed.add(target.path);
          continue;
        }
        const declared = drafts.of(parsed.value);
        if (declared !== undefined && declared !== rootDraft) {
          const of = (value: Value) => (isObj(value) && typeof value["$schema"] === "string" ? JSON.stringify(value["$schema"]) : "not declared, so draft-07");
          report(`The $ref "${ref}" names a schema whose $schema is ${of(parsed.value)}, and this schema's is ${of(root)}: a schema and the files it refers to are compiled in one draft.`);
          failed.add(target.path);
          continue;
        }
        schemaThere = clean(parsed.value);
        schemas.set(target.path, schemaThere);
        places.set(target.path, place);
        queue.push({ path: target.path, schema: schemaThere, via: place });
      }
      const segments = pointer(target.fragment);
      if (segments && pointTo(schemaThere, segments) === undefined) report(`The $ref "${ref}" points to nothing: ${specifierOf(path, target.path)} has no #${target.fragment}.`);
    }
  }
  return { schemas, places, watched, problems };
}

/**
 * Each 2020-12 `$dynamicRef` that ajv resolves otherwise than the spec, as a problem placed as
 * `collect`'s are. ajv 8.20.0 (`dist/vocabularies/dynamic/dynamicRef.js`) resolves `"#name"` to the
 * `$dynamicAnchor` of that name only when it has compiled one already, which it has for one at the
 * root of the file or of a schema with an `$id`, and otherwise, as for a JSON Pointer, to the root
 * of the schema: measured on 2026-10-20, with the anchor in `$defs` the validator checked the
 * root's rules in its place, and with the reference at the root it recursed until the stack ran out.
 */
export function dynamicRefProblems(files: Files, rootPath: string, rootSource: string): Problem[] {
  const problems: Problem[] = [];
  for (const [path, schema] of files.schemas) {
    const anchors = new Set<string>();
    const refs = new Set<string>();
    let root = true;
    eachSchema(schema, (s) => {
      if ((root || typeof s["$id"] === "string") && typeof s["$dynamicAnchor"] === "string") anchors.add(s["$dynamicAnchor"]);
      if (typeof s["$dynamicRef"] === "string") refs.add(s["$dynamicRef"]);
      root = false;
    });
    for (const ref of refs) {
      // `#` is the root for ajv and the spec alike; a reference to another document ajv refuses itself.
      if (ref === "#" || !ref.startsWith("#")) continue;
      const name = ref.includes("/") ? undefined : ref.slice(1);
      if (name !== undefined && anchors.has(name)) continue;
      const fix = name === undefined ? "write it as a $ref" : `declare "$dynamicAnchor": "${name}" at the root of the schema or of a schema with an $id, or write it as a $ref`;
      const where = path === rootPath ? "" : `${specifierOf(rootPath, path)}: `;
      const place = path === rootPath ? placeOf(rootSource, ref) : files.places.get(path)!;
      problems.push({ message: `${where}ajv resolves the $dynamicRef "${ref}" to the root of its schema, not where it points: ${fix}.`, ...place, code: CODES.schema });
    }
  }
  return problems;
}

/**
 * Every file of `files` for ajv, each under an id that holds no path, because ajv's standalone code
 * embeds ids: a file's own absolute `$id` (one with a scheme), or `motherload:<n>`. Each reference
 * to another of the files is rewritten to that file's id, so ajv never resolves a file path.
 */
export function forAjv(files: Files, rootPath: string): { root: Value; others: { path: string; id: string; schema: Value }[] } {
  const ids = new Map<string, string>();
  let n = 0;
  for (const [path, schema] of files.schemas) {
    const own = isObj(schema) && typeof schema["$id"] === "string" && /^[A-Za-z][A-Za-z0-9+.-]*:/.test(schema["$id"]) ? schema["$id"] : undefined;
    ids.set(path, own ?? `motherload:${n++}`);
  }
  const prepare = (path: string, schema: Value): Value => {
    const rewritten = mapRefs(schema, (ref) => {
      const target = fileOf(ref, path);
      const id = target && ids.get(target.path);
      return id ? `${id}${target.fragment ? `#${target.fragment}` : ""}` : ref;
    });
    return isObj(rewritten) ? { ...rewritten, $id: ids.get(path)! } : rewritten;
  };
  return {
    root: prepare(rootPath, files.schemas.get(rootPath)!),
    others: [...files.schemas].filter(([path]) => path !== rootPath).map(([path, schema]) => ({ path, id: ids.get(path)!, schema: prepare(path, schema) })),
  };
}
