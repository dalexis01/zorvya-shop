# ZorvyA Shop

Localized ecommerce platform for Suriname with a storefront, operational admin panel, delivery logic, PayPal/cash checkout, and AI-assisted product workflows.

## What It Is

ZorvyA Shop is a Next.js 16 commerce application built around a real local-market workflow instead of a generic demo-store pattern. The project combines:

- Customer storefront with multilingual browsing, cart, checkout, account, order history, notifications, and support.
- Admin workspace for products, orders, delivery blocks, providers, users, support, revenue, AI product review, and homepage settings.
- PostgreSQL/Supabase-backed runtime data for products, orders, accounts, notifications, reviews, admin auth, support, and admin settings.
- Vercel Blob for image storage.
- Delivery pricing logic tailored to the current store rules, including free-delivery thresholds and heavy-item handling.

## Current Status

This repository is production-oriented, but still actively evolving.

- Live-ready core: catalog, product detail, cart, checkout, order creation, account, notifications, admin product/order workflows, provider admin, PayPal integration, delivery quoting.
- In production with real code paths: support assistant endpoint, AI product draft ingestion/review, Telegram/n8n image intake, Supabase/Postgres persistence, Vercel Blob image workflows.
- Partially implemented / still maturing: finer-grained admin UX, warehouse-level inventory, broader automated test coverage, continued decomposition of large client pages.
- Documented or experimental: legacy AI draft helpers and roadmap-style integration notes outside the active admin AI review flow.

## Architecture

High-level layout:

```text
app/                    Next.js App Router pages and route handlers
components/             Shared UI for storefront and admin
lib/server/             Server-side domain logic, Postgres access, auth, orders, delivery
lib/shop/               Shared storefront/admin types and business utilities
db/migrations/          SQL schema files used by runtime bootstrap helpers
helpers/                Delivery/storefront constants
scripts/                Maintenance and migration scripts
data/                   Legacy JSON imports kept only as migration/bootstrap artifacts
```

Canonical runtime stores:

- Products: [lib/server/admin/products.ts](./lib/server/admin/products.ts)
- Storefront catalog projection: [lib/server/catalog.ts](./lib/server/catalog.ts)
- Orders: [lib/server/orders-store.ts](./lib/server/orders-store.ts)
- Customer accounts and addresses: [lib/server/customer-db.ts](./lib/server/customer-db.ts)
- Admin runtime/auth stores: [lib/server/admin/runtime-db.ts](./lib/server/admin/runtime-db.ts)

## Core Features

### Storefront

- Homepage/catalog experience with responsive product grid and storefront settings.
- Product detail pages with recommendations, cart entry, gallery, and localized copy.
- Cart and checkout flows for delivery or pickup.
- PayPal authorization flow plus cash-on-delivery support.
- Customer account, addresses, order history, issue reporting, and notifications.
- Support entry points and assistant-driven help flow.

### Admin

- Protected admin login and session handling.
- Product CRUD, accounting fields, AI pending-product review, image upload, provider assignment.
- Orders list, route blocks, routing helpers, provider payouts, revenue dashboards.
- Homepage settings, PayPal settings, support inbox, customer management.
- Egress/debug endpoints and operational metrics helpers.

## Data Model Notes

Products are the most complex entity in the system and currently mix:

- Public catalog fields
- Internal/accounting fields
- AI provenance fields
- Translation/localization fields

See:

- [docs/PRODUCT_SCHEMA.md](./docs/PRODUCT_SCHEMA.md)
- [lib/server/admin/products.ts](./lib/server/admin/products.ts)

## AI: Production vs Experimental

The repo now documents active versus exploratory AI clearly:

- Production-facing / wired flows: [docs/AI_STATUS.md](./docs/AI_STATUS.md)
- Legacy or exploratory notes: [AI_INTEGRATION_GUIDE.md](./AI_INTEGRATION_GUIDE.md)

## Security Notes

Recent hardening in this repo includes:

- Admin auth moved off JSON runtime storage into Postgres-backed tables.
- Same-origin validation added for sensitive admin mutations.
- Permission checks added across core admin APIs.
- New admin runtime tables are created with RLS enabled and anon/authenticated access revoked.

Sensitive values must stay server-side:

- `DATABASE_URL`
- `POSTGRES_URL`
- `SUPABASE_DB_URL`
- `ADMIN_SESSION_SECRET`
- `RESEND_API_KEY`
- `PAYPAL_CLIENT_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BLOB_READ_WRITE_TOKEN`
- `ZORVYA_ADMIN_API_SECRET`
- `N8N_SECRET`

## Local Development

```bash
npm install
npm run dev
```

Required environment values depend on which flows you want to exercise. At minimum:

- Postgres/Supabase connection for runtime data
- Public Supabase URL/anon key for client-side account flows when applicable
- Blob token for image upload flows
- PayPal credentials if testing PayPal
- Resend credentials if testing real email flows

## Scripts

```bash
npm run build
npm run admin:create
npm run orders:migrate:postgres
npm run products:migrate:postgres
npm run users:migrate:postgres
npm run images:migrate:blob
npm run smoke
```

## Smoke Tests

`npm run smoke` runs lightweight HTTP smoke checks against a running app instance.

Environment:

- `SMOKE_BASE_URL` default: `http://localhost:3000`
- `SMOKE_ADMIN_EMAIL` and `SMOKE_ADMIN_PASSWORD` optional for authenticated admin login verification

## Warehouse / Inventory Roadmap

The repo now includes a first schema proposal for warehouse-aware inventory:

- [docs/WAREHOUSES_AND_INVENTORY.md](./docs/WAREHOUSES_AND_INVENTORY.md)
- [db/migrations/013_warehouses_inventory.sql](./db/migrations/013_warehouses_inventory.sql)

This is intentionally staged as the next operational layer rather than being silently mixed into the current stock model.

## Known Gaps

- Large client/admin pages still need further decomposition.
- Smoke coverage exists, but full end-to-end automation is still limited.
- Some legacy JSON files remain as historical/bootstrap artifacts and should be retired after operational validation.
- Warehouse-level inventory is not yet connected to checkout or order allocation.

## Authoring Notes

This repository shows end-to-end ownership across product design, frontend, backend, data modeling, payments, support flows, delivery logic, and AI-assisted admin tooling. The project is not a tutorial scaffold and should be described honestly as an actively developed production-oriented platform.
