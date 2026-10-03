import { plugin } from "./plugin.ts";
import { toEsbuildPlugin } from "./universal.ts";

export default toEsbuildPlugin(plugin);
