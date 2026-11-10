// Deliberately simplified, offline DOM: this does not render the full application.
// CSS comes unchanged from globals.css. Never report these results as Preview QA.
export const shellCases = [
  {route: '/', wrapper: 'management-table-wrap', table: 'management-table'},
  {route: '/delivery', wrapper: 'delivery-table-wrap', table: 'delivery-table'},
];
export const shellWidths = [360, 768, 1440];

export function shellFixture(css, {wrapper, table}) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'none'; connect-src 'none'">
<style>${css}</style></head><body>
<main class="shell"><aside class="sidebar"></aside><section class="workspace">
<section class="panel"><div class="${wrapper}"><div class="${table}">Synthetic table</div></div></section>
</section></main><script>
const wrapper = document.querySelector('.${wrapper}');
const table = document.querySelector('.${table}');
wrapper.scrollLeft = wrapper.scrollWidth;
const result = {
  viewport: innerWidth, document: document.documentElement.scrollWidth,
  workspace: document.querySelector('.workspace').getBoundingClientRect().width,
  client: wrapper.clientWidth, scroll: wrapper.scrollWidth, scrollLeft: wrapper.scrollLeft,
  overflowX: getComputedStyle(wrapper).overflowX,
  finalColumnReachable: table.getBoundingClientRect().right <= wrapper.getBoundingClientRect().right + 1
};
const output = document.createElement('script');
output.id = 'shell-metrics'; output.type = 'application/json';
output.textContent = JSON.stringify(result); document.body.append(output);
</script></body></html>`;
}

// A counterfactual control, never shipped CSS. Refuse partial/unrecognised fixes.
export function baselineShellCss(css) {
  const changes = [
    ['grid-template-columns: 230px minmax(0, 1fr)', 'grid-template-columns: 230px 1fr'],
    ['grid-template-columns: 74px minmax(0, 1fr)', 'grid-template-columns: 74px 1fr'],
    ['.workspace { min-width: 0; ', '.workspace { '],
  ];
  for (const [fixed, baseline] of changes) {
    if (css.split(fixed).length !== 2) throw Error(`Expected exactly one ${fixed}`);
    css = css.replace(fixed, baseline);
  }
  return css;
}
