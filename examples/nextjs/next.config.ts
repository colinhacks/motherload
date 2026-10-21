import type { NextConfig } from "next";
import { withMotherload } from "motherload/next";

const nextConfig: NextConfig = {
  turbopack: {
    // Only because this example sits inside the Motherload repository, whose own lockfile Next.js
    // would otherwise take for the workspace root. An app of its own drops this line.
    root: import.meta.dirname,
  },
};

// Motherload: each data file becomes a module, for the server and the browser alike, under
// Turbopack and webpack; and next build's type check runs the content mapper.
export default withMotherload(nextConfig);
