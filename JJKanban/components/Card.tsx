import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Avatar, Badge, mergeClasses } from "@fluentui/react-components";
import type { BoardCard, CardFieldDef, ThemeDef } from "../services/types";
import { rgba } from "./theme";

export interface CardProps {
  card: BoardCard;
  layout: CardFieldDef[];
  theme: ThemeDef;
  selected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
}

const slot = (layout: CardFieldDef[], s: CardFieldDef["slot"]) => layout.find((f) => f.slot === s);

/** Pure visual representation of a card. Used both inside a lane (wrapped by Card)
 *  and inside the DragOverlay (rendered directly). Has no DnD hooks. */
export const CardVisual: React.FC<{
  card: BoardCard;
  layout: CardFieldDef[];
  theme: ThemeDef;
  selected?: boolean;
  asOverlay?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
}> = ({ card, layout, theme, selected, asOverlay, onClick, onDoubleClick }) => {
  const titleField = slot(layout, "title");
  const subtitleField = slot(layout, "subtitle");
  const accentField = slot(layout, "accent");

  const accent =
    (card.accentColor && card.accentColor !== "" ? card.accentColor : null) ??
    (accentField ? String(card.fields[accentField.field]?.raw ?? "") : "") ??
    theme.accent;

  const title =
    card.title ||
    (titleField && titleField.field !== "_primary_"
      ? card.fields[titleField.field]?.formatted
      : "(untitled)");
  const subtitle = subtitleField ? card.fields[subtitleField.field]?.formatted : card.subtitle;

  const bodyFields = layout.filter((f) => f.slot === "body");
  const footerFields = layout.filter((f) => f.slot === "footer");

  return React.createElement(
    "div",
    {
      onClick,
      onDoubleClick,
      className: mergeClasses(
        "jj-card",
        selected && "jj-card--selected",
        card.readOnly && "jj-card--readonly",
        asOverlay && "jj-card--overlay",
      ),
      title: card.tooltip || "Double-click to open",
    },
    React.createElement("div", {
      className: "jj-card__accent",
      style: {
        background: accent || theme.accent,
        boxShadow: `0 0 12px ${rgba(accent || theme.accent, 0.5)}`,
      },
    }),
    React.createElement(
      "div",
      { className: "jj-card__body" },
      title && React.createElement("div", { className: "jj-card__title" }, title),
      subtitle && React.createElement("div", { className: "jj-card__subtitle" }, subtitle),
      bodyFields.length > 0 &&
        React.createElement(
          "div",
          { className: "jj-card__fields" },
          bodyFields.map((f) =>
            React.createElement(
              "div",
              { key: f.field, className: "jj-card__field" },
              f.label && React.createElement("span", { className: "jj-card__field-label" }, f.label),
              React.createElement(
                "span",
                { className: "jj-card__field-value" },
                card.fields[f.field]?.formatted ?? "",
              ),
            ),
          ),
        ),
      footerFields.length > 0 &&
        React.createElement(
          "div",
          { className: "jj-card__footer" },
          footerFields.map((f) => renderFooterField(f, card)),
        ),
    ),
    card.readOnly &&
      React.createElement(
        "div",
        { className: "jj-card__lock", title: "Read-only" },
        "🔒",
      ),
  );
};

function renderFooterField(f: CardFieldDef, card: BoardCard): React.ReactElement {
  const v = card.fields[f.field];
  if (!v) return React.createElement("span", { key: f.field });
  if (f.format === "user") {
    return React.createElement(Avatar, { key: f.field, name: v.formatted, size: 24 });
  }
  if (f.format === "tag") {
    return React.createElement(
      Badge,
      { key: f.field, appearance: "tint", color: "informative" },
      v.formatted,
    );
  }
  return React.createElement("span", { key: f.field, className: "jj-card__chip" }, v.formatted);
}

/** Card that lives inside a lane. Uses useDraggable. When a DragOverlay is mounted
 *  for the active id, useDraggable returns transform=null for the active item, so
 *  the in-lane card stays put while the overlay clone floats. */
export const Card: React.FC<CardProps> = ({ card, layout, theme, selected, onClick, onDoubleClick }) => {
  // useSortable enables within-lane reordering visualisation: cards shift to make
  // room for the active card. DragOverlay handles the cross-lane floating clone.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: card.readOnly,
    data: { laneKey: card.laneKey, type: "card" },
  });

  const outerStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    cursor: card.readOnly ? "not-allowed" : "grab",
    touchAction: "none",
    position: "relative",
  };

  return React.createElement(
    "div",
    {
      ref: setNodeRef,
      ...attributes,
      ...listeners,
      style: outerStyle,
      className: "jj-card-wrap",
      "data-jj-card-id": card.id,
    },
    React.createElement(CardVisual, { card, layout, theme, selected, onClick, onDoubleClick }),
  );
};
