// The webpack loader under Turbopack's name, for Next.js, which runs webpack loaders:
//   turbopack: { rules: { "*.env": { loaders: ["@motherload/env/turbopack"], as: "*.js" } } }
export { default } from "./webpack.ts";
