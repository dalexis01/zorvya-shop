# PANEL ADMINISTRATIVO - PROPUESTA DE IMPLEMENTACIÓN

## VISIÓN GENERAL
Panel administrativo completo, escalable y profesional integrado en tu Next.js App Router.
Acceso privado con roles, gestión de productos con IA, órdenes, soporte y analytics básicos.

---

## 1. ESTRUCTURA DE CARPETAS PROPUESTA

```
app/
├── admin/                              # Página privada separada
│   ├── layout.tsx                      # Layout solo para admin
│   ├── page.tsx                        # Dashboard principal
│   ├── login/
│   │   └── page.tsx                    # Login admin separado
│   ├── products/
│   │   ├── page.tsx                    # Listado de productos
│   │   ├── create/page.tsx             # Crear producto
│   │   ├── [id]/page.tsx               # Editar producto
│   │   └── ai-enhance/page.tsx         # Tool IA para mejorar imágenes
│   ├── orders/
│   │   ├── page.tsx                    # Listado de órdenes
│   │   └── [id]/page.tsx               # Detalle de orden
│   ├── support/
│   │   ├── page.tsx                    # Mensajes de soporte
│   │   └── [id]/page.tsx               # Detalle de mensaje
│   ├── users/
│   │   └── page.tsx                    # Gestión de usuarios
│   └── content/
│       ├── featured/page.tsx           # Destacados
│       ├── top/page.tsx                # Top productos
│       └── banners/page.tsx            # Banners
│
├── api/
│   ├── auth/                           # Auth existente del cliente
│   ├── admin/
│   │   ├── auth/
│   │   │   ├── login/route.ts          # Admin login separado
│   │   │   ├── logout/route.ts         # Admin logout
│   │   │   └── session/route.ts        # Admin session check
│   │   ├── products/
│   │   │   ├── route.ts                # GET/POST productos
│   │   │   ├── [id]/route.ts           # GET/PUT/DELETE producto
│   │   │   └── ai-enhance/route.ts     # IA para mejorar imágenes
│   │   ├── orders/
│   │   │   ├── route.ts                # GET órdenes
│   │   │   ├── [id]/route.ts           # GET/PUT/DELETE orden
│   │   │   └── status-log/route.ts     # Historial de cambios
│   │   ├── support/
│   │   │   ├── route.ts                # GET/POST mensajes
│   │   │   └── [id]/route.ts           # PUT mensaje (respuesta)
│   │   ├── users/
│   │   │   ├── route.ts                # GET usuarios
│   │   │   └── [id]/route.ts           # PUT usuario (bloquear, etc)
│   │   └── content/
│   │       ├── featured/route.ts       # GET/PUT destacados
│   │       ├── top/route.ts            # GET/PUT tops
│   │       └── banners/route.ts        # GET/PUT banners
│
├── components/
│   ├── admin/
│   │   ├── AdminLayout.tsx
│   │   ├── Sidebar.tsx
│   │   ├── ProductForm.tsx
│   │   ├── ProductTable.tsx
│   │   ├── OrderTable.tsx
│   │   ├── SupportChat.tsx
│   │   ├── Dashboard.tsx
│   │   └── ... más componentes
│
└── lib/
    └── server/
        ├── admin/
        │   ├── auth.ts                 # Autenticación admin
        │   ├── products.ts             # CRUD productos
        │   ├── orders.ts               # Gestión órdenes (admin)
        │   ├── support.ts              # Gestión soporte
        │   ├── users.ts                # Gestión usuarios (admin)
        │   ├── ai-image.ts             # Helpers IA imágenes
        │   └── ai-description.ts       # Helpers IA descripciones
        └── ... (existentes)

data/
├── users.json                          # Usuarios actuales (agregar roles)
├── orders.json                         # Órdenes actuales
├── sessions.json                       # Sesiones
├── products.json                       # NUEVO - Catálogo de productos
├── support-messages.json               # NUEVO - Mensajes de soporte
├── admin-users.json                    # NUEVO - Usuarios admin (separado)
├── admin-sessions.json                 # NUEVO - Sesiones admin
└── content-featured.json               # NUEVO - Productos destacados
```

---

## 2. MODELOS DE DATOS EXTENDIDOS

### 2.1 ADMIN USERS (data/admin-users.json)
```typescript
interface AdminUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: "admin" | "worker" | "support_agent";
  permissions: string[];
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  createdBy: string; // admin que lo creó
}
```

### 2.2 PRODUCTS (data/products.json)
```typescript
interface Product {
  id: string;
  sku: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  brand: string;
  category: string;
  tags: string[];
  price: number;
  originalPrice?: number;
  stock: number;
  images: {
    id: string;
    url: string;
    alt: string;
    isPrimary: boolean;
  }[];
  isActive: boolean;
  isFeatured: boolean;
  isTop: boolean;
  attributes: {
    [key: string]: string;
  };
  createdAt: string;
  updatedAt: string;
  updatedBy: string; // admin que lo modificó
  ai?: {
    sourceImageUrl?: string;
    generatedImageUrls?: string[];
    generatedDescriptions?: {
      short: string;
      long: string;
    };
    suggestedTags?: string[];
    suggestedCategory?: string;
  };
}
```

### 2.3 SUPPORT MESSAGES (data/support-messages.json)
```typescript
interface SupportMessage {
  id: string;
  orderId?: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  message: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "resolved";
  category: "product" | "delivery" | "payment" | "other";
  responses: {
    id: string;
    respondedBy: string; // admin user id
    respondedByName: string;
    message: string;
    attachments?: string[];
    createdAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}
```

### 2.4 STATUS LOG (data/admin-logs.json)
```typescript
interface StatusLog {
  id: string;
  type: "order" | "product" | "user" | "content";
  targetId: string;
  action: "created" | "updated" | "deleted" | "status_changed";
  changedBy: string; // admin user id
  changedByName: string;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  createdAt: string;
}
```

### 2.5 FEATURED/TOP CONTENT (data/content-featured.json)
```typescript
interface FeaturedContent {
  id: string;
  type: "featured" | "top" | "banner";
  productIds: string[];
  position: number;
  isActive: boolean;
  startDate: string;
  endDate?: string;
  createdAt: string;
  updatedBy: string;
}
```

---

## 3. AUTENTICACIÓN Y MIDDLEWARE

### 3.1 Separación clara
- **Cliente**: `/auth/login` (usuarios normales)
- **Admin**: `/admin/login` (trabajadores, admin, soporte)
- Usan cookies separadas
- Session stores separados
- Roles y permisos basados en tabla de admin

### 3.2 Middleware de protección
```typescript
// middleware.ts en raíz
// Protege rutas /admin y /api/admin
// Valida sesión admin
// Redirige a /admin/login si no está autenticado
```

---

## 4. INTEGRACIÓN DE IA

### 4.1 Para imágenes
**Opciones recomendadas:**
1. **Replicate API** - Modelos de upscaling, variación de ángulos
   - GFPGAN (mejorar calidad)
   - Real-ESRGAN (upscale)
   - ControlNet (generar desde ángulos)

2. **Hugging Face** - Modelos gratuitos de transformación
   - Image to Image generation
   - Style transfer

3. **Stability AI** - Generación avanzada
   - Imagen, edit, upscale

**Flujo:**
```
1. Usuario sube imagen de producto
2. Sistema extrae metadata con Claude Vision API
3. Replica/Stability genera variaciones
4. Muestra sugerencias al usuario
5. User elige cuáles usar
6. Se guardan en el producto
```

### 4.2 Para descripciones y tags
**Usar Claude API:**
```
1. Analiza imagen con Claude Vision
2. Genera descripción corta y larga
3. Sugiere tags relevantes
4. Sugiere categoría
5. Extrae atributos clave
```

**Ejemplo prompt:**
```
Analiza esta imagen de producto y genera:
- Nombre comercial (si no existe)
- Descripción corta (máx 120 chars)
- Descripción larga (máx 500 chars)
- Tags relevantes (5-8)
- Categoría sugerida
- Atributos principales (color, tamaño, material, etc)

Responde en JSON estructurado.
```

---

## 5. SEGURIDAD

- Roles con permisos granulares
- Cada acción loguea quién la hizo
- Contraseñas hasheadas (bcrypt/argon2)
- Sessions con expiración
- CSRF tokens para formularios
- Rate limiting en logins
- No puedes editar producto que no creaste (solo admin full)
- Audit trail de cambios

---

## 6. DASHBOARD PRINCIPAL

Debe mostrar:
- **KPIs:**
  - Total productos
  - Total órdenes (hoy, semana, mes)
  - Órdenes pendientes
  - Órdenes completadas
  - Ingresos estimados

- **Alertas:**
  - Productos con stock bajo
  - Usuarios bloqueados
  - Soporte pendiente

- **Gráficos básicos:**
  - Órdenes por día
  - Ventas por categoría
  - Productos más vendidos

---

## 7. PLAN DE IMPLEMENTACIÓN PASO A PASO

### FASE 1: Infraestructura Base (3-4 horas)
1. Crear estructura de carpetas
2. Extender tipos TypeScript
3. Crear data files nuevos
4. Crear middleware de admin auth

### FASE 2: Autenticación Admin (2 horas)
1. API login/logout admin
2. Session check
3. Página de login admin
4. Protección de rutas

### FASE 3: CRUD de Productos (4-5 horas)
1. Funciones de servidor (create, read, update, delete)
2. APIs REST
3. Componentes de UI (tabla, form, modal)
4. Validaciones

### FASE 4: IA para Productos (3-4 horas)
1. Integración Replicate o similar
2. Upload de imagen
3. Generación de variaciones
4. Análisis con Claude Vision
5. Sugerencias de descripción/tags

### FASE 5: Gestión de Órdenes (3 horas)
1. Vistas separadas por estado
2. Edición de estado
3. Historial de cambios
4. Detalles completos

### FASE 6: Soporte (2-3 horas)
1. Listado de mensajes
2. Responder mensajes
3. Marcar como resuelto
4. Filtros y búsqueda

### FASE 7: Gestión de Usuarios (1-2 horas)
1. Listado de usuarios
2. Bloquear/desbloquear
3. Ver historial básico

### FASE 8: Contenido (1-2 horas)
1. Marcar como featured
2. Marcar como top
3. Ordenar aparición

### FASE 9: Dashboard y Polish (2-3 horas)
1. Dashboard principal
2. Gráficos
3. Alertas
4. UI refinada

---

## 8. TECNOLOGÍAS ESPECÍFICAS

```json
{
  "nuevas_dependencias": {
    "jose": "^5.0.0",          // JWT para sessions
    "bcryptjs": "^2.4.3",      // Hashing de contraseñas
    "zod": "^3.22.0",          // Validación
    "clsx": "^2.0.0",          // Condicionales CSS
    "date-fns": "^3.0.0",      // Manejo de fechas
    "recharts": "^2.10.0",     // Gráficos
    "zustand": "^4.4.0"        // State management simple
  },
  "apis": {
    "claude": "https://api.anthropic.com",
    "replicate": "https://api.replicate.com",
    "opcional": "stability-ai, hugging-face"
  }
}
```

---

## 9. ENDPOINTS API ADMIN COMPLETOS

```
POST   /api/admin/auth/login
POST   /api/admin/auth/logout
GET    /api/admin/auth/session

GET    /api/admin/products
POST   /api/admin/products
GET    /api/admin/products/[id]
PUT    /api/admin/products/[id]
DELETE /api/admin/products/[id]
POST   /api/admin/products/ai-enhance

GET    /api/admin/orders
GET    /api/admin/orders/[id]
PUT    /api/admin/orders/[id]
GET    /api/admin/orders/[id]/status-log

GET    /api/admin/support
GET    /api/admin/support/[id]
POST   /api/admin/support/[id]/response

GET    /api/admin/users
PUT    /api/admin/users/[id]

GET    /api/admin/content/featured
PUT    /api/admin/content/featured
GET    /api/admin/content/top
PUT    /api/admin/content/top
```

---

## 10. INICIO INMEDIATO

**Próximos pasos concretos:**
1. Crear tipos extendidos (admin-types.ts)
2. Crear data files (products.json, admin-users.json, etc)
3. Crear middleware auth admin
4. Crear login admin (página + API)
5. Crear layout admin protegido
6. Crear primera sección: CRUD productos

Cada paso construye sobre el anterior. Todo modular, escalable y profesional.

---

**Este documento es la guía. No hay teoría, solo implementación concreta lista para código real.**
