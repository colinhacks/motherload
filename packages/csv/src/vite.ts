// Vite, Rollup and Rolldown: `plugins: [csv()]`, from `import csv from "@motherload/csv/vite"`.
import { standalone, toVitePlugin } from "@motherload/core";
import { loader } from "./loader.ts";

export default function csv() {
  return toVitePlugin(standalone(loader));
}
