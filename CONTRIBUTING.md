# Contributing to JJ Kanban

Thanks for taking the time to contribute! Bug reports, ideas and pull requests are all welcome.

## Reporting bugs / requesting features

Please open an [issue](../../issues/new/choose) using one of the templates. For bugs, include your
environment (Dynamics/Dataverse version), the control configuration (swimlane column & source type),
and steps to reproduce.

## Development setup

Prerequisites: [Node.js](https://nodejs.org) 18+, the [.NET SDK](https://dotnet.microsoft.com), and the
[Power Platform CLI](https://aka.ms/PowerPlatformCLI) (`pac`).

```bash
npm install
npm run build      # compile & bundle the control
npm run lint       # ESLint
```

To produce an importable solution:

```bash
dotnet build solution/JJKanbanSolution.cdsproj -c Release
```

## Pull requests

1. Fork the repo and create a topic branch (`feature/...` or `fix/...`).
2. Keep changes focused; match the existing TypeScript style and folder layout.
3. Make sure `npm run build` and `npm run lint` pass.
4. Describe the change and the use case in the PR (see the PR template).

## Code layout

```
JJKanban/
  ControlManifest.Input.xml   control definition & properties
  index.ts                    PCF entry point (Boards.Kanban)
  components/                 React UI (board, lane, card)
  services/                   pure logic: grouping, sorting, colours, config, Dataverse access
  css/ · strings/             styling & localized labels
solution/                     Dataverse solution wrapper (builds the importable zip)
```

## License

By contributing, you agree that your contributions are licensed under the project's
[MIT License](LICENSE).
