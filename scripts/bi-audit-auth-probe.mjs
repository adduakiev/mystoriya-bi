// Read-only, credential-free, bounded preview probe. No login submissions, cookies or protection bypass.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const audit = JSON.parse(fs.readFileSync(new URL('../docs/audit/2026-10-24/inventory.json', import.meta.url), 'utf8'));
export function previewOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.username || url.password || url.search || url.hash)
    throw Error('Provide an HTTPS preview origin without credentials, path, query or tokens');
  return url.origin;
}
async function loginShell(response) {
  if (response.status !== 200 || !response.headers.get('content-type')?.includes('text/html')) return false;
  const reader = response.body?.getReader();
  if (!reader) return false;
  const chunks = []; let size = 0;
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 256 * 1024) return false;
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const html = Buffer.concat(chunks).toString('utf8');
  return /action="\/api\/auth\/login"/.test(html) && /name="password"/.test(html);
}
export async function probePreview(base, fetcher = fetch) {
  const origin = previewOrigin(base);
  const paths = [...audit.routes.map(r=>r.path), ...audit.api.map(r=>r.path).filter(p=>p !== '/api/auth/login')];
  const results = [];
  for (const path of paths) {
    try {
      const options = {method:'GET', redirect:'manual', credentials:'omit', cache:'no-store', signal:AbortSignal.timeout(10000)};
      const response = await fetcher(`${origin}${path}`, options);
      const row = {path, method:'GET', status:response.status, follow_status:null, next_preserved:null,
        result:'UNEXPECTED_RESPONSE', evidence:'UNAUTHENTICATED_HTTP_ONLY'};
      if (path === '/login') row.result = await loginShell(response) && !response.headers.has('set-cookie') ? 'LOGIN_SHELL' : 'UNEXPECTED_RESPONSE';
      else if ([301,302,303,307,308].includes(response.status)) {
        const target = new URL(response.headers.get('location') || '', origin);
        if (target.origin === origin && target.pathname === '/login' && !target.username && !target.password && !response.headers.has('set-cookie')) {
          row.next_preserved = target.searchParams.get('next') === path;
          const followed = await fetcher(target.href, {...options, signal:AbortSignal.timeout(10000)});
          row.follow_status = followed.status;
          if (await loginShell(followed) && !followed.headers.has('set-cookie')) row.result = row.next_preserved ? 'DENIED_TO_LOGIN' : 'DENIED_TO_LOGIN_NEXT_ABSENT_OR_DIFFERENT';
        }
      } else if (response.status === 401 && response.headers.get('content-type')?.includes('application/json')) {
        // Do not record raw bodies, even on error. A status alone is not proof of handler correctness.
        row.result = 'DENIED_401_BODY_NOT_AUDITED';
      } else if (response.status === 403) row.result = 'BLOCKED_403_LAYER_UNVERIFIED';
      results.push(row);
    } catch (error) {
      results.push({path,method:'GET',result:'BLOCKED_NETWORK',code:error.cause?.code || error.code || error.name,evidence:'NO_HTTP_RESPONSE'});
    }
  }
  return {origin, observed_at:new Date().toISOString(), scope:'No credentials, browser, session, warehouse or rendered BI parity',results};
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw Error('Usage: node scripts/bi-audit-auth-probe.mjs https://EXACT-PREVIEW-ORIGIN');
  const report = await probePreview(process.argv[2]);
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  if (report.results.some(r=>!['LOGIN_SHELL','DENIED_TO_LOGIN','DENIED_401_BODY_NOT_AUDITED'].includes(r.result))) process.exitCode = 1;
}
