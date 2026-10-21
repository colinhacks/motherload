// Vite, Rollup and Rolldown: `plugins: [json5()]`, from `import json5 from "@motherload/json5/vite"`.
import { standalone, toVitePlugin } from "@motherload/core";
import { loader } from "./loader.ts";

export default function json5() {
  return toVitePlugin(standalone(loader));
}
