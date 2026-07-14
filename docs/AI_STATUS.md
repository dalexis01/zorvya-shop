# AI Status

## Production-facing flows

These paths are wired into the current application and should be treated as the active AI surface:

- Support assistant endpoint: [app/api/support-assistant/route.ts](../app/api/support-assistant/route.ts)
- AI product intake endpoints:
  - [app/api/ai-products/create-draft/route.ts](../app/api/ai-products/create-draft/route.ts)
  - [app/api/ai-products/update-draft/route.ts](../app/api/ai-products/update-draft/route.ts)
  - [app/api/ai-products/upload-original/route.ts](../app/api/ai-products/upload-original/route.ts)
  - [app/api/n8n/upload-image/route.ts](../app/api/n8n/upload-image/route.ts)
- Admin AI review workflow:
  - [app/admin/products/ai-pending/page.tsx](../app/admin/products/ai-pending/page.tsx)
  - [lib/server/admin/ai-products.ts](../lib/server/admin/ai-products.ts)

## Production support systems around AI

- AI batch tables and Telegram-oriented draft fields:
  - [db/migrations/009_ai_product_automation.sql](../db/migrations/009_ai_product_automation.sql)
  - [db/migrations/010_ai_product_telegram_upgrade.sql](../db/migrations/010_ai_product_telegram_upgrade.sql)
- Product schema fields for AI provenance:
  - [lib/server/admin/products.ts](../lib/server/admin/products.ts)

## Experimental / legacy / not primary production path

- Legacy draft helper flow:
  - [lib/server/admin/ai-drafts.ts](../lib/server/admin/ai-drafts.ts)
  - [lib/server/admin/ai-helpers.ts](../lib/server/admin/ai-helpers.ts)
- Narrative / planning documentation rather than guaranteed active implementation:
  - [AI_INTEGRATION_GUIDE.md](../AI_INTEGRATION_GUIDE.md)

## Practical guidance

- When documenting current production AI, describe the system as AI-assisted product ingestion/review and support assistance.
- Do not describe the project as fully autonomous product publishing.
- Do not describe every AI note in the repo as a shipped feature; some files are clearly exploratory.
