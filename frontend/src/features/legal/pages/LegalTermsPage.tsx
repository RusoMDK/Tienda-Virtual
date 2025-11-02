import { useEffect } from "react";
import Container from "@/layout/Container";
import { Link } from "react-router-dom";

export default function LegalTermsPage() {
  const updated = "2025-08-17";
  useEffect(() => {
    document.title = "Términos y Condiciones – Tienda";
  }, []);

  const h = "text-lg font-semibold mt-6 mb-2";
  const p = "opacity-80 leading-relaxed";
  const card = "rounded-2xl bg-[var(--card)] border border-[var(--border)] p-5";

  return (
    <Container className="py-8">
      <div className={card}>
        <h1 className="text-2xl font-bold">Términos y Condiciones</h1>
        <p className="text-xs opacity-70 mt-1">
          Última actualización: {updated}
        </p>

        {/* Índice */}
        <nav className="mt-4 text-sm">
          <ul className="list-disc pl-5 grid gap-1">
            <li>
              <a href="#aceptacion" className="underline">
                1. Aceptación
              </a>
            </li>
            <li>
              <a href="#compras" className="underline">
                2. Compras y pagos
              </a>
            </li>
            <li>
              <a href="#envios" className="underline">
                3. Envíos
              </a>
            </li>
            <li>
              <a href="#devoluciones" className="underline">
                4. Devoluciones
              </a>
            </li>
            <li>
              <a href="#cuentas" className="underline">
                5. Cuentas
              </a>
            </li>
            <li>
              <a href="#prohibido" className="underline">
                6. Usos prohibidos
              </a>
            </li>
            <li>
              <a href="#responsabilidad" className="underline">
                7. Responsabilidad
              </a>
            </li>
            <li>
              <a href="#ley" className="underline">
                8. Ley aplicable
              </a>
            </li>
            <li>
              <a href="#cambios" className="underline">
                9. Cambios a los términos
              </a>
            </li>
            <li>
              <a href="#contacto" className="underline">
                10. Contacto
              </a>
            </li>
          </ul>
        </nav>

        <section id="aceptacion" className={h}>
          1. Aceptación
        </section>
        <p className={p}>
          Al acceder y usar este sitio aceptas estos Términos. Si no estás de
          acuerdo, por favor no utilices el servicio.
        </p>

        <section id="compras" className={h}>
          2. Compras y pagos
        </section>
        <p className={p}>
          Los precios se muestran en la moneda indicada e incluyen/excluyen
          impuestos según se señale en el checkout. Procesamos pagos de forma
          segura a través de Stripe. Los pedidos están sujetos a confirmación de
          stock y pago.
        </p>

        <section id="envios" className={h}>
          3. Envíos
        </section>
        <p className={p}>
          Ofrecemos envíos con tracking. Los plazos se estiman en el checkout y
          pueden variar por logística del transportista.
        </p>

        <section id="devoluciones" className={h}>
          4. Devoluciones
        </section>
        <p className={p}>
          Aceptamos devoluciones dentro de 30 días naturales desde la entrega,
          siempre que el producto esté en condiciones originales. Para iniciar
          un proceso, visita{" "}
          <Link to="/orders" className="underline">
            Mis pedidos
          </Link>{" "}
          o usa{" "}
          <Link to="/contact" className="underline">
            Contacto
          </Link>
          .
        </p>

        <section id="cuentas" className={h}>
          5. Cuentas
        </section>
        <p className={p}>
          Eres responsable de la exactitud de tus datos y de mantener la
          confidencialidad de tus credenciales.
        </p>

        <section id="prohibido" className={h}>
          6. Usos prohibidos
        </section>
        <p className={p}>
          Queda prohibido vulnerar la seguridad del sitio, usarlo con fines
          fraudulentos o infringir derechos de terceros.
        </p>

        <section id="responsabilidad" className={h}>
          7. Limitación de responsabilidad
        </section>
        <p className={p}>
          En la medida permitida por ley, no seremos responsables por daños
          indirectos o consecuentes derivados del uso del servicio.
        </p>

        <section id="ley" className={h}>
          8. Ley aplicable
        </section>
        <p className={p}>
          Estos Términos se rigen por las leyes del país/estado donde operamos
          (ajusta este texto según tu jurisdicción).
        </p>

        <section id="cambios" className={h}>
          9. Cambios a los términos
        </section>
        <p className={p}>
          Podemos actualizar estos Términos. Publicaremos la versión vigente con
          fecha de actualización.
        </p>

        <section id="contacto" className={h}>
          10. Contacto
        </section>
        <p className={p}>
          ¿Dudas? Escríbenos a{" "}
          <a className="underline" href="mailto:soporte@tienda.com">
            soporte@tienda.com
          </a>{" "}
          o ve a{" "}
          <Link to="/contact" className="underline">
            Contacto
          </Link>
          .
        </p>
      </div>
    </Container>
  );
}
