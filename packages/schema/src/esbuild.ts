// esbuild (and Bun.build): `plugins: [schema()]`, from `import schema from "@motherload/schema/esbuild"`.
import { standalone, toEsbuildPlugin } from "@motherload/core";
import { loader } from "./loader.ts";

export default function schema() {
  return toEsbuildPlugin(standalone(loader));
}
