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
 * No ordinal/ranking fallback: missing or repeated IDs remain ambiguous.
 * Colliding suffixes use full raw IDs, including the account/path prefix.
 */
export function labelGbpLocations<T extends LocationIdentity>(rows: readonly T[]) {
  const titleCounts = new Map<string, number>();
  const idCounts = new Map<string, number>();
  const suffixIds = new Map<string, Set<string>>();
  for (const row of rows) {
    const title = comparable(titleOf(row));
    titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1);
    const id = row.locationId ?? "";
    if (!id.trim()) continue;
    idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
    const suffix = id.split("/").pop()?.slice(-6) ?? "";
    if (!suffixIds.has(suffix)) suffixIds.set(suffix, new Set());
    suffixIds.get(suffix)!.add(id);
  }
  const labels = rows.map(row => {
    const title = titleOf(row);
    const id = row.locationId ?? "";
    const hasId = Boolean(id.trim());
    const needsLabel = !title || (titleCounts.get(comparable(title)) ?? 0) > 1 || !hasId;
    const base = title || "Профіль GBP";
    const suffix = id.split("/").pop()?.slice(-6) ?? "";
    const token = suffix && suffixIds.get(suffix)?.size === 1 && id.length > 6 ? `…${suffix}` : id;
    return {
      ...row,
      locationLabel: needsLabel ? `${base} · ID ${hasId ? token : "відсутній"}` : title,
      locationIdentityNote: hasId
        ? `GBP ID: ${id}${(idCounts.get(id) ?? 0) > 1 ? " · ID повторюється; ідентичність неоднозначна" : ""}`
        : "GBP ID відсутній; ідентичність не підтверджена",
      needsLabel,
      fullLabel: `${base} · ID ${hasId ? id : "відсутній"}`,
    };
  });
  // A genuine unique title may itself resemble a generated label. Preserve it
  // and expand the generated label rather than silently claiming uniqueness.
  const counts = new Map<string, number>();
  for (const row of labels) {
    const key = comparable(row.locationLabel);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const expanded = labels.map(row => ({...row,
    locationLabel: row.needsLabel && (counts.get(comparable(row.locationLabel)) ?? 0) > 1
      ? row.fullLabel : row.locationLabel,
  }));
  const finalCounts = new Map<string, number>();
  for (const row of expanded) {
    const key = comparable(row.locationLabel);
    finalCounts.set(key, (finalCounts.get(key) ?? 0) + 1);
  }
  return expanded.map(({needsLabel, fullLabel, ...row}) => ({...row,
    locationIdentityNote: (finalCounts.get(comparable(row.locationLabel)) ?? 0) > 1
      ? `${row.locationIdentityNote} · підпис неоднозначний` : row.locationIdentityNote,
  }));
}
