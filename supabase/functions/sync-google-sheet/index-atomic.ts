// Atomic release entrypoint, selected by supabase/config.toml. Deploy with the v3 SQL
// protocol; its database policy remains disabled until release verification.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleAtomicSalesRequest } from "./atomic-sales-handler.mjs";
Deno.serve((req: Request) => handleAtomicSalesRequest(req, {
  envGet: (name: string) => Deno.env.get(name)
}));
