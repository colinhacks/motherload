import { defineConfig } from "vite";
import motherload from "motherload/vite";

export default defineConfig({
  // Motherload: each data file becomes a module holding its parsed value, in the dev server,
  // the build and Vitest.
  plugins: [motherload()],
});
