# Product Schema

Canonical source: [lib/server/admin/products.ts](../lib/server/admin/products.ts)

## Purpose

`products` is currently the central commercial entity for:

- Public catalog rendering
- Internal accounting
- Delivery behavior
- AI provenance
- Translation/localization

## Public storefront fields

- `id`
- `public_id`
- `display_order`
- `sku`
- `name`
- `short_description`
- `long_description`
- `brand`
- `category`
- `tags_json`
- `price`
- `original_price`
- `stock`
- `rating`
- `review_count`
- `inventory_label`
- `delivery_label`
- `show_stock`
- `images_json`
- `is_active`
- `is_visible`
- `is_featured`
- `is_top`
- `attributes_json`
- `translations_json`
- `created_at`
- `updated_at`
- `published_at`

## Internal/accounting fields

- `internal_json`
- `metrics_json`
- `supplier_id`
- `supplier_name`
- `cost_usd`
- `price_srd`
- `stock_code`
- `updated_by`
- `stock_added_at`
- `last_sold_at`
- `sale_dates_json`

## AI / source-provenance fields

- `accounting_original_image_url`
- `original_telegram_image_url`
- `original_slack_image_url`
- `original_source`
- `ai_batch_id`
- `review_status`
- `created_by_ai`
- `ai_confidence_score`
- `generated_images`
- `seo_title`
- `seo_description`
- `specifications`
- `ai_json`

## Current design caveats

- The table is intentionally rich, but it now carries both public and private concerns.
- Public APIs should never expose private accounting/source fields.
- Client-facing product queries should stay limited to storefront-safe columns.
- A future refactor should consider splitting product media, inventory, and AI provenance into dedicated tables once warehouse inventory is introduced.

## Related readers/writers

- Storefront projection: [lib/server/catalog.ts](../lib/server/catalog.ts)
- Admin CRUD: [lib/server/admin/products.ts](../lib/server/admin/products.ts)
- AI pending workflow: [lib/server/admin/ai-products.ts](../lib/server/admin/ai-products.ts)
- Reviews sync: [lib/server/product-reviews.ts](../lib/server/product-reviews.ts)
