# Agent Foundation + локальний Operating Layer

Foundation v1 зафіксовано окремим комітом `ba46e2a`. Наступний шар додає незалежність аналізу, quality gate, Council, Astra й задачі. Це ще не розгорнутий Digital Intelligence 3.0.

## Перевірка

Node >=22.13, npm, авторизований Codex CLI для live-аналізу.

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
Повний run вимагає InputPacket v2 з `web/lib/operating-core.ts`. Legacy summary packet дозволений лише через `--executive-only` (partial). `--replay PRIVATE_RESULTS.json` перевіряє протокол без LLM і не дозволяє створення задач.

## Runtime

`.agents/data_bus.json` — поточний run; єдиний автор — оркестратор. `runtime/run.lock` блокує конкуренцію. Збій зберігає failed status; старі results не домішуються. `runtime/latest.json` і executive-summary.md оновлюються після успіху, тому завжди перевіряти поточний bus. Після аварії lock видаляється лише після перевірки завершення процесу. Кожен завершений/невдалий run архівується в `runtime/runs/<run_id>.json`. Runtime не комітити.

Cockpit `/operating` читає поточні aggregates та повторно перевіряє Council. Replay/partial/старший за 24h/невідповідний поточним даним run не може створювати задачі.
Task API `/api/operating/tasks`: GET/POST/PATCH, cookie auth, same-origin mutations, body limit, revision conflicts, atomic local writes. NEW → IN PROGRESS → DONE → CHECK RESULT. Створення задачі — явна дія користувача, без виконання бізнес-операцій.
Store: `.agents/runtime/tasks.json`; production-процес вимагає абсолютний `OPERATING_TASKS_PATH`. На Vercel запис вимкнено до durable adapter. `OPERATING_BUS_PATH` задає локальну шину.

## Межі

Rules confidence — консервативна оцінка якості, не статистична ймовірність. Exact-key конфлікти не є повним NLP-аналізом. Спільний evidence не доводить причину. Будь-який impact_uah блокується до появи виміряного impact-контракту.
Read-only sandbox CLI не обмежує сам по собі MCP; інструкції забороняють tool calls і читання інших agent outputs. Повний live-цикл потребує квоти та acceptance-перевірки.
