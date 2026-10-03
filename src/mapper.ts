// The content mapper process: tsc spawns `node src/mapper.ts` (cwd = this package) and speaks
// JSON-RPC over stdio.
import { serve } from "./rpc.ts";
import { plugin } from "./plugin.ts";
import { toMapperHandlers } from "./universal.ts";

serve(toMapperHandlers(plugin));
