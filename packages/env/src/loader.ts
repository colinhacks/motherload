// A `.env` file's module (DESIGN.md, "The `.env` module"): imported for its effect,
// `import "./.env"`, it declares each variable on `NodeJS.ProcessEnv` and, when it runs, checks that
// each is set, having loaded the file into `process.env` first everywhere but in a bundle.
import { parseEnv } from "node:util";
import { basename } from "node:path";
import { moduleLoader, propertyName, type LoadHost, type ModuleText, type Parsed } from "@motherload/core";

/** Node's grammar (`util.parseEnv`), the one `process.loadEnvFile` reads the file with at run time: every value is a string, `${NAME}` is not expanded, and a line that is not an assignment is ignored. */
export function parseEnvFile(source: string): Parsed {
  const parsed = parseEnv(source);
  const out: Record<string, string> = {};
  for (const key of Object.keys(parsed)) out[key] = parsed[key]!;
  return { ok: true, value: out };
}

/**
 * The types declare each variable on `NodeJS.ProcessEnv`, and the module holds the names and none of
 * the values. Where it runs as it was made, under the preload, Vitest and Jest, its own URL is the
 * file, which it reads into `process.env`, setting each variable the environment does not already
 * set, with `util.parseEnv`, so that it does what `process.loadEnvFile` does (DESIGN.md, "The `.env`
 * module") to whichever `process` is in scope: Jest gives each test file a copy of `process.env`,
 * which `process.loadEnvFile` never writes to. A bundle reads no file and holds no path, since it runs
 * wherever it is deployed: its variables come from the environment there. Either way the module then
 * throws, naming every variable the file declares that is still unset, so that each `string` it
 * types is true. It is an ES module with no exports, so that a bundler imports it for its effect alone.
 */
export function envModule(source: string, path: string, host?: LoadHost): ModuleText {
  const parsed = parseEnvFile(source);
  const keys = parsed.ok ? Object.keys(parsed.value as Record<string, string>) : [];
  const name = basename(path);
  // A caller that does not say where the module runs gets the check on the module's URL: the file's
  // own under the preload, and a bundle's chunk, which is not the file, in most bundlers.
  const load = host?.bundle
    ? []
    : [
        `if (typeof import.meta.url === "string" && import.meta.url.endsWith(${JSON.stringify(`/${name}`)})) {`,
        `  let text;`,
        `  try { text = process.getBuiltinModule("node:fs").readFileSync(new URL(import.meta.url), "utf8"); } catch (error) { if (error?.code !== "ENOENT") throw error; }`,
        `  const vars = text === undefined ? {} : process.getBuiltinModule("node:util").parseEnv(text);`,
        `  for (const key of Object.keys(vars)) process.env[key] ??= vars[key];`,
        `}`,
      ];
  const hint = host?.bundle ? ` A bundle does not read ${name}: set them where it runs, or start it with node --env-file=${name}.` : "";
  const check = keys.length
    ? [
        `const unset = ${JSON.stringify(keys)}.filter((key) => process.env[key] === undefined);`,
        `if (unset.length) throw new Error(${JSON.stringify(`Motherload: ${name} declares `)} + unset.join(", ") + ${JSON.stringify(`, which the environment does not set.${hint}`)});`,
      ]
    : [];
  return {
    code: [...load, ...check, `export {};`, ""].join("\n"),
    types: ["declare global {", "  namespace NodeJS {", "    interface ProcessEnv {", ...keys.map((key) => `      ${propertyName(key)}: string;`), "    }", "  }", "}", "export {};", ""].join("\n"),
    problems: parsed.ok ? [] : parsed.problems,
  };
}

/**
 * `.env` files are matched by name, `.env`, `.env.local`, or by suffix, `prod.env`; a tsconfig entry
 * reaches `.env.local` only if it lists `.env.local` in full. A missing one may load, under `strict: false`, as
 * the module of an empty file, which declares, loads and checks nothing.
 */
export const loader = { ...moduleLoader("@motherload/env", [".env"], /(?:(?:^|[\\/])\.env(?:\.[^\\/]+)?|\.env)$/, envModule), optional: () => true };
