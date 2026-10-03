// next.config: turbopack: { rules: { "*.toml": { loaders: ["universal-toml/turbopack-loader"], as: "*.js" } } }
import { plugin } from "./plugin.ts";
import { toWebpackLoader } from "./universal.ts";

export default toWebpackLoader(plugin);
