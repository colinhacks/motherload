// Vite, Rollup and Rolldown: `plugins: [jsonc()]`, from `import jsonc from "@motherload/jsonc/vite"`.
import { standalone, toVitePlugin } from "@motherload/core";
import { loader } from "./loader.ts";

export default function jsonc() {
  return toVitePlugin(standalone(loader));
}
