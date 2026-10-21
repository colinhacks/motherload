// The webpack loader under Turbopack's name, for Next.js, which runs webpack loaders:
//   turbopack: { rules: { "*.jsonc": { loaders: ["@motherload/jsonc/turbopack"], as: "*.js" } } }
export { default } from "./webpack.ts";
