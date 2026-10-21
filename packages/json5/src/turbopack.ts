// The webpack loader under Turbopack's name, for Next.js, which runs webpack loaders:
//   turbopack: { rules: { "*.json5": { loaders: ["@motherload/json5/turbopack"], as: "*.js" } } }
export { default } from "./webpack.ts";
