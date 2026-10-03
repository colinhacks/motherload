import { plugin } from "universal-toml";
import { toBunPlugin } from "universal-toml/universal";

const result = await Bun.build({ entrypoints: [new URL("./main.ts", import.meta.url).pathname], target: "node", format: "esm", plugins: [toBunPlugin(plugin)] });
const text = await result.outputs[0]!.text();
console.log(`success=${result.success} logs=${result.logs.length} hasLoadedBy=${text.includes("universal-toml")}`);
