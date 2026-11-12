# Atomic Sales release review — 2026-11-12

This records local review, offline measurements, and a Sales-scoped local restore of the new release candidate. It is not evidence of a production deployment or hosted import. Those outcomes require their own release receipts.

## Source and warehouse identity

The actual gviz CSV was 8,140,183 bytes, SHA-256 `cc5e5cf4c923ef2f5039ff2a49c1a4e9888977139d8597e8280e2aed27354bfc`. It contains 47,478 source records and 1,395 sub-cent metric cells. Reproducing the installed v9 parser and aggregation produced 46,702 canonical rows across 1,045 dates, 2024-01-01 through 2026-11-10.

The new numeric contract preserves source order and the installed JavaScript sum followed by `toFixed(2)`. It does not round individual input cells. Exact cents are used after canonical aggregation. The generic cent-only preflight remains unchanged for its existing callers.

An independent comparison found zero missing, extra, or changed rows between the new parser and the installed-v9 reproduction. A separate decimal-safe comparison against the complete `bi_sales_flat` backup also found zero differences. Both comparisons used all six identity fields and all three metrics, not only aggregate totals. The flat export SHA-256 was `d40ac89e98ee711371e0d528edf788c6f3210ece6faf8cdfde95c13f83e91638`. Raw source and backup records remain outside Git.

## Local restore and SQL review

The private PostgreSQL 17.11 restore receipt reports PASS for 17 Sales relations and 151,984 exported rows, with matching row hashes. The catalog receipt reports no differences for 17 relations, 15 functions, and 3 sequences. A native SQL comparison independently reports zero source-only or warehouse-only rows and dates. These are local-only checks: Auth, Storage, Digital data, role passwords, and platform-wide disaster recovery are outside this restore's scope; platform default ACLs and role memberships remain backup metadata rather than installed local settings.

The actual restored-data rehearsal exposed a correlated channel check that repeatedly scanned all 46,702 facts and reached the 55-second deadline. The replacement compares the source channel set against the approved active channel set with `EXCEPT`. Review found equivalent rejection semantics for the validated, non-null staged dimensions. This optimization needs the new actual-data and native-suite receipts; the earlier timeout is not a passing rehearsal. The reviewed SQL SHA-256 is `a39ea623360646b6d0b104a520d213334fd8aa24555d3da916ef7d481f92a70a`.

## Real Deno measurement

Deno 2.1.4 ran `handleAtomicSalesRequest` with the real private source bytes and database context, synthetic credentials, and mocked network responses. The exercised path included authentication, two source reads and digests, full preparation, 24 staging calls, and a successful commit receipt. No deployed function or database writer was called.

The parser now consumes records incrementally using string slices, caches validated dimensions and dates, and avoids a second complete CSV matrix. Canonical duplicate aggregation still completes before the first batch is staged. The handler hashes its second source read without decoding another full text and checks the prepared batch count without reparsing each JSON payload.

Two measurements of CPU time inside the handler were **1.641 s** and **1.724 s**; peak process RSS was approximately **178–179 MiB**, with approximately **68 MiB** of JavaScript heap. CPU was measured using the host's `getrusage` before and after the request; it excludes CLI startup and loading the private fixture. The private profiling script and detailed receipt are retained in `.release-private/profile-atomic-handler*.{mjs,json}` outside the repository.

Supabase documents a **2 s CPU** and **256 MB memory** limit. These local results provide limited CPU headroom; mocked network responses do not measure hosted CPU speed, TLS/request encoding, database latency, or PostgREST timeouts. A hosted canary remains required before treating the importer as operationally verified. [Supabase limits](https://supabase.com/docs/guides/functions/limits)

Measured source files:

| File | SHA-256 |
| --- | --- |
| `sales-snapshot.mjs` | `bd9191560482d9fd4d89d6a141e6c8fa28797a458168644a6442b32735dbc1a4` |
| `atomic-sales-handler.mjs` | `816ecbce4b108591e74e96d236a10f092ea50dba2e7afee522bfe581d6629534` |

## Web and deployment review

The October report's fallback was traced to blank HTML select values sent as SQL empty strings. The deployed RPC raised `no_data`; the fallback then ignored those blank filters. All six Sales adapters now send SQL `NULL` for blank optional dimensions while preserving real selections. The Channel Mix axis also rounds displayed percentage ticks.

The refresh routes check the dashboard cookie, require same-origin POST, inject the dashboard password on the server, and bind progress to the exact request ID. Cache invalidation happens only in an explicit POST after the database reports verified atomic success. The SQL success receipt now includes the `done` and `atomic` fields required by the web guard; unknown outcomes remain unknown. The sidebar's existing freshness qualification is retained.

`supabase/config.toml` selects `index-atomic.ts`; the historical entrypoint remains inert. Gateway JWT verification is disabled because the handler checks the existing sync-key capability. The database policy starts disabled. CLI deployments honor the configured relative entrypoint; deployments through the connector must explicitly select `index-atomic.ts` and upload all relative dependencies. [Function configuration](https://supabase.com/docs/guides/functions/function-configuration)

Latest targeted validation: **16/16 tests passed** (9 snapshot/handler/parser tests and 7 filter/report tests), TypeScript passed, and `git diff --check` passed. The authentication probe also passes all three tests with the new routes included.

## Full production-shape rehearsal

The final SQL candidate SHA-256 is `d159666ecc21e244c7a1e047f207c3e6708dfdaa81f1892323e4a7387bd06011`. The restored production schema exposed two fixture gaps: a correlated channel check was too slow at the existing warehouse size, and the actual flat materialization calls its channel column `channel`. The candidate now compares channel sets once and projects the actual column; native coverage uses the real interface and repeats a full import against an already full warehouse.

The final candidate passed against a clone of the verified PostgreSQL 17.11 restore, using the retained real CSV, optimized parser, installed legacy merge function, and all three actual materializations. All 46,702 canonical rows matched in both directions across six identity fields and three exact metrics, covering 1,045 dates. All materializations agreed, one successful generation was published, retry was idempotent, and legacy service-role mutation RPCs were denied. The commit took 42.318 seconds under a 55-second deadline while other local checks were running; staging through completion took 47.198 seconds. The pristine restore was left unchanged.

An earlier rehearsal deliberately reached a post-refresh validation failure; all 16 business relations and the generation were unchanged afterward, and the failure log correctly reported zero published rows. Detailed receipts remain outside Git in `.release-private/sales-backup/`. These are local proofs. Final build/CI, hosted canary, and browser confirmation remain separate release checks.
