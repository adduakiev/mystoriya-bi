import { TriangleAlert } from "lucide-react";

// Keep this action inert until private source access AND atomic promotion pass
// their release gates. The API independently rejects direct POST requests.
export function DataSyncControl({ initialCutoff }: { initialCutoff: string | null }) {
  return (
    <div className="data-sync-control" data-warehouse-cutoff={initialCutoff ?? undefined}>
      <button
        type="button"
        className="data-sync-button error"
        disabled
        title="Оновлення тимчасово недоступне: готуємо безпечний імпорт"
        aria-label="Оновити дані з Google Sheets — тимчасово недоступно"
      >
        <TriangleAlert size={13} />
      </button>
      <small className="data-sync-message error" role="status">
        Оновлення призупинено · наявні дані збережено
      </small>
    </div>
  );
}
