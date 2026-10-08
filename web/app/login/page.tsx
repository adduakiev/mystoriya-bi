import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Вхід"
};

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const error = first(params.error);
  const nextPath = first(params.next) ?? "/";
  const passwordConfigured = Boolean(process.env.BI_ACCESS_PASSWORD);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background:
          "radial-gradient(circle at 50% 20%, rgba(245,166,35,.08), transparent 34%), #090d12",
        color: "#f4f7fb"
      }}
    >
      <section
        style={{
          width: "min(100%, 390px)",
          border: "1px solid #202935",
          borderRadius: "18px",
          background: "rgba(15,21,29,.96)",
          padding: "30px",
          boxShadow: "0 28px 80px rgba(0,0,0,.38)"
        }}
      >
        <div style={{ marginBottom: "26px" }}>
          <div
            style={{
              fontSize: "11px",
              letterSpacing: ".18em",
              color: "#f5a623",
              fontWeight: 800,
              marginBottom: "8px"
            }}
          >
            М&apos;ЯСТОРІЯ
          </div>
          <h1 style={{ margin: 0, fontSize: "26px", lineHeight: 1.15 }}>
            Control Center
          </h1>
          <p
            style={{
              margin: "9px 0 0",
              color: "#84909d",
              fontSize: "13px",
              lineHeight: 1.5
            }}
          >
            Внутрішній BI. Введіть спільний пароль для доступу.
          </p>
        </div>

        <form method="post" action="/api/auth/login">
          <input type="hidden" name="next" value={nextPath} />

          <label
            htmlFor="password"
            style={{
              display: "block",
              marginBottom: "8px",
              color: "#9aa4b1",
              fontSize: "11px",
              fontWeight: 750
            }}
          >
            Пароль
          </label>

          <input
            id="password"
            name="password"
            type="password"
            autoFocus
            required
            autoComplete="current-password"
            placeholder="•••••••"
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid #2a3441",
              borderRadius: "10px",
              background: "#0b1118",
              color: "#f4f7fb",
              padding: "13px 14px",
              outline: "none",
              fontSize: "16px"
            }}
          />

          {error === "1" && (
            <div
              style={{
                marginTop: "10px",
                color: "#ff9298",
                fontSize: "11px"
              }}
            >
              Невірний пароль. Спробуйте ще раз.
            </div>
          )}

          {!passwordConfigured && (
            <div
              style={{
                marginTop: "10px",
                color: "#e8c676",
                fontSize: "11px",
                lineHeight: 1.45
              }}
            >
              Пароль доступу ще не налаштований у Vercel.
            </div>
          )}

          <button
            type="submit"
            style={{
              width: "100%",
              marginTop: "16px",
              border: "1px solid #6b4a12",
              borderRadius: "10px",
              background: "#f5a623",
              color: "#111",
              padding: "12px 14px",
              fontWeight: 850,
              cursor: "pointer"
            }}
          >
            Увійти
          </button>
        </form>

        <div
          style={{
            marginTop: "18px",
            color: "#596472",
            fontSize: "10px",
            lineHeight: 1.5
          }}
        >
          Доступ зберігається в цьому браузері. Повторний вхід зазвичай не потрібен.
        </div>
      </section>
    </main>
  );
}
