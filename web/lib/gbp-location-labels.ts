type LocationIdentity = {locationId?: string | null; locationTitle?: string | null};

/** Comparison only: display names and upstream identity are never rewritten. */
function comparable(value: string): string {
  return value.normalize("NFKC").replace(/\s*['’‘ʼ`´]\s*/gu, "'")
    .replace(/\s+/gu, " ").trim().toLocaleLowerCase("uk-UA");
}

function titleOf(row: LocationIdentity): string {
  const title = row.locationTitle?.trim() ?? "";
  return ["—", "-"].includes(title) ? "" : title;
}

// Exact GBP resource IDs confirmed by Kostiantyn on 2026-11-17.
// Address confirmation does not establish ownership/franchise status.
const confirmedAddresses:Readonly<Record<string,string>>={
  "locations/14041797018953207147":"вулиця Академіка Вільямса, 3/7, Київ, 02000",
  "locations/11452898684627681419":"вулиця Анни Ахматової, 22, Київ, 02000",
  "locations/14390582861278894493":"Голосіївський проспект, 58А, 1 поверх, ЖК Парк Авеню, Київ, 03039",
  "locations/15689179339837801980":"проспект Героїв Сталінграду, 8К5, Київ, 04210",
};
/** Labels include only owner-confirmed addresses matched by exact resource ID.
 * Always retain the full source ID, even with a unique title: filtering the
 * input must not rename a profile or shorten its identity to a colliding suffix.
 * No ordinal/ranking fallback: missing or repeated IDs remain ambiguous.
 */
export function labelGbpLocations<T extends LocationIdentity>(rows: readonly T[]) {
  const idCounts = new Map<string, number>();
  for (const row of rows) {
    const id = row.locationId ?? "";
    if (id.trim()) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  }
  const labels = rows.map(row => {
    const title = titleOf(row);
    const id = row.locationId ?? "";
    const hasId = Boolean(id.trim());
    const address=confirmedAddresses[id];
    return {
      ...row,
      locationLabel: `${title || "Профіль GBP"}${address?` · ${address}`:""} · ID ${hasId ? id : "відсутній"}`,
      locationIdentityNote: `${hasId
        ? `GBP ID: ${id}${(idCounts.get(id) ?? 0) > 1 ? " · ID повторюється; ідентичність неоднозначна" : ""}`
        : "GBP ID відсутній; ідентичність не підтверджена"} · ${address?"Адресу підтверджено власником · Належність закладу не підтверджена":"Адреса не підтверджена"}`,
    };
  });
  const counts = new Map<string, number>();
  for (const row of labels) {
    const key = comparable(row.locationLabel);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return labels.map(row => ({...row,
    locationIdentityNote: (counts.get(comparable(row.locationLabel)) ?? 0) > 1
      ? `${row.locationIdentityNote} · підпис неоднозначний` : row.locationIdentityNote,
  }));
}
