import type { IInputs } from "../generated/ManifestTypes";
import { NEUTRAL_LANE_COLOR } from "./colors";
import type { DataverseService } from "./DataverseService";
import type { CardFieldDef, KanbanConfig, SwimlaneDef, SwimlaneSourceType, ThemeDef } from "./types";

/**
 * Resolves the effective KanbanConfig by merging:
 *  1. control manifest properties (lowest priority)
 *  2. metadata from Dataverse (lane labels & default colors)
 *  3. jj_kanbanconfig record (highest priority — wins on conflict)
 */
export class ConfigService {
  constructor(private dv: DataverseService) {}

  async resolve(ctx: ComponentFramework.Context<IInputs>, entityName: string): Promise<KanbanConfig> {
    const swimlaneColumn = ctx.parameters.swimlaneColumn?.raw ?? "statuscode";
    const sourceType = (ctx.parameters.swimlaneSourceType?.raw ?? "choice") as SwimlaneSourceType;
    const configName = ctx.parameters.configRecordName?.raw?.trim();

    // Metadata-derived defaults
    const metaLanes = await this.dv.getSwimlaneOptions(entityName, swimlaneColumn, sourceType);

    const fallbackLayout: CardFieldDef[] = [
      { field: ctx.parameters.titleColumn?.raw || "_primary_", slot: "title", format: "text" },
      ...(ctx.parameters.subtitleColumn?.raw
        ? [{ field: ctx.parameters.subtitleColumn.raw, slot: "subtitle" as const, format: "text" as const }]
        : []),
      ...(ctx.parameters.accentColorColumn?.raw
        ? [{ field: ctx.parameters.accentColorColumn.raw, slot: "accent" as const, format: "text" as const }]
        : []),
    ];

    const fallbackTheme: ThemeDef = {
      accent: "#5b21b6",
      cardRadius: 10,
      cardElevation: 1,
      density: (ctx.parameters.density?.raw ?? "comfortable") as "compact" | "comfortable",
    };

    let lanes = metaLanes;
    let cardLayout = fallbackLayout;
    let theme = fallbackTheme;

    // Overlay with jj_kanbanconfig record when one is named.
    if (configName) {
      try {
        const rec = await this.dv.loadConfigRecord(configName);
        if (rec) {
          const customLanes = safeJson<SwimlaneDef[]>(rec.pp_swimlanes_json);
          if (customLanes?.length) lanes = mergeLanes(metaLanes, customLanes);

          const customCards = safeJson<CardFieldDef[]>(rec.pp_cardlayout_json);
          if (customCards?.length) cardLayout = customCards;

          const customTheme = safeJson<ThemeDef>(rec.pp_theme_json);
          if (customTheme) theme = { ...fallbackTheme, ...customTheme };
        }
      } catch (e) {
        console.warn("[JJ Kanban] config record load failed", e);
      }
    }

    // Lane colour mode: "neutral" forces every lane to the neutral grey regardless
    // of metadata; "auto" (default) keeps the resolved colours.
    const laneColors = (ctx.parameters as any).laneColors?.raw ?? "auto";
    let finalLanes = lanes.sort((a, b) => a.order - b.order);
    if (laneColors === "neutral") {
      finalLanes = finalLanes.map((l) => ({ ...l, color: NEUTRAL_LANE_COLOR }));
    }

    return {
      entityName,
      swimlaneColumn,
      swimlaneSourceType: sourceType,
      swimlanes: finalLanes,
      cardLayout,
      theme,
      sortColumn: ctx.parameters.sortColumn?.raw?.trim() || undefined,
      tooltipColumn: ctx.parameters.tooltipColumn?.raw?.trim() || undefined,
      multiSelect: true,
    };
  }
}

/**
 * A stable string of ONLY the inputs that should trigger a config re-resolve.
 * App uses this as its single effect dependency, so a brand-new `context` object on
 * every updateView (which carries identical values) does NOT rebuild the config tree.
 * This is the guardrail against the render-loop that made dragging "rattle".
 * If a new manifest property should affect config, add it here explicitly.
 */
export function configSignature(ctx: ComponentFramework.Context<IInputs>): string {
  const p = ctx.parameters as any;
  const entity = (ctx.parameters.records as any)?.getTargetEntityType?.() ?? "";
  return [
    entity,
    p.swimlaneColumn?.raw ?? "",
    p.swimlaneSourceType?.raw ?? "",
    p.configRecordName?.raw ?? "",
    p.titleColumn?.raw ?? "",
    p.subtitleColumn?.raw ?? "",
    p.accentColorColumn?.raw ?? "",
    p.sortColumn?.raw ?? "",
    p.tooltipColumn?.raw ?? "",
    p.laneColors?.raw ?? "",
    p.density?.raw ?? "",
  ].join("|");
}

function safeJson<T>(s: string | undefined | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

/** Merge metadata-derived lanes with config overrides keyed on value. */
function mergeLanes(meta: SwimlaneDef[], overrides: SwimlaneDef[]): SwimlaneDef[] {
  const byVal = new Map(meta.map((l) => [String(l.value), l]));
  const merged: SwimlaneDef[] = [];
  overrides.forEach((o, i) => {
    const baseline = byVal.get(String(o.value));
    merged.push({
      ...baseline,
      ...o,
      order: o.order ?? i,
    });
    byVal.delete(String(o.value));
  });
  // Append any lanes from metadata that the user did not configure (so nothing is lost).
  byVal.forEach((l) => merged.push({ ...l, order: merged.length }));
  return merged;
}
