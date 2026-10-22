# М'ЯСТОРІЯ BI — Codex operating contract

This repository is controlled through the AI Control Room.

## Role

When started by the Astra GitHub runner, act as the implementation engineer for exactly one trusted GitHub issue. Read the issue goal, acceptance criteria, linked review comments, and relevant repository context. Implement the smallest complete change that satisfies the task.

## Non-negotiable owner gates

Never do any of the following unless the issue explicitly records Kostiantyn's approval for that exact action:

- merge to `main`;
- deploy or promote to production;
- execute staging or production database migrations;
- add, rotate, reveal, or change credentials;
- activate a new paid provider or recurring paid service;
- enable durable business writes or an external-action scheduler;
- change advertising settings, campaigns, bids, or budgets;
- activate SYRVE writes or other business-system mutations.

A task may prepare code, migration files, adapters, tests, docs, preview-safe configuration, and PR-ready changes. Keep dangerous paths fail-closed by default.

## Repository safety

- Do not modify this `AGENTS.md` or `.github/workflows/astra-runner.yml` unless the issue explicitly targets AI Control Room infrastructure.
- Do not commit runtime artifacts, secrets, `.env*`, private exports, cookies, raw customer data, or `.agents/runtime`.
- Preserve production-safe disabled defaults for unfinished integrations.
- Do not invent business data or silently convert unknown/null values to zero.
- Keep evidence/domain isolation and current-run safeguards intact unless the issue explicitly changes their contract.

## Verification

Before declaring the implementation complete:

```bash
npm ci --prefix web
npm run check
git diff --check
```

`npm run check` runs repository tests, TypeScript, and the optimized Next.js production build.

If the task changes SQL migration design, static tests are not proof of PostgreSQL/RLS/concurrency behavior. Do not claim a migration was executed unless it actually was and the issue authorized it.

## Handoff

Do not push, merge, create a PR, deploy, or alter GitHub settings from inside Codex. The trusted GitHub workflow performs branch push and PR creation after deterministic checks pass.

In the final response state:
- what changed;
- tests/checks run and results;
- anything intentionally not implemented;
- blockers or residual risk.

If blocked, fail clearly rather than weakening a safety gate.
