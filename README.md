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
