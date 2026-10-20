// Local authenticated smoke check. Password stays in memory; no HTML or cookies are persisted.
// Optional cockpit screenshot stays in ignored private runtime.
import fs from "node:fs";
import { createRequire } from "node:module";
import { parseEnv } from "node:util";
// Windows editors may add a BOM; keep the parsed secret only in process memory.
if (!process.env.BI_ACCESS_PASSWORD && fs.existsSync("web/.env.local"))
  process.env.BI_ACCESS_PASSWORD = parseEnv(fs.readFileSync("web/.env.local", "utf8").replace(/^\uFEFF/, "")).BI_ACCESS_PASSWORD || "";
const base = process.env.BI_TEST_URL || "http://localhost:3100";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw Error("Loopback test only");
if (!process.env.BI_ACCESS_PASSWORD) throw Error("BI_ACCESS_PASSWORD unavailable");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const report = { checked_at: new Date().toISOString(), pages: [], runtime_error_count: 0 };
let browser;
try {
  report.step = "launch-browser";
  browser = await chromium.launch({ headless: true,
    ...(process.env.BI_TEST_BROWSER ? { executablePath: process.env.BI_TEST_BROWSER } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  report.step = "authenticate";
  const response = await context.request.post(`${base}/api/auth/login`, {
    form: { password: process.env.BI_ACCESS_PASSWORD, next: "/digital" }, maxRedirects: 0
  });
  if (response.status() !== 303 || response.headers().location?.includes("login")) throw Error("Login failed");
  const page = await context.newPage();
  page.on("pageerror", () => { report.runtime_error_count++; });
  page.on("console", msg => { if (msg.type() === "error") report.runtime_error_count++; });
  const routes = ["/digital", "/digital/ads", "/digital/seo"];
  if (process.env.BI_TEST_OPERATING === "1") routes.push("/operating");
  for (const route of routes) {
    report.step = route;
    const r = await page.goto(base + route, { waitUntil: "networkidle", timeout: 90000 });
    const text = await page.locator("body").innerText();
    const login = new URL(page.url()).pathname === "/login";
    const errors = /Application error|Internal Server Error|не вдалося|Something went wrong/i.test(text);
    const dates = [...new Set(text.match(/\b20\d{2}-\d{2}-\d{2}\b/g) ?? [])];
    const tables = await page.locator(".table-row:not(.table-head)").count();
    const periodLabels = await page.locator(".pnl-source-chip").allTextContents();
    report.pages.push({ route, status: r?.status(), login, errors, source_dates_visible: dates, table_rows: tables,
      period_labels: periodLabels.filter(v=>/\d/.test(v)),
      unknown_marker: text.includes("—"), freshness_note: text.includes("Дати даних:"),
      snapshot_note: text.includes("30-денні знімки") });
    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    report.pages.at(-1).mobile_document_overflow = overflow;
    await page.setViewportSize({ width: 1440, height: 1000 });
    if (route === "/operating") {
      fs.mkdirSync(".agents/runtime",{recursive:true});
      await page.screenshot({path:".agents/runtime/operating-desktop.png",fullPage:true});
      const taskResponse = await context.request.get(`${base}/api/operating/tasks`);
      report.task_api_status = taskResponse.status();
      const denied = await context.request.post(`${base}/api/operating/tasks`,{
        headers:{"Origin":"https://invalid.example"},data:{source_run_id:"test",recommendation_id:"test"}
      });
      report.cross_origin_mutation_status = denied.status();
      if (taskResponse.status() !== 200 || denied.status() !== 403) process.exitCode=1;
    }
    if (login || errors || r?.status() !== 200) process.exitCode = 1;
  }
  if (report.runtime_error_count) process.exitCode = 1;
} catch {
  report.failure = "Live check failed; diagnostics deliberately omit request data and secrets.";
  process.exitCode = 1;
} finally {
  await browser?.close();
  fs.mkdirSync(".agents/runtime", { recursive: true });
  fs.writeFileSync(".agents/runtime/live-check.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
