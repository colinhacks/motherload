// esbuild (and Bun.build): `plugins: [md()]`, from `import md from "@motherload/md/esbuild"`.
import { standalone, toEsbuildPlugin } from "@motherload/core";
import { loader } from "./loader.ts";

export default function md() {
  return toEsbuildPlugin(standalone(loader));
}
