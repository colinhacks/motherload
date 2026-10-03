// esbuild through the bare adapter and through unplugin's esbuild adapter; same plugin object.
import { build } from "esbuild";
import { writeFileSync, mkdirSync } from "node:fs";
import bare from "universal-toml/esbuild";
import { universalToml } from "universal-toml/unplugin";

mkdirSync("dist", { recursive: true });
for (const [label, plugin] of [["bare", bare], ["unplugin", universalToml.esbuild()]]) {
  const result = await build({ entryPoints: ["main.ts"], bundle: true, format: "esm", platform: "node", write: false, plugins: [plugin], logLevel: "silent" });
  const text = result.outputFiles[0].text;
  writeFileSync(`dist/main.${label}.mjs`, text);
  console.log(`${label}: errors=${result.errors.length} warnings=${result.warnings.length} bytes=${text.length} hasLoadedBy=${text.includes('"universal-toml"')}`);
}
