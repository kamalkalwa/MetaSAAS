# Multi-Platform Strategy

## Current State: PWA Baseline ✅

The Next.js web app is now a Progressive Web App:
- **manifest.json** — installable on mobile and desktop
- **Service worker** — network-first for API calls, cache-first for assets
- **Theme color + icons** — branded browser chrome and home screen icon
- **Apple Web App** — full-screen experience on iOS Safari

This means MetaSAAS is already installable on every platform via the browser.

## Architecture: Why Multi-Platform Works

MetaSAAS was designed for multi-platform from day one:

```
┌──────────────────────────────────────────────────┐
│                   Action Bus API                  │
│     (Fastify — same endpoints for all clients)    │
├──────────────────────────────────────────────────┤
│                                                    │
│   Web (Next.js)    Mobile (React Native)    Desktop (Tauri)   │
│   ↕ REST/SSE       ↕ REST/SSE              ↕ REST/SSE        │
│                                                    │
└──────────────────────────────────────────────────┘
```

Every client talks to the same API. The API serves the same responses.
The Action Bus doesn't know or care what triggered the request.

## Next Steps (When Needed)

### React Native (Mobile)

**When**: When the PWA experience isn't enough (push notifications,
background sync, camera/GPS/NFC, app store presence).

**How**: Create `apps/mobile/` with React Native + Expo. Reuse:
- `packages/contracts/` — same TypeScript types
- `packages/ui/` — shared components (adapt for React Native)
- API client — same REST endpoints, same auth tokens

**What changes**: Only the view layer. Business logic stays on the server.

### Tauri (Desktop)

**When**: When a native desktop experience is needed (system tray,
file system access, OS-level notifications, offline-first).

**How**: Create `apps/desktop/` with Tauri. The web app runs inside
a native webview — same Next.js code, but with native OS capabilities.

**What changes**: Near-zero. Tauri wraps the existing web app.

## Decision Framework

| Need | Solution |
|------|----------|
| "Works on phones" | PWA (already done) |
| "App Store presence" | React Native |
| "Push notifications" | React Native or web push API |
| "Desktop app feel" | Tauri |
| "Offline-first" | Service worker + IndexedDB |
| "Native hardware" | React Native (camera, GPS, NFC) |
