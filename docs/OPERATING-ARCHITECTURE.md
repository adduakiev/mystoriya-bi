# Локальний Operating Layer — контракт і межі

## Виконувані шари

| Шар | Файл | Реальна поведінка |
|---|---|---|
| Collector | `web/lib/operating-collector.ts`, `.agents/collect.mjs` | Три allowlisted aggregate RPC; strict projection без raw PII |
| Input contract | `web/lib/operating-core.ts::validateInput` | Typed v2 packet, finite/null, timestamps, source status, bounds; unknown fields rejected |
| Data Quality | `qualityGate` + skill agent-data-quality | Stale/missing/duplicate/gap/broken source блокуються; unknown coverage знижує confidence |
| Specialists | `.agents/run.mjs` | Послідовні незалежні виклики; domain-only packet, no peer inbox |
| Council | `buildCouncil` + skill agent-ai-council | FACT / INFERENCE / RECOMMENDATION / BLOCKED, dedup, conflicts, quality recheck |
| Astra | `astraExecutive` | До 5 питань на розгляд; бізнес-пріоритет без контракту UNASSESSED |
| Cockpit | `web/app/operating/page.tsx` | KPI → напрям → зміни → причини → рішення → задачі |
| Task Engine | `operating-tasks.ts`, `operating-task-store.ts`, task API | Authenticated drafts, owner/status/revision/result, atomic local persistence |

## Важливі рішення

- Business KPI Status і Data Quality незалежні: WARN не дає DATA ISSUE; лише BLOCK блокує бізнес-оцінку. Quality та confidence видимі окремо.
- Автоматичні Council-рекомендації і нові задачі мають UNASSESSED. Confidence не визначає P1/P2/P3 або порядок Astra; явний бізнес-пріоритет потребує окремого контракту чи призначення користувачем.
- `runIssues` накопичує replay/stale/changed-data причини. Будь-яка причина вимикає створення задач.
- Технічні row-count/coverage показники розміщені в Data Quality / Sources, поза бізнес-KPI, напрямом і змінами.

- Collector не видає часову мітку отримання за source observation.
- Legacy RPC не дають перевірених coverage/gaps/duplicates або валюти Ads.
  У пакетах це unknown, а не вигадані FULL/0/UAH.
- GA4 purchases — події, не backend orders. Net revenue SYRVE залишається null.
- KPI status може бути NO TARGET. CRITICAL не виводиться без бізнес-порога.
  Прогноз не екстраполюється довільно.
- Зміна метрики — описова різниця, не причинне пояснення. Поточна модель
  використовує previous period legacy RPC; часові ряди/forecast ще не реалізовані.
- Council rule-based. Наявність skill не означає окремий LLM-vote.
- Збій одного CLI-виклику зупиняє цикл зі статусом failed.
- Задачі тільки з актуального completed live run. Сервер сам відновлює
  Council із inputs/outputs і повторно отримує поточний packet.
  Replay/partial/stale/changed-source recommendations не приймаються.
- UI не змінює кампанії, бюджети, production DB чи бізнес-операції.

## Технічний борг

1. Daily active_users не можна додавати як unique users довільного періоду.
2. Legacy `Number(value ?? 0)` лишається в частині Digital; collector не може
   відновити missing, якщо upstream уже згорнув його в zero.
3. Global period не застосовується однаково до всіх звітів.
4. SYRVE/orders/identity/refunds/backend attribution відсутні.
5. Coverage, source IDs, country/context/currency і timestamps треба
   додати до контрактів warehouse та RPC.
6. Production task storage потребує durable DB adapter, retention і audit trail.
7. Shared-password авторизація потребує окремого переходу до ролей/користувачів.
8. Collector scheduler, журнал запусків/алерти й повний live acceptance ще потрібні.
9. Семантичне виявлення суперечностей/common root cause ширше за exact keys
   потребує додаткової моделі й окремої доказової перевірки.

## Правила релізу

Перевіряти `npm run check`, authenticated local live smoke, privacy/staging.
Push, merge і production deploy — тільки за окремою командою Костянтина.
Успішний build не означає deployment чи живого AI-аналізу.
