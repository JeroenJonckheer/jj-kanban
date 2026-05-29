# JJ Kanban

A configurable, drag-and-drop **Kanban board** for Microsoft Dynamics 365 / Dataverse, built as a
**PCF (Power Apps Component Framework)** dataset control. Bind it to any table view — on a form or a
dashboard — and drag records between swimlanes to update their status; the change is written straight
back to Dataverse.

> Control: `jj_Boards.Kanban` · publisher prefix `jj` · virtual React control.

## Demo

[▶︎ Watch the demo clip](media/jj-kanban-demo.webm) — the same control, configured first as a project
**task board** and then as a **sales-leads** board, showing drag-and-drop across statuses.

## Features

- **Drag & drop between swimlanes** — moving a card updates the record's status column, with an
  optimistic UI and automatic rollback if the save fails.
- **Manual ordering within a lane** — optional sort column lets users reorder cards; the new position
  is persisted (fractional indexing, no mass-renumbering).
- **Any swimlane source** — Choice (option set), Status/Status reason, Lookup, Business Process Flow
  stage, or Yes/No.
- **Colours from metadata** — lane colours come from the Choice/Status definition automatically, with a
  calm neutral-grey fallback (or force neutral).
- **Configurable cards** — choose the title, subtitle, accent-colour and hover-tooltip columns.
- **Works on forms and dashboards**, desktop / tablet / phone.
- **Accessible** — keyboard drag & drop, WCAG-aware text contrast.
- **Tidy at scale** — page size control with a "load more" affordance, compact/comfortable density,
  light/dark/auto theme.

## Configuration (control properties)

| Property | Required | Description |
|---|---|---|
| `swimlaneColumn` | ✓ | Logical name of the column that drives the lanes (e.g. `statuscode`). |
| `swimlaneSourceType` | ✓ | `choice` · `status` · `lookup` · `bpfstage` · `boolean`. |
| `titleColumn` | | Card title column (defaults to the primary name column). |
| `subtitleColumn` | | Optional subtitle under the title. |
| `accentColorColumn` | | Optional column with a hex colour for the card accent stripe. |
| `tooltipColumn` | | Optional column shown as the card hover tooltip (empty = "Double-click to open"). |
| `sortColumn` | | Decimal/float column for manual within-lane ordering. |
| `pageSize` | | Records to load at once (default 100). |
| `laneColors` | | `auto` (metadata colours) or `neutral`. |
| `density` | | `comfortable` or `compact`. |
| `themeMode` | | `auto` · `light` · `dark`. |
| `configRecordName` | | (Optional) name of a `jj_kanbanconfig` record for runtime configuration. |

## Build & deploy

Requires [Node.js](https://nodejs.org), the [.NET SDK](https://dotnet.microsoft.com) and the
[Power Platform CLI](https://aka.ms/PowerPlatformCLI) (`pac`).

```bash
npm install
npm run build                                            # build the control

# build a deployable (managed) solution:
dotnet build solution/JJKanbanSolution.cdsproj -c Release

# import into your environment:
pac auth create --url https://YOURORG.crm.dynamics.com
pac solution import --path solution/bin/Release/JJKanbanSolution.zip --publish-changes
```

Then add the control to a view, subgrid or dashboard list and set the properties above.

The control uses the host-provided **React 16** and **Fluent UI 9** platform libraries.

## Customization & commercial support

JJ Kanban is free and open source (MIT) — use it, ship it, learn from it.

**Need it tailored to your organisation?** Extra swimlane sources, bespoke card layouts, WIP limits and
policies, a point-and-click configuration UI, theming, or integration with your processes — I take on
paid customization and support for companies with specific requirements.

**Jeroen Jonckheer** · [platformpower.nl](https://www.platformpower.nl) · [LinkedIn](https://www.linkedin.com/in/jeroen-jonckheer/) · jeroen.jonckheer@platformpower.nl

## License

[MIT](LICENSE) © 2026 Jeroen Jonckheer
