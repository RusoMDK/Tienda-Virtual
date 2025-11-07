# 🛒 Tienda Virtual

Tienda virtual full-stack con **frontend en React + TypeScript + Vite** y un **panel de administración** para gestionar productos, stock y contenido de la página de inicio.

Pensada como una base sólida para un e-commerce moderno: catálogo rápido, detalle de producto cuidado, carrito integrado y herramientas para el administrador (importación CSV, ajuste de stock, edición visual del home, etc.).

---

## ✨ Funcionalidades principales

### Frontend (tienda)

- 🏠 **Home destacada**

  - Carrusel tipo hero full-width.
  - Secciones configurables desde el admin (ofertas, categorías, destacados, etc.).

- 🧭 **Catálogo de productos**

  - Listado paginado con **grid responsivo**.
  - Filtros por categoría /subcategoría.
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
  - Preparado para integrarse con pasarelas de pago (ej: Stripe).

- 🎨 **UI / UX**
  - Diseño moderno con **Tailwind CSS** y componentes reutilizables.
  - Layout responsivo pensado para desktop y laptops (y mobile-ready).
  - Estados de carga y skeletons para una mejor percepción de velocidad.
  - Sistema de temas (dark/light) listo para expandir.

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

---

## 🧱 Stack técnico

### Frontend

- ⚛️ **React** + **TypeScript**
- ⚡ **Vite** como bundler
- 💨 **Tailwind CSS** para estilos
- 🎯 **TanStack Query** para manejo de datos async (API)
- 🧱 Sistema de componentes en `src/ui`:
  - `Button`, `Card`, `Dialog`, `Modal`, `Input`, `Badge`, `Dropdown`, `Skeleton`, `Toast`, etc.
- 🧭 React Router para las rutas:
  - `/` – Home
  - `/products` – Catálogo
  - `/product/:slug` – Detalle de producto
  - `/admin/...` – Panel de administración

### Backend

> Ajusta esta sección según tu implementación real.

- 🟢 Node.js
- API REST en `/backend`
- Variables de entorno documentadas en `backend/.env.example`
- Endpoints para:
  - Productos (catálogo, detalle, listado admin)
  - Categorías
  - Stock / ledger
  - Pedidos (según implementes)

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
    app/            # Providers globales (React Query, tema, etc.)
    features/
      home/         # Página de inicio + layout + componentes
      products/     # Catálogo, detalle, cards, API de productos
      cart/         # Estado global del carrito
      admin/        # Panel de administración (productos, home, etc.)
      categories/   # Categorías y subcategorías
      checkout/     # Flujo de checkout
      auth/         # Autenticación
      ...
    layout/
      Navbar.tsx
      Footer.tsx
      Container.tsx
    ui/             # Design system (botones, cards, modals, etc.)
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
- [ ] Integrar pasarela de pago real (Stripe, PayPal, etc.).
- [ ] Implementar favoritos / wishlist.
- [ ] Mejorar SEO (metadatos por producto, OpenGraph, etc.).

---

## 📄 Licencia

Este proyecto no es de código abierto clásico.

Todo el código está protegido por **derechos de autor (copyright)**.  
Consulta el archivo [`LICENSE`](./LICENSE) para ver los términos completos.
