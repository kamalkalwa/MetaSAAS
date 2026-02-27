# MetaSAAS — Roadmap

> Living document. Updated every session. Tracks what's done, what's next, and what's blocked.
>
> For the "why" → see [VISION.md](../VISION.md)
> For strategic decisions → see [STRATEGY.md](./STRATEGY.md)
> For customer acquisition → see [CUSTOMER-ACQUISITION-PLAYBOOK.md](./CUSTOMER-ACQUISITION-PLAYBOOK.md)

*Last updated: 2026-02-27*

---

## Current Status

**Platform**: 10 phases complete. 13 entities across 5 domains. 566 tests passing (39 test files).

**Modules shipped**: Email, File Storage, Entity Installer, Licensing, Webhooks, AI Gateway, Chat Persistence, Billing (Stripe), Notifications, Observability, Plugins.

**Modules pending**: SSO (PRO), White-label (PRO), Advanced RBAC (PRO).

**Revenue**: Landing page live. Payment link needed.

---

## Recently Completed

### Session: 2026-02-26

| Task | Status | Details |
|------|--------|---------|
| Licensing simplified | Done | Reduced from 15 gated features to 4 PRO only (billing, SSO, white-label, advanced RBAC). Everything else is free. |
| Bootstrap ungated | Done | Removed entity limits and AI gating. All entities register, AI always initializes. |
| Adapter ungated | Done | Removed AI/webhook/chat route gates. Only `/api/meta/features` remains for feature discovery. |
| Email module | Done | Resend provider + console fallback. `initEmail()`, `sendEmail()`, `registerEmailTrigger()`. 13 tests. |
| File storage module | Done | S3-compatible provider + local fallback. `initStorage()`, `uploadFile()`, `getFileUrl()`, `deleteFile()`. 20 tests. |
| Entity installer | Done | Hot-installs entities at runtime. `installEntity()` → register + schema + CRUD + migrate. 10 tests. `POST /api/entities/install` endpoint. |
| CI/CD pipeline | Done | `.github/workflows/ci.yml` — test + build on every push/PR to main. |
| STRATEGY.md | Done | Comprehensive reference doc with all strategic decisions. |
| ROADMAP.md | Done | This file. |

---

## Next Up (Priority Order)

### Immediate — Revenue (This Week)

| # | Task | Priority | Effort | Notes |
|---|------|----------|--------|-------|
| 1 | Landing page at `/` for unauthenticated users | P0 | 1 day | Hero, features grid, pricing, CTA |
| 2 | Gumroad/Lemonsqueezy product setup | P0 | 1 hour | $149 early access, GitHub repo access |
| 3 | Launch posts (LinkedIn, Twitter, Reddit, IH) | P0 | 2 hours | Use templates from CUSTOMER-ACQUISITION-PLAYBOOK.md |
| 4 | Cold outreach (5-10 messages) | P1 | 1 hour/day | Target: non-technical founders, agencies |
| 5 | Demo video (5 min) | P1 | 2 hours | Entity → running app flow |

### Near-Term — Technical (Next 2 Weeks)

| # | Task | Priority | Effort | Notes |
|---|------|----------|--------|-------|
| 6 | Plugin host system | P1 | 1 day | Extension points for PRO repo. `PluginHost` interface. |
| 7 | `file` field type in contracts | P2 | 2 hours | Maps to `text` column, UI renders as file upload widget |
| 8 | Monitoring (Sentry) | P2 | 2 hours | Error tracking, basic health endpoint |
| 9 | Release workflow | P2 | 2 hours | `.github/workflows/release.yml` — tag-based, Docker images |
| 10 | Test coverage gaps | P3 | 1 day | E2E tests, web component tests |

### PRO Features (Private Repo — When Revenue Justifies)

| # | Task | Priority | Effort | Notes |
|---|------|----------|--------|-------|
| 11 | Billing module (Stripe) | P2 | 2-3 days | Checkout, subscriptions, portal, webhooks |
| 12 | SSO / SAML | P3 | 2 days | Enterprise single sign-on |
| 13 | White-label | P3 | 1-2 days | Custom branding, remove MetaSAAS marks |
| 14 | Advanced RBAC | P3 | 2-3 days | Role hierarchies, field-level access |

### Future / Backlog

| Task | Notes |
|------|-------|
| Platform update mechanism | Git remote tracking, merge strategies for upstream pulls |
| React Native mobile app | For App Store presence, push notifications |
| Tauri desktop app | For native desktop experience |
| Complex multi-field workflows | Single-field proven; multi-field is configuration |
| Ownership-based permissions | `owner` field in PermissionRule |
| Product Hunt launch | Schedule when landing page + demo video are ready |

---

## Module Status

| Module | Path | Status | Tests | Provider | Fallback |
|--------|------|--------|-------|----------|----------|
| Action Bus | `platform/core/action-bus/` | Shipped | 62 tests | — | — |
| Event Bus | `platform/core/event-bus/` | Shipped | 15 tests | — | — |
| Database | `platform/core/database/` | Shipped | 56 tests | PostgreSQL + Drizzle | — |
| Entity Manager | `platform/core/entity-manager/` | Shipped | 9 tests | — | — |
| Auth | `platform/auth/` | Shipped | — | Supabase | DevAuthProvider |
| AI Gateway | `platform/ai/` | Shipped | 7 tests | Gemini/OpenAI/Anthropic | NullAIProvider |
| Licensing | `platform/core/licensing/` | Shipped | 16 tests | JWT/RSA | Free tier |
| Webhooks | `platform/core/webhooks/` | Shipped | 13 tests | HTTP POST | — |
| Email | `platform/core/email/` | Shipped | 13 tests | Resend | ConsoleEmailProvider |
| File Storage | `platform/core/storage/` | Shipped | 20 tests | S3-compatible | LocalStorageProvider |
| Entity Installer | `platform/ai/entity-installer.ts` | Shipped | 10 tests | — | — |
| Chat Persistence | `platform/ai/chat-store.ts` | Shipped | — | PostgreSQL | — |
| Audit Log | `platform/core/audit/` | Shipped | — | PostgreSQL | Console fallback |
| Billing (Stripe) | `platform/core/billing/` | Shipped (Free) | 20 tests | Stripe | ConsoleBillingProvider |
| Notifications | `platform/core/notifications/` | Shipped | 15+ tests | PostgreSQL | ConsoleNotificationProvider |
| Observability | `platform/core/observability/` | Shipped | 12 tests | Sentry | ConsoleObservabilityProvider |
| Plugins | `platform/core/plugins/` | Shipped | 11 tests | — | — |
| SSO / SAML | — | Not started (PRO) | — | TBD | — |
| White-label | — | Not started (PRO) | — | — | — |
| Advanced RBAC | — | Not started (PRO) | — | — | — |

---

## API Endpoints

### Core
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/meta/entities` | All entity definitions |
| GET | `/api/meta/entities/:pluralName` | Single entity definition |
| GET | `/api/meta/actions` | All registered actions |
| GET | `/api/meta/features` | Enabled features + license info |
| GET | `/api/auth/config` | Auth provider configuration |
| POST | `/api/actions/:actionId` | Generic action dispatch |

### Per-Entity (auto-generated)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/:pluralName` | List (with filters, search, sort, pagination) |
| GET | `/api/:pluralName/:id` | Get by ID |
| POST | `/api/:pluralName` | Create |
| PATCH | `/api/:pluralName/:id` | Update |
| DELETE | `/api/:pluralName/:id` | Delete |
| GET | `/api/:pluralName/:id/transitions` | Valid workflow transitions |

### AI
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/ai/command` | Natural language → action dispatch |
| POST | `/api/ai/command/stream` | Streaming version (SSE) |

### Chat
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/chat/sessions` | List chat sessions |
| POST | `/api/chat/sessions` | Create session |
| GET | `/api/chat/sessions/:id` | Get session with messages |
| PATCH | `/api/chat/sessions/:id` | Update session title |
| DELETE | `/api/chat/sessions/:id` | Delete session |
| POST | `/api/chat/sessions/:id/messages` | Add message |

### Modules
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/entities/install` | Hot-install entity at runtime |
| POST | `/api/email/send` | Send a test email |
| POST | `/api/files/upload` | Upload file (base64 JSON) |
| GET | `/api/files/*` | Get file URL |
| DELETE | `/api/files/*` | Delete file |
| GET | `/api/webhooks` | List webhooks |
| POST | `/api/webhooks` | Register webhook |
| DELETE | `/api/webhooks/:id` | Remove webhook |
| GET | `/api/webhooks/:id/deliveries` | Webhook delivery log |

---

## Test Counts

| Package | Test Files | Tests | Status |
|---------|-----------|-------|--------|
| platform (src) | 26 | 383 | All passing |
| contracts | 2 | 59 | All passing |
| ui | 2 | 22 | All passing |
| web | 6 | 102 | All passing |
| e2e | 3 | — | Needs running server |
| **Total** | **39** | **566** | All clean |

---

## Decision Log (Recent)

| Date | Decision | Context |
|------|----------|---------|
| 2026-02-27 | Billing moved to FREE | Stripe integration ships in public repo; monetize on service layer |
| 2026-02-27 | Only 3 PRO features | SSO, White-label, Advanced RBAC — reduced from 4 |
| 2026-02-27 | Notification REST API | Plugin-based routes wired to PostgreSQL-backed provider |
| 2026-02-26 | Two-repo open-core | Single-repo license key is bypassable; code absence is true protection |
| 2026-02-26 | AI is free | Primary differentiator — locking it defeats the purpose |
| 2026-02-26 | Unlimited entities | Entity limits frustrate users and block evaluation |
| 2026-02-26 | Resend for email | Modern, $0 for 3K/month, simplest API |
| 2026-02-26 | S3-compatible storage | Works with AWS, R2, MinIO — no vendor lock-in |
| 2026-02-26 | No SDK for S3 | Raw HTTP with AWS Sig V4 — zero dependencies |

---

## How to Update This File

After each work session:
1. Move completed items from "Next Up" to "Recently Completed"
2. Add new items to "Next Up" or "Future / Backlog"
3. Update "Module Status" table if new modules are built
4. Update test counts
5. Add decisions to the decision log
6. Update the `Last updated` date at the top
