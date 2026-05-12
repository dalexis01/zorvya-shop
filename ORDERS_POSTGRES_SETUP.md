# Orders PostgreSQL / Supabase Setup

## Variables soportadas

Puedes usar cualquiera de estas variables de entorno:

```bash
DATABASE_URL=postgresql://...
# o
POSTGRES_URL=postgresql://...
# o
SUPABASE_DB_URL=postgresql://...
```

Si tu proveedor no necesita SSL:

```bash
PGSSL=disable
# o
ORDERS_DB_SSL_DISABLE=true
```

## Migracion inicial

La tabla se crea automaticamente desde:

- [db/migrations/001_orders_postgres.sql](/C:/Users/Dalexis/sorvya/db/migrations/001_orders_postgres.sql)

Para migrar las ordenes legacy desde `data/orders.json`:

```bash
npm run orders:migrate:postgres
```

## Que cambia

- PostgreSQL pasa a ser el almacenamiento principal de ordenes.
- `data/orders.json` queda solo como respaldo legacy.
- `Cuenta > Ordenes` carga solo las ordenes del usuario autenticado.
- Admin usa paginacion real por cursor.
- El backend usa cache corto en memoria para paginas de ordenes y meta admin.

## Escalabilidad actual

- tabla indexada por `user_id`, `created_at`, `delivery_type`, `admin_status`
- consultas parciales por usuario autenticado
- paginacion real por cursor
- meta admin calculada por SQL
- actualizaciones invalidan cache automaticamente

## Flujo recomendado

```bash
# 1. configura la URL de base de datos
# 2. migra las ordenes legacy
npm run orders:migrate:postgres

# 3. levanta la app
npm run dev
```
