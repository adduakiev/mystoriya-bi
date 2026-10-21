# Release report — Astra Agent Foundation v1 + локальний Operating Layer

Дата: 20.10.2026, Europe/Kyiv. **Локальна реалізація, без push/merge/production deployment.**
Production baseline: `a2f7eb55f42ad3ccc410eb42ce55909843bc2380`.
Чистий Foundation commit: **`ba46e2a` — Astra Agent Foundation v1**.
Після живої перевірки до цього неопублікованого коміту додано frontend і npm lock;
попередній локальний SHA `e10ad04` замінено.

## Що було

- Незакомічені 5 skills, CLI та ланцюг Sales → Ads → SEO → UX → Executive.
- Replay і один partial executive-only тест; scheduler/collector відсутні.
- Ads undefined ratios ставали нулями; SEO snapshots вимагали точну дату.
- Нові UI-зміни ще не мали локальної перевірки на живих джерелах.

## Що зроблено

| Зміна | Evidence |
|---|---|
| Foundation зафіксовано окремо; приватний runtime не комітиться | `git show ba46e2a`, `.gitignore` |
| Випадковий pnpm lock замінено npm lock; одна команда перевірок | `web/package-lock.json`, `package.json`, `scripts/check.mjs` |
| Specialists логічно незалежні, фізично послідовні | `.agents/run.mjs`, `.agents/run.test.mjs` |
| Data Quality Agent: stale/missing/gaps/duplicates/coverage | `web/lib/operating-core.ts::qualityGate`, skill agent-data-quality |
| Collector із трьох allowlisted aggregate RPC і strict packet validation | `web/lib/operating-collector.ts`, `.agents/collect.mjs`, input API |
| Council окремий від Astra, classifications і конфлікти | `buildCouncil`, `astraExecutive`, skill agent-ai-council |
| Новий cockpit з KPI, напрямом, змінами, причинами, рішеннями, задачами | `web/app/operating/page.tsx`, sidebar |
| Task Engine: authenticated drafts, статуси, owner, deadlines, result, optimistic revisions | `operating-tasks.ts`, `operating-task-store.ts`, task API |
| Захист task creation від replay/partial/stale/changed sources | Server-side Council recomputation та current packet comparison у task store/API |
| Виправлено white-on-white контраст, знайдений візуально | `web/app/operating/operating.module.css` |

## Що реально працює

- Collector прочитав живі aggregates через локальний авторизований BI:
  6 метрик, з них backend net revenue недоступна.
- Quality gate дав WARN для GA4/GSC/Ads із непідтвердженим coverage та
  BLOCK для застарілого device slice й відсутнього backend.
- Повний **replay** пройшов чотири домени → Council → Astra.
  Це структурний end-to-end тест із живим aggregate packet, **не чотири LLM-висновки**.
- `/operating` показує актуальні KPI та окремо дату/режим Council run.
  Replay чітко позначено, створення задач вимкнено.
- Задачі мають реальне локальне зберігання та API; не виконують бізнес-дій.
- Runtime-результати містять run_id; завершені й невдалі запуски архівуються
  в ignored `runtime/runs/` для посилань задач на джерело.

## Що протестовано

- **14 тестів:** orchestration/independence/lock/failure, null/zero/date,
  quality/contract/collector/Council, task transitions/revisions/atomic store.
- TypeScript `--noEmit` та production build.
- Чистий **npm ci** в ізольованій тестовій папці за новим lock-файлом.
- Authenticated browser smoke на `http://localhost:3100`:

| Сторінка | Результат | Дати джерел / розбіжності |
|---|---|---|
| Overview `/digital` | HTTP 200, без runtime errors | GA4 до 19.10; channels/devices до 14.10; GSC до 17.10 |
| Ads `/digital/ads` | HTTP 200, 13 campaign rows | Доступний період 12–19.10; не тотожний 30-денному періоду Overview |
| SEO `/digital/seo` | HTTP 200, 35 відображених query/page rows | Site totals 18.09–17.10; 30-денні snapshots до 12.10 |
| Operating `/operating` | HTTP 200, live aggregates + явно позначений replay | Source dates збережені окремо від fetched_at |

- 390 px: document horizontal overflow не виявлено.
- Task API GET — 200; cross-origin POST — 403.
- Перша спроба live smoke мала DNS `ENOTFOUND` через sandbox; після
  дозволеного мережевого запуску сервера повторна перевірка успішна.
- Секрет не виводився, не записувався в reports/runtime й не комітився.
  Збережені лише знеособлені результати тесту та приватний screenshot UI.

## Що ще не працює / не підтверджено

1. Повного live LLM-циклу чотирьох specialists не виконано. Делегований агент
   під час роботи натрапив на квоту; replay не підмінює цю перевірку.
2. Council, Data Quality та Astra — **детерміновані шари**, не окремі LLM votes.
   Common root cause не доведено: пов'язані evidence IDs лише підстава для аналізу.
3. Task storage локальний. Vercel повертає явну відмову до durable DB adapter.
   У локальному production-процесі потрібен абсолютний OPERATING_TASKS_PATH.
4. Scheduler не встановлено. Collector запускається CLI або при читанні cockpit.
5. Немає SYRVE/backend orders, refunds, identities, contribution margin,
   підтверджених targets або прогнозу. Вони залишаються unknown/null.
6. Не виконано позитивний browser flow створення задачі з незалежного live
   Council: поточний replay навмисно цього не дозволяє. Сам engine перевірений тестами.
7. Production сайт не змінено. Локальний успішний build не є deployment.

## Ризики й технічний борг

- Legacy upstream може вже підміняти missing нулем; collector не відновлює
  втраченої семантики. Active users за період ще не виправлені глобально.
- Global period не є спільним для всіх звітів.
- Currency/coverage/gap metadata в legacy RPC недостатні; confidence обмежується.
- Конфлікти за semantic key не виявляють усі можливі семантичні суперечності.
- Confidence — policy score якості, не ймовірність причинного ефекту.
- Зберігається shared-password auth; production ролі/аудит/retention потребують роботи.
- Повне архітектурне розділення та debt list: [OPERATING-ARCHITECTURE.md](OPERATING-ARCHITECTURE.md).

## Наступний крок

1. Провести повний independent live acceptance за доступної квоти на
   актуальному знеособленому packet; перевірити позитивний task flow.
2. Узгодити SYRVE/backend contract і targets із власниками — задачі в
   [PROJECT-STATUS.md](PROJECT-STATUS.md).
3. Додати durable task storage та source-quality metadata, потім scheduler.
4. Production deploy — лише за окремою командою Костянтина.
