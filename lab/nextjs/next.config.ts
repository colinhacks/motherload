import { join } from "node:path";
import type { NextConfig } from "next";
import { withMotherload } from "motherload/next";

const nextConfig: NextConfig = {
  turbopack: {
    // Only because motherload is this repository, outside this directory, and Turbopack resolves
    // nothing outside its root. An app that installs motherload drops this line.
    root: join(import.meta.dirname, "../.."),
  },
};

// withMotherload sends every format but .env through motherload/turbopack and motherload/webpack,
// for the server and the browser, and runs `tsc --noEmit --runExternalCode` inside next build in
// place of Next's own check, which cannot run the content mapper.
export default withMotherload(nextConfig);
