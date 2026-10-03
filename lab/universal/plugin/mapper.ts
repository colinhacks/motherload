// The content mapper process: tsc spawns `node mapper.ts` (cwd = this directory) and
// speaks JSON-RPC over stdio. Everything file-type specific comes from plugin.ts.
import { serve } from "./rpc.ts";
import { plugin } from "./plugin.ts";
import { toMapperHandlers } from "./universal.ts";

serve(toMapperHandlers(plugin));
