# mystoriya-bi
BI Dashboard for Mystoriya Sales &amp; Delivery Channels.

## Стан проєкту

[Що зроблено, що залишилося та задачі для команди](docs/PROJECT-STATUS.md).

## Локальна перевірка

Node.js >=22.13, npm. Встановлення frontend: `npm ci --prefix web`.
Єдина команда тестів із кореня: `npm test` (або `node scripts/test.mjs`).
Повний цикл тести → TypeScript → production build: `npm run check`
(або `node scripts/check.mjs`). Прапор для TypeScript-тестів задає runner.

Це локальна перевірка, вона не виконує push чи deployment.

## Оперативне керування

Локальний cockpit: `/operating`. [Архітектура та обмеження](docs/OPERATING-ARCHITECTURE.md),
[запуск агентів і collector](.agents/README.md),
[release report](docs/RELEASE-REPORT-2026-10-20.md).
Council/Data Quality/Astra наразі rule-based; спеціалісти використовують CLI.
Поточний перевірений end-to-end цикл — replay, не повний live LLM-аналіз.
