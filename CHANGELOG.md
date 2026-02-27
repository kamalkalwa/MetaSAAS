# Changelog

All notable changes to this project are documented in this file.

## [0.0.2] - 2026-02-25

### Problems Solved

- **Dark mode inconsistency across surfaces**: fixed the Tailwind v4 theming architecture so UI tokens resolve at runtime instead of using baked light-mode values.
- **Workflow friction in record management**: added valid-transition-aware status controls and clearer transition errors.
- **Scale bottlenecks in list pages**: added text search, enum filtering, and bulk operations for higher-volume usage.
- **Prototype-to-production reliability gaps**: improved webhook delivery guarantees and added stronger integration safety patterns.

### Added

- New reusable UI components:
  - `DataTable`
  - `Pagination`
  - `SearchFilterBar`
  - `BulkActionsBar`
  - `ConfirmDialog`
  - `Toast`
  - `EmptyState`
  - `Skeleton`
  - `CopyButton`
  - `ImportModal`
- Kanban drag-and-drop with transition-aware validation.
- Related records section on detail pages with quick-add paths.
- CSV import/export flows for operational data movement.
- AI entity evolution flow to modify existing entities from AI prompts.
- Webhook reliability features: exponential backoff retry, circuit breaker, HMAC signature verification, async queue.
- Additional test suites for webhooks, entity evolution, pagination, and UI component coverage.

### Changed

- Version bumped from `0.0.1` to `0.0.2`.
- Theme architecture moved to semantic token layering compatible with multiple themes.
- Dashboard and list experiences improved for faster operator workflows.

### Source

- PR #1: Phase 8 (UX + scale + AI story + production deploy)
- PR #2: Phase 9 (UI component library + dark mode architecture + webhooks + tests)

## [0.0.1] - 2026-02-19

### Added

- Initial release of MetaSAAS (AI-native, entity-driven SaaS framework).
- Action Bus architecture with validation, authorization, execution, and audit.
- Multi-tenant support, RBAC, workflow engine, AI command flows, and generated CRUD stack.
- Baseline unit/integration/E2E test coverage and starter domain entities.
