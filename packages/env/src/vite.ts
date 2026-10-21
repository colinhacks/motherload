// Vite, Rollup and Rolldown: `plugins: [env()]`, from `import env from "@motherload/env/vite"`.
import { standalone, toVitePlugin } from "@motherload/core";
import { loader } from "./loader.ts";

export default function env() {
  return toVitePlugin(standalone(loader));
}
