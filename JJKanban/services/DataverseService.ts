import type { IInputs } from "../generated/ManifestTypes";
import type { SwimlaneDef, SwimlaneSourceType } from "./types";
import { NEUTRAL_LANE_COLOR, normalizeColor } from "./colors";

/**
 * Thin wrapper around context.webAPI + Xrm.Utility for metadata + record updates.
 * All metadata reads are cached per-control-instance so the board stays snappy.
 */
export class DataverseService {
  private metaCache = new Map<string, any>();

  constructor(private ctx: ComponentFramework.Context<IInputs>) {}

  private get webApi(): ComponentFramework.WebApi {
    return this.ctx.webAPI;
  }

  /** Fetch entity metadata (primary name, primary id, set name). */
  async getEntityMeta(entityName: string): Promise<{
    primaryNameAttribute: string;
    primaryIdAttribute: string;
    entitySetName: string;
  }> {
    const key = `meta:${entityName}`;
    if (this.metaCache.has(key)) return this.metaCache.get(key);

    // EntityDefinitions(LogicalName='...')?$select=PrimaryNameAttribute,PrimaryIdAttribute,EntitySetName
    const url = `EntityDefinitions(LogicalName='${entityName}')?$select=PrimaryNameAttribute,PrimaryIdAttribute,EntitySetName`;
    const result = await this.fetchOData(url);
    const value = {
      primaryNameAttribute: result.PrimaryNameAttribute,
      primaryIdAttribute: result.PrimaryIdAttribute,
      entitySetName: result.EntitySetName,
    };
    this.metaCache.set(key, value);
    return value;
  }

  /** Fetch swimlane options for a given source-type. */
  async getSwimlaneOptions(
    entityName: string,
    columnName: string,
    sourceType: SwimlaneSourceType,
  ): Promise<SwimlaneDef[]> {
    const key = `lanes:${entityName}:${columnName}:${sourceType}`;
    if (this.metaCache.has(key)) return this.metaCache.get(key);

    let lanes: SwimlaneDef[] = [];
    switch (sourceType) {
      case "choice":
        lanes = await this.fetchChoiceOptions(entityName, columnName);
        break;
      case "status":
        lanes = await this.fetchStatusOptions(entityName, columnName);
        break;
      case "boolean":
        lanes = await this.fetchBooleanOptions(entityName, columnName);
        break;
      case "lookup":
        lanes = await this.fetchLookupOptions(entityName, columnName);
        break;
      case "bpfstage":
        lanes = await this.fetchBpfStages(entityName);
        break;
    }
    this.metaCache.set(key, lanes);
    return lanes;
  }

  private async fetchChoiceOptions(entity: string, column: string): Promise<SwimlaneDef[]> {
    const url =
      `EntityDefinitions(LogicalName='${entity}')/Attributes(LogicalName='${column}')` +
      `/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$expand=OptionSet`;
    const meta = await this.fetchOData(url);
    const options = meta?.OptionSet?.Options ?? [];
    return options.map((o: any, i: number) => ({
      value: o.Value,
      label: o.Label?.UserLocalizedLabel?.Label ?? String(o.Value),
      color: normalizeColor(o.Color),
      order: i,
    }));
  }

  private async fetchStatusOptions(entity: string, column: string): Promise<SwimlaneDef[]> {
    const url =
      `EntityDefinitions(LogicalName='${entity}')/Attributes(LogicalName='${column}')` +
      `/Microsoft.Dynamics.CRM.StatusAttributeMetadata?$expand=OptionSet`;
    const meta = await this.fetchOData(url);
    const options = meta?.OptionSet?.Options ?? [];
    return options.map((o: any, i: number) => ({
      value: o.Value,
      label: o.Label?.UserLocalizedLabel?.Label ?? String(o.Value),
      color: normalizeColor(o.Color),
      order: i,
    }));
  }

  private async fetchBooleanOptions(entity: string, column: string): Promise<SwimlaneDef[]> {
    const url =
      `EntityDefinitions(LogicalName='${entity}')/Attributes(LogicalName='${column}')` +
      `/Microsoft.Dynamics.CRM.BooleanAttributeMetadata?$expand=OptionSet`;
    const meta = await this.fetchOData(url);
    const os = meta?.OptionSet;
    const t = os?.TrueOption;
    const f = os?.FalseOption;
    return [
      {
        value: false,
        label: f?.Label?.UserLocalizedLabel?.Label ?? "No",
        color: normalizeColor(f?.Color),
        order: 0,
      },
      {
        value: true,
        label: t?.Label?.UserLocalizedLabel?.Label ?? "Yes",
        color: normalizeColor(t?.Color),
        order: 1,
      },
    ];
  }

  private async fetchLookupOptions(entity: string, column: string): Promise<SwimlaneDef[]> {
    // Resolve the lookup target entity then read all records as lanes (cap to 30 to be safe).
    const lookupMeta = await this.fetchOData(
      `EntityDefinitions(LogicalName='${entity}')/Attributes(LogicalName='${column.replace(/^_|_value$/g, "")}')` +
        `/Microsoft.Dynamics.CRM.LookupAttributeMetadata?$select=Targets`,
    );
    const target = lookupMeta?.Targets?.[0];
    if (!target) return [];
    const targetMeta = await this.getEntityMeta(target);
    const list = await this.webApi.retrieveMultipleRecords(
      target,
      `?$select=${targetMeta.primaryIdAttribute},${targetMeta.primaryNameAttribute}&$top=30`,
    );
    return list.entities.map((e: any, i: number) => ({
      value: e[targetMeta.primaryIdAttribute],
      label: e[targetMeta.primaryNameAttribute] ?? "(unnamed)",
      color: NEUTRAL_LANE_COLOR,
      order: i,
    }));
  }

  private async fetchBpfStages(entity: string): Promise<SwimlaneDef[]> {
    // Find the active BPF for the entity and list its stages.
    const bpf = await this.webApi.retrieveMultipleRecords(
      "workflow",
      `?$select=workflowid,name,clientdata&$filter=primaryentity eq '${entity}' and category eq 4 and statecode eq 1`,
    );
    if (!bpf.entities.length) return [];
    // Stages are stored in clientdata XAML; for MVP we use processstage table instead.
    const stages = await this.webApi.retrieveMultipleRecords(
      "processstage",
      `?$select=processstageid,stagename,stagecategory&$filter=_processid_value eq ${bpf.entities[0].workflowid}&$orderby=stagename`,
    );
    return stages.entities.map((s: any, i: number) => ({
      value: s.processstageid,
      label: s.stagename ?? `Stage ${i + 1}`,
      color: NEUTRAL_LANE_COLOR,
      order: i,
    }));
  }

  /** Update a single column on a record. */
  async updateRecord(entityName: string, recordId: string, payload: Record<string, any>): Promise<void> {
    await this.webApi.updateRecord(entityName, recordId, payload);
  }

  /** Move a record to a new swimlane and optionally update its manual sort value. */
  async moveCard(
    entityName: string,
    recordId: string,
    swimlaneColumn: string,
    newValue: string | number | boolean | null,
    sourceType: SwimlaneSourceType,
    sortColumn?: string,
    newSortValue?: number,
  ): Promise<void> {
    const payload: Record<string, any> = {};

    if (sourceType === "lookup") {
      const navProp = swimlaneColumn.replace(/^_/, "").replace(/_value$/, "");
      if (newValue === null) {
        payload[`${navProp}@odata.bind`] = null;
      } else {
        const meta = await this.fetchOData(
          `EntityDefinitions(LogicalName='${entityName}')/Attributes(LogicalName='${navProp}')` +
            `/Microsoft.Dynamics.CRM.LookupAttributeMetadata?$select=Targets`,
        );
        const target = meta?.Targets?.[0];
        const targetMeta = await this.getEntityMeta(target);
        payload[`${navProp}@odata.bind`] = `/${targetMeta.entitySetName}(${newValue})`;
      }
    } else if (sourceType === "bpfstage") {
      payload[swimlaneColumn] = newValue;
    } else {
      payload[swimlaneColumn] = newValue;
    }

    if (sortColumn && typeof newSortValue === "number" && Number.isFinite(newSortValue)) {
      payload[sortColumn] = newSortValue;
    }

    await this.webApi.updateRecord(entityName, recordId, payload);
  }

  /** Open the standard form for a record. Tries PCF context.navigation first
   *  (preferred — respects host), falls back to Xrm.Navigation which is always
   *  available inside a model-driven app. */
  openRecord(entityName: string, recordId: string): void {
    const opts = { entityName, entityId: recordId };
    const nav = (this.ctx as any).navigation;
    if (nav?.openForm) {
      try {
        nav.openForm(opts);
        return;
      } catch (e) {
        console.warn("[JJ Kanban] context.navigation.openForm failed, falling back to Xrm", e);
      }
    }
    const xrm = (window as any).Xrm;
    if (xrm?.Navigation?.openForm) {
      xrm.Navigation.openForm(opts);
    } else {
      console.warn("[JJ Kanban] no navigation API available to open record", opts);
    }
  }

  /** Try to load a jj_kanbanconfig record by name. */
  async loadConfigRecord(name: string): Promise<any | null> {
    const safe = name.replace(/'/g, "''");
    const result = await this.webApi.retrieveMultipleRecords(
      "jj_kanbanconfig",
      `?$select=jj_name,jj_entityname,jj_swimlanesource,jj_swimlanes_json,jj_cardlayout_json,jj_theme_json,jj_sourcetype&$filter=jj_name eq '${safe}'&$top=1`,
    );
    return result.entities[0] ?? null;
  }

  /** Generic OData GET against the org's Web API root (used for metadata). */
  private async fetchOData(relative: string): Promise<any> {
    const clientUrl = (this.ctx as any).page?.getClientUrl?.() ?? (window as any).Xrm?.Utility?.getGlobalContext?.()?.getClientUrl?.();
    const url = `${clientUrl}/api/data/v9.2/${relative}`;
    const resp = await fetch(url, {
      headers: {
        "OData-Version": "4.0",
        "OData-MaxVersion": "4.0",
        Accept: "application/json",
        "Content-Type": "application/json; charset=utf-8",
      },
      credentials: "include",
    });
    if (!resp.ok) throw new Error(`OData ${resp.status}: ${await resp.text()}`);
    return resp.json();
  }

}
