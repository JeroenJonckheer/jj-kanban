export type SwimlaneSourceType = "choice" | "status" | "lookup" | "bpfstage" | "boolean";

export interface SwimlaneDef {
  /** Raw value stored in the source column (int for choice/status, GUID for lookup/bpf, bool for boolean). */
  value: string | number | boolean | null;
  label: string;
  /** Hex color for the lane header / background tint. */
  color: string;
  order: number;
  wipLimit?: number;
  collapsed?: boolean;
  /** Optional description shown in lane header tooltip. */
  description?: string;
}

export interface CardFieldDef {
  /** Logical name of the column. */
  field: string;
  label?: string;
  /** "text" | "date" | "currency" | "user" | "tag" | "progress" */
  format?: "text" | "date" | "currency" | "user" | "tag" | "progress";
  /** Position in card: "title" | "subtitle" | "body" | "footer" | "accent". */
  slot?: "title" | "subtitle" | "body" | "footer" | "accent";
  /** Optional conditional color rules: [{ when: { eq: "High" }, color: "#e53e3e" }] */
  rules?: { when: Partial<Record<"eq" | "neq" | "lt" | "gt", string | number>>; color: string }[];
}

export interface ThemeDef {
  accent: string;
  surface?: string;
  text?: string;
  cardRadius?: number;
  cardElevation?: number;
  density?: "compact" | "comfortable";
}

export interface KanbanConfig {
  entityName: string;
  swimlaneColumn: string;
  swimlaneSourceType: SwimlaneSourceType;
  swimlanes: SwimlaneDef[];
  cardLayout: CardFieldDef[];
  theme: ThemeDef;
  /** Optional column that stores manual sort order (numeric). Empty = no manual order. */
  sortColumn?: string;
  /** Optional column whose value becomes the card hover tooltip. Empty = default hint. */
  tooltipColumn?: string;
  /** Allow multi-select drag (Shift-click). Default true. */
  multiSelect?: boolean;
}

export interface BoardCard {
  id: string;
  entityName: string;
  title: string;
  subtitle?: string;
  /** Resolved swimlane key as string (we always stringify for keying). */
  laneKey: string;
  /** Raw value (number/string/bool) to send back when updating. */
  laneRawValue: string | number | boolean | null;
  accentColor?: string;
  /** Resolved per-field display values, keyed by logical name. */
  fields: Record<string, { raw: any; formatted: string }>;
  /** True when the current user cannot update this record's swimlane column. */
  readOnly?: boolean;
  /** Numeric value from the sort column, used to order cards within a lane. */
  sortValue?: number;
  /** Resolved hover tooltip text (from tooltipColumn). Undefined = use default hint. */
  tooltip?: string;
}
