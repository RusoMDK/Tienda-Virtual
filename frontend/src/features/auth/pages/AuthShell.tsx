// src/features/auth/components/AuthShell.tsx
import { AnimatePresence, motion } from "framer-motion";
import React from "react";

/**
 * Shell animado para Login/Register.
 * - Centrado vertical (queda a mitad entre navbar y footer).
 * - Transición suave izquierda↔derecha al cambiar de modo.
 */
export default function AuthShell({
  mode, // "login" | "register"
  brand, // contenido del panel de marca (JSX)
  form, // contenido del formulario (JSX)
}: {
  mode: "login" | "register";
  brand: React.ReactNode;
  form: React.ReactNode;
}) {
  // en login: brand a la derecha, form a la izquierda
  // en register: al revés (inverso)
  const brandOnRight = mode === "login";

  // Variantes simpáticas
  const spring = { type: "spring", stiffness: 240, damping: 28, mass: 0.9 };

  const brandVariants = {
    initial: { opacity: 0, x: brandOnRight ? 40 : -40, scale: 0.985 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: brandOnRight ? -40 : 40, scale: 0.985 },
  };
  const formVariants = {
    initial: { opacity: 0, x: brandOnRight ? -40 : 40, scale: 0.985 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: brandOnRight ? 40 : -40, scale: 0.985 },
  };

  return (
    <section className="relative">
      {/* halos suaves detrás */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(600px 200px at 85% -80px, rgb(var(--accent-rgb)/0.18), transparent), radial-gradient(600px 200px at -10% 120%, rgb(var(--primary-rgb)/0.16), transparent)",
        }}
      />

      {/* 👇 min-h para centrar vertical: ~80% del viewport; padding amplio lejos del navbar */}
      <div className="container min-h-[80dvh] py-14 md:py-24 grid items-center">
        <div className="grid gap-6 md:gap-8 md:grid-cols-2 items-stretch">
          {/* FORM (izq en login, der en register) */}
          <AnimatePresence mode="wait" initial>
            <motion.div
              key={`form-${mode}`}
              variants={formVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={spring}
              className={brandOnRight ? "" : "md:order-last"}
            >
              <div className="rounded-2xl border bg-[rgb(var(--card-rgb))] p-6 sm:p-7 shadow-lg">
                {form}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* BRAND (der en login, izq en register) */}
          <AnimatePresence mode="wait" initial>
            <motion.aside
              key={`brand-${mode}`}
              variants={brandVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={spring}
              className={[
                "hidden md:block",
                brandOnRight ? "" : "md:order-first",
              ].join(" ")}
            >
              <div className="rounded-3xl border bg-[rgb(var(--card-rgb))] p-8 overflow-hidden relative">
                {/* halos internos */}
                <div
                  className="absolute -right-8 -top-8 h-40 w-40 rounded-full blur-2xl"
                  style={{
                    background:
                      "radial-gradient(closest-side, rgb(var(--accent-rgb)/0.25), transparent)",
                  }}
                />
                <div
                  className="absolute -left-10 -bottom-10 h-44 w-44 rounded-full blur-2xl"
                  style={{
                    background:
                      "radial-gradient(closest-side, rgb(var(--primary-rgb)/0.25), transparent)",
                  }}
                />
                <div className="relative">{brand}</div>
              </div>
            </motion.aside>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
