import type { BoardCard } from "./types";

export const SORT_SPACING = 1000;

/** A single record update produced by a drop. */
export interface SortUpdate {
  id: string;
  sortValue?: number;
  isMover: boolean;
}

/**
 * Simple midpoint value for inserting at `targetIndex` within `laneCards`
 * (which must EXCLUDE the moving card). Used when the lane is already clean.
 */
export function calculateSortValue(laneCards: BoardCard[], targetIndex: number): number {
  if (laneCards.length === 0) return SORT_SPACING;
  const idx = Math.max(0, Math.min(targetIndex, laneCards.length));
  if (idx === 0) {
    const first = laneCards[0].sortValue ?? SORT_SPACING;
    return first - SORT_SPACING;
  }
  if (idx >= laneCards.length) {
    const last = laneCards[laneCards.length - 1].sortValue ?? 0;
    return last + SORT_SPACING;
  }
  const before = laneCards[idx - 1].sortValue;
  const after = laneCards[idx].sortValue;
  if (before == null && after == null) return SORT_SPACING;
  if (before == null) return (after as number) - SORT_SPACING;
  if (after == null) return before + SORT_SPACING;
  return (before + after) / 2;
}

/**
 * Decide the record updates for a drop.
 *
 * `filtered` is the target lane in sorted order, EXCLUDING the moving card.
 * `insertIndex` is where the moving card should land within `filtered`.
 *
 * Normal case → one fractional midpoint update on the mover (atomic, no ties).
 * Falls back to renumbering the WHOLE lane when:
 *   - a direct neighbour has no sort value (initial backfill),
 *   - the gap between neighbours is below float-precision safety (< 1e-4),
 *   - the computed value would tie an existing record.
 *
 * `now` is injectable so tests are deterministic.
 */
export function computeDropUpdates(
  filtered: BoardCard[],
  insertIndex: number,
  moverId: string,
  now: number = Date.now(),
): { updates: SortUpdate[]; mode: "midpoint" | "renumber" } {
  const safe = Math.max(0, Math.min(insertIndex, filtered.length));
  const order: { id: string; sortValue?: number }[] = [
    ...filtered.slice(0, safe).map((c) => ({ id: c.id, sortValue: c.sortValue })),
    { id: moverId, sortValue: undefined },
    ...filtered.slice(safe).map((c) => ({ id: c.id, sortValue: c.sortValue })),
  ];

  const moverNewIdx = safe;
  const before = moverNewIdx > 0 ? order[moverNewIdx - 1].sortValue : undefined;
  const after = moverNewIdx < order.length - 1 ? order[moverNewIdx + 1].sortValue : undefined;

  // sub-fraction jitter so concurrent drops can't tie on the same midpoint
  const jitter = (now % 1_000_000) / 1e10;
  let newSortValue: number;
  if (before == null && after == null) newSortValue = SORT_SPACING + jitter;
  else if (before == null) newSortValue = (after as number) - SORT_SPACING + jitter;
  else if (after == null) newSortValue = (before as number) + SORT_SPACING + jitter;
  else newSortValue = ((before as number) + (after as number)) / 2 + jitter;

  const neighbourMissing =
    (moverNewIdx > 0 && before == null) ||
    (moverNewIdx < order.length - 1 && after == null);
  const gapTooSmall =
    before != null && after != null && Math.abs(after - before) < 0.0001;
  const wouldCollide = order.some((c) => c.id !== moverId && c.sortValue === newSortValue);

  if (neighbourMissing || gapTooSmall || wouldCollide) {
    return {
      mode: "renumber",
      updates: order.map((c, i) => ({
        id: c.id,
        sortValue: (i + 1) * SORT_SPACING,
        isMover: c.id === moverId,
      })),
    };
  }
  return { mode: "midpoint", updates: [{ id: moverId, sortValue: newSortValue, isMover: true }] };
}
