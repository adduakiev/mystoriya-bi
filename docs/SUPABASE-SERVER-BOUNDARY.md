# Supabase BI server credential boundary — issue #25

This change prepares server code only. It installs no credentials, changes no
Supabase grants or policies, applies no migration, and performs no deployment.
The existing `BI_ACCESS_PASSWORD` RPC guard remains required.

## Runtime selection and readiness

`web/lib/data/source.ts` imports `server-only`; a Next.js Client Component cannot
import the transport, including through another module. All three RPC paths
(sales snapshot, sync status, and `callBiRpc`) select credentials at request time:

| Explicit `BI_SUPABASE_RPC_AUTH_MODE` | Required BI-specific key | Readiness `mode` | HTTP headers |
| --- | --- | --- | --- |
| `secret` | `BI_SUPABASE_SECRET_KEY` | `secret` | `apikey: <secret>`; no `Authorization` |
| `legacy-service-role` | `BI_SUPABASE_SERVICE_ROLE_KEY` | `legacy-service-role` | `apikey: <legacy JWT>` and `Authorization: Bearer <legacy JWT>` |
| unset / `anon-fallback` | none | `anon-fallback` | Existing legacy anon JWT in both headers |

The mode switch is deliberately explicit. Standard/global variables such as
`SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` are ignored by this
transport, so merging this preparation cannot silently elevate production merely
because another integration already configured a Supabase server credential.

`supabaseRpcReadiness()` is a server-only helper returning exactly `{ mode }`.
Call it from trusted server diagnostics to inspect the selected mode; never dump
the process environment, request headers, or credentials. This is configuration
readiness, not proof of a working key, project match, permissions, or connectivity.
It adds no public diagnostics route or credential fields to dashboard data.
A missing key for an explicitly selected elevated mode, or an invalid mode, is
reported only as readiness `misconfigured` and the transport fails closed; it
does not retry using anon. Existing sales-to-Google-Sheets fallback remains unchanged.

New `sb_secret_...` keys are opaque API keys, not JWTs. Supabase's API gateway
accepts them through `apikey` and resolves the backend role; do not send them as
Bearer tokens. The legacy compatibility variable must contain a service_role JWT.
Both backend credential types have elevated privileges and must stay server-only.
See [Supabase API keys](https://supabase.com/docs/guides/api/api-keys).
RPC error bodies and raw sales transport exceptions are excluded from errors/logs
because upstream diagnostics may echo credentials.

## Manual Vercel setup — separate owner-approved action

The owning-team Vercel connector is not authorized as of the issue audit. This
issue does not authorize installing, changing, or revealing any credential.
An authorized owner/operator must perform these steps after Kostiantyn approves
the exact credential setup:

1. Open the correct Supabase project → **Project Settings → API Keys**. Obtain an
   existing approved backend secret key (`sb_secret_...`) through the team's
   secret-management process. Creating a new key also needs approval. Verify it
   belongs to the project used by the transport; do not use a publishable key.
2. Open the owning team's BI project in **Vercel → Settings → Environment
   Variables → Add Environment Variable**. For **Preview only**, add
   `BI_SUPABASE_SECRET_KEY` (never a `NEXT_PUBLIC_...` name), paste the value
   directly into the protected value field, and mark it **Sensitive**. Also add
   `BI_SUPABASE_RPC_AUTH_MODE=secret` for Preview. Keep `BI_ACCESS_PASSWORD`
   configured. Do not copy the key into GitHub issues/comments, PRs, source files,
   chat, build arguments, or logs. Do not target Production in this first step.
3. If using a connector instead of the dashboard, an owner must first authorize
   it to the owning Vercel team/project, then approve the exact environment write.
   Supply the value through a protected secret input, target Preview first, and
   suppress value output. Do not transmit it in a GitHub comment or ordinary tool
   output. No connector action is performed by this issue.
4. Environment changes apply to subsequent deployments. Create/redeploy the normal
   preview and confirm server readiness is `secret`. Exercise login, sales
   snapshot, sync status, and read-only dashboard RPCs (including digital and
   aggregators). Check expected data and inspect browser assets/network responses
   for secret exposure without printing the key. Do not trigger sync/business
   writes as part of this smoke test.
5. Only after Preview passes and Kostiantyn separately approves the production
   gate, add the same two BI-specific variables to **Production**, redeploy, and
   repeat the read-only smoke tests. Saving Preview variables is not permission
   to change Production.

Do **not** revoke anon EXECUTE in this change. Secret installation plus successful
preview and production smoke tests must precede a separately approved grant
hardening issue. RLS/no-policy tables remain fail-closed; add no public policies.
Until then `anon-fallback` deliberately preserves existing production behavior
and the Security Advisor's remaining anon-executable function warnings can persist.

## Verification

`web/tests/supabase-boundary.test.mjs` mocks HTTP and Next's server cache to test
all three RPC paths, credential priority, safe readiness/data/errors, the password
guard, and pre-configuration compatibility. An isolated real Next.js build must
reject a Client Component importing the transport. These checks do not contact
Supabase/Vercel and do not prove live database grants or deployment readiness.

Run `npm ci --prefix web`, `npm run check`, and `git diff --check` before handoff.
The trusted GitHub runner handles branch/PR creation for Barbara review only.
