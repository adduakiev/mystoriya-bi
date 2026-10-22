# Agent Foundation + Operating Layer v2 development

Digital Operating Layer v1 LIVE у production commit `800b3ce9d9e062daf907825fd67fdadc11154a7c`. v2 готується окремо: runtime/provider і repository abstractions, без production activation. Це не повний Digital Intelligence 3.0.

## Перевірка

Node >=22.13, npm. Codex CLI adapter доступний лише локально; LIVE додатково вимагає fresh aggregate fingerprint callback.

```powershell
npm ci --prefix web
npm test
npm run check
```

`npm run check`: тести → TypeScript → production build. Без npm у PATH після встановлення залежностей можна виконати `node scripts/check.mjs`.

## Потік

Collector → Data Quality → незалежні specialists → Council → Astra → cockpit → task drafts.
Чотири specialists запускаються послідовно, кожен отримує лише свій домен після quality gate та порожній inbox. Peer conclusions не є вхідними фактами.
Data Quality (`qualityGate`), Council (`buildCouncil`) і Astra (`astraExecutive`) зараз детерміновані шари правил, не додаткові LLM-виклики. Council відокремлює FACT/INFERENCE/RECOMMENDATION/BLOCKED. Astra обирає до п'яти питань.
До чотирьох Codex-викликів, без retries, timeout 180s кожен. Заблокований домен не витрачає LLM-виклик.

## Collector

Лише `bi_digital_payload`, `bi_digital_history_payload`, `bi_digital_ads_payload`. Проєкція фіксованих агрегатів відкидає raw payload/PII. Source/date/status/coverage/confidence обов'язкові. SYRVE unknown; валюта legacy Ads RPC не підтверджена. Targets/forecasts не підставляються.

Локальний сервер читає секрет із Git-ignored `web/.env.local`. Після його запуску:

```powershell
$env:BI_LOCAL_URL = "http://localhost:3100"
node --experimental-strip-types .agents/collect.mjs
node --experimental-strip-types .agents/run.mjs --input .agents/runtime/collected-input.json
```

Прямий HTTPS RPC також підтримується через securely configured `BI_SUPABASE_URL`, `BI_SUPABASE_ANON_KEY`, `BI_ACCESS_PASSWORD`. Секрети не потрапляють у пакет. Scheduler не встановлено.
Повний run вимагає свіжий InputPacket v2 з `web/lib/operating-core.ts`. `--executive-only` retired: він не є повним Council. `--replay PRIVATE_RESULTS.json` перевіряє протокол без LLM і не дозволяє створення задач. API `run()` тепер async — викликати через `await`.

Після audit hardening issue #7 команда `run.mjs --input ...` без replay блокується до collection/LLM з `FINGERPRINT_REQUIRED`: CLI ще не має fresh-read wiring. Програмний `run({..., currentFingerprint})` передає callback у core; він має повторно прочитати поточні aggregates після specialists. Помилка/timeout/невалідний hash → `FINGERPRINT_READ_FAILED`, зміна → `EVIDENCE_CHANGED`; Council не запускається. Підставляти hash початкового пакета замість повторного читання заборонено. Replay callback не вимагає.

## Runtime

`.agents/data_bus.json` — поточний run; єдиний автор — локальний runner. `runtime/run.lock` блокує конкуренцію. `active-run.json` містить lifecycle checkpoint, `latest.json` — останню спробу, `last-successful.json` — останній completed run. Bus/latest/summary можуть описувати failed/blocked спробу; status перевіряти завжди. Після аварії lock видаляється лише після перевірки завершення процесу. Кожен завершений run архівується в `runtime/runs/<run_id>.json`. Runtime не комітити.

Server-safe orchestration: `web/lib/operating-orchestrator.ts`. `AgentRuntime` має `invoke(agent, packet)` і metadata. `CodexCliRuntime` містить весь subprocess код у `.agents/adapters/`, заборонений на Vercel/production. `ReplayRuntime` виконується локально; `ProductionRuntime` — завжди disabled stub, без SDK/provider/credentials. Timeout припиняє очікування; майбутній network provider має реалізувати cancellation, бо Promise timeout не скасовує зовнішній запит.

Manual API `/api/operating/runs`: authenticated GET availability; same-origin POST повертає BLOCKED/503. `OPERATING_MANUAL_RUN_ENABLED=1` сам по собі нічого не активує. TaskRepository local adapter виконується; Supabase adapter лише контракт зі stub-методами, що повертають 503.

Cockpit `/operating` читає поточні aggregates та повторно перевіряє Council. Replay/partial/старший за 24h/невідповідний поточним даним run не може створювати задачі.
Task API `/api/operating/tasks`: GET/POST/PATCH, cookie auth, same-origin mutations, body limit, revision conflicts, atomic local writes. NEW → IN PROGRESS → DONE → CHECK RESULT. Створення задачі — явна дія користувача, без виконання бізнес-операцій.
Store: `.agents/runtime/tasks.json`; production-процес вимагає абсолютний `OPERATING_TASKS_PATH`. На Vercel запис вимкнено до durable adapter. `OPERATING_BUS_PATH` задає локальну шину.

## Межі

Rules confidence — консервативна оцінка якості, не статистична ймовірність. Exact-key конфлікти не є повним NLP-аналізом. Спільний evidence не доводить причину. Будь-який impact_uah блокується до появи виміряного impact-контракту.
Read-only sandbox CLI не обмежує сам по собі MCP; інструкції забороняють tool calls і читання інших agent outputs. Повний live-цикл потребує квоти та acceptance-перевірки.
