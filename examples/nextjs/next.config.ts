import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the build script runs the type check first
  typescript: { ignoreBuildErrors: true },
  turbopack: {
    // Only because this example sits inside the Motherload repository, whose own lockfile Next.js
    // would otherwise take for the workspace root. An app of its own drops this line.
    root: import.meta.dirname,
    // Each data file becomes a module, for the server and the browser alike.
    rules: {
      "*.{toml,csv,md}": { loaders: ["motherload/turbopack"], as: "*.js" },
    },
  },
  // The same loader for `next dev --webpack` and `next build --webpack`.
  webpack(config) {
    config.module.rules.push({ test: /\.(toml|csv|md)$/, use: "motherload/webpack" });
    return config;
  },
};

export default nextConfig;
