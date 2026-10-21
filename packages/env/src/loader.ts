// A `.env` file's module (DESIGN.md, "The `.env` module"): imported for its effect,
// `import "./.env"`, it loads the file into `process.env` when it runs and declares each variable
// on `NodeJS.ProcessEnv`.
import { parseEnv } from "node:util";
import { basename, relative } from "node:path";
import { moduleLoader, propertyName, type ModuleText, type Parsed } from "@motherload/core";

/** Node's grammar (`util.parseEnv`), the one `process.loadEnvFile` reads the file with at run time: every value is a string, `${NAME}` is not expanded, and a line that is not an assignment is ignored. */
export function parseEnvFile(source: string): Parsed {
  const parsed = parseEnv(source);
  const out: Record<string, string> = {};
  for (const key of Object.keys(parsed)) out[key] = parsed[key]!;
  return { ok: true, value: out };
}

/**
 * When the module runs, Node reads the file into `process.env` (`process.loadEnvFile`, which leaves
 * a variable the environment already sets), so no value is in the module, and the types declare
 * each variable on `NodeJS.ProcessEnv`. Under the preload the module's own URL is the file; in a
 * bundle the file is the same path from the working directory as at build time, and a missing
 * file loads nothing, as a deploy that sets its variables another way has none.
 */
export function envModule(source: string, path: string): ModuleText {
  const parsed = parseEnvFile(source);
  const keys = parsed.ok ? Object.keys(parsed.value as Record<string, string>) : [];
  const name = basename(path);
  const fromCwd = relative(process.cwd(), path) || name;
  return {
    code: [
      `const file = typeof import.meta.url === "string" && import.meta.url.endsWith(${JSON.stringify(`/${name}`)}) ? new URL(import.meta.url) : ${JSON.stringify(fromCwd)};`,
      `try { process.loadEnvFile(file); } catch (error) { if (error?.code !== "ENOENT") throw error; }`,
      "",
    ].join("\n"),
    types: ["declare global {", "  namespace NodeJS {", "    interface ProcessEnv {", ...keys.map((key) => `      ${propertyName(key)}: string;`), "    }", "  }", "}", "export {};", ""].join("\n"),
    problems: parsed.ok ? [] : parsed.problems,
  };
}

/** `.env` files are matched by name, `.env`, `.env.local`, or by suffix, `prod.env`; a tsconfig entry reaches `.env.local` only if it claims `.local`. */
export const loader = moduleLoader("@motherload/env", [".env"], /(?:(?:^|[\\/])\.env(?:\.[^\\/]+)?|\.env)$/, envModule);
