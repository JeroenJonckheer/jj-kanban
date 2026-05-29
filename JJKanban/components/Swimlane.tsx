import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Tooltip, mergeClasses } from "@fluentui/react-components";
import { Card } from "./Card";
import type { BoardCard, CardFieldDef, SwimlaneDef, ThemeDef } from "../services/types";
import { rgba, readableText } from "./theme";

export interface SwimlaneProps {
  lane: SwimlaneDef;
  cards: BoardCard[];
  layout: CardFieldDef[];
  theme: ThemeDef;
  /** When true, cards within this lane can be re-ordered via drag. */
  enableSort?: boolean;
  isDropTarget?: boolean;
  isAnyDragActive?: boolean;
  activeCardId?: string | null;
  onCardClick?: (card: BoardCard, e: React.MouseEvent) => void;
  onCardOpen?: (card: BoardCard, e: React.MouseEvent) => void;
  selectedIds?: Set<string>;
}

const Chevron: React.FC<{ open: boolean }> = ({ open }) =>
  React.createElement(
    "svg",
    {
      width: 16,
      height: 16,
      viewBox: "0 0 20 20",
      style: {
        transform: open ? "rotate(0deg)" : "rotate(-90deg)",
        transition: "transform 220ms cubic-bezier(.2,.8,.2,1)",
      },
      "aria-hidden": true,
    },
    React.createElement("path", {
      d: "M5 7l5 6 5-6",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
  );

function renderCards(
  cards: BoardCard[],
  layout: CardFieldDef[],
  theme: ThemeDef,
  enableSort: boolean | undefined,
  isAnyDragActive: boolean | undefined,
  onCardClick: ((card: BoardCard, e: React.MouseEvent) => void) | undefined,
  onCardOpen: ((card: BoardCard, e: React.MouseEvent) => void) | undefined,
  selectedIds: Set<string> | undefined,
): React.ReactNode {
  const items =
    cards.length === 0
      ? [
          React.createElement(
            "div",
            { key: "__empty", className: "jj-lane__empty" },
            isAnyDragActive ? "Drop here" : "No items",
          ),
        ]
      : cards.map((card) =>
          React.createElement(Card, {
            key: card.id,
            card,
            layout,
            theme,
            selected: selectedIds?.has(card.id),
            onClick: (e: React.MouseEvent) => onCardClick?.(card, e),
            onDoubleClick: (e: React.MouseEvent) => onCardOpen?.(card, e),
          }),
        );

  // Only wrap in SortableContext when manual sorting is enabled. Without it, cards
  // are still draggable (cross-lane) but won't visually reorder within a lane — which
  // matches the actual behaviour (no persistence without a sort column).
  if (!enableSort) return items;
  return React.createElement(
    SortableContext as any,
    { items: cards.map((c) => c.id), strategy: verticalListSortingStrategy },
    ...items,
  );
}

export const Swimlane: React.FC<SwimlaneProps> = ({
  lane,
  cards,
  layout,
  theme,
  enableSort,
  isDropTarget,
  isAnyDragActive,
  onCardClick,
  onCardOpen,
  selectedIds,
}) => {
  const [collapsed, setCollapsed] = React.useState(!!lane.collapsed);
  const droppable = useDroppable({ id: `lane:${String(lane.value)}`, data: { lane } });

  const overWipLimit = lane.wipLimit !== undefined && cards.length > lane.wipLimit;
  const headerBg = lane.color;
  const headerFg = readableText(lane.color);
  // 3D text: white text on dark headers gets an engraved (dark) shadow; dark text
  // on light/grey headers gets an embossed (light) shadow.
  const headerTextShadow =
    headerFg === "#ffffff" ? "0 1px 1px rgba(0,0,0,0.35)" : "0 1px 0 rgba(255,255,255,0.55)";

  const tintWhenDragOver: React.CSSProperties = isDropTarget
    ? {
        background: `linear-gradient(180deg, ${rgba(lane.color, 0.18)} 0%, ${rgba(lane.color, 0.06)} 100%)`,
        boxShadow: `inset 0 0 0 2px ${lane.color}`,
      }
    : {
        background: rgba(lane.color, 0.03),
      };

  return React.createElement(
    "div",
    {
      className: mergeClasses(
        "jj-lane",
        collapsed && "jj-lane--collapsed",
        isAnyDragActive && "jj-lane--dropable",
        isDropTarget && "jj-lane--over",
      ),
      style: { ...tintWhenDragOver, transition: "all 220ms cubic-bezier(.2,.8,.2,1)" },
    },
    React.createElement(
      "div",
      {
        className: "jj-lane__header",
        style: { background: headerBg, color: headerFg, textShadow: headerTextShadow },
        onClick: () => setCollapsed((c) => !c),
      },
      React.createElement(
        "span",
        { className: "jj-lane__chev" },
        React.createElement(Chevron, { open: !collapsed }),
      ),
      React.createElement("span", { className: "jj-lane__label" }, lane.label),
      React.createElement(
        Tooltip,
        {
          content: overWipLimit ? `Over WIP limit (${lane.wipLimit})` : `${cards.length} items`,
          relationship: "label",
        },
        React.createElement(
          "span",
          {
            className: mergeClasses("jj-lane__count", overWipLimit && "jj-lane__count--over"),
          },
          lane.wipLimit !== undefined ? `${cards.length} / ${lane.wipLimit}` : String(cards.length),
        ),
      ),
    ),
    !collapsed &&
      React.createElement(
        "div",
        {
          ref: droppable.setNodeRef,
          className: "jj-lane__body",
          "data-jj-lane-id": String(lane.value),
        },
        renderCards(cards, layout, theme, enableSort, isAnyDragActive, onCardClick, onCardOpen, selectedIds),
      ),
  );
};
