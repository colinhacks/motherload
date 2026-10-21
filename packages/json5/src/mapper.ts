// The content mapper process: tsc spawns `node src/mapper.ts` in this package and speaks JSON-RPC
// over stdio.
import { serve, standalone, toMapperHandlers } from "@motherload/core";
import { loader } from "./loader.ts";

serve(toMapperHandlers(standalone(loader)));
