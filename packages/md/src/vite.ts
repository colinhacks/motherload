// Vite, Rollup and Rolldown: `plugins: [md()]`, from `import md from "@motherload/md/vite"`.
import { standalone, toVitePlugin } from "@motherload/core";
import { loader } from "./loader.ts";

export default function md() {
  return toVitePlugin(standalone(loader));
}
