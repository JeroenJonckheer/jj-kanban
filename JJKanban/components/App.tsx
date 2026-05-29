import * as React from "react";
import {
  FluentProvider,
  webLightTheme,
  webDarkTheme,
  Theme,
} from "@fluentui/react-components";
import type { IInputs } from "../generated/ManifestTypes";
import { KanbanBoard } from "./KanbanBoard";
import { DataverseService } from "../services/DataverseService";
import { ConfigService, configSignature } from "../services/ConfigService";
import type { KanbanConfig } from "../services/types";

export interface AppProps {
  context: ComponentFramework.Context<IInputs>;
  onChange: () => void;
}

/**
 * Top-level shell. CRITICAL: Dynamics calls updateView (which triggers App re-render)
 * on every dataset change AND many other minor events. We must NOT re-resolve config
 * on every render — that would create new config object references, invalidate all
 * downstream memos, and prevent @dnd-kit from committing transforms during drag.
 *
 * Config is resolved only when the *manifest property values* change (entity, columns,
 * etc.). The dataset itself is read straight from `context.parameters.records` and
 * passed through, so data refreshes still flow without rebuilding the config tree.
 */
export const App: React.FC<AppProps> = ({ context, onChange }) => {
  const dataset = context.parameters.records;
  const entityName: string = (dataset as any)?.getTargetEntityType?.() ?? "";

  const themeMode = context.parameters.themeMode?.raw ?? "auto";
  // Single stable key of all config-affecting inputs — see configSignature().
  const sig = configSignature(context);

  // Service instances — stable across renders. We deliberately do NOT depend on
  // `context` because the context object is a new reference on every updateView.
  const ctxRef = React.useRef(context);
  ctxRef.current = context;
  const dataverse = React.useMemo(() => new DataverseService(ctxRef.current), []);
  const configSvc = React.useMemo(() => new ConfigService(dataverse), [dataverse]);

  const [config, setConfig] = React.useState<KanbanConfig | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Re-resolve config only when one of the actual config inputs changes.
  // Primitive deps mean stable references → no extra rebuilds.
  React.useEffect(() => {
    let cancelled = false;
    if (!entityName) return;
    configSvc
      .resolve(ctxRef.current, entityName)
      .then((c) => {
        if (!cancelled) setConfig(c);
        return null;
      })
      .catch((e) => {
        if (!cancelled) setError(String(e?.message ?? e));
        return null;
      });
    return () => {
      cancelled = true;
    };
    // `sig` changes only when a real config input changes — NOT on every updateView.
  }, [sig, entityName, configSvc]);

  const theme: Theme = React.useMemo(() => {
    const hostDark = !!(context as any).fluentDesignLanguage?.isDarkTheme;
    const dark = themeMode === "dark" || (themeMode === "auto" && hostDark);
    return dark ? webDarkTheme : webLightTheme;
    // intentionally only key on themeMode + host theme flag; ignore the context object identity
  }, [themeMode, (context as any).fluentDesignLanguage?.isDarkTheme]);

  if (!entityName) {
    return React.createElement(
      "div",
      { className: "jj-kanban-message" },
      "Bind this control to a subgrid or dataset to start.",
    );
  }
  if (error) {
    return React.createElement("div", { className: "jj-kanban-error" }, "Error: " + error);
  }
  if (!config) {
    return React.createElement("div", { className: "jj-kanban-loading" }, "Loading…");
  }

  return React.createElement(
    FluentProvider,
    { theme, className: "jj-kanban-root" },
    React.createElement(KanbanBoard, {
      context,
      config,
      dataverse,
      onChange,
    }),
  );
};
