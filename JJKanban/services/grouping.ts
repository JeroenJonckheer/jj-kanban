import type { BoardCard, KanbanConfig } from "./types";

/** Minimal structural shape of a PCF dataset that buildCards needs. */
export interface DatasetLike {
  sortedRecordIds: string[];
  records: Record<string, { getValue(col: string): any; getFormattedValue(col: string): string | null }>;
  columns?: { name: string; isPrimary?: boolean }[];
}

export const UNMATCHED_LANE = "__unmatched__";

/** Build BoardCard[] from a dataset + config. Pure transform (no React/PCF imports). */
export function buildCards(dataset: DatasetLike, config: KanbanConfig): BoardCard[] {
  const records = dataset.sortedRecordIds ?? [];
  return records.map((id) => {
    const rec = dataset.records[id];
    const titleSlot = config.cardLayout.find((f) => f.slot === "title");
    const titleField =
      titleSlot?.field === "_primary_" || !titleSlot
        ? dataset.columns?.find((c) => c.isPrimary)?.name ?? "name"
        : titleSlot.field;

    const fields: Record<string, { raw: any; formatted: string }> = {};
    const allFields = new Set<string>();
    config.cardLayout.forEach((f) => allFields.add(f.field === "_primary_" ? titleField : f.field));
    allFields.add(config.swimlaneColumn);
    allFields.add(titleField);
    if (config.sortColumn) allFields.add(config.sortColumn);
    if (config.tooltipColumn) allFields.add(config.tooltipColumn);

    allFields.forEach((col) => {
      try {
        fields[col] = {
          raw: rec.getValue(col),
          formatted: rec.getFormattedValue(col) ?? String(rec.getValue(col) ?? ""),
        };
      } catch {
        fields[col] = { raw: null, formatted: "" };
      }
    });

    const laneRaw = fields[config.swimlaneColumn]?.raw;
    const laneKey =
      laneRaw == null
        ? "__null__"
        : String(typeof laneRaw === "object" ? laneRaw.id ?? laneRaw.value ?? laneRaw : laneRaw);

    const accentSlot = config.cardLayout.find((f) => f.slot === "accent");

    const tooltip = config.tooltipColumn
      ? fields[config.tooltipColumn]?.formatted || undefined
      : undefined;

    let sortValue: number | undefined;
    if (config.sortColumn) {
      const raw = fields[config.sortColumn]?.raw;
      const n = typeof raw === "number" ? raw : raw != null ? Number(raw) : NaN;
      sortValue = Number.isFinite(n) ? n : undefined;
    }

    return {
      id,
      entityName: config.entityName,
      title: fields[titleField]?.formatted ?? "",
      subtitle: undefined,
      laneKey,
      laneRawValue: laneRaw ?? null,
      accentColor: accentSlot ? String(fields[accentSlot.field]?.raw ?? "") : undefined,
      fields,
      readOnly: false,
      sortValue,
      tooltip,
    };
  });
}

/** Group cards into lanes (by laneKey), add an Unmatched bucket, and sort within
 *  each lane by sortValue ascending (undefined to the bottom) with an id tiebreaker. */
export function groupByLane(cards: BoardCard[], config: KanbanConfig): Map<string, BoardCard[]> {
  const map = new Map<string, BoardCard[]>();
  config.swimlanes.forEach((l) => map.set(String(l.value), []));
  map.set(UNMATCHED_LANE, []);

  cards.forEach((c) => {
    const list = map.get(c.laneKey);
    if (list) list.push(c);
    else map.get(UNMATCHED_LANE)?.push(c);
  });

  if (config.sortColumn) {
    map.forEach((list) => {
      list.sort((a, b) => {
        const av = a.sortValue ?? Number.POSITIVE_INFINITY;
        const bv = b.sortValue ?? Number.POSITIVE_INFINITY;
        if (av !== bv) return av - bv;
        return a.id.localeCompare(b.id);
      });
    });
  }
  return map;
}
