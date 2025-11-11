# 🛒 Tienda Virtual

Tienda virtual full-stack con **frontend en React + TypeScript + Vite** y un **panel de administración** para gestionar productos, stock, contenido de la página de inicio y ahora también **favoritos y notificaciones**.

Pensada como una base sólida para un e-commerce moderno: catálogo rápido, detalle de producto cuidado, carrito integrado, **lista de deseos**, **centro de notificaciones**, multi-moneda, multi-idioma y herramientas para el administrador (importación CSV, ajuste de stock, edición visual del home, etc.).

---

## ✨ Funcionalidades principales

### Frontend (tienda)

- 🏠 **Home destacada**

  - Carrusel tipo hero full-width.
  - Secciones configurables desde el admin (ofertas, categorías, destacados, etc.).

- 🧭 **Catálogo de productos**

  - Listado paginado con **grid responsivo**.
  - Filtros por categoría / subcategoría.
  - Ordenamiento por fecha y precio.
  - Tamaño de página configurable (12 / 24 / 36 productos).

- 🔍 **Detalle de producto**

  - Galería de imágenes con miniaturas y **zoom / lightbox**.
  - Estado de stock (en stock, bajo, sin stock, no disponible).
  - Control de cantidad con límites según stock y unidades en carrito.
  - Botones de **“Añadir al carrito”** y **“Comprar ahora”**.
  - Sección de productos relacionados en formato compacto.

- 🛒 **Carrito y checkout**

  - Carrito persistente en el navegador.
  - Control de stock por producto.
  - Resumen en el **navbar** con total dinámico y animación al añadir ítems.
  - Preparado para integrarse con pasarelas de pago (ej: Stripe).

- ❤️ **Favoritos / Wishlist**

  - Icono de corazón en cards y detalle de producto para **añadir/quitar de favoritos**.
  - Corazón del navbar con:
    - Color dinámico (vacío / con favoritos).
    - Contador de favoritos con animación suave.
  - Página **“Mis favoritos”**:
    - Grid responsivo con diseño tipo vitrina.
    - Orden inteligente: primero productos que **bajaron de precio**, luego sin cambios y al final los que subieron.
    - Indicadores visuales:
      - 🔻 Porcentaje de descuento respecto al momento en que se guardó.
      - 🔺 Diferencia de precio si aumentó.
    - Información de:
      - Precio al guardar vs. precio actual.
      - Fecha en que se añadió a favoritos.
    - Vacío muy cuidado: mensaje amigable y CTA para seguir explorando.

- 🔔 **Notificaciones**

  - **Campana en el navbar** con indicador de no leídas.
  - **Dropdown de notificaciones**:
    - Lista compacta con título, cuerpo y fecha.
    - Marca visual para no leídas.
    - Acciones rápidas:
      - Marcar individual como leída.
      - Marcar todas como leídas.
      - Ir a la pantalla de notificaciones.
  - **Centro de notificaciones** (`/notifications`):
    - Diseño tipo **timeline** agrupado por día (“Hoy”, “Ayer”, fechas).
    - Filtro de **Todas** / **No leídas**.
    - Categorías con iconos y tonos:
      - Pedido, Soporte, Seguridad, Favoritos, Promociones, General.
    - Cada notificación incluye:
      - Banda lateral de estado (leída / no leída).
      - Icono y etiqueta de categoría.
      - Hora, título y descripción.
      - Botón **“Marcar como leído”**.
      - Botón **“Ver detalle”** que navega al recurso correspondiente:
        - Pedido, producto, conversación de soporte, etc.
    - Paginación con botón **“Cargar más notificaciones”**.

- 👤 **Cuenta, pedidos y soporte**

  - Sistema de autenticación con rutas de login / registro.
  - Menú de cuenta en el navbar (cuenta, listas, pedidos, admin/soporte).
  - Página de pedidos y seguimiento.
  - Sección de soporte con acceso rápido desde el navbar para roles de soporte/admin.
  - Backend preparado para **2FA** (segundo factor de autenticación) y notificaciones de seguridad.

- 🌐 **Idioma y moneda**

  - Selector de idioma (ES / EN).
  - Selector de moneda con **CUP (MN) como primera opción** y otras divisas (USD, EUR, MXN, etc.).
  - Conversión de precios usando tasas configurables.
  - Preview tipo: `1 USD ≈ X MN` o `1 USD ≈ X EUR`.

- 🎨 **UI / UX**

  - Diseño moderno con **Tailwind CSS** y componentes reutilizables.
  - Layout responsivo pensado para desktop y laptops (y mobile-ready).
  - Estados de carga y skeletons para una mejor percepción de velocidad.
  - Sistema de temas (dark/light) listo para expandir.
  - Navbar inteligente:
    - Se oculta al hacer scroll hacia abajo y reaparece al subir.
    - Animaciones sutiles en iconos (carrito y favoritos).
  - **Toasts**:
    - Aparecen en la parte superior derecha, alineados con el navbar.
    - Animación suave tipo “persiana” desde el lateral.
    - Variantes para éxito / error con diseño minimalista empresarial.

---

### Panel de administración

- 📦 **Gestión de productos**

  - CRUD completo de productos.
  - Edición avanzada: nombre, descripción, precio, moneda, categoría, estado, tags, SKU, código de barras, etc.
  - Gestión de imágenes con **ImageUploader** (arrastrar para reordenar, primera imagen como portada).

- 📊 **Stock e inventario**

  - Ajuste de stock con motivo y nota.
  - Historial de movimientos (ledger) por producto.
  - Indicadores de stock bajo / sin stock en la tabla.

- 📁 **Importación / exportación**

  - Importación de productos por CSV con mapeo de columnas.
  - Creación masiva + ajuste de stock a partir de CSV.
  - Exportación de la página de productos actual a CSV.
  - Plantilla CSV de ejemplo descargable.

- 🧩 **Home editable**

  - Configuración visual de secciones de inicio.
  - Hero/carrusel, bloques, etc. desde el admin (sin tocar código).

- 📨 **Notificaciones (backend)**

  - Modelo de notificación en base de datos mediante Prisma.
  - Servicio para crear notificaciones ligadas a eventos (pedidos, soporte, seguridad, wishlist, etc.).
  - Rutas protegidas para:
    - Listar notificaciones del usuario.
    - Marcar como leídas.
    - Configurar preferencias básicas.

---

## 🧱 Stack técnico

### Frontend

- ⚛️ **React** + **TypeScript**
- ⚡ **Vite** como bundler
- 💨 **Tailwind CSS** para estilos
- 🎯 **TanStack Query** para manejo de datos async (API)
- 🧭 **React Router** para las rutas:
  - `/` – Home
  - `/search` – Búsqueda con filtros y categorías
  - `/product/:slug` – Detalle de producto
  - `/cart` – Carrito
  - `/wishlist` – Lista de deseos
  - `/orders` – Pedidos del usuario
  - `/notifications` – Centro de notificaciones
  - `/help` – Ayuda
  - `/support` – Panel de soporte (según rol)
  - `/admin/...` – Panel de administración

- 🧱 Sistema de componentes en `src/ui`:
  - `Button`, `Card`, `Dialog`, `Modal`, `Input`, `Badge`, `Dropdown`,  
    `Skeleton`, `Toast`, `NotificationBell`, etc.

### Backend

- 🟢 Node.js + TypeScript
- 🗄️ **Prisma ORM** (`backend/prisma/schema.prisma` + migraciones)
- API REST en `backend/src` con rutas organizadas por dominio:
  - `auth`, `2fa`, `products`, `categories`, `orders`, `support`, `me.notifications`, etc.
- Variables de entorno documentadas en `backend/.env.example`
- Endpoints para:
  - Productos (catálogo, detalle, listado admin)
  - Categorías
  - Stock / ledger
  - Pedidos
  - Wishlist
  - Notificaciones + preferencias
  - Autenticación y 2FA (segundo factor) según configuración

---

## 🚀 Puesta en marcha

Clona el repo:

```bash
git clone https://github.com/RusoMDK/Tienda-Virtual.git
cd Tienda-Virtual
```

### 1. Configura las variables de entorno

Copia los archivos de ejemplo y ajusta tus valores:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Rellena cada `.env` con tus credenciales (DB, claves externas, URLs, etc.).

### 2. Instala dependencias

Backend:

```bash
cd backend
npm install
```

Frontend:

```bash
cd ../frontend
npm install
```

### 3. Ejecuta el proyecto en desarrollo

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

El frontend normalmente levantará en algo como:

```text
http://localhost:5173
```

(Depende de la config de Vite.)

---

## 📂 Estructura del proyecto (resumen frontend)

```text
frontend/
  src/
    app/            # Providers globales (React Query, tema, toasts, etc.)
    features/
      home/         # Página de inicio + layout + componentes
      products/     # Catálogo, detalle, cards, API de productos
      cart/         # Estado global del carrito
      wishlist/     # Lógica y páginas de favoritos
      notifications/# Dropdown + centro de notificaciones + hooks/API
      admin/        # Panel de administración (productos, home, etc.)
      categories/   # Categorías y subcategorías
      checkout/     # Flujo de checkout
      auth/         # Autenticación (login, registro, etc.)
      support/      # Soporte / conversaciones (según rol)
      ...
    layout/
      Navbar.tsx
      Footer.tsx
      Container.tsx
    ui/             # Design system (botones, cards, dropdowns, toasts, etc.)
    styles/
      theme.css     # Tokens / variables de tema
```

---

## 🧪 Scripts útiles (frontend)

> Verifica / ajusta según tu `frontend/package.json`.

```bash
# Desarrollo
npm run dev

# Build producción
npm run build

# Preview del build
npm run preview

# Linter / formato
npm run lint
```

---

## ✅ Estado actual

- [x] Catálogo funcional con filtros y paginación.
- [x] Detalle de producto con galería e integración con carrito.
- [x] Panel admin de productos + stock + CSV import/export.
- [x] Home con carrusel y secciones configurables.
- [x] **Wishlist / favoritos** con página dedicada y corazón en navbar.
- [x] **Sistema de notificaciones** (backend + dropdown + centro de notificaciones).
- [x] Mejoras de UX: navbar animado, toasts laterales suaves, badges en iconos.
- [ ] Integrar pasarela de pago real (Stripe, PayPal, etc.).
- [ ] Mejorar SEO (metadatos por producto, OpenGraph, etc.).
- [ ] Ampliar panel admin (gestión avanzada de pedidos, reporting, etc.).

---

## 📄 Licencia

Este proyecto no es de código abierto clásico.

Todo el código está protegido por **derechos de autor (copyright)**.  
Consulta el archivo [`LICENSE`](./LICENSE) para ver los términos completos.
