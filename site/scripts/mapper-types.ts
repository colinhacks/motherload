// Runs Motherload's content mapper on the docs page's example files. Reads `[{ path, text }]` as
// JSON on stdin and writes `[{ types, problems }]`: the module TypeScript gets for each file under
// `tsc --runExternalCode`. lib/remark-mapper.ts calls it, in a process of its own, because the site
// build bundles its own modules and Motherload's source runs on Node as it is.
import { plugin } from "../../src/plugin.ts";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const files = JSON.parse(input) as { path: string; text: string }[];
const results = [];
for (const file of files) results.push(await plugin.types(file.text, file.path));
process.stdout.write(JSON.stringify(results));
