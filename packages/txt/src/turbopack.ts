// The webpack loader under Turbopack's name, for Next.js, which runs webpack loaders:
//   turbopack: { rules: { "*.txt": { loaders: ["@motherload/txt/turbopack"], as: "*.js" } } }
export { default } from "./webpack.ts";
