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

/** Labels describe profiles, never an unverified street/store crosswalk.
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
    return {
      ...row,
      locationLabel: `${title || "Профіль GBP"} · ID ${hasId ? id : "відсутній"}`,
      locationIdentityNote: `${hasId
        ? `GBP ID: ${id}${(idCounts.get(id) ?? 0) > 1 ? " · ID повторюється; ідентичність неоднозначна" : ""}`
        : "GBP ID відсутній; ідентичність не підтверджена"} · Адреса не підтверджена`,
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
