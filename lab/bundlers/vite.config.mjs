// Vite builds main.js for Node into dist/vite/main.mjs, each data file through motherload/vite.
import motherload from "motherload/vite";

export default {
  root: import.meta.dirname,
  logLevel: "warn",
  plugins: [motherload()],
  build: { ssr: "main.js", outDir: "dist/vite", emptyOutDir: true, rollupOptions: { output: { entryFileNames: "main.mjs" } } },
};
