// Vite, Rollup and Rolldown: `plugins: [toml()]`, from `import toml from "@motherload/toml/vite"`.
import { standalone, toVitePlugin } from "@motherload/core";
import { loader } from "./loader.ts";

export default function toml() {
  return toVitePlugin(standalone(loader));
}
