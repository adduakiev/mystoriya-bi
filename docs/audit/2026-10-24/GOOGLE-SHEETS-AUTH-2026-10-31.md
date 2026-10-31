# Private Sheets authorization preparation — issue #43 / PR #44

Status: PREPARED, NOT APPLIED, NOT READY FOR PRODUCTION GATE.

## Observed configuration and scope

Isolated PR checkout baseline: `3081ae2fbe08578abaed7f980b7258e6bc024fb1`,
branch `astra/issue-43-40107435112`. Supabase Management connector read-only
inspection on 2026-10-31 confirmed project `rxewpevxqtfmksybykvo`, function
`sync-google-sheet`, ACTIVE v8, `verify_jwt=false`, bundle SHA256
`3df6e58f513e48bb09cf2d60616358533bf3a0755ea8db235d2b9e48a8362ca9`.
Installed code authenticates callers using the stored hash of `x-bi-sync-key`,
then reads unauthenticated Google gviz CSV. Its `sync_sales_batch` loop and
`finalize_sales_snapshot` are separate calls: P0 partial writes/deletion remains.
The PR entrypoint retains that writer plus source preflight. Neither is changed here.

Source is pinned to existing spreadsheet `1g8NbVYEunt55lB-0E1OLQmNkeEQbF9y73n9kH3d3xbA`,
tab `Данние короткі`. Viewer access for
`myastoriya-bi-sheets-reader@myastoriya-bi.iam.gserviceaccount.com` is owner-reported;
not independently proven using this service account. No key was accessed or created.
Google IAM/provider configuration, Sheets API enablement and runtime secret names/values
were not available through the inspected read-only connectors: UNKNOWN, not absent.

## WIF decision

Prefer keyless WIF when the Edge execution environment can supply a short-lived,
platform-attested identity. A viable design is runtime OIDC subject token → Google STS
token exchange → IAM Credentials service-account impersonation → Sheets GET.
Trust must pin issuer, audience, project, function and environment, map a stable
`google.subject`, and bind only that workload to this service account with
`roles/iam.workloadIdentityUser`. Request only `spreadsheets.readonly` at impersonation.
Do not accept arbitrary client-supplied subject tokens or service-account targets.

No documented Edge workload-token source or configured provider was verified in
this inspection. Supabase Auth user JWTs, service-role keys, deployment IDs and
GitHub Actions OIDC are not proof of this running Edge function's identity.
A GitHub OIDC bridge would require a different execution/scheduler trust boundary;
a broker authenticated by a static secret would not make the chain keyless.
Therefore direct WIF is **not currently proven practical**, not categorically impossible.
No pool/provider/IAM changes or speculative WIF configuration are included.

## Prepared fallback and safety properties

`google-sheet-reader.mjs` accepts the server-only secret
`GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON` (Google service-account JSON). It pins account,
project, token endpoint, spreadsheet and tab; validates PKCS8 RSA >=2048 bits;
signs a five-minute RS256 assertion using Web Crypto and exchanges it for a bearer
token at Google's fixed HTTPS endpoint. It requests only Sheets readonly scope,
with no domain-wide delegation or user `sub`. Tokens remain in request-local memory.
No new dependency or lockfile change is needed; synthetic tests verify the signature.

The reader uses Sheets API `values.get`, `UNFORMATTED_VALUE`, `SERIAL_NUMBER`, and
`ROWS`; it converts cells into the existing string-matrix contract. Missing cells
remain empty; zero remains zero. Full `A:N` avoids a hardcoded row cutoff.
Responses have 30-second deadlines, explicit byte ceilings, rejected redirects,
strict JSON/cell checks and sanitized errors. There is no public-CSV fallback,
token URL parameter, logging, database client, persistent token cache or import-time I/O.
`probe:true` requests header `A1:N1` only; it is a library option, not a deployed endpoint.

**Deliberately disconnected from index.ts.** Installing a secret alone must not revive
the unsafe batch writer. No entrypoint, SQL, migration, deployment or cron is changed.
This is authorization preparation, not a working deployed integration.

Supabase Secrets are project-scoped server configuration, not a per-function vault:
other trusted project functions/deployers may access them. Restrict deployment/admin
access, never put the JSON in Git, chat, browser code, database tables, logs or shell
arguments. The scope limits token operations; spreadsheet Viewer sharing limits
resources. Do not add project-wide Editor/Owner or Drive scopes. Key rotation/revocation
must be an owner-approved operational action, not an automatic code side effect.

## Minimal owner step and subsequent gates

For now: approve the fallback design **only** if no platform-issued workload identity
is available; no key upload or production action is needed to review this PR.
If WIF is available, provide only non-secret issuer/audience/subject and the documented
runtime token mechanism, not a token or key.

After separate credential approval, the owner/security administrator can provision the
dedicated account's JSON directly in Supabase Dashboard → Edge Functions → Secrets as
`GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON`, without sending it to this chat. If no key exists,
key creation requires its own explicit approval. Confirm Sheets API enabled in the
account project; enabling it is also outside this task. Keep the sheet private and
the existing Viewer grant. Do not invoke `sync-google-sheet` as an auth test.

Before any import activation: prove staging plus transactional promotion/rollback,
concurrency and failed-batch preservation on disposable PostgreSQL; authorize and verify
the production atomic protection separately; integrate the reader with the protected
path in this same PR; perform a separately approved no-write header probe; then obtain
the exact-SHA deployment/import gate. Existing schedules are not modified here.

## Verification evidence

Initial focused command: `node --test web/tests/google-sheet-reader.test.mjs web/tests/source-preflight.test.mjs`:
24 passed, 0 failed, 0 skipped. All transport is mocked; only an ephemeral synthetic
RSA key exists in process memory. Tests cover signature/claims, fixed destinations,
bad credentials, token/schema/transport failures, header-only scope, missing versus zero,
preflight compatibility and disconnection from the legacy writer.
Final full-check and committed-SHA results are recorded in the PR evidence comment.
No live OAuth exchange, private-source read with this account, Deno deployment,
production import or atomicity proof is claimed by these Node tests.

## Official sources reviewed 2026-10-31

- [Google WIF](https://cloud.google.com/iam/docs/workload-identity-federation)
- [Google service-account OAuth](https://developers.google.com/identity/protocols/oauth2/service-account)
- [Sheets values.get](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get)
- [Supabase Secrets](https://supabase.com/docs/guides/functions/secrets)
- [Supabase changelog](https://supabase.com/changelog.md): scanned breaking-change entries;
  no relevant Edge Secrets/runtime identity change identified. Supabase Auth OAuth is
  distinct from workload federation. Documentation search did not establish an Edge IdP.
