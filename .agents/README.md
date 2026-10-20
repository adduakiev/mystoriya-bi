# М'ясторія: п'ять агентів

Потрібні Node.js і авторизований Codex CLI (`codex exec`). Залежностей npm немає.
Запуски строго послідовні: sales → ads → seo → ux → executive.
П'ять LLM-викликів максимум, без автоматичних повторів, timeout 180 s/agent.
Модель успадковується з CLI. Byte limits обмежують пакет, але не є лімітом
оплачуваних токенів. Доступні tools і облікові дані визначає середовище CLI.

```powershell
node .agents/run.mjs --input C:\private\evidence.json
node --test .agents/run.test.mjs
```

Вхід: `{ "as_of": "2026-10-20T00:00:00Z", "evidence": [
{ "id": "source-check", "observed_at": "2026-10-19T12:00:00Z",
"summary": "Approved, pseudonymized evidence with source, period and limitations" }
] }`. Зберігайте вхід поза Git. Пакет готується з дозволених джерел; цей
launcher самостійно не імпортує Windsor/SYRVE і не підтверджує свіжість даних.
Валідація перевіряє посилання на докази, але не доводить істинність LLM-висновку.

`.agents/data_bus.json` створюється при запуску. Оркестратор володіє записом;
агенти повертають структуровані findings. Маршрути в orchestrator.json.
Контракт у CONTRACT.md, схема відповіді у output.schema.json.
`runtime/executive-summary.md` — останній успішний звіт; перевіряйте його
дату і поточний data_bus.status, оскільки невдалий запуск не стирає минулий звіт.
При аварійному завершенні процесу може залишитися run.lock: перед ручним
видаленням переконайтеся, що попередній runner завершився.

Для перевірки без витрати токенів:
`node .agents/run.mjs --input PRIVATE_PACKET --replay PRIVATE_RESULTS`.
Replay читає map agent-name→response і перевіряє весь маршрут. Він явно
позначений replay і не є новим незалежним LLM-аналізом.
`--executive-only` виконує один виклик, status=partial: спеціалісти не запускалися.

Runtime, bus і приватні результати ігноруються Git. Не вставляйте business
exports до skills, конфігурації або tracked fixtures.

Це локальний виконуваний runtime. Він не встановлює фоновий процес чи cloud
scheduler. Для щоденної експлуатації потрібні runner host, актуальний пакет,
дійсна CLI-авторизація та доступна квота. Автоматичний розклад задавайте
через підтримуваний scheduler після визначення джерела й часу оновлення.
Публікація на Vercel сама по собі не запускає цей локальний CLI.
