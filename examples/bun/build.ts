import motherload from "motherload/esbuild";

// Motherload's esbuild plugin builds each data file into the bundle, which then runs without the preload
const result = await Bun.build({
  entrypoints: ["main.ts"],
  target: "bun",
  plugins: [motherload()],
  outdir: "dist",
});
for (const output of result.outputs) console.log(`built ${output.path}`);
