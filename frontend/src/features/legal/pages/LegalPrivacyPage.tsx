import { useEffect } from "react";
import Container from "@/layout/Container";
import { Link } from "react-router-dom";

export default function LegalPrivacyPage() {
  const updated = "2025-08-17";
  useEffect(() => {
    document.title = "Política de Privacidad – Tienda";
  }, []);

  const h = "text-lg font-semibold mt-6 mb-2";
  const p = "opacity-80 leading-relaxed";
  const card = "rounded-2xl bg-[var(--card)] border border-[var(--border)] p-5";

  return (
    <Container className="py-8">
      <div className={card}>
        <h1 className="text-2xl font-bold">Política de Privacidad</h1>
        <p className="text-xs opacity-70 mt-1">
          Última actualización: {updated}
        </p>

        <nav className="mt-4 text-sm">
          <ul className="list-disc pl-5 grid gap-1">
            <li>
              <a href="#quien" className="underline">
                1. Responsable
              </a>
            </li>
            <li>
              <a href="#datos" className="underline">
                2. Datos que recopilamos
              </a>
            </li>
            <li>
              <a href="#uso" className="underline">
                3. Cómo usamos tus datos
              </a>
            </li>
            <li>
              <a href="#base" className="underline">
                4. Bases legales
              </a>
            </li>
            <li>
              <a href="#retencion" className="underline">
                5. Conservación
              </a>
            </li>
            <li>
              <a href="#compartir" className="underline">
                6. Con quién los compartimos
              </a>
            </li>
            <li>
              <a href="#derechos" className="underline">
                7. Tus derechos
              </a>
            </li>
            <li>
              <a href="#cookies" className="underline">
                8. Cookies
              </a>
            </li>
            <li>
              <a href="#seguridad" className="underline">
                9. Seguridad
              </a>
            </li>
            <li>
              <a href="#cambios" className="underline">
                10. Cambios
              </a>
            </li>
            <li>
              <a href="#contacto" className="underline">
                11. Contacto
              </a>
            </li>
          </ul>
        </nav>

        <section id="quien" className={h}>
          1. Responsable
        </section>
        <p className={p}>
          “Tienda” (indica razón social y datos fiscales si aplica). Email:
          soporte@tienda.com.
        </p>

        <section id="datos" className={h}>
          2. Datos que recopilamos
        </section>
        <ul className="list-disc pl-5 opacity-80">
          <li>Datos de cuenta (nombre, email, contraseña hash).</li>
          <li>Datos de pedido (direcciones, artículos, importes).</li>
          <li>Datos de pago (tokens de Stripe; no almacenamos tarjetas).</li>
          <li>
            Datos técnicos (IP, navegador) para seguridad y analítica básica.
          </li>
        </ul>

        <section id="uso" className={h}>
          3. Cómo usamos tus datos
        </section>
        <ul className="list-disc pl-5 opacity-80">
          <li>Procesar pedidos y pagos.</li>
          <li>Atención al cliente y notificaciones transaccionales.</li>
          <li>Prevención de fraude y cumplimiento legal.</li>
          <li>
            Con tu consentimiento, marketing (puedes darte de baja en cualquier
            momento).
          </li>
        </ul>

        <section id="base" className={h}>
          4. Bases legales
        </section>
        <p className={p}>
          Ejecución de contrato, cumplimiento legal, interés legítimo y
          consentimiento (cuando corresponda).
        </p>

        <section id="retencion" className={h}>
          5. Conservación
        </section>
        <p className={p}>
          Conservamos los datos el tiempo necesario para los fines indicados o
          lo exigido por ley/contabilidad.
        </p>

        <section id="compartir" className={h}>
          6. Con quién los compartimos
        </section>
        <p className={p}>
          Proveedores de pago (Stripe), logística, hosting y herramientas
          estrictamente necesarias para operar el servicio. Firmamos acuerdos de
          tratamiento cuando procede.
        </p>

        <section id="derechos" className={h}>
          7. Tus derechos
        </section>
        <p className={p}>
          Acceso, rectificación, supresión, oposición, limitación, portabilidad
          y retiro del consentimiento. Para ejercerlos, escribe a{" "}
          <a className="underline" href="mailto:soporte@tienda.com">
            soporte@tienda.com
          </a>{" "}
          o usa{" "}
          <Link to="/contact" className="underline">
            Contacto
          </Link>
          .
        </p>

        <section id="cookies" className={h}>
          8. Cookies
        </section>
        <p className={p}>
          Usamos cookies esenciales y, con tu consentimiento,
          analíticas/marketing. Puedes gestionar preferencias desde tu
          navegador. (Opcional: crea una página /legal/cookies para detalle).
        </p>

        <section id="seguridad" className={h}>
          9. Seguridad
        </section>
        <p className={p}>
          Aplicamos medidas técnicas y organizativas razonables (TLS/SSL,
          controles de acceso, cifrado en tránsito).
        </p>

        <section id="cambios" className={h}>
          10. Cambios
        </section>
        <p className={p}>
          Publicaremos cualquier cambio con su fecha de vigencia.
        </p>

        <section id="contacto" className={h}>
          11. Contacto
        </section>
        <p className={p}>
          Correo: soporte@tienda.com | También en{" "}
          <Link to="/contact" className="underline">
            Contacto
          </Link>
          .
        </p>
      </div>
    </Container>
  );
}
