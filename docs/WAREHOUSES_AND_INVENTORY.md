# Warehouses and Inventory

This document describes the next-stage inventory model that prepares ZorvyA Shop for multi-warehouse operations.

## Why this exists

The current `products.stock` field is enough for a single operational stock pool, but it is not enough for:

- Multiple physical warehouses
- Warehouse-specific stock counts
- Reservation and fulfillment logic
- Transfer history
- Supplier-to-warehouse receiving workflows

## Introduced schema

See [db/migrations/013_warehouses_inventory.sql](../db/migrations/013_warehouses_inventory.sql)

Tables:

- `warehouses`
- `warehouse_inventory`
- `inventory_movements`

## Intended responsibilities

### `warehouses`

- Canonical warehouse list
- Address/contact metadata
- Activation state

### `warehouse_inventory`

- Stock per `product_id` and `warehouse_id`
- Reserved quantity
- Reorder threshold
- Last sync/last counted timestamps

### `inventory_movements`

- Audit trail for receives, adjustments, reservations, releases, transfers, and sales
- Attribution to actor/source
- Optional order linkage

## What is not wired yet

- Checkout does not allocate against a warehouse yet.
- Admin product stock editing still uses the product-level stock abstraction.
- Delivery block creation does not yet choose a warehouse pickup origin.
- Supplier receiving is not yet connected to inventory movements.

## Recommended next implementation steps

1. Add admin inventory screens by warehouse.
2. Sync product-level `stock` from summed warehouse quantities.
3. Reserve inventory on order creation.
4. Release or consume reservations on cancellation/completion.
5. Add warehouse selection/allocation rules per order.
