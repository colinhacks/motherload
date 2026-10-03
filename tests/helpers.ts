import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const TSC = `${ROOT}node_modules/.bin/tsc`;

/** Evaluates generated module code as an ES module. */
export async function evaluate(code: string): Promise<Record<string, any>> {
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}

/** Runs a command and returns its exit status and output; never throws on a non-zero exit. */
export function run(command: string, args: string[], cwd = ROOT): { status: number | null; out: string } {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } });
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}
