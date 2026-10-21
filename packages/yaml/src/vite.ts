// Vite, Rollup and Rolldown: `plugins: [yaml()]`, from `import yaml from "@motherload/yaml/vite"`.
import { standalone, toVitePlugin } from "@motherload/core";
import { loader } from "./loader.ts";

export default function yaml() {
  return toVitePlugin(standalone(loader));
}
