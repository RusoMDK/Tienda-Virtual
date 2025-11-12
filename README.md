# 🛒 Tienda Virtual

Tienda virtual full-stack con **frontend en React + TypeScript + Vite** y un **panel de administración** para gestionar productos, stock y contenido de la página de inicio.

Pensada como una base sólida para un e-commerce moderno: catálogo rápido, detalle de producto cuidado, carrito integrado y herramientas para el administrador (importación CSV, ajuste de stock, edición visual del home, etc.).

---

## ✨ Funcionalidades principales

### Frontend (tienda)

- 🏠 **Home destacada**

  - Carrusel tipo hero full-width (estático o carrusel).
  - Secciones configurables desde el admin (ofertas, categorías, destacados, etc.).
  - **Compatibilidad light/dark** en textos y overlays del hero para legibilidad en ambos temas.

- 🧭 **Catálogo de productos**

  - Listado paginado con **grid responsivo**.
  - Filtros por categoría / subcategoría.
  - Ordenamiento por fecha y precio.
  - Tamaño de página configurable (12 / 24 / 36 productos).
  - **Cambio de moneda global** aplicado (ver sección Moneda).

- 🔍 **Detalle de producto**

  - Galería de imágenes con miniaturas y **zoom / lightbox**.
  - Estado de stock (en stock, bajo, sin stock, no disponible).
  - Control de cantidad con límites según stock y unidades en carrito.
  - Botones de **“Añadir al carrito”** y **“Comprar ahora”**.
  - Sección de productos relacionados en formato compacto.
  - **Favoritos / Wishlist** (UI integrada; requiere backend de favoritos para persistencia).

- 🛒 **Carrito y checkout**

  - Carrito persistente en el navegador (store tipo Zustand).
  - Control de stock por producto y actualización inmediata de cantidades al “Comprar ahora”.
  - **Totales convertidos a la moneda seleccionada**.
  - Preparado para integrarse con pasarelas de pago (ej: Stripe).

- 💱 **Moneda y precios**

  - Toggle de moneda en el **Navbar** (p. ej., USD/EUR/CUP).
  - Componente `<Price>` unificado para renderizar precios.
  - API/servicio de conversión configurable (estático o dinámico).

- 🖼️ **Imágenes**

  - Integración con **Cloudinary** para subir/gestionar imágenes desde el admin.
  - Limpieza de placeholders aleatorios: se usa la imagen real del producto o un fallback neutral controlado.
  - Upload por slide en el hero y subida masiva para carruseles.

- 🎨 **UI / UX**
  - Diseño moderno con **Tailwind CSS** y componentes reutilizables.
  - Layout responsivo pensado para desktop y laptops (y mobile-ready).
  - Estados de carga y skeletons para una mejor percepción de velocidad.
  - Sistema de temas (dark/light) listo y aplicado a plantillas.

---

### Panel de administración

- 📦 **Gestión de productos**

  - CRUD completo de productos.
  - Edición: nombre, descripción, precio, moneda, categoría, estado, tags, SKU, código de barras, etc.
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
  - **Plantillas de home** (HERO, PRODUCT_GRID, PRODUCT_STRIP, CATEGORY_STRIP, BANNER, TEXT_BLOCK).
  - Subida directa a Cloudinary para fondo del hero y slides.
  - Reordenamiento de secciones y slides.
  - **Corrección de HTML semántico** (sin botones anidados) para evitar errores de hidratación.
  - Tokens de color que **respetan light/dark** en textos y fondos.

---

## 🧱 Stack técnico

### Frontend

- ⚛️ **React** + **TypeScript**
- ⚡ **Vite** como bundler
- 💨 **Tailwind CSS** para estilos
- 🎯 **TanStack Query** para manejo de datos async (API)
- 📦 **Zustand** para estado local (carrito, wishlist)
- 🧱 Sistema de componentes en `src/ui`:
  - `Button`, `Card`, `Dialog`, `Modal`, `Input`, `Badge`, `Dropdown`, `Skeleton`, `Toast`, etc.
- 🧭 React Router para las rutas:
  - `/` – Home
  - `/products` – Catálogo
  - `/product/:slug` – Detalle de producto
  - `/cart` – Carrito
  - `/checkout` – Checkout
  - `/wishlist` – Favoritos (si lo habilitas)
  - `/admin/...` – Panel de administración

### Backend

> Ajusta esta sección según tu implementación real.

- 🟢 Node.js (Fastify/Express) + TypeScript (opcional)
- Persistencia: PostgreSQL/MySQL/SQLite (según prisma/ORM)
- Variables de entorno en `backend/.env.example`
- Endpoints típicos:
  - Productos (catálogo, detalle, listado admin)
  - Categorías
  - Stock / ledger
  - Pedidos
  - Wishlist (si lo incluyes)
  - Currency rates (si conversión dinámica)

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

Rellena cada `.env` con tus credenciales (DB, claves externas, URLs, Cloudinary, etc.).

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

El frontend normalmente levantará en:

```
http://localhost:5173
```

(Depende de la config de Vite.)

---

## 📂 Estructura del proyecto (resumen frontend)

```text
frontend/
  src/
    app/                  # Providers globales (React Query, tema, etc.)
    features/
      home/               # Página de inicio + layout + componentes + templates
      products/           # Catálogo, detalle, cards, API de productos
      cart/               # Estado global del carrito
      wishlist/           # Hooks y UI de favoritos (si está activo)
      currency/           # Contexto/hooks de moneda + <Price />
      uploads/            # Integración Cloudinary
      admin/              # Panel de administración (productos, home, etc.)
      categories/         # Categorías y subcategorías
      checkout/           # Flujo de checkout
      auth/               # Autenticación
      ...
    layout/
      Navbar.tsx          # Incluye toggle de moneda
      Footer.tsx
      Container.tsx
    ui/                   # Design system (botones, cards, modals, etc.)
    styles/
      theme.css           # Tokens / variables de tema (light/dark)
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
- [x] Integración de Cloudinary en admin/home y productos.
- [x] Corrección de error de hidratación por botones anidados en admin home.
- [ ] Integrar pasarela de pago real (Stripe, PayPal, etc.).
- [ ] Implementar favoritos / wishlist (persistencia).
- [ ] Mejorar SEO (metadatos por producto, OpenGraph, JSON-LD).
- [ ] Conversión de moneda dinámica desde backend (si aplica).

---

## 🗺️ Roadmap (alto nivel)

- Cuenta/Perfil (pedidos, direcciones, wishlist).
- Gestión de pedidos en admin (picking, estados, facturas).
- Políticas y centro de ayuda (FAQ, envíos, devoluciones, privacidad, T&C).
- Búsqueda avanzada (filtros por precio, rating, disponibilidad).
- i18n (ES/EN) y formatos regionales.
- Observabilidad (Logging, métricas, tracing).

---

## ⚡ Quick wins (esta semana)

_(Sección pedida: items sin marcar y con “Estado actual”)_

- [ ] **Moneda unificada en todo el flujo**
  - Estado actual: `<Price />` aplicado en detalle y catálogo; carrito y resumen ya convierten totales. Falta API de tasas si quieres conversión dinámica.
- [ ] **Imágenes reales vía Cloudinary en todo el sitio**
  - Estado actual: Admin y slides del hero suben a Cloudinary; productos usan su propia imagen (sin Unsplash). Revisar productos legacy sin `imageUrl`.
- [ ] **Wishlist básica (UI completa + persistencia)**
  - Estado actual: Botón de favorito y hooks listos; falta endpoint persistente y página `/wishlist` con grid.
- [ ] **Plantillas de Home compatibles con light/dark**
  - Estado actual: Tokens de color/texto saneados; validar contrastes en hero con imágenes claras (overlay auto).
- [ ] **SEO rápido**
  - Estado actual: `document.title` en detalle; falta `<Helmet>` con metadatos/OpenGraph por producto y sitemap.xml.
- [ ] **404 / 500 y ErrorBoundary**
  - Estado actual: fallbacks de carga; falta página 404/500 dedicadas y boundary global.
- [ ] **Accesibilidad base**
  - Estado actual: Labels y roles en progreso; revisar foco-teclas en carrusel y botones de cantidad.
- [ ] **Eventos de analítica clave**
  - Estado actual: pendiente instrumentar (page_view, add_to_cart, start_checkout).
- [ ] **CSV import UX**
  - Estado actual: funciona; agregar previsualización y validaciones por columna.
- [ ] **Testing mínimo crítico**
  - Estado actual: pendiente unit tests en `currency/format`, `cart/store` y e2e “añadir al carrito”.

---

## 📄 Licencia

Este proyecto no es de código abierto clásico.  
Todo el código está protegido por **derechos de autor (copyright)**.  
Consulta el archivo [`LICENSE`](./LICENSE) para ver los términos completos.
