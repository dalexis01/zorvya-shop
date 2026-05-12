# 📍 MAPA VISUAL DEL PANEL ADMINISTRATIVO

## CÓMO ESTÁ ORGANIZADO

```
┌─────────────────────────────────────────────────────────────────┐
│                    🎯 PANEL ADMINISTRATIVO                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐      ┌─────────────────────────────────┐  │
│  │   🔐 LOGIN       │      │  📊 DASHBOARD                   │  │
│  │   /admin/login   │ ──→  │  /admin                         │  │
│  │                  │      │  • Estadísticas                 │  │
│  │  • Email         │      │  • KPIs                         │  │
│  │  • Password      │      │  • Alertas                      │  │
│  │  • Seguro        │      │  • Acciones rápidas             │  │
│  └──────────────────┘      └─────────────────────────────────┘  │
│                                           │                      │
│                    ┌──────────────────────┼──────────────────────┬─────────────┐
│                    │                      │                      │             │
│         ┌──────────▼───────┐  ┌──────────▼──────┐  ┌───────────▼────┐   ┌────▼────────┐
│         │   📦 PRODUCTOS   │  │  📋 ÓRDENES    │  │  💬 SOPORTE   │   │ 👥 USUARIOS│
│         │  /admin/products │  │ /admin/orders  │  │ /admin/support│   │ /admin/users│
│         │                  │  │                │  │               │   │             │
│         │ ✅ FUNCIONAL:    │  │ ⏳ BACKEND:    │  │ ⏳ BACKEND:  │   │ ⏳ BACKEND:│
│         │ • Crear          │  │ • Listar orden │  │ • Mensajes    │   │ • Bloquear  │
│         │ • Listar         │  │ • Estados      │  │ • Responder   │   │ • Ver histor│
│         │ • Buscar         │  │ • Historial    │  │ • Resolver    │   │ • Permisos  │
│         │ • Destacar       │  │                │  │               │   │             │
│         │ • Imágenes       │  │ UI: ⏳ PRÓXIMA │  │ UI: ⏳ PRÓXIMA│   │ UI: ⏳ PRÓXIMA│
│         └──────────────────┘  └────────────────┘  └───────────────┘   └─────────────┘
│                    │
│         ┌──────────▼──────────┐
│         │  🎨 CONTENIDO       │
│         │ /admin/content      │
│         │                     │
│         │ ⏳ BACKEND:         │
│         │ • Destacados        │
│         │ • Top productos     │
│         │ • Orden             │
│         │ • UI: ⏳ PRÓXIMA    │
│         └─────────────────────┘
│
└─────────────────────────────────────────────────────────────────┘

Legend:
✅ = Completamente funcional
⏳ = Backend listo, falta UI
🤖 = Requiere integración
```

---

## FLUJO DE ACCESO

```
┌─────────────────────────────────────────────────────────────────┐
│                       FLUJO DE USUARIO                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. VISITA /admin/login                                         │
│     ↓                                                             │
│  2. INGRESA CREDENCIALES                                        │
│     ↓                                                             │
│  3. BACKEND VALIDA (authenticateAdminUser)                      │
│     ↓                                                             │
│  4. CREA SESIÓN (createAdminSession)                            │
│     ↓                                                             │
│  5. GUARDA EN COOKIE (admin-session)                            │
│     ↓                                                             │
│  6. REDIRIGE A /admin (DASHBOARD)                               │
│     ↓                                                             │
│  7. MIDDLEWARE VALIDA SESIÓN EN CADA REQUEST                    │
│     ↓                                                             │
│  8. USUARIO NAVEGA (sidebar con menú)                           │
│     ├─ Productos → crear, listar, editar                        │
│     ├─ Órdenes → ver, filtrar, cambiar estado                  │
│     ├─ Soporte → leer, responder, resolver                     │
│     ├─ Usuarios → buscar, bloquear                             │
│     └─ Contenido → destacar, ordenar                           │
│     ↓                                                             │
│  9. ACCIONES CREAN LOGS AUTOMÁTICOS                            │
│     ├─ Quién: admin user ID                                    │
│     ├─ Qué: cambio realizado                                   │
│     ├─ Cuándo: timestamp                                       │
│     └─ Detalles: antes/después                                 │
│     ↓                                                             │
│  10. LOGOUT ELIMINA SESIÓN                                      │
│      ↓                                                             │
│  11. REDIRIGE A /admin/login                                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## ESTRUCTURA DE DATOS

```
┌─────────────────────────────────────────────────────────────────┐
│                      BASE DE DATOS (JSON)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ADMIN SYSTEM (Separado del cliente)                            │
│  ├─ admin-users.json                                            │
│  │  └─ id, email, passwordHash, name, role, permissions        │
│  ├─ admin-sessions.json                                         │
│  │  └─ id, adminUserId, createdAt, expiresAt                   │
│  └─ admin-logs.json                                             │
│     └─ id, type, targetId, action, changedBy, changes[]        │
│                                                                   │
│  CONTENIDO (Administrado)                                        │
│  ├─ products.json                                               │
│  │  └─ id, sku, name, desc, brand, category, tags,            │
│  │     price, stock, images[], attributes                      │
│  ├─ support-messages.json                                       │
│  │  └─ id, customerId, subject, message, responses[],          │
│  │     priority, status, category                              │
│  └─ content-featured.json                                       │
│     └─ id, type, productIds[], position, isActive              │
│                                                                   │
│  CLIENTE (Existente, intacto)                                   │
│  ├─ users.json                                                  │
│  ├─ sessions.json                                               │
│  └─ orders.json                                                 │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## FLUJO DE CREAR PRODUCTO

```
┌─────────────────────────────────────────────────────────────────┐
│                  CREAR PRODUCTO - FLUJO COMPLETO                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. USUARIO ACCEDE /admin/products/create                      │
│     ↓                                                             │
│  2. LLENA FORMULARIO:                                           │
│     • SKU, nombre, descripciones                               │
│     • Brand, categoría, tags                                   │
│     • Precio, stock                                            │
│     • URLs de imágenes                                         │
│     ↓                                                             │
│  3. ENVÍA POST /api/admin/products                             │
│     ↓                                                             │
│  4. BACKEND VALIDA:                                            │
│     ✓ SKU único                                                │
│     ✓ Precios válidos                                          │
│     ✓ URLs correctas                                           │
│     ✓ Stock positivo                                           │
│     ↓                                                             │
│  5. CREA PRODUCTO:                                             │
│     • Genera UUID                                              │
│     • Asigna createdBy (admin user)                            │
│     • Guarda timestamp                                         │
│     ↓                                                             │
│  6. GUARDA EN products.json                                    │
│     ↓                                                             │
│  7. CREA LOG EN admin-logs.json                                │
│     • Tipo: "product"                                          │
│     • Acción: "created"                                        │
│     • Quién, cuándo, qué                                       │
│     ↓                                                             │
│  8. RETORNA RESPUESTA AL FRONTEND                              │
│     {                                                            │
│       success: true,                                            │
│       product: { id, sku, name, ... }                         │
│     }                                                            │
│     ↓                                                             │
│  9. FRONTEND REDIRIGE A /admin/products                        │
│     ↓                                                             │
│  10. PRODUCTO APARECE EN LISTADO INMEDIATAMENTE               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## SEGURIDAD - CAPA POR CAPA

```
┌─────────────────────────────────────────────────────────────────┐
│                     SEGURIDAD MULTINIVEL                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  CAPA 1: MIDDLEWARE (middleware.ts)                            │
│  ├─ Valida que /admin/* tenga sesión                          │
│  ├─ Redirige a login si no hay sesión                         │
│  └─ Bloquea acceso directo                                     │
│                                                                   │
│  CAPA 2: AUTENTICACIÓN (api/admin/auth/*)                     │
│  ├─ Valida email/password                                      │
│  ├─ Verifica con bcryptjs (hash)                              │
│  ├─ Crea sesión de 7 días                                     │
│  └─ Retorna cookie httpOnly + secure                          │
│                                                                   │
│  CAPA 3: AUTORIZACIÓN (api/admin/*)                           │
│  ├─ Valida sesión en cada request                             │
│  ├─ Verifica role del usuario                                 │
│  ├─ Comprueba permisos específicos                            │
│  └─ Bloquea acciones no autorizadas                           │
│                                                                   │
│  CAPA 4: VALIDACIÓN (api/admin/*/route.ts)                    │
│  ├─ Valida tipos de entrada                                   │
│  ├─ Checkea valores (ej: SKU único)                           │
│  ├─ Sanitiza strings                                          │
│  └─ Retorna errores específicos                               │
│                                                                   │
│  CAPA 5: AUDITORÍA (admin-logs.json)                          │
│  ├─ Registra cada cambio                                      │
│  ├─ Guarda identidad del usuario                              │
│  ├─ Almacena antes/después                                    │
│  └─ Permite rastreo completo                                  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## PERMISOS POR ROL

```
┌─────────────────────────────────────────────────────────────────┐
│                    MATRIZ DE PERMISOS                            │
├────────────────────┬──────────┬─────────┬──────────────┤
│ ACCIÓN             │  ADMIN   │ WORKER  │ SUPPORT AGT  │
├────────────────────┼──────────┼─────────┼──────────────┤
│ CREATE PRODUCT     │    ✅    │   ✅    │      ❌      │
│ READ PRODUCT       │    ✅    │   ✅    │      ❌      │
│ UPDATE PRODUCT     │    ✅    │   ✅    │      ❌      │
│ DELETE PRODUCT     │    ✅    │   ❌    │      ❌      │
│ VIEW ORDERS        │    ✅    │   ✅    │      ✅      │
│ EDIT ORDER STATUS  │    ✅    │   ✅    │      ❌      │
│ VIEW SUPPORT       │    ✅    │   ✅    │      ✅      │
│ RESPOND SUPPORT    │    ✅    │   ✅    │      ✅      │
│ VIEW USERS         │    ✅    │   ✅    │      ✅      │
│ BLOCK USERS        │    ✅    │   ❌    │      ❌      │
│ MANAGE STAFF       │    ✅    │   ❌    │      ❌      │
│ EDIT CONTENT       │    ✅    │   ❌    │      ❌      │
└────────────────────┴──────────┴─────────┴──────────────┘

✅ = Permitido
❌ = Bloqueado
```

---

## ROADMAP VISUAL

```
SEMANA 1                SEMANA 2                SEMANA 3
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│ ✅ FASE 1    │       │ ⏳ FASE 2    │       │ ⏳ FASE 3    │
│ (HECHO)      │       │ (1-2h)       │       │ (4-5h)       │
│              │       │              │       │              │
│ • Auth       │──────→│ • Edit prod  │──────→│ • IA img     │
│ • Products   │       │ • Stock ctrl │       │ • IA desc    │
│ • Dashboard  │       │ • Images     │       │ • IA tags    │
│ • Roles      │       │ • Prices     │       │ • Quality    │
│              │       │              │       │              │
└──────────────┘       └──────────────┘       └──────────────┘
                                                      │
                                                      ↓
                                                ┌──────────────┐
                                                │ ⏳ FASE 4    │
                                                │ (4h)         │
                                                │              │
                                                │ • Órdenes    │
                                                │ • Estados    │
                                                │ • Historial  │
                                                │              │
                                                └──────────────┘
                                                      │
                                                      ↓
                                                ┌──────────────┐
                                                │ ⏳ FASE 5-6  │
                                                │ (5h)         │
                                                │              │
                                                │ • Soporte    │
                                                │ • Usuarios   │
                                                │ • Contenido  │
                                                │              │
                                                └──────────────┘
                                                      │
                                                      ↓
                                                ┌──────────────┐
                                                │ ✅ COMPLETO  │
                                                │ (PRODUCCIÓN) │
                                                └──────────────┘
```

---

## ARCHIVOS A LEER (EN ORDEN)

```
1. ADMIN_START_HERE.md          (5 min - COMIENZA AQUÍ)
   └─ Cómo empezar en 3 pasos

2. QUICK_CHECK.md               (3 min - VERIFICACIÓN)
   └─ Qué funciona ahora

3. ADMIN_SETUP.md               (5 min - SETUP)
   └─ Crear usuarios y roles

4. ADMIN_PROPOSAL.md            (15 min - ARQUITECTURA)
   └─ Visión técnica completa

5. ADMIN_PROGRESS.md            (10 min - ROADMAP)
   └─ Próximos pasos detallados

6. AI_INTEGRATION_GUIDE.md      (10 min - IA)
   └─ Cómo integrar IA

7. README_ADMIN.md              (5 min - RESUMEN)
   └─ Índice de todo
```

---

## DEPENDENCIAS INCLUIDAS

```
✅ INSTALADAS EN package.json:
   • React 19
   • Next.js 16.2.3
   • TypeScript 5
   • Tailwind CSS 4
   • Nodemailer (para emails)

⏳ PARA AGREGAR (CUANDO NECESITES):
   • @anthropic-ai/sdk       (Claude IA)
   • replicate                (Modelos IA)
   • bcryptjs                 (Password hashing)
   • jose                     (JWT tokens)
```

---

**Tu panel administrativo está mapeado, documentado y listo para usar.**

🚀 **Comienza con ADMIN_START_HERE.md**
