// esbuild (and Bun.build): `plugins: [csv()]`, from `import csv from "@motherload/csv/esbuild"`.
import { standalone, toEsbuildPlugin } from "@motherload/core";
import { loader } from "./loader.ts";

export default function csv() {
  return toEsbuildPlugin(standalone(loader));
}
