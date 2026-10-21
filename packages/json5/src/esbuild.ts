// esbuild (and Bun.build): `plugins: [json5()]`, from `import json5 from "@motherload/json5/esbuild"`.
import { standalone, toEsbuildPlugin } from "@motherload/core";
import { loader } from "./loader.ts";

export default function json5() {
  return toEsbuildPlugin(standalone(loader));
}
