// esbuild (and Bun.build): `plugins: [motherload()]`, from `import motherload from "motherload/esbuild"`.
// A function, as every plugin a bundler registers in code is, so options can be added later.
import { toEsbuildPlugin } from "@motherload/core";
import { plugin } from "./plugin.ts";

export default function motherload() {
  return toEsbuildPlugin(plugin);
}
