// esbuild: `plugins: [motherload]`, from `import motherload from "motherload/esbuild"`.
import { plugin } from "./plugin.ts";
import { toEsbuildPlugin } from "./universal.ts";

export default toEsbuildPlugin(plugin);
