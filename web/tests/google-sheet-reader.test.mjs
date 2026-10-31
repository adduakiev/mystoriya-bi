import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readPrivateSalesSheet, SERVICE_ACCOUNT, SPREADSHEET_ID } from "../../supabase/functions/sync-google-sheet/google-sheet-reader.mjs";
import { assertSalesCsvPreflight } from "../../supabase/functions/sync-google-sheet/source-safety.mjs";

// Ephemeral synthetic key, generated in memory only. Never a Google credential.
const pair = await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5", modulusLength:2048,
  publicExponent:new Uint8Array([1,0,1]), hash:"SHA-256"}, true, ["sign","verify"]);
const der = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
const account = {type:"service_account", project_id:"myastoriya-bi", client_email:SERVICE_ACCOUNT,
  token_uri:"https://oauth2.googleapis.com/token", private_key_id:"a".repeat(40),
  private_key:`-----BEGIN PRIVATE KEY-----\n${Buffer.from(der).toString("base64")}\n-----END PRIVATE KEY-----\n`};
const secret = JSON.stringify(account);
const header = ["Номер Тижня","Рік","Месяц","Рік","Місяць","Обліковий день","Зі складу","Бренд","Власність","Доставка","Тип замовлення","Сума зі знижкою, грн.","Чеків","Націнка, грн."];
const row = [1,2026,10,2026,10,46321,"Test location","Test brand","Власні","Заклад","Заклад",12.50,0,0];
const json = value => new Response(JSON.stringify(value), {headers:{"content-type":"application/json"}});
const token = () => json({access_token:"synthetic-token",token_type:"Bearer",expires_in:3600});
const values = () => json({majorDimension:"ROWS",values:[header,row]});
function transport(second = values) {
  let count = 0;
  return async () => ++count === 1 ? token() : second();
}

test("signed assertion verifies cryptographically and requests only readonly Sheets scope", async () => {
  let calls = 0;
  const result = await readPrivateSalesSheet(secret, {fetchImpl: async (url, options) => {
    calls++;
    assert.equal(options.redirect,"error");
    assert.ok(options.signal instanceof AbortSignal);
    if (calls === 1) {
      assert.equal(url,account.token_uri);
      assert.equal(options.method,"POST");
      assert.equal(options.body.get("grant_type"),"urn:ietf:params:oauth:grant-type:jwt-bearer");
      const [h,p,s] = options.body.get("assertion").split(".");
      assert.deepEqual(JSON.parse(Buffer.from(h,"base64url")),{alg:"RS256",typ:"JWT",kid:account.private_key_id});
      const claims=JSON.parse(Buffer.from(p,"base64url"));
      assert.deepEqual(Object.keys(claims).sort(),["aud","exp","iat","iss","scope"]);
      assert.equal(claims.iss,SERVICE_ACCOUNT);
      assert.equal(claims.aud,account.token_uri);
      assert.equal(claims.scope,"https://www.googleapis.com/auth/spreadsheets.readonly");
      assert.equal(claims.exp-claims.iat,300);
      assert.ok(Math.abs(claims.iat-Math.floor(Date.now()/1000))<5);
      assert.equal(await crypto.subtle.verify("RSASSA-PKCS1-v1_5",pair.publicKey,Buffer.from(s,"base64url"),new TextEncoder().encode(`${h}.${p}`)),true);
      return token();
    }
    const parsed = new URL(url);
    assert.equal(parsed.origin,"https://sheets.googleapis.com");
    assert.equal(decodeURIComponent(parsed.pathname),`/v4/spreadsheets/${SPREADSHEET_ID}/values/'Данние короткі'!A:N`);
    assert.equal(parsed.searchParams.get("valueRenderOption"),"UNFORMATTED_VALUE");
    assert.equal(parsed.searchParams.get("dateTimeRenderOption"),"SERIAL_NUMBER");
    assert.equal(options.method,"GET");
    assert.equal(options.headers.Authorization,"Bearer synthetic-token");
    assert.equal(parsed.searchParams.has("access_token"),false);
    return values();
  }});
  assert.equal(calls,2);
  assert.equal(result[1][5],"46321");
  assert.equal(result[1][12],"0");
  assert.deepEqual(assertSalesCsvPreflight(result),{rawRows:1});
});

test("missing, malformed, wrong-account and attacker-endpoint secrets fail before network", async () => {
  for(const input of [undefined,"secret-canary", "null", "{}", JSON.stringify({...account,client_email:"other@example.com"}),
    JSON.stringify({...account,token_uri:"https://attacker.invalid"}),JSON.stringify({...account,project_id:"other"})]) {
    await assert.rejects(readPrivateSalesSheet(input,{fetchImpl:()=>assert.fail("network must not run")}),{message:"GOOGLE_AUTH_INVALID_SECRET"});
  }
});

test("invalid PKCS8 is sanitized before network", async () => {
  await assert.rejects(readPrivateSalesSheet(JSON.stringify({...account,private_key:"-----BEGIN PRIVATE KEY-----\nYWJj\n-----END PRIVATE KEY-----\n"}),
    {fetchImpl:()=>assert.fail("network must not run")}),{message:"GOOGLE_AUTH_SIGNING_FAILED"});
});

test("token denial, redirects, HTML, malformed JSON and network errors never expose upstream data", async () => {
  for(const response of [()=>new Response("secret-canary",{status:401}),()=>new Response("secret-canary",{status:302}),
    ()=>new Response("secret-canary"),()=>new Response("secret-canary",{headers:{"content-type":"application/json"}}),
    ()=>{throw Error("secret-canary");},()=>json({oversized:"x".repeat(17000)})]) {
    await assert.rejects(readPrivateSalesSheet(secret,{fetchImpl:response}),{message:"GOOGLE_AUTH_TOKEN_FAILED"});
  }
});

test("malformed bearer tokens and expiry cannot reach Sheets", async () => {
  for(const payload of [null,{}, {access_token:"a\r\nb",token_type:"Bearer",expires_in:3600},
    {access_token:"a",token_type:3,expires_in:3600},{access_token:"a",token_type:"Bearer",expires_in:0}]) {
    let calls=0;
    await assert.rejects(readPrivateSalesSheet(secret,{fetchImpl:()=>{assert.equal(++calls,1);return json(payload);}}),{message:"GOOGLE_AUTH_INVALID_TOKEN"});
  }
});

test("Sheets auth failures and transport errors are sanitized, with no public fallback", async () => {
  for(const status of [401,403,404,429,500,302]) {
    await assert.rejects(readPrivateSalesSheet(secret,{fetchImpl:transport(()=>new Response("secret-canary",{status}))}),{message:"GOOGLE_SHEETS_READ_FAILED"});
  }
});

test("header-only probe never requests source data rows", async () => {
  let calls=0;
  const result=await readPrivateSalesSheet(secret,{probe:true,fetchImpl:async(url)=>{
    if(++calls===1)return token();
    assert.ok(decodeURIComponent(url).includes("!A1:N1?"));
    return json({majorDimension:"ROWS",values:[header]});
  }});
  assert.deepEqual(result,[header]);
  await assert.rejects(readPrivateSalesSheet(secret,{probe:true,fetchImpl:transport()}),{message:"GOOGLE_SHEETS_INVALID_VALUES"});
});

test("missing trailing metrics stay empty and fail existing preflight, not become zero", async () => {
  const result=await readPrivateSalesSheet(secret,{fetchImpl:transport(()=>json({majorDimension:"ROWS",values:[header,row.slice(0,13)]}))});
  assert.equal(result[1][13],"");
  assert.throws(()=>assertSalesCsvPreflight(result),/INVALID_NUMBER/);
});

test("empty, non-row, boolean and object payloads fail closed", async () => {
  for(const payload of [{majorDimension:"COLUMNS",values:[header]}, {majorDimension:"ROWS",values:[]},
    {majorDimension:"ROWS",values:[[true]]},{majorDimension:"ROWS",values:[[{}]]},
    {majorDimension:"ROWS",values:[Array(15).fill("x")]}]) {
    await assert.rejects(readPrivateSalesSheet(secret,{fetchImpl:transport(()=>json(payload))}),{message:"GOOGLE_SHEETS_INVALID_VALUES"});
  }
});

test("reader remains disconnected from unsafe legacy importer until atomic gate", () => {
  const entry=readFileSync(new URL("../../supabase/functions/sync-google-sheet/index.ts",import.meta.url),"utf8");
  assert.equal(entry.includes("google-sheet-reader"),false);
  assert.equal(entry.includes("GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON"),false);
});
