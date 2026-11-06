import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// PREPARE ONLY: no Sales import is authorized. The installed writer is not
// atomic and the private source, provenance, access and rollback release gates
// remain closed. No flag, credentials or request input can enable writes here.
Deno.serve((req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ ok: false, code: "SALES_IMPORT_SAFETY_GATE" }), {
    status: 503,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
});
