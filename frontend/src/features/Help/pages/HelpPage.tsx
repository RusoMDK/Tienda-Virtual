// src/pages/HelpPage.tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input, Button } from "@/ui";
import Container from "@/layout/Container"; // ajusta si tu Container está en otra ruta

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const nav = useNavigate();

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    // Por ahora solo navega con el query param; más adelante puedes hacer búsqueda real
    nav(`/help?q=${encodeURIComponent(q)}`);
  }

  return (
    <main className="min-h-[calc(100vh-var(--nav-h))] bg-[rgb(var(--bg-rgb))]">
      {/* HERO / CABECERA */}
      <section className="border-b border-[rgb(var(--border-rgb))] bg-gradient-to-b from-[rgb(var(--card-rgb))] via-[rgb(var(--card-2-rgb))] to-[rgb(var(--bg-rgb))]">
        <Container className="!max-w-6xl px-4 lg:px-8 py-8 lg:py-12">
          <div className="grid gap-6 lg:gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-center">
            <div className="space-y-4 lg:space-y-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[rgb(var(--muted-rgb))]">
                Centro de ayuda
              </p>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight">
                ¿En qué podemos ayudarte hoy?
              </h1>
              <p className="text-sm sm:text-base lg:text-[15px] text-[rgb(var(--muted-fg))] max-w-2xl">
                Encuentra respuestas rápidas sobre pedidos, envíos, pagos,
                devoluciones y configuración de tu cuenta. Si lo necesitas,
                también puedes hablar con una persona de nuestro equipo.
              </p>

              {/* Buscador de ayuda */}
              <form onSubmit={onSearch} className="mt-3 max-w-xl space-y-2">
                <label
                  htmlFor="help-search"
                  className="text-[11px] uppercase tracking-wide text-[rgb(var(--muted-fg))]"
                >
                  Buscar en el centro de ayuda
                </label>
                <div className="relative flex items-center gap-2">
                  <Input
                    id="help-search"
                    placeholder='Escribe una pregunta: "no me llegó el pedido", "cambiar dirección"...'
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="
                      h-11 sm:h-12
                      pr-28
                      bg-[rgb(var(--elev-rgb))]
                      border border-[rgb(var(--border-rgb))]
                      text-sm sm:text-[15px]
                    "
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    className="
                      absolute right-1.5 top-1/2 -translate-y-1/2
                      h-8 sm:h-9 px-4 text-xs sm:text-sm
                    "
                  >
                    Buscar
                  </Button>
                </div>
                <p className="text-[11px] text-[rgb(var(--muted-fg))]">
                  Ejemplos:{" "}
                  <button
                    type="button"
                    onClick={() => setQuery("¿Dónde está mi pedido?")}
                    className="underline underline-offset-2 hover:text-[rgb(var(--fg-rgb))]"
                  >
                    ¿Dónde está mi pedido?
                  </button>
                  ,{" "}
                  <button
                    type="button"
                    onClick={() => setQuery("Quiero devolver un producto")}
                    className="underline underline-offset-2 hover:text-[rgb(var(--fg-rgb))]"
                  >
                    Quiero devolver un producto
                  </button>
                  .
                </p>
              </form>
            </div>

            {/* Tarjeta de contacto rápido */}
            <aside className="mt-2 lg:mt-0">
              <div className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--elev-rgb))] shadow-sm p-4 sm:p-5 space-y-3">
                <h2 className="text-sm sm:text-base font-semibold">
                  ¿Necesitas ayuda inmediata?
                </h2>
                <p className="text-xs sm:text-sm text-[rgb(var(--muted-fg))]">
                  Si tienes un problema con un pedido reciente, empieza por
                  revisar el estado del pedido. Si todavía necesitas ayuda, abre
                  un ticket de soporte y nuestro equipo te responderá lo antes
                  posible.
                </p>
                <div className="flex flex-col gap-2">
                  <Link to="/orders">
                    <Button className="w-full text-sm">Ver mis pedidos</Button>
                  </Link>
                  <Link to="/support">
                    <Button
                      variant="secondary"
                      className="w-full text-xs sm:text-sm"
                    >
                      Contactar con soporte
                    </Button>
                  </Link>
                </div>
                <p className="text-[11px] text-[rgb(var(--muted-fg))]">
                  Horario de atención: lunes a sábado, 9:00 a 18:00 (hora
                  local).
                </p>
              </div>
            </aside>
          </div>
        </Container>
      </section>

      {/* CONTENIDO PRINCIPAL */}
      <Container className="!max-w-6xl px-4 lg:px-8 py-8 lg:py-12 space-y-10 lg:space-y-12">
        {/* Bloque de categorías de ayuda */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base sm:text-lg font-semibold">
                Temas más consultados
              </h2>
              <p className="text-xs sm:text-sm text-[rgb(var(--muted-fg))]">
                Elige un tema para ver guías rápidas y preguntas frecuentes.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
            {/* Envíos y entregas */}
            <HelpCategoryCard
              id="envios"
              title="Envíos y entregas"
              description="Tiempos de entrega, zonas disponibles, seguimiento y qué hacer si tu pedido se retrasa."
              items={[
                "Plazos de entrega por provincia",
                "Cómo hacer seguimiento de tu envío",
                "¿Qué hago si mi paquete no llega?",
                "Pedido marcado como entregado pero no lo recibí",
              ]}
            />

            {/* Pedidos y devoluciones */}
            <HelpCategoryCard
              id="devoluciones"
              title="Pedidos, devoluciones y reembolsos"
              description="Información sobre cómo modificar, cancelar o devolver un pedido y cuándo recibes tu reembolso."
              items={[
                "Cancelar o modificar un pedido",
                "Cómo iniciar una devolución",
                "Estado de mi reembolso",
                "Producto defectuoso o incompleto",
              ]}
            />

            {/* Pagos */}
            <HelpCategoryCard
              id="pagos"
              title="Pagos y facturación"
              description="Métodos de pago aceptados, seguridad de pagos y descarga de facturas."
              items={[
                "Formas de pago disponibles",
                "Pagos rechazados o fallidos",
                "Seguridad y protección de datos",
                "Cómo obtener mi factura",
              ]}
            />

            {/* Cuenta */}
            <HelpCategoryCard
              id="cuenta"
              title="Cuenta y seguridad"
              description="Acceso a tu cuenta, actualización de datos y consejos de seguridad."
              items={[
                "No puedo iniciar sesión",
                "Cambiar correo o contraseña",
                "Direcciones de envío y facturación",
                "Cerrar mi cuenta",
              ]}
            />

            {/* Productos */}
            <HelpCategoryCard
              id="productos"
              title="Productos y disponibilidad"
              description="Información sobre fichas de producto, stock, variantes y garantías."
              items={[
                "Stock y disponibilidad",
                "Garantía de productos",
                "Información de tallas y medidas",
                "Consultar características técnicas",
              ]}
            />

            {/* Soporte técnico */}
            <HelpCategoryCard
              id="tecnico"
              title="Soporte técnico y uso de la tienda"
              description="Problemas con la web, errores en el pago o dificultades al navegar."
              items={[
                "La web va lenta o no carga",
                "Problemas al pagar",
                "No recibo correos de confirmación",
                "Reportar un error técnico",
              ]}
            />
          </div>
        </section>

        {/* Bloques de FAQs detalladas */}
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          {/* FAQs principales */}
          <div className="space-y-5 lg:space-y-6">
            <h2 className="text-base sm:text-lg font-semibold">
              Preguntas frecuentes generales
            </h2>

            <div className="space-y-3">
              <HelpFAQ
                question="¿Cómo puedo ver el estado de mi pedido?"
                answer={
                  <>
                    Puedes revisar el estado actual de todos tus pedidos desde{" "}
                    <Link
                      to="/orders"
                      className="underline underline-offset-4 text-[rgb(var(--primary-rgb))]"
                    >
                      la sección &quot;Mis pedidos&quot;
                    </Link>
                    . Allí verás si tu pedido está en preparación, en camino o
                    entregado, así como el número de seguimiento si está
                    disponible.
                  </>
                }
              />
              <HelpFAQ
                question="No me llegó el correo de confirmación, ¿qué hago?"
                answer={
                  <>
                    Primero revisa tu carpeta de spam o correo no deseado. Si no
                    aparece, entra a{" "}
                    <Link
                      to="/orders"
                      className="underline underline-offset-4 text-[rgb(var(--primary-rgb))]"
                    >
                      Mis pedidos
                    </Link>{" "}
                    para confirmar que la compra se registró correctamente. Si
                    aún así no ves tu pedido, contáctanos desde{" "}
                    <Link
                      to="/support"
                      className="underline underline-offset-4 text-[rgb(var(--primary-rgb))]"
                    >
                      soporte
                    </Link>
                    .
                  </>
                }
              />
              <HelpFAQ
                question="¿Puedo cambiar la dirección de entrega después de comprar?"
                answer={
                  <>
                    Depende del estado del pedido. Si todavía está &quot;En
                    preparación&quot;, en muchos casos podemos actualizar la
                    dirección. Escríbenos lo antes posible desde{" "}
                    <Link
                      to="/support"
                      className="underline underline-offset-4 text-[rgb(var(--primary-rgb))]"
                    >
                      soporte
                    </Link>{" "}
                    indicando el número de pedido y la nueva dirección. Si el
                    pedido ya está en reparto, intentaremos ayudarte con una
                    solución alternativa.
                  </>
                }
              />
              <HelpFAQ
                question="¿Qué pasa si mi pago fue rechazado?"
                answer={
                  <>
                    Si el pago fue rechazado pero ves un cargo pendiente en tu
                    banco o tarjeta, normalmente se libera de forma automática
                    en unas horas. Te recomendamos intentar de nuevo el pago con
                    otro método o contactar a tu banco. Si tienes dudas, puedes
                    escribirnos desde la sección de{" "}
                    <Link
                      to="/help#pagos"
                      className="underline underline-offset-4 text-[rgb(var(--primary-rgb))]"
                    >
                      ayuda sobre pagos
                    </Link>
                    .
                  </>
                }
              />
            </div>
          </div>

          {/* Contacto y soporte humano */}
          <div className="space-y-4">
            <h2 className="text-base sm:text-lg font-semibold">
              Habla con nuestro equipo
            </h2>
            <div className="space-y-3">
              <div className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] p-4 space-y-2">
                <h3 className="text-sm font-semibold">
                  Abrir un ticket de soporte
                </h3>
                <p className="text-xs sm:text-sm text-[rgb(var(--muted-fg))]">
                  Cuéntanos qué ha pasado y adjunta, si puedes, capturas de
                  pantalla o fotos del problema. Así podremos darte una solución
                  más rápida y precisa.
                </p>
                <Link to="/support">
                  <Button className="w-full text-xs sm:text-sm">
                    Ir a soporte
                  </Button>
                </Link>
              </div>

              <div className="rounded-2xl border border-dashed border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-2-rgb))] p-4 space-y-2">
                <h3 className="text-sm font-semibold">
                  ¿Prefieres que te contactemos?
                </h3>
                <p className="text-xs sm:text-sm text-[rgb(var(--muted-fg))]">
                  Si lo prefieres, puedes escribirnos desde{" "}
                  <Link
                    to="/contact"
                    className="underline underline-offset-4 text-[rgb(var(--primary-rgb))]"
                  >
                    el formulario de contacto
                  </Link>
                  . Déjanos tu correo y una breve descripción del problema y te
                  responderemos en el menor tiempo posible.
                </p>
                <p className="text-[11px] text-[rgb(var(--muted-fg))]">
                  Tiempo de respuesta estimado: entre 24 y 48 horas hábiles.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Info de confianza / políticas */}
        <section className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] p-4 sm:p-5 lg:p-6 space-y-3">
          <h2 className="text-base sm:text-lg font-semibold">
            Nuestra promesa de soporte
          </h2>
          <div className="grid gap-4 sm:grid-cols-3 text-xs sm:text-sm">
            <div className="space-y-1">
              <h3 className="font-semibold">Transparencia</h3>
              <p className="text-[rgb(var(--muted-fg))]">
                Te informamos siempre del estado de tu pedido, tus devoluciones
                y tus reembolsos, sin letra pequeña.
              </p>
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold">Seguridad</h3>
              <p className="text-[rgb(var(--muted-fg))]">
                Tus datos personales y de pago están protegidos siguiendo buenas
                prácticas de seguridad y cifrado.
              </p>
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold">Acompañamiento</h3>
              <p className="text-[rgb(var(--muted-fg))]">
                Estamos disponibles para ayudarte antes, durante y después de tu
                compra. Si algo sale mal, buscamos una solución contigo.
              </p>
            </div>
          </div>
        </section>
      </Container>
    </main>
  );
}

/* ==== Subcomponentes internos ==== */

type HelpCategoryCardProps = {
  id: string;
  title: string;
  description: string;
  items: string[];
};

function HelpCategoryCard({
  id,
  title,
  description,
  items,
}: HelpCategoryCardProps) {
  return (
    <a
      href={`#${id}`}
      className="
        group block h-full rounded-2xl border border-[rgb(var(--border-rgb))]
        bg-[rgb(var(--card-rgb))] p-4 sm:p-5
        hover:border-[rgb(var(--ring-rgb))] hover:shadow-sm
        transition
      "
    >
      <div className="flex flex-col gap-2 h-full">
        <div>
          <h3 className="text-sm sm:text-base font-semibold mb-1">{title}</h3>
          <p className="text-xs sm:text-sm text-[rgb(var(--muted-fg))]">
            {description}
          </p>
        </div>
        <ul className="mt-2 space-y-1.5 text-[11px] sm:text-xs text-[rgb(var(--muted-fg))]">
          {items.map((item) => (
            <li key={item} className="flex gap-1.5">
              <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-[rgb(var(--primary-rgb))]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <span className="mt-auto pt-2 text-[11px] sm:text-xs font-medium text-[rgb(var(--primary-rgb))] group-hover:underline underline-offset-4">
          Ver más sobre {title.toLowerCase()}
        </span>
      </div>
    </a>
  );
}

type HelpFAQProps = {
  question: string;
  answer: React.ReactNode;
};

function HelpFAQ({ question, answer }: HelpFAQProps) {
  return (
    <details
      className="
        group rounded-xl border border-[rgb(var(--border-rgb))]
        bg-[rgb(var(--card-rgb))] px-3 sm:px-4 py-2.5 sm:py-3
      "
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 list-none">
        <span className="text-xs sm:text-sm font-medium">{question}</span>
        <span className="text-[11px] opacity-60 group-open:rotate-180 transition-transform">
          ▾
        </span>
      </summary>
      <div className="mt-2 text-xs sm:text-sm text-[rgb(var(--muted-fg))]">
        {answer}
      </div>
    </details>
  );
}
