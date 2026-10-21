// esbuild (and Bun.build): `plugins: [jsonc()]`, from `import jsonc from "@motherload/jsonc/esbuild"`.
import { standalone, toEsbuildPlugin } from "@motherload/core";
import { loader } from "./loader.ts";

export default function jsonc() {
  return toEsbuildPlugin(standalone(loader));
}
