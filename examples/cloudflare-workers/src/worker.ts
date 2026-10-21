// Each data file is a module: the type check types it, and motherload/vite builds it into the
// Worker's bundle.
import { site } from "../site";

export default {
  fetch() {
    return Response.json(site());
  },
} satisfies ExportedHandler<Cloudflare.Env>;
