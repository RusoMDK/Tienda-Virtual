# Tienda Virtual — Monorepo (Backend + Frontend)

_E-commerce full-stack con Fastify + Prisma + PostgreSQL en el backend y React + Vite + Tailwind en el frontend. JWT, 2FA, Cloudinary, pagos con Stripe, panel admin y más. Sí, la tienda vende… y también escala 😉._

---

## 🧭 TL;DR (arranca en 5 minutos)

```bash
git clone https://github.com/RusoMDK/Tienda-Virtual.git
cd Tienda-Virtual
```

**Backend**
```bash
cd backend
cp .env.example .env      # edita valores (JWTs, DB, Cloudinary, Stripe, etc.)
npm i
npx prisma generate
# si tienes migraciones:
npx prisma migrate reset --force
# si NO usas migraciones:
# npx prisma db push
npm start                 # http://localhost:4000
```

**Frontend**
```bash
cd ../frontend
cp .env.example .env      # VITE_API_URL, VITE_CLOUDINARY_CLOUD_NAME, etc.
npm i
npm run dev               # http://localhost:5173
```

**Smoke tests**
```bash
curl http://localhost:4000/categories
curl "http://localhost:4000/products?page=1&pageSize=12"
# 401 en /me o /auth/refresh es normal sin sesión/cookies
```

---

## 🏗️ Arquitectura & Tech Stack

**Backend**
- Fastify 5 (CORS, Helmet, Rate Limit, Cookies, JWT)
- Prisma ORM + PostgreSQL
- Zod para validación de env y payloads
- Autenticación JWT (access/refresh), 2FA (TOTP)
- Stripe (checkout) • Cloudinary (media) • Cron jobs (node-cron)
- Pino logger • SSE para soporte / eventos
- Rutas: `auth`, `me`, `addresses`, `orders`, `payments`, `products`, `categories`, `support`, `fx.*`, `cloudinary`, `image-proxy`, `admin.*`

**Frontend**
- React + Vite + TypeScript
- Tailwind CSS + UI components propios
- Router con rutas protegidas
- Estado/API helpers (query client)
- Módulos: catálogo, producto, carrito, checkout, cuenta, admin (productos, categorías, usuarios, soporte, FX), soporte (inbox, hilo, adjuntos), moneda y precios (conmutador)

---

## 🗂️ Estructura del repo

```
Tienda-Virtual/
├─ backend/        # Fastify + Prisma + TS
│  ├─ prisma/      # schema.prisma, migrations/, seed.ts
│  └─ src/         # plugins, routes, services, jobs, utils
└─ frontend/       # React + Vite + TS + Tailwind
   └─ src/         # features, pages, ui, lib, theme...
```

---

## ⚙️ Configuración de entorno

**Backend (`backend/.env.example`)** incluye:
- `DATABASE_URL` (Postgres)
- `PORT`, `NODE_ENV`, `CORS_ORIGIN` / `FRONTEND_ORIGIN`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, TTLs
- Cookies (`COOKIE_SECURE`, `COOKIE_SAME_SITE`, etc.)
- **Stripe** (secret key y webhook secret) ← _usa placeholders, jamás claves reales en el repo_
- **Cloudinary** (`CLOUDINARY_*`)
- FX cron (opcional)

> Genera secretos fuertes:
>
> ```bash
> openssl rand -hex 64
> ```

**Frontend (`frontend/.env.example`)**:
- `VITE_API_URL=http://localhost:4000`
- `VITE_CLOUDINARY_CLOUD_NAME=...`
- (Opcional) `VITE_STRIPE_PUBLISHABLE_KEY` (clave **publicable** de Stripe)

> Los `.env` **no** se commitean; los `.env.example` **sí**.

---

## 🧰 Comandos útiles

**Backend**
```bash
npm start            # dev con tsx (http://localhost:4000)
npm run build        # tsc -> dist (si necesitas build)
npx prisma generate
npx prisma migrate reset --force   # recrea y aplica migraciones (+ seed si procede)
npx prisma db push                 # crea tablas sin migraciones
npm run prisma:seed                # ejecuta prisma/seed.ts (si aplica)
npx prisma studio                  # GUI para la DB
```

**Frontend**
```bash
npm run dev          # http://localhost:5173
npm run build
npm run preview
```

---

## 🛢️ PostgreSQL (dev rápido en macOS)

Con Homebrew:
```bash
brew install postgresql@16
brew services start postgresql@16

# crea rol/DB de ejemplo (ajusta si ya tienes otra config)
psql -d postgres -c "DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='tienda') THEN CREATE ROLE tienda LOGIN PASSWORD 'tienda'; END IF; END $$;"
psql -d postgres -c "DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_database WHERE datname='tienda') THEN CREATE DATABASE tienda OWNER tienda; END IF; END $$;"
psql -d tienda -c "GRANT ALL PRIVILEGES ON SCHEMA public TO tienda; CREATE EXTENSION IF NOT EXISTS pgcrypto;"
```

`.env` (backend):
```
DATABASE_URL="postgresql://tienda:tienda@127.0.0.1:5432/tienda?schema=public"
```

---

## 🔐 Seguridad (muy importante)

- **No subas secretos** (JWT, claves de Stripe, Cloudinary, etc.). GitHub Push Protection bloquea pushes con patrones sensibles.
- Usa placeholders en `*.env.example` (ej. `__REPLACE_ME__`).
- Rota llaves si alguna vez se expusieron.
- En producción: HTTPS y `COOKIE_SECURE=true`.

---

## 🧪 Endpoints de prueba (dev)

```bash
# categorías (público)
curl http://localhost:4000/categories

# productos (público, paginado)
curl "http://localhost:4000/products?page=1&pageSize=12"

# FX público (si activaste el cron/seed)
curl http://localhost:4000/fx/public
```

> **401** en `/me` o `/auth/refresh` es esperado sin sesión.

---

## 🗺️ Roadmap corto

- [ ] Búsqueda full-text/tri-gram + filtros avanzados
- [ ] Webhooks de pago en producción
- [ ] Roles/Permisos finos para admin/staff
- [ ] Tests e2e (Playwright/Cypress)
- [ ] Docker Compose para dev one-shot

---

## 🤝 Contribuir

PRs e issues bienvenidos. Mantén estilo consistente, describe bien el cambio y no subas `.env`. _Si dudas, abre issue: mejor preguntar que romper la producción de tu yo del futuro._

---

## 🧾 Licencia

Consulta `LICENSE` en este repo.

---

_Hecho con ❤️, Fastify y un cafecito. Si esto te ahorró tiempo, deja una ⭐._
