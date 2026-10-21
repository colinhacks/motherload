// esbuild (and Bun.build): `plugins: [env()]`, from `import env from "@motherload/env/esbuild"`.
import { standalone, toEsbuildPlugin } from "@motherload/core";
import { loader } from "./loader.ts";

export default function env() {
  return toEsbuildPlugin(standalone(loader));
}
