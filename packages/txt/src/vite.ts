// Vite, Rollup and Rolldown: `plugins: [txt()]`, from `import txt from "@motherload/txt/vite"`.
import { standalone, toVitePlugin } from "@motherload/core";
import { loader } from "./loader.ts";

export default function txt() {
  return toVitePlugin(standalone(loader));
}
