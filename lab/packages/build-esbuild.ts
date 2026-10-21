// Bundles main.ts with the three packages' esbuild plugins into dist/main.mjs, which imports
// nothing. The JSONC plugin comes before the schema plugin, and leaves user.schema.jsonc to it.
import { build } from "esbuild";
import jsonc from "@motherload/jsonc/esbuild";
import schema from "@motherload/schema/esbuild";
import toml from "@motherload/toml/esbuild";

const result = await build({ entryPoints: [new URL("./main.ts", import.meta.url).pathname], outfile: new URL("./dist/main.mjs", import.meta.url).pathname, bundle: true, format: "esm", platform: "node", plugins: [jsonc(), schema(), toml()], logLevel: "warning", metafile: true });
const inputs = Object.keys(result.metafile.inputs);
console.log(`errors=${result.errors.length} inputs=${inputs.length} node_modules=${inputs.filter((i) => i.includes("node_modules")).length}`);
