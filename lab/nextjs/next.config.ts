import { join } from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // next build's own type check runs tsc without --runExternalCode, so it cannot run content
  // mappers; the typecheck script runs tsc with it before next build.
  typescript: { ignoreBuildErrors: true },
  turbopack: {
    // Only because motherload is this repository, outside this directory, and Turbopack resolves
    // nothing outside its root. An app that installs motherload drops this line.
    root: join(import.meta.dirname, "../.."),
    // Each data file becomes a module, for the server and the browser alike.
    rules: {
      "*.{toml,yaml,yml,jsonc,json5,csv,tsv,txt,md}": {
        loaders: ["motherload/turbopack"],
        as: "*.js",
      },
    },
  },
  // The same loader for `next dev --webpack` and `next build --webpack`.
  webpack(config) {
    config.module.rules.push({ test: /\.(toml|ya?ml|jsonc|json5|[ct]sv|txt|md)$/, use: "motherload/webpack" });
    return config;
  },
};

export default nextConfig;
