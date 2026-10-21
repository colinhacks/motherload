// Rolldown bundles main.js into dist/rolldown/main.mjs, each data file through motherload/vite.
import motherload from "motherload/vite";

export default {
  input: `${import.meta.dirname}/main.js`,
  platform: "node",
  plugins: [motherload()],
  output: { file: `${import.meta.dirname}/dist/rolldown/main.mjs`, format: "es" },
};
