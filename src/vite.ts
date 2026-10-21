// Vite, Rollup and Rolldown: `plugins: [motherload()]`, from `import motherload from "motherload/vite"`.
// Vitest takes the same plugin.
import { toVitePlugin } from "@motherload/core";
import { plugin } from "./plugin.ts";

export default function motherload() {
  return toVitePlugin(plugin);
}
