// The content mapper process: tsc spawns `node src/mapper.ts` (cwd = this package) and speaks
// JSON-RPC over stdio.
import { serve, toMapperHandlers } from "@motherload/core";
import { plugin } from "./plugin.ts";

serve(toMapperHandlers(plugin));
