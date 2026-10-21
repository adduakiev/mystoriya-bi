// Aggregate-only collector. Environment secrets never enter the packet.
import fs from "node:fs";
import { parseEnv } from "node:util";
import { collectInput } from "../web/lib/operating-collector.ts";
import { validateInput } from "../web/lib/operating-core.ts";
if (!process.env.BI_ACCESS_PASSWORD && fs.existsSync("web/.env.local"))
  process.env.BI_ACCESS_PASSWORD = parseEnv(fs.readFileSync("web/.env.local","utf8").replace(/^\uFEFF/,"")).BI_ACCESS_PASSWORD || "";
const url = process.env.BI_SUPABASE_URL;
const key = process.env.BI_SUPABASE_ANON_KEY;
const password = process.env.BI_ACCESS_PASSWORD;
if (!password) throw Error("Configure BI_ACCESS_PASSWORD securely");
let packet;
if (process.env.BI_LOCAL_URL) {
  const base = new URL(process.env.BI_LOCAL_URL);
  if (!["localhost","127.0.0.1"].includes(base.hostname)) throw Error("BI_LOCAL_URL must be loopback");
  const login = await fetch(new URL("/api/auth/login",base), {method:"POST",redirect:"manual",
    body:new URLSearchParams({password,next:"/operating"}),signal:AbortSignal.timeout(15000)});
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  if (login.status !== 303 || !cookie || login.headers.get("location")?.includes("/login"))
    throw Error("Local BI authentication failed");
  const response = await fetch(new URL("/api/operating/input",base), {headers:{cookie},
    signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw Error("Local aggregate collector unavailable");
  packet = await response.json();
} else {
  if (!url || !key || new URL(url).protocol !== "https:") throw Error("Configure HTTPS BI_SUPABASE_URL and BI_SUPABASE_ANON_KEY, or BI_LOCAL_URL");
  packet = await collectInput(async name => {
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_password: password }), signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw Error("Source unavailable");
  const raw = await response.json();
  return Array.isArray(raw) && raw.length === 1 ? raw[0][name] ?? raw[0] : raw;
  });
}
validateInput(packet);
fs.mkdirSync(".agents/runtime", { recursive: true });
fs.writeFileSync(".agents/runtime/collected-input.json", JSON.stringify(packet, null, 2));
console.log(JSON.stringify({ status: "collected", metrics: packet.evidence.length,
  unavailable: packet.evidence.filter(e => e.value === null).length }));
