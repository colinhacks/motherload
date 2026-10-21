import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";
import motherload from "motherload/vite";

// The tests run inside workerd, with the Worker of wrangler.jsonc.
export default defineConfig({
  plugins: [motherload(), cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
});
