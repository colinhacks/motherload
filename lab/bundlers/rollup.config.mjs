// Rollup bundles main.js into dist/rollup/main.mjs, each data file through motherload/vite.
import motherload from "motherload/vite";

export default {
  input: `${import.meta.dirname}/main.js`,
  plugins: [motherload()],
  output: { file: `${import.meta.dirname}/dist/rollup/main.mjs`, format: "es" },
};
