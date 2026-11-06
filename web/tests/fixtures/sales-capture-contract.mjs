// OFFLINE SYNTHETIC ONLY. Test custodian, never a production root/attestor.
import assert from 'node:assert/strict';
import { capturePreparedPrivateSalesSheet } from '../../../supabase/functions/sync-google-sheet/prepared-sales-sheet-capture.mjs';
import { canonicalSalesSourceBytes, deriveSalesProvenance } from '../../../supabase/functions/sync-google-sheet/prepared-sales-provenance.mjs';
import { prepareSalesRecovery } from '../../../supabase/functions/sync-google-sheet/prepared-sales-recovery.mjs';
import { SERVICE_ACCOUNT, SPREADSHEET_ID } from '../../../supabase/functions/sync-google-sheet/google-sheet-reader.mjs';

export async function syntheticCaptureCustodian() {
  // Ephemeral keys, no environment, real network, credential files or persistence.
  const rsa = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const signer = await crypto.subtle.generateKey('Ed25519', false, ['sign', 'verify']);
  const der = await crypto.subtle.exportKey('pkcs8', rsa.privateKey);
  const secret = JSON.stringify({ type: 'service_account', project_id: 'myastoriya-bi', client_email: SERVICE_ACCOUNT,
    token_uri: 'https://oauth2.googleapis.com/token', private_key_id: 'a'.repeat(40),
    private_key: `-----BEGIN PRIVATE KEY-----\n${Buffer.from(der).toString('base64')}\n-----END PRIVATE KEY-----\n` });
  const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
  async function observe(payload, { missingAuth = false, status = 200, signal, abortBody,
    rawBody = JSON.stringify(payload) } = {}) {
    let calls = 0;
    const observation = await capturePreparedPrivateSalesSheet(missingAuth ? '' : secret, { signal,
      fetchImpl: async (url, init) => {
        calls++;
        assert.equal(init.redirect, 'error');
        if (calls === 1) {
          assert.equal(url, 'https://oauth2.googleapis.com/token');
          assert.equal(init.method, 'POST');
          assert.equal(init.body.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
          const [h, p, s] = init.body.get('assertion').split('.');
          assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url')), { alg: 'RS256', typ: 'JWT', kid: 'a'.repeat(40) });
          const claims = JSON.parse(Buffer.from(p, 'base64url'));
          assert.equal(claims.iss, SERVICE_ACCOUNT); assert.equal(claims.aud, url);
          assert.equal(claims.scope, 'https://www.googleapis.com/auth/spreadsheets.readonly');
          assert.equal(claims.exp - claims.iat, 300);
          assert.equal(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', rsa.publicKey,
            Buffer.from(s, 'base64url'), new TextEncoder().encode(`${h}.${p}`)), true);
          return json({ access_token: 'offline-synthetic-token', token_type: 'Bearer', expires_in: 3600 });
        }
        assert.equal(calls, 2, 'No retries or real HTTP fallback');
        const u = new URL(url);
        assert.equal(u.origin, 'https://sheets.googleapis.com');
        assert.equal(decodeURIComponent(u.pathname), `/v4/spreadsheets/${SPREADSHEET_ID}/values/'Данние короткі'!A:N`);
        assert.deepEqual([...u.searchParams], [['majorDimension', 'ROWS'],
          ['valueRenderOption', 'UNFORMATTED_VALUE'], ['dateTimeRenderOption', 'SERIAL_NUMBER']]);
        assert.equal(init.method, 'GET'); assert.equal(init.credentials, 'omit'); assert.equal(init.cache, 'no-store');
        assert.deepEqual(init.headers, { Authorization: 'Bearer offline-synthetic-token', Accept: 'application/json' });
        if (abortBody) return new Response(new ReadableStream({
          pull(controller) {
            controller.enqueue(new TextEncoder().encode(rawBody.slice(0, 20)));
            abortBody.abort(); // Deterministic mid-stream interruption; never a timer race.
          }
        }), { headers: { 'content-type': 'application/json' } });
        return new Response(rawBody, { status, headers: { 'content-type': 'application/json' } });
      } });
    assert.equal(calls, 2);
    return observation;
  }
  const seal = observation => crypto.subtle.sign('Ed25519', signer.privateKey,
    canonicalSalesSourceBytes(observation.capture));
  async function contract(observation, signature, options) {
    const bytes = canonicalSalesSourceBytes(observation.capture);
    assert.equal(await crypto.subtle.verify('Ed25519', signer.publicKey, signature, bytes), true,
      'OFFLINE_SYNTHETIC_CAPTURE_SIGNATURE_MISMATCH');
    const matrix = JSON.parse(new TextDecoder().decode(bytes))[8]
      .map(row => row.map(cell => cell[0] === 'blank' ? '' : cell[1]));
    const prepared = prepareSalesRecovery(matrix, options);
    const provenance = await deriveSalesProvenance({ capture: observation.capture, ...options });
    assert.equal(provenance.sourceSha256, observation.sourceSha256);
    assert.equal(provenance.manifestJson, prepared.manifestJson);
    assert.equal(prepared.batches.length, 1, 'Bounded fixture must fit the existing single SQL authority payload');
    return { prepared, provenance };
  }
  return { observe, seal, contract };
}
