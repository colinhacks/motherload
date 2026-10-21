// esbuild (and Bun.build): `plugins: [yaml()]`, from `import yaml from "@motherload/yaml/esbuild"`.
import { standalone, toEsbuildPlugin } from "@motherload/core";
import { loader } from "./loader.ts";

export default function yaml() {
  return toEsbuildPlugin(standalone(loader));
}
