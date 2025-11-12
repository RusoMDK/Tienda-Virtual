<div align="right">
  <a href="README.en.md">
    <img alt="English" src="https://img.shields.io/badge/lang-EN-success?style=flat-square">
  </a>
  <a href="README.md">
    <img alt="Español" src="https://img.shields.io/badge/idioma-ES-informational?style=flat-square">
  </a>
</div>

# 🛒 Online Store

Full‑stack online store with a **React + TypeScript + Vite** frontend and an **admin panel** to manage products, stock, and home page content.

Designed as a solid baseline for a modern e‑commerce: fast catalog, polished product detail, integrated cart, and admin tools (CSV import, stock adjustments, visual home editor, etc.).

---

## ✨ Key features

### Frontend (shop)

- 🏠 **Featured Home**

  - Full‑width hero (static or carousel).
  - Configurable sections from admin (deals, categories, featured, etc.).
  - **Light/Dark compatibility** for hero text and overlays to ensure readability in both themes.

- 🧭 **Product catalog**

  - Paginated list with **responsive grid**.
  - Filters by category / subcategory.
  - Sort by date and price.
  - Page size options (12 / 24 / 36 products).
  - **Global currency switch** applied (see Currency section).

- 🔍 **Product detail**

  - Image gallery with thumbnails and **zoom / lightbox**.
  - Stock state (in stock, low, out of stock, unavailable).
  - Quantity control with limits based on stock and items in cart.
  - **“Add to cart”** and **“Buy now”** actions.
  - Compact related products.
  - **Favorites / Wishlist** (UI integrated; requires wishlist backend for persistence).

- 🛒 **Cart & checkout**

  - Cart persists in the browser (Zustand store).
  - Per‑product stock enforcement and instant quantity updates on “Buy now”.
  - **Totals converted to the selected currency**.
  - Ready to integrate with payment gateways (e.g., Stripe).

- 💱 **Currency & pricing**

  - Currency toggle in the **Navbar** (e.g., USD/EUR/CUP).
  - Unified `<Price>` component to render prices.
  - Configurable conversion provider (static or dynamic).

- 🖼️ **Images**

  - **Cloudinary** integration to upload/manage images from admin.
  - Clean, controlled fallbacks instead of random placeholders.
  - Per‑slide uploads for hero and bulk uploads for carousels.

- 🎨 **UI / UX**
  - Modern design with **Tailwind CSS** and reusable components.
  - Responsive layout primarily optimized for desktop/laptops (mobile‑ready).
  - Loading states and skeletons to improve perceived performance.
  - Theme system (dark/light) applied to templates.

---

### Admin panel

- 📦 **Product management**

  - Full CRUD for products.
  - Editing: name, description, price, currency, category, status, tags, SKU, barcode, etc.
  - Image management with **ImageUploader** (drag to reorder, first image as cover).

- 📊 **Stock & inventory**

  - Stock adjustments with reason and note.
  - Per‑product movement history (ledger).
  - Low/out‑of‑stock indicators in the table.

- 📁 **Import / export**

  - CSV import with column mapping.
  - Bulk creation + stock adjustments from CSV.
  - Export current product page to CSV.
  - Example CSV template included.

- 🧩 **Editable Home**
  - Visual configuration of home sections.
  - **Home templates** (HERO, PRODUCT_GRID, PRODUCT_STRIP, CATEGORY_STRIP, BANNER, TEXT_BLOCK).
  - Direct Cloudinary uploads for hero background and slides.
  - Reorder sections and slides.
  - **Semantic HTML fix** (no nested buttons) to avoid hydration issues.
  - Color tokens that **respect light/dark** for text and backgrounds.

---

## 🧱 Tech stack

### Frontend

- ⚛️ **React** + **TypeScript**
- ⚡ **Vite** as bundler
- 💨 **Tailwind CSS** for styles
- 🎯 **TanStack Query** for async data (API)
- 📦 **Zustand** for local state (cart, wishlist)
- 🧱 Component system in `src/ui`:
  - `Button`, `Card`, `Dialog`, `Modal`, `Input`, `Badge`, `Dropdown`, `Skeleton`, `Toast`, etc.
- 🧭 React Router routes:
  - `/` – Home
  - `/products` – Catalog
  - `/product/:slug` – Product detail
  - `/cart` – Cart
  - `/checkout` – Checkout
  - `/wishlist` – Favorites (if enabled)
  - `/admin/...` – Admin panel

### Backend

> Adjust this section to your actual implementation.

- 🟢 Node.js (Fastify/Express) + TypeScript (optional)
- Persistence: PostgreSQL/MySQL/SQLite (depending on prisma/ORM)
- Environment variables in `backend/.env.example`
- Typical endpoints:
  - Products (catalog, detail, admin listing)
  - Categories
  - Stock / ledger
  - Orders
  - Wishlist (if included)
  - Currency rates (if dynamic conversion)

---

## 🚀 Getting started

Clone the repo:

```bash
git clone https://github.com/RusoMDK/Tienda-Virtual.git
cd Tienda-Virtual
```

### 1. Configure environment variables

Copy sample files and set your values:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Fill each `.env` with your credentials (DB, external services, URLs, Cloudinary, etc.).

### 2. Install dependencies

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

### 3. Run the project in development

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

Frontend usually runs at:

```
http://localhost:5173
```

(Depends on your Vite config.)

---

## 📂 Project structure (frontend summary)

```text
frontend/
  src/
    app/                  # Global providers (React Query, theme, etc.)
    features/
      home/               # Home page + layout + components + templates
      products/           # Catalog, detail, cards, products API
      cart/               # Global cart state
      wishlist/           # Wishlist hooks & UI (if enabled)
      currency/           # Currency context/hooks + <Price />
      uploads/            # Cloudinary integration
      admin/              # Admin panel (products, home, etc.)
      categories/         # Categories & subcategories
      checkout/           # Checkout flow
      auth/               # Authentication
      ...
    layout/
      Navbar.tsx          # Includes currency toggle
      Footer.tsx
      Container.tsx
    ui/                   # Design system (buttons, cards, modals, etc.)
    styles/
      theme.css           # Theme tokens/variables (light/dark)
```

---

## 🧪 Useful scripts (frontend)

> Check/adjust to your `frontend/package.json`.

```bash
# Development
npm run dev

# Production build
npm run build

# Preview build
npm run preview

# Lint / format
npm run lint
```

---

## ✅ Current status

- [x] Functional catalog with filters & pagination.
- [x] Product detail with gallery and cart integration.
- [x] Admin products + stock + CSV import/export.
- [x] Home with carousel and configurable sections.
- [x] Cloudinary integration in admin/home and products.
- [x] Hydration error fixed by removing nested buttons in admin home.
- [ ] Integrate real payment gateway (Stripe, PayPal, etc.).
- [ ] Implement favorites / wishlist (persistence).
- [ ] Improve SEO (per‑product metadata, OpenGraph, JSON‑LD).
- [ ] Dynamic currency conversion from backend (if applicable).

---

## 🗺️ Roadmap (high level)

- Account/Profile (orders, addresses, wishlist).
- Admin order management (picking, statuses, invoices).
- Help center and policies (FAQ, shipping, returns, privacy, T&C).
- Advanced search (filters for price, rating, availability).
- i18n (ES/EN) and regional formatting.
- Observability (Logging, metrics, tracing).

---

## ⚡ Quick wins (this week)

_(Requested section: unchecked items with “Current status”)_

- [ ] **Unified currency across the flow**
  - Current status: `<Price />` applied in detail & catalog; cart and summary already convert totals. Need a rates API if you want dynamic conversion.
- [ ] **Real images via Cloudinary across the site**
  - Current status: Admin and hero slides upload to Cloudinary; products use their own image (no Unsplash). Review legacy products without `imageUrl`.
- [ ] **Basic wishlist (full UI + persistence)**
  - Current status: Favorite button and hooks are ready; need persistent endpoint and `/wishlist` grid page.
- [ ] **Home templates compatible with light/dark**
  - Current status: Color/text tokens cleaned; validate contrast on hero with bright images (auto overlay).
- [ ] **Fast SEO**
  - Current status: `document.title` on detail; need `<Helmet>` with per‑product meta/OpenGraph and sitemap.xml.
- [ ] **404 / 500 and ErrorBoundary**
  - Current status: loading fallbacks exist; need dedicated 404/500 pages and a global boundary.
- [ ] **Accessibility baseline**
  - Current status: labels and roles in progress; review focus/keys on carousel and quantity buttons.
- [ ] **Key analytics events**
  - Current status: to instrument (page_view, add_to_cart, start_checkout).
- [ ] **CSV import UX**
  - Current status: works; add preview and per‑column validations.
- [ ] **Minimal critical testing**
  - Current status: pending unit tests in `currency/format`, `cart/store` and e2e “add to cart”.

---

## 📄 License

This project is not classic open source.  
All code is protected by **copyright**.  
See [`LICENSE`](./LICENSE) for full terms.
