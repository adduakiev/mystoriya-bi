import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const {createElement} = require("react");
const {renderToStaticMarkup} = require("react-dom/server");

function loadTsx(path, dependencies = {}) {
  const {outputText} = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022}
  });
  const module = {exports: {}};
  new Function("require", "module", "exports", outputText)(
    name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), module, module.exports
  );
  return module.exports;
}

// Observe the actual Next Link props: SSR HTML alone cannot prove prefetch=false.
function captureLinks() {
  const links = [];
  function Link({prefetch, ...props}) {
    links.push({prefetch, ...props});
    return createElement("a", props);
  }
  return {links, Link};
}

const sidebarRoutes = ["/operating", "/", "/delivery", "/aggregators", "/locations",
  "/dynamics", "/pnl", "/digital", "/explorer", "/insights"];

for (const lfl of [false, true]) {
  test(`every sidebar route disables prefetch and preserves navigation (LFL=${lfl})`, () => {
    const {links, Link} = captureLinks();
    const {DashboardSidebar} = loadTsx("../components/DashboardSidebar.tsx", {
      "next/link": {default: Link},
      "@/components/SidebarBrand": {SidebarBrand: () => null}
    });
    for (const activeHref of sidebarRoutes) {
      links.length = 0;
      renderToStaticMarkup(createElement(DashboardSidebar, {
        activeHref, lfl, statusTitle: "Fixture", statusDetail: "Fixture"
      }));
      assert.deepEqual(links.map(link => link.href), sidebarRoutes.map(href => lfl ? `${href}?lfl=1` : href));
      for (const [index, link] of links.entries()) {
        assert.equal(link.prefetch, false, `${link.href} must explicitly disable Next Link prefetch`);
        assert.equal(link.className, sidebarRoutes[index] === activeHref ? "nav-item active" : "nav-item");
      }
    }
  });
}

test("Digital overview and every report tab disable prefetch for every active tab", () => {
  const {links, Link} = captureLinks();
  const {DIGITAL_REPORTS} = loadTsx("../lib/digital-reports.ts");
  const {DigitalTabs} = loadTsx("../components/DigitalReportShell.tsx", {
    "next/link": {default: Link},
    "@/components/DashboardSidebar": {DashboardSidebar: () => null},
    "@/lib/digital-reports": {DIGITAL_REPORTS}
  });
  const tabs = [{slug: "overview", label: "Огляд"}, ...DIGITAL_REPORTS];
  for (const active of tabs.map(tab => tab.slug)) {
    links.length = 0;
    renderToStaticMarkup(createElement(DigitalTabs, {active}));
    assert.deepEqual(links.map(link => link.href), ["/digital", ...DIGITAL_REPORTS.map(report => `/digital/${report.slug}`)]);
    assert.deepEqual(links.map(link => link.children), tabs.map(tab => tab.label));
    for (const [index, link] of links.entries()) {
      assert.equal(link.prefetch, false, `${link.href} must explicitly disable Next Link prefetch`);
      assert.equal(link.className, tabs[index].slug === active ? "active" : "");
    }
  }
});
