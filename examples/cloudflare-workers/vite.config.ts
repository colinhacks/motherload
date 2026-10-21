import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import motherload from "motherload/vite";

export default defineConfig({
  plugins: [motherload(), cloudflare()],
});
