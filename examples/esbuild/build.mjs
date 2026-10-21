import * as esbuild from "esbuild";
import motherload from "motherload/esbuild";

await esbuild.build({
  entryPoints: ["main.ts"],
  bundle: true, // each data file goes into the one file as its value
  platform: "node",
  format: "esm",
  plugins: [motherload()], // turns each data file into a module at build time
  outfile: "dist/main.mjs",
});
console.log("built dist/main.mjs");
