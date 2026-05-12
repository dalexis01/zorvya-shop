# SETUP INICIAL: CREAR USUARIO ADMIN

Para que el panel administrativo funcione, necesitas crear al menos un usuario admin.

## OPCIÓN 1: Script directo

```bash
npm run admin:create
```

Esto crea por defecto:

- Email: `admin@sorvya.local`
- Contraseña: `admin4466`
- Nombre: `Admin Principal`
- Rol: `admin`

## OPCIÓN 2: Script con datos personalizados

```bash
npm run admin:create -- admin@sorvya.local admin4466 "Admin Principal" admin
```

Formato:

```bash
npm run admin:create -- <email> <password> <name> <role>
```

## ROLES DISPONIBLES

- `admin`
- `worker`
- `support_agent`

## CÓMO ACCEDER AL ADMIN DESPUÉS

1. Ve a: `http://localhost:3000/admin/login`
2. Ingresa el email y contraseña del usuario que creaste
3. Serás redirigido al dashboard

## NOTAS IMPORTANTES

- Las contraseñas se hashean con `scrypt`
- Las sesiones duran 7 días
- Cada sesión es única y se almacena en `data/admin-sessions.json`
- Los usuarios admin se almacenan en `data/admin-users.json`
- No uses credenciales de prueba en producción

## PRÓXIMOS PASOS

Una vez que el admin esté creado:

1. Accede al dashboard
2. Crea productos desde `/admin/products/create`
3. Gestiona órdenes en `/admin/orders`
4. Responde soporte en `/admin/support`
5. Administra usuarios cuando esa sección esté implementada

## ESTRUCTURA DE DATOS ADMIN

El sistema admin separado utiliza estos archivos:

```text
data/
  - admin-users.json
  - admin-sessions.json
  - products.json
  - support-messages.json
  - admin-logs.json
  - content-featured.json
```

Separado del sistema de cliente:

```text
data/
  - users.json
  - sessions.json
  - orders.json
```

## ROLES Y PERMISOS

### ADMIN
- Acceso total al panel
- Crear, editar y eliminar productos
- Gestionar órdenes
- Responder soporte
- Administrar usuarios
- Gestionar contenido

### WORKER
- Crear y editar productos
- Ver órdenes
- Responder soporte
- No puede eliminar productos ni administrar usuarios

### SUPPORT_AGENT
- Ver y responder soporte
- Ver órdenes
- Ver usuarios con datos básicos

La base del sistema ya está lista para seguir creciendo.
