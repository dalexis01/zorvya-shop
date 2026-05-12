# ⚡ REFERENCIA RÁPIDA

## En 30 segundos

**¿Qué recibiste?**
Panel admin completo, funcional, documentado.

**¿Cómo empiezo?**
1. Crea admin (Node script)
2. Accede a `/admin/login`
3. Crea un producto

**¿Cuánto tiempo?**
5 minutos para tener todo funcionando.

---

## URLs Principales

```
/admin/login              ← Ingresa aquí
/admin                    ← Dashboard
/admin/products           ← Ver productos
/admin/products/create    ← Crear producto
/admin/orders             ← Órdenes (próximamente)
/admin/support            ← Soporte (próximamente)
```

---

## Credenciales de Prueba

```
Email: admin@sorvya.local
Password: admin123456
```

(Después de crear usuario con Node)

---

## API Endpoints

```
POST   /api/admin/auth/login           ← Login
POST   /api/admin/auth/logout          ← Logout
GET    /api/admin/auth/session         ← Check

GET    /api/admin/products             ← Listar
POST   /api/admin/products             ← Crear
GET    /api/admin/products/[id]        ← Ver uno
PUT    /api/admin/products/[id]        ← Editar
DELETE /api/admin/products/[id]        ← Eliminar

GET    /api/admin/dashboard            ← Stats
```

---

## Archivos Clave

```
lib/server/admin/auth.ts       ← Autenticación
lib/server/admin/products.ts   ← CRUD productos
lib/server/admin/support.ts    ← Soporte
lib/server/admin/logs.ts       ← Auditoría
lib/server/admin/content.ts    ← Destacados
lib/shop/admin-types.ts        ← TypeScript

app/admin/page.tsx             ← Dashboard
app/admin/products/page.tsx    ← Listado
app/admin/products/create/page.tsx ← Crear

middleware.ts                  ← Protección
```

---

## Crear Admin (Copy-Paste)

```bash
node
import { createAdminUser } from './lib/server/admin/auth.js';
await createAdminUser({
  email: 'admin@sorvya.local',
  password: 'admin123456',
  name: 'Admin',
  role: 'admin',
  createdBy: 'system'
});
process.exit();
```

---

## Estructura Base

```
✅ Autenticación
✅ Dashboard
✅ Productos (CRUD)
✅ Búsqueda
✅ Roles
✅ Logs

⏳ Órdenes
⏳ Soporte
⏳ Usuarios
⏳ Contenido
🤖 IA
```

---

## Funciones Principales

### Auth
```typescript
authenticateAdminUser(email, password)
createAdminSession(userId)
findAdminSession(sessionId)
```

### Productos
```typescript
getAllProducts(options)
createProduct(input, createdBy)
updateProduct(id, updates, updatedBy)
deleteProduct(id)
```

### Soporte
```typescript
getAllSupportMessages(options)
createSupportMessage(input)
addSupportResponse(messageId, input)
```

### Logs
```typescript
createStatusLog(input)
getLogsForTarget(targetId)
```

---

## Roles

```
admin        → Todo
worker       → Crear/editar productos
support_agent → Solo soporte
```

---

## Documentación Orden

1. **ADMIN_START_HERE.md** ← Comienza aquí
2. **QUICK_CHECK.md** ← Verificación
3. **ADMIN_PROPOSAL.md** ← Arquitectura
4. **ADMIN_PROGRESS.md** ← Roadmap
5. **AI_INTEGRATION_GUIDE.md** ← IA
6. **VISUAL_MAP.md** ← Mapeo visual

---

## Datos JSON

```
data/admin-users.json           ← Users admin
data/admin-sessions.json        ← Sessions activas
data/products.json              ← Catálogo
data/support-messages.json      ← Soporte
data/admin-logs.json            ← Logs/auditoría
data/content-featured.json      ← Destacados
```

---

## Próximos Pasos

```
[ ] Crea admin
[ ] Accede a /admin/login
[ ] Crea producto
[ ] Lee ADMIN_PROGRESS.md
[ ] Decide qué hacer después
```

---

## Stack

- React 19
- Next.js 16.2.3
- TypeScript 5
- Tailwind CSS 4
- JSON (Data)

---

## Soporte Rápido

**Error "SESSION_EXPIRED"?**
→ Logout y login de nuevo

**No funciona login?**
→ Verifica data/admin-users.json

**Producto no se guarda?**
→ Verifica permisos en data/

**¿Próximo paso?**
→ Lee ADMIN_PROGRESS.md FASE 2

---

**MÁS INFO: Lee ADMIN_START_HERE.md**
