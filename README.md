<div align="center">

# JJ Kanban

### Turn any Dataverse table into a beautiful, drag-and-drop Kanban board — no code.

[![License: MIT](https://img.shields.io/badge/license-MIT-2ea44f.svg)](LICENSE)
[![Power Platform](https://img.shields.io/badge/Power%20Platform-PCF%20control-742774.svg)](https://learn.microsoft.com/power-apps/developer/component-framework/overview)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Made by Jeroen Jonckheer](https://img.shields.io/badge/made%20by-Jeroen%20Jonckheer-14b8a6.svg)](https://www.platformpower.nl)

A configurable **Kanban board** for Microsoft Dynamics 365 / Dataverse, built as a
**PCF (Power Apps Component Framework)** dataset control. Bind it to any view — on a form or a
dashboard — drag records between swimlanes, reorder within a lane, and every change is written
straight back to Dataverse.

</div>

## Demo

<video src="https://github.com/JeroenJonckheer/jj-kanban/raw/main/media/jj-kanban-demo.webm" controls width="100%"></video>

> The **same control**, configured first as a project **task board**, then as a **sales-leads** board.
> ▶︎ If the player doesn't load, [watch the clip here](media/jj-kanban-demo.webm).

## What you can build

One control, endless boards — anything with a status, stage or category becomes a board:

- 🧲 **Sales & acquisition pipelines** — leads and opportunities by temperature or stage
- 🧑‍💼 **Recruitment / ATS** — candidates through *New → Screening → Interview → Offer → Hired*
- ✅ **Project & team task boards** — *New → In progress → Done → Closed*
- 🎫 **Support ticket triage** — by priority, queue or SLA status
- 📝 **Approvals & reviews** — drafts moving through review gates
- 🗓️ **Editorial / content calendars** — idea → writing → review → published
- 📦 **Order / case / asset status** — fulfilment, onboarding, maintenance states
- 🔄 **Business Process Flow stages** — visualise and move records across BPF stages

If it lives in Dataverse and has a Choice, Status, Lookup, Yes/No or BPF stage column, JJ Kanban can
turn it into a board.

## Features

- **Drag & drop between swimlanes** — moving a card updates the status column, with an optimistic UI
  and automatic rollback if the save fails.
- **Manual ordering within a lane** — optional sort column lets users reorder cards; the new position
  is persisted (fractional indexing, no mass-renumbering).
- **Any swimlane source** — Choice (option set), Status / Status reason, Lookup, Business Process Flow
  stage, or Yes/No.
- **Colours from metadata** — lane colours come straight from the Choice/Status definition, with a calm
  neutral-grey fallback (or force neutral).
- **Configurable cards** — pick the title, subtitle, accent-colour and hover-tooltip columns.
- **Works on forms *and* dashboards** — desktop, tablet and phone.
- **Accessible** — full keyboard drag & drop and WCAG-aware text contrast.
- **Tidy at scale** — page-size control with a "load more" affordance, compact/comfortable density,
  and light / dark / auto theming.

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

## Install

### Option A — import the ready-made solution (no build)

1. Download `JJKanban_managed.zip` from the [latest release](../../releases/latest).
2. Import it: **make.powerapps.com → Solutions → Import solution**, or:
   ```bash
   pac auth create --url https://YOURORG.crm.dynamics.com
   pac solution import --path JJKanban_managed.zip --publish-changes
   ```
3. Add **JJ Kanban** to a view, subgrid or dashboard list and set the properties above.

### Option B — build from source

Requires [Node.js](https://nodejs.org), the [.NET SDK](https://dotnet.microsoft.com) and the
[Power Platform CLI](https://aka.ms/PowerPlatformCLI) (`pac`).

```bash
npm install
npm run build                                            # build the control
dotnet build solution/JJKanbanSolution.cdsproj -c Release  # build the managed solution
pac solution import --path solution/bin/Release/JJKanbanSolution.zip --publish-changes
```

The control uses the host-provided **React 16** and **Fluent UI 9** platform libraries.

## Customization & commercial support

JJ Kanban is free and open source (MIT) — use it, ship it, learn from it. 💚

**Need it tailored to your organisation?** Extra swimlane sources, bespoke card layouts, WIP limits and
policies, a point-and-click configuration UI, theming, or integration with your processes — I take on
paid customization and support for companies with specific requirements.

**Jeroen Jonckheer** · [platformpower.nl](https://www.platformpower.nl) · [LinkedIn](https://www.linkedin.com/in/jeroen-jonckheer/) · jeroen.jonckheer@platformpower.nl

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © 2026 Jeroen Jonckheer
