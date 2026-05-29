# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [1.0.1] — 2026-05-29

First public release.

### Added
- Drag-and-drop Kanban board as a PCF dataset control (`jj_Boards.Kanban`).
- Swimlane sources: Choice, Status/Status reason, Lookup, Business Process Flow stage, Yes/No.
- Lane colours from Choice/Status metadata, with a neutral-grey fallback (or forced neutral).
- Configurable card title, subtitle, accent-colour and hover-tooltip columns.
- Manual within-lane ordering via an optional sort column (fractional indexing).
- Optimistic moves with automatic rollback on save failure.
- Page-size control with "load more", compact/comfortable density, and light/dark/auto theming.
- Keyboard drag & drop and WCAG-aware text contrast.
- Buildable managed solution (`solution/`).
