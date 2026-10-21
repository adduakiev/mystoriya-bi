import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, createAccessToken, safeEqual } from "@/lib/auth";
import { TaskError, object, exactKeys } from "@/lib/operating-tasks";
import { readTasks, addCouncilTask, updateTask } from "@/lib/operating-task-store";
import { collectInput } from "@/lib/operating-collector";
import { callBiRpc } from "@/lib/data/source";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {"Cache-Control": "no-store"};
async function authorize(request: NextRequest, mutation = false) {
  const secret = process.env.BI_ACCESS_PASSWORD;
  if (!secret) throw new TaskError("BI authentication is not configured", 503);
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value || "";
  if (!safeEqual(token, await createAccessToken(secret))) throw new TaskError("Unauthorized", 401);
  if (mutation && (request.headers.get("origin") !== request.nextUrl.origin || request.headers.get("sec-fetch-site") === "cross-site")) throw new TaskError("Same-origin request required", 403);
}
async function body(request: NextRequest) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new TaskError("JSON required", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new TaskError("Body required");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const {value, done} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 16384) { await reader.cancel(); throw new TaskError("Body too large", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return object(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
  catch (error) { if (error instanceof TaskError) throw error; throw new TaskError("Invalid JSON"); }
}
function failure(error: unknown) { return NextResponse.json({error: error instanceof TaskError ? error.message : "Task storage operation failed"}, {status: error instanceof TaskError ? error.status : 503, headers}); }
export async function GET(request: NextRequest) {
  try { await authorize(request); return NextResponse.json({tasks: await readTasks(), persistence: "local"}, {headers}); }
  catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    await authorize(request, true); const input = await body(request);
    exactKeys(input, ["source_run_id", "recommendation_id"]);
    const packet = await collectInput(name => callBiRpc(name));
    return NextResponse.json({task: await addCouncilTask(input.source_run_id, input.recommendation_id, packet)}, {status: 201, headers});
  } catch (error) { return failure(error); }
}
export async function PATCH(request: NextRequest) {
  try { await authorize(request, true); return NextResponse.json({task: await updateTask(await body(request))}, {headers}); }
  catch (error) { return failure(error); }
}
