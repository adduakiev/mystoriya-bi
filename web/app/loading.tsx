export default function Loading() {
  return (
    <div className="route-loading-screen" role="status" aria-live="polite">
      <div className="route-loading-card">
        <span className="route-loading-spinner" aria-hidden="true" />
        <div>
          <b>М'ЯСТОРІЯ BI</b>
          <span>Готую дані…</span>
        </div>
      </div>
    </div>
  );
}
