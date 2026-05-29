import * as React from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Button, Spinner } from "@fluentui/react-components";
import type { IInputs } from "../generated/ManifestTypes";
import type { BoardCard, KanbanConfig } from "../services/types";
import { Swimlane } from "./Swimlane";
import { CardVisual } from "./Card";
import type { DataverseService } from "../services/DataverseService";
import { buildCards, groupByLane } from "../services/grouping";
import { computeDropUpdates } from "../services/sorting";

export interface KanbanBoardProps {
  context: ComponentFramework.Context<IInputs>;
  config: KanbanConfig;
  dataverse: DataverseService;
  onChange: () => void;
}

/** Prefer pointer-within when the pointer is over a droppable lane,
 *  fall back to rectIntersection otherwise. */
const kanbanCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return rectIntersection(args);
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ context, config, dataverse, onChange }) => {
  const dataset = context.parameters.records;

  // Tiny non-blocking error banner — no Fluent Toaster (its wrapper traps pointer
  // events on some hosts and blocks subsequent drags).
  const [errorBanner, setErrorBanner] = React.useState<string | null>(null);
  const errorTimerRef = React.useRef<number | null>(null);
  const showError = React.useCallback((msg: string) => {
    setErrorBanner(msg);
    if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
    errorTimerRef.current = window.setTimeout(() => setErrorBanner(null), 4000);
  }, []);

  const requestedPageSize = (context.parameters as any).pageSize?.raw ?? 100;

  // Override the host's page size (usually 4-10 from the subgrid setting) and
  // explicitly trigger a refresh so the new size actually takes effect.
  const appliedPageSizeRef = React.useRef<number>(0);
  React.useEffect(() => {
    const paging = (dataset as any).paging;
    if (!paging) return;
    if (appliedPageSizeRef.current >= requestedPageSize) return;
    const current = paging.pageSize ?? 0;
    if (current >= requestedPageSize) {
      appliedPageSizeRef.current = current;
      return;
    }
    console.log(`[JJ Kanban] increasing pageSize ${current} → ${requestedPageSize}, refreshing dataset`);
    paging.setPageSize(requestedPageSize);
    appliedPageSizeRef.current = requestedPageSize;
    try {
      (dataset as any).refresh?.();
    } catch (e) {
      console.warn("[JJ Kanban] dataset.refresh threw", e);
    }
  }, [dataset, requestedPageSize]);

  const paging = (dataset as any).paging;
  const totalCount: number | null = paging?.totalResultCount ?? null;
  const loadedCount = (dataset.sortedRecordIds ?? []).length;
  const hasNextPage = !!paging?.hasNextPage;
  const isLoading = !!(dataset as any).loading;
  const canLoadMore = hasNextPage || (totalCount != null && totalCount > loadedCount);

  // Surface paging state so we can see if hasNextPage / totalResultCount are populated
  // and react properly when Load more is clicked.
  React.useEffect(() => {
    console.log(
      `[JJ Kanban] paging state — pageSize=${paging?.pageSize} loaded=${loadedCount} total=${totalCount} hasNextPage=${hasNextPage} loading=${isLoading}`,
    );
  }, [paging?.pageSize, loadedCount, totalCount, hasNextPage, isLoading]);

  const [loadingMore, setLoadingMore] = React.useState(false);
  const onLoadMore = React.useCallback(() => {
    const pg = (dataset as any).paging;
    if (!pg) return;
    setLoadingMore(true);
    try {
      if (pg.hasNextPage && typeof pg.loadNextPage === "function") {
        // Preferred: append the next page.
        console.log("[JJ Kanban] loadNextPage()");
        pg.loadNextPage();
      } else {
        // Fallback: enlarge the page window and refresh.
        const current = pg.pageSize ?? requestedPageSize;
        const next = current + 100;
        console.log(`[JJ Kanban] enlarging pageSize ${current} → ${next} + refresh`);
        pg.setPageSize(next);
        appliedPageSizeRef.current = next;
        (dataset as any).refresh?.();
      }
    } catch (e) {
      console.warn("[JJ Kanban] load more failed", e);
    } finally {
      setTimeout(() => setLoadingMore(false), 2000);
    }
  }, [dataset, requestedPageSize]);

  const baseCards = React.useMemo(() => buildCards(dataset, config), [dataset, config]);

  // Optimistic moves: card.id → { laneKey, sortValue? } override.
  interface OptimisticEntry { laneKey: string; sortValue?: number }
  const [optimistic, setOptimistic] = React.useState<Record<string, OptimisticEntry>>({});
  const cards = React.useMemo(
    () =>
      baseCards.map((c) => {
        const o = optimistic[c.id];
        if (!o) return c;
        return { ...c, laneKey: o.laneKey, sortValue: o.sortValue ?? c.sortValue };
      }),
    [baseCards, optimistic],
  );

  const cardsByLane = React.useMemo(() => groupByLane(cards, config), [cards, config]);

  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [overLane, setOverLane] = React.useState<string | null>(null);

  const [setupWarning, setSetupWarning] = React.useState<string | null>(null);
  React.useEffect(() => {
    const cols = (dataset as any).columns ?? [];
    const colNames: string[] = cols.map((c: any) => c.name);
    const missing: string[] = [];
    if (!colNames.includes(config.swimlaneColumn)) missing.push(config.swimlaneColumn);
    if (config.sortColumn && !colNames.includes(config.sortColumn)) missing.push(config.sortColumn);

    const parts: string[] = [];
    if (missing.length > 0) {
      parts.push(
        `View is missing column(s): ${missing.join(", ")}. Add them to the view's column list ` +
          `(and sort the view by ${config.sortColumn ?? "the swimlane column"} ascending) for ` +
          `lanes and manual order to work correctly.`,
      );
    }
    // Honest limitation: BPF stage moves are not yet persisted as real stage transitions.
    if (config.swimlaneSourceType === "bpfstage") {
      parts.push(
        "Business Process Flow stages are shown read-only in this version — dragging will not move the process stage.",
      );
    }

    if (parts.length > 0) {
      const msg = parts.join(" ");
      console.warn("[JJ Kanban] " + msg);
      setSetupWarning(msg);
    } else {
      setSetupWarning(null);
    }
  }, [dataset, config.swimlaneColumn, config.sortColumn, config.swimlaneSourceType]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // sortableKeyboardCoordinates → arrow keys move card-by-card (proper a11y reorder)
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** Remember where each active drag originated so a dropped-outside-any-lane
   *  release can roll the optimistic state back to the source lane. */
  const dragOriginRef = React.useRef<{ id: string; laneKey: string } | null>(null);

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    setActiveId(id);
    document.body.classList.add("jj-kanban-dragging");
    const card = cards.find((c) => c.id === id);
    if (card) dragOriginRef.current = { id: card.id, laneKey: card.laneKey };
    console.log(
      `[JJ Kanban] dragstart id=${id} fromLane=${card?.laneKey ?? "?"} title="${card?.title ?? ""}"`,
    );
  };

  const onDragOver = (e: DragOverEvent) => {
    const over = e.over;
    if (!over) {
      setOverLane(null);
      return;
    }
    const overData = over.data.current as any;
    let newOverLane: string | null = null;
    if (overData?.lane?.value != null) newOverLane = String(overData.lane.value);
    else if (overData?.laneKey != null) newOverLane = String(overData.laneKey);

    setOverLane(newOverLane);

    // Cross-lane placeholder: optimistically move the active card into the target
    // lane while the user is still dragging, so that lane's SortableContext renders
    // it as one of its items and the strategy shows the placeholder at the pointer
    // position. We only update when the lane actually changes — onDragOver fires
    // many times per second.
    if (newOverLane) {
      const activeId = String(e.active.id);
      const active = cards.find((c) => c.id === activeId);
      if (active && active.laneKey !== newOverLane) {
        setOptimistic((s) => {
          const existing = s[activeId];
          if (existing?.laneKey === newOverLane) return s;
          return {
            ...s,
            [activeId]: { laneKey: newOverLane, sortValue: existing?.sortValue },
          };
        });
      }
    }
  };

  const onDragEnd = async (e: DragEndEvent) => {
    document.body.classList.remove("jj-kanban-dragging");
    const cardId = String(e.active.id);
    const overData = e.over?.data.current as any;
    const overId = e.over?.id != null ? String(e.over.id) : null;

    // Target lane: explicit `lane` data (lane-drop) wins, else infer from card-drop's laneKey,
    // else fall back to the lane recorded during onDragOver.
    const targetLaneKey =
      overData?.lane?.value != null
        ? String(overData.lane.value)
        : overData?.laneKey != null
          ? String(overData.laneKey)
          : overLane ?? null;

    setActiveId(null);
    setOverLane(null);

    const card = cards.find((c) => c.id === cardId);
    if (!card) {
      console.warn(`[JJ Kanban] dragend: no card found for id ${cardId}`);
      return;
    }
    if (!targetLaneKey) {
      console.log("[JJ Kanban] dragend: dropped outside any lane — rolling back");
      // Cancel the optimistic lane change we may have set in onDragOver.
      const origin = dragOriginRef.current;
      if (origin && origin.id === cardId) {
        setOptimistic((s) => {
          const copy = { ...s };
          delete copy[cardId];
          return copy;
        });
      }
      return;
    }

    const lane = config.swimlanes.find((l) => String(l.value) === targetLaneKey);
    if (!lane) {
      console.warn(`[JJ Kanban] dragend: target lane "${targetLaneKey}" not in config`);
      return;
    }

    // Full target lane (may include the active card if same-lane or after dragOver
    // moved it there).
    const targetLaneFull = cardsByLane.get(targetLaneKey) ?? [];
    const targetLaneCards = targetLaneFull.filter((c) => c.id !== cardId);

    // Use the over item's SortableContext index. Dropping ON a card always inserts
    // BEFORE that card (the over card slides down). This matches the visual
    // placeholder @dnd-kit's sortable strategy renders, removes the top-half /
    // bottom-half ambiguity, and matches how Trello/Linear/Jira behave.
    // For drops at the very end, the user drops on the empty space below the last
    // card → e.over is the lane (no sortable.index) → targetIndex = lane length.
    let targetIndex = targetLaneFull.length;
    const sortableInfo = (e.over?.data.current as any)?.sortable;
    if (sortableInfo && typeof sortableInfo.index === "number") {
      targetIndex = sortableInfo.index;
    } else if (overData?.type === "card" && overId) {
      // Defensive fallback if sortable data is missing.
      const idx = targetLaneFull.findIndex((c) => c.id === overId);
      if (idx >= 0) targetIndex = idx;
    }
    console.log(`[JJ Kanban] drop → targetIndex=${targetIndex} (lane length=${targetLaneFull.length})`);

    // Without a sortColumn, only lane-changes are persisted (no manual reorder).
    // Detect no-op against the ORIGINAL lane (not the optimistic-applied one).
    const origin = dragOriginRef.current;
    if (!config.sortColumn) {
      if (origin && origin.id === cardId && origin.laneKey === targetLaneKey) {
        console.log("[JJ Kanban] dragend: same lane, no sortColumn — no-op");
        // roll back the dragOver-induced optimistic lane change if any
        setOptimistic((s) => {
          const copy = { ...s };
          delete copy[cardId];
          return copy;
        });
        return;
      }
    }

    // Decide record updates via the pure (unit-tested) sorting logic.
    let updates: { id: string; sortValue?: number; isMover: boolean }[];
    if (config.sortColumn) {
      const result = computeDropUpdates(targetLaneCards, targetIndex, card.id);
      console.log(`[JJ Kanban] drop mode=${result.mode}, ${result.updates.length} update(s)`);
      updates = result.updates;
    } else {
      updates = [{ id: card.id, isMover: true }];
    }

    console.log(
      `[JJ Kanban] moving "${card.title}" → lane=${lane.label} idx=${targetIndex}; ` +
        `renumbering ${updates.length} card(s)`,
    );

    // Apply optimistic for every renumbered card.
    setOptimistic((s) => {
      const next = { ...s };
      updates.forEach((u) => {
        const existingLane =
          u.isMover
            ? String(lane.value)
            : next[u.id]?.laneKey ?? cards.find((c) => c.id === u.id)?.laneKey ?? targetLaneKey;
        next[u.id] = { laneKey: existingLane, sortValue: u.sortValue };
      });
      return next;
    });

    try {
      await Promise.all(
        updates.map((u) => {
          const payload: Record<string, any> = {};
          if (u.isMover) {
            // Lane change for the dragged card.
            if (config.swimlaneSourceType === "lookup") {
              // delegate to moveCard so it handles @odata.bind
              return dataverse.moveCard(
                config.entityName,
                u.id,
                config.swimlaneColumn,
                lane.value,
                config.swimlaneSourceType,
                config.sortColumn,
                u.sortValue,
              );
            }
            payload[config.swimlaneColumn] = lane.value;
          }
          if (config.sortColumn && typeof u.sortValue === "number") {
            payload[config.sortColumn] = u.sortValue;
          }
          return dataverse.updateRecord(config.entityName, u.id, payload);
        }),
      );
      console.log(`[JJ Kanban] backend update OK for ${card.id}`);
      onChange();
      // No explicit dataset.refresh — it races with subsequent drags and can re-deliver
      // stale records that overwrite the optimistic state. Dynamics will re-fetch on
      // its own (form save, navigation, periodic). The optimistic override stays in
      // local state until baseCards matches it (cleanup useEffect).
    } catch (err) {
      console.error("[JJ Kanban] move failed", err);
      setOptimistic((s) => {
        const copy = { ...s };
        delete copy[card.id];
        return copy;
      });
      showError(`Move failed: ${String((err as Error)?.message ?? err)}`);
    }
  };

  // Drop optimistic overrides only when the real dataset CONFIRMS them.
  // We deliberately do NOT drop overrides for records that are missing from baseCards —
  // a dataset can briefly miss records mid-refresh and we'd then "lose" a card the user
  // just moved.
  React.useEffect(() => {
    if (Object.keys(optimistic).length === 0) return;
    const cleaned: Record<string, OptimisticEntry> = {};
    Object.entries(optimistic).forEach(([id, entry]) => {
      const real = baseCards.find((c) => c.id === id);
      // Drop override when real data matches both lane and (if applicable) sort.
      if (real && real.laneKey === entry.laneKey) {
        if (entry.sortValue == null || real.sortValue === entry.sortValue) {
          console.log(`[JJ Kanban] optimistic cleanup: confirmed ${id} → ${entry.laneKey}`);
          return;
        }
      }
      cleaned[id] = entry;
    });
    if (JSON.stringify(cleaned) !== JSON.stringify(optimistic)) setOptimistic(cleaned);
  }, [baseCards]);

  const activeCard = activeId ? cards.find((c) => c.id === activeId) ?? null : null;

  const footerText =
    totalCount != null && totalCount > loadedCount
      ? `Showing ${loadedCount} of ${totalCount}`
      : `${loadedCount} ${loadedCount === 1 ? "item" : "items"}`;

  return React.createElement(
    "div",
    { className: `jj-kanban jj-kanban--${config.theme.density ?? "comfortable"}` },
    setupWarning &&
      React.createElement(
        "div",
        { className: "jj-kanban__warn-banner", role: "status" },
        "⚠ ",
        setupWarning,
      ),
    errorBanner &&
      React.createElement(
        "div",
        { className: "jj-kanban__error-banner", role: "alert" },
        errorBanner,
      ),
    React.createElement(
      DndContext,
      {
        sensors,
        collisionDetection: kanbanCollision,
        autoScroll: false,
        onDragStart,
        onDragOver,
        onDragEnd,
      },
      React.createElement(
        "div",
        { className: "jj-kanban__lanes" },
        ...config.swimlanes.map((lane) =>
          React.createElement(Swimlane, {
            key: String(lane.value),
            lane,
            cards: cardsByLane.get(String(lane.value)) ?? [],
            layout: config.cardLayout,
            theme: config.theme,
            isDropTarget: overLane === String(lane.value),
            isAnyDragActive: activeId !== null,
            activeCardId: activeId,
            enableSort: !!config.sortColumn,
            onCardOpen: (card: BoardCard) => dataverse.openRecord(card.entityName, card.id),
          }),
        ),
        (cardsByLane.get("__unmatched__")?.length ?? 0) > 0 &&
          React.createElement(Swimlane, {
            key: "__unmatched__",
            lane: {
              value: "__unmatched__",
              label: "Unmatched",
              color: "#9ca3af",
              order: 9999,
              description: "Cards whose swimlane value is null or not in the configured set.",
            },
            cards: cardsByLane.get("__unmatched__") ?? [],
            layout: config.cardLayout,
            theme: config.theme,
            isDropTarget: false,
            isAnyDragActive: activeId !== null,
            activeCardId: activeId,
            enableSort: !!config.sortColumn,
            onCardOpen: (card: BoardCard) => dataverse.openRecord(card.entityName, card.id),
          }),
      ),
      // Footer: counts + Load more
      React.createElement(
        "div",
        { className: "jj-kanban__footer" },
        React.createElement("span", { className: "jj-kanban__count" }, footerText),
        isLoading && React.createElement(Spinner, { size: "extra-tiny", label: "Loading…" }),
        canLoadMore &&
          React.createElement(
            Button,
            {
              size: "small",
              appearance: "secondary",
              disabled: loadingMore || isLoading,
              onClick: onLoadMore,
            },
            loadingMore
              ? "Loading…"
              : totalCount != null
                ? `Load more (${Math.max(0, totalCount - loadedCount)} hidden)`
                : "Load more",
          ),
      ),
      // The host (Dynamics) has transformed ancestors above the kanban container,
      // which means `position: fixed` on a DragOverlay rendered inside the kanban
      // gets clipped by those ancestors' overflow. We portal it to document.body
      // so it lives OUTSIDE every transformed ancestor.
      // dropAnimation null because the snap target rect can also fall inside a
      // clipped container, producing the "card disappears" effect on drop.
      createPortal(
        React.createElement(
          DragOverlay,
          {
            dropAnimation: null,
            zIndex: 100000,
          },
          activeCard
            ? React.createElement(CardVisual, {
                card: activeCard,
                layout: config.cardLayout,
                theme: config.theme,
                asOverlay: true,
              })
            : null,
        ),
        document.body,
      ),
    ),
  );
};

