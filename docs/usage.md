# Usage Guide

This guide explains how to navigate the Hyperpage portal, how widgets retrieve data, and how personalization works in the current Next.js implementation.

## Dashboard Layout

The application uses a fixed shell so navigation elements stay anchored while data scrolls underneath.

- **Top Bar (64px, fixed)** – contains the Hyperpage logo, the global search field, a manual refresh button, theme toggle, and the auth dropdown. The actions are implemented in `TopBar.tsx` and `TopBarActions.tsx`.
- **Tab Navigation (48px, fixed)** – today there is a single `Overview` tab rendered by `TabNavigation.tsx`. The component keeps the API surface flexible for future tabs, but only `overview` is active now.
- **Main Content Area** – the section beneath the headers hosts `PortalOverview`. It contains the error summary, search results header, widget grid, and the tool status row.

The fixed positioning in `Portal.tsx` ensures the top bar, tabs, and content offsets stay consistent across breakpoints (`top-0`, `top-16`, `top-28`).

## Widgets & Data Flow

Widgets are declared in each tool definition (`tools/*/index.ts`). They populate automatically at runtime:

1. `/api/tools/enabled` returns sanitized tool definitions with widget metadata.
2. `useToolQueries` inspects those widgets and schedules React Query requests for every `apiEndpoint` marked as `dynamic`.
3. Polling intervals are adjusted in real time. The hook inspects rate-limit telemetry and browser activity to slow down when APIs approach quota or the tab is inactive.
4. `PortalOverview` feeds each widget into `ToolWidgetGrid`, which currently renders table-based widgets through the shared `DataTable` component.
5. Users can trigger a refresh per widget via the inline button or refresh everything via the header action.

Additional instrumentation:

- `PortalErrorSummary` aggregates failures per tool/endpoint and surfaces them alongside the `WidgetTelemetryPanel`.
- `ToolStatusRow` displays rate-limit indicators and error badges using the same telemetry feed.

## Global Search

`GlobalSearchInput` filters widget data client-side. The helper `processPortalData` lowercases the query, inspects every field in the widget rows, and returns only matches. When a query is active, `SearchResultsHeader` shows the total matches so users know their filter is applied.

## Responsive Behavior

- Small screens render a single-column grid (`grid-cols-1`). Desktop screens switch to two columns (`lg:grid-cols-2`).
- The fixed headers remain in place on mobile and desktop, so content scrolls independently underneath.
- The widget grid and tool status row rely on Tailwind utilities only; there is no separate mobile navigation or sidebar to maintain.

## Tool Status & Rate Limits

The footer row in `PortalOverview` reflects two cross-cutting signals:

- **Rate limits** – `useMultipleRateLimits` polls `/api/rate-limits/[tool]` endpoints and decorates the status indicators, which helps the polling hook decide whether to slow down.
- **Widget errors** – errors are keyed by `tool-endpoint` and deduplicated before they reach `PortalErrorSummary` and `ToolStatusRow`.

## Sessions & Personalization

Client components can persist UI preferences through the `/api/sessions` API:

- `useSession` loads (or lazily creates) a session record, caches the `sessionId` in `localStorage`, and exposes helpers to update preferences or clear the record.
- Session data includes theme selection, expanded widgets, and tool-specific settings. The backing store uses Redis when available and falls back to memory for single-node development.

## Configuration Tips

- Enable or disable widgets via environment variables (`ENABLE_GITHUB`, `ENABLE_CODE_REVIEWS`, etc.). Each tool self-registers at import time.
- Tool-specific URLs (e.g., `JIRA_WEB_URL`) are only required for the connectors you intend to use.
- `DATA_REFRESH_INTERVAL` and similar knobs are centralised in the tool registry so you do not need to patch components to change polling cadence.

## Troubleshooting

| Symptom                       | Recommended Checks                                                                                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Widgets show empty states     | Ensure the corresponding `ENABLE_*` flag is `true` and the required tokens are set. Restart `npm run dev` after editing `.env.dev`.                                          |
| Continuous loading spinners   | Confirm `DATABASE_URL` points at a reachable Postgres instance and that `npm run db:migrate` completed. React Query retries are logged via the console for easier diagnosis. |
| Search results look stale     | Global search filters the data already loaded in memory. Trigger a manual refresh to fetch new rows before filtering again.                                                  |
| Session changes are not saved | Verify Redis is running if you expect cross-process storage. Without Redis the in-memory fallback will reset on every server restart.                                        |

For implementation details, inspect `app/components/Portal.tsx` plus the hooks inside `app/components/hooks/`.
