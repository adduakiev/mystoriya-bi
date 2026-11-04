import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { runPrivateSalesHeaderProbe, privateSalesHeaderProbeCli } from '../../scripts/sales-private-header-probe.mjs';

test('one-shot probe refuses accidental invocation before secret access or network', async () => {
  const deny = () => assert.fail('must not touch credential or network');
  for (const args of [undefined, [], ['--help'], ['--read-only', '--write'], ['--read-only=1']]) {
    const result = await runPrivateSalesHeaderProbe(args, { readSecret: deny, fetchImpl: deny });
    assert.deepEqual(Object.keys(result), ['code', 'timestamp']);
    assert.equal(result.code, 'FAIL');
  }
});

test('missing/throwing owner secret fails without transport and exceptions never leave boundary', async () => {
  const deny = () => assert.fail('must not make a request');
  for (const readSecret of [() => undefined, () => { throw Error('private-secret-canary'); }]) {
    const result = await runPrivateSalesHeaderProbe(['--read-only'], { readSecret, fetchImpl: deny });
    assert.equal(result.code, 'FAIL');
    assert.equal(JSON.stringify(result).includes('private-secret-canary'), false);
  }
});

test('automated probe uses only the named server secret and readonly OAuth plus header GET', async () => {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const secret = JSON.stringify({ type: 'service_account', project_id: 'myastoriya-bi',
    client_email: 'myastoriya-bi-sheets-reader@myastoriya-bi.iam.gserviceaccount.com',
    token_uri: 'https://oauth2.googleapis.com/token', private_key_id: 'a'.repeat(40),
    private_key: `-----BEGIN PRIVATE KEY-----\n${Buffer.from(await crypto.subtle.exportKey('pkcs8', pair.privateKey)).toString('base64')}\n-----END PRIVATE KEY-----\n` });
  const range = "'Данние короткі'!A1:N1";
  const header = ['', '', '', '', '', 'Обліковий день', 'Зі складу', 'Бренд', 'Власність', 'Доставка',
    'Тип замовлення', 'Сума зі знижкою, грн.', 'Чеків', 'Націнка, грн.'];
  let reads = 0;
  const calls = [];
  const result = await runPrivateSalesHeaderProbe(['--read-only'], {
    readSecret(name) { assert.equal(name, 'GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON'); reads++; return secret; },
    fetchImpl: async (url, init) => {
      calls.push(url);
      assert.equal(init.redirect, 'error');
      let body;
      if (calls.length === 1) {
        assert.equal(url, 'https://oauth2.googleapis.com/token');
        assert.equal(init.method, 'POST'); // token exchange, no business mutation
        const claims = JSON.parse(Buffer.from(init.body.get('assertion').split('.')[1], 'base64url'));
        assert.equal(claims.scope, 'https://www.googleapis.com/auth/spreadsheets.readonly');
        body = { access_token: 'private-token-canary', token_type: 'Bearer', expires_in: 3600 };
      } else {
        assert.equal(calls.length, 2);
        assert.equal(url, 'https://sheets.googleapis.com/v4/spreadsheets/1g8NbVYEunt55lB-0E1OLQmNkeEQbF9y73n9kH3d3xbA/values/' +
          encodeURIComponent(range) + '?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER');
        assert.equal(init.method, 'GET');
        body = { range, majorDimension: 'ROWS', values: [header] };
      }
      return Response.json(body);
    }
  });
  assert.equal(reads, 1);
  assert.equal(calls.length, 2);
  assert.deepEqual(Object.keys(result), ['code', 'timestamp']);
  assert.equal(result.code, 'PASS');
  assert.equal(new Date(result.timestamp).toISOString(), result.timestamp);
  assert.equal(JSON.stringify(result).includes('private-token-canary'), false);
  assert.equal(JSON.stringify(result).includes(secret), false);
});

test('import has no I/O; CLI with missing secret emits only sanitized JSON and fails', async () => {
  const url = new URL('../../scripts/sales-private-header-probe.mjs', import.meta.url);
  const imported = spawnSync(process.execPath, ['--input-type=module', '-e', `
    globalThis.fetch=()=>{throw Error('unexpected network');};
    await import(${JSON.stringify(url.href)});
  `], { encoding: 'utf8', env: {} });
  assert.equal(imported.status, 0, imported.stderr);
  assert.equal(imported.stdout, '');
  for (const args of [[], ['--read-only']]) {
    const output = [];
    const code = await privateSalesHeaderProbeCli(args, {
      readSecret: () => undefined, fetchImpl: () => assert.fail('unexpected network')
    }, value => output.push(value));
    assert.equal(code, 1);
    assert.equal(output.length, 1);
    assert.equal(output[0].endsWith('\n'), true);
    const result = JSON.parse(output[0]);
    assert.deepEqual(Object.keys(result), ['code', 'timestamp']);
    assert.equal(result.code, 'FAIL');
  }
});
