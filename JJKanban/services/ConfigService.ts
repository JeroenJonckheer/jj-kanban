import type { IInputs } from "../generated/ManifestTypes";
import { NEUTRAL_LANE_COLOR } from "./colors";
import type { DataverseService } from "./DataverseService";
import type { CardFieldDef, KanbanConfig, SwimlaneSourceType, ThemeDef } from "./types";

/**
 * Resolves the effective KanbanConfig from the control's manifest properties plus
 * Dataverse metadata (lane labels & default colours).
 */
export class ConfigService {
  constructor(private dv: DataverseService) {}

  async resolve(ctx: ComponentFramework.Context<IInputs>, entityName: string): Promise<KanbanConfig> {
    const swimlaneColumn = ctx.parameters.swimlaneColumn?.raw ?? "statuscode";
    const sourceType = (ctx.parameters.swimlaneSourceType?.raw ?? "choice") as SwimlaneSourceType;

    // Lanes come from the column's metadata (labels + colours).
    const metaLanes = await this.dv.getSwimlaneOptions(entityName, swimlaneColumn, sourceType);

    const cardLayout: CardFieldDef[] = [
      { field: ctx.parameters.titleColumn?.raw || "_primary_", slot: "title", format: "text" },
      ...(ctx.parameters.subtitleColumn?.raw
        ? [{ field: ctx.parameters.subtitleColumn.raw, slot: "subtitle" as const, format: "text" as const }]
        : []),
      ...(ctx.parameters.accentColorColumn?.raw
        ? [{ field: ctx.parameters.accentColorColumn.raw, slot: "accent" as const, format: "text" as const }]
        : []),
    ];

    const theme: ThemeDef = {
      accent: "#5b21b6",
      cardRadius: 10,
      cardElevation: 1,
      density: (ctx.parameters.density?.raw ?? "comfortable") as "compact" | "comfortable",
    };

    // Lane colour mode: "neutral" forces every lane to the neutral grey regardless
    // of metadata; "auto" (default) keeps the metadata colours. (Copy before sorting
    // so the cached metadata array isn't mutated in place.)
    const laneColors = (ctx.parameters as any).laneColors?.raw ?? "auto";
    let swimlanes = [...metaLanes].sort((a, b) => a.order - b.order);
    if (laneColors === "neutral") {
      swimlanes = swimlanes.map((l) => ({ ...l, color: NEUTRAL_LANE_COLOR }));
    }

    return {
      entityName,
      swimlaneColumn,
      swimlaneSourceType: sourceType,
      swimlanes,
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
    p.titleColumn?.raw ?? "",
    p.subtitleColumn?.raw ?? "",
    p.accentColorColumn?.raw ?? "",
    p.sortColumn?.raw ?? "",
    p.tooltipColumn?.raw ?? "",
    p.laneColors?.raw ?? "",
    p.density?.raw ?? "",
  ].join("|");
}
