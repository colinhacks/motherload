// esbuild (and Bun.build): `plugins: [txt()]`, from `import txt from "@motherload/txt/esbuild"`.
import { standalone, toEsbuildPlugin } from "@motherload/core";
import { loader } from "./loader.ts";

export default function txt() {
  return toEsbuildPlugin(standalone(loader));
}
