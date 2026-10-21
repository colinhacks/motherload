// esbuild (and Bun.build): `plugins: [toml()]`, from `import toml from "@motherload/toml/esbuild"`.
import { standalone, toEsbuildPlugin } from "@motherload/core";
import { loader } from "./loader.ts";

export default function toml() {
  return toEsbuildPlugin(standalone(loader));
}
