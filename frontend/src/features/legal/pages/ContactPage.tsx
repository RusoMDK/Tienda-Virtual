import { useEffect, useState } from "react";
import Container from "@/layout/Container";
import { Button, Input, Label } from "@/ui";
import { useToast } from "@/ui";

export default function ContactPage() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    document.title = "Contacto – Tienda";
  }, []);

  function validEmail(v: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !validEmail(email) || msg.length < 10) {
      toast({
        title: "Revisa los campos",
        description:
          "Completa nombre, email válido y mensaje (mín. 10 caracteres).",
        variant: "error",
      });
      return;
    }
    // Conecta aquí a tu endpoint real, p. ej. api.post("/contact", { name, email, msg })
    toast({
      title: "Mensaje enviado",
      description: "Te responderemos pronto.",
      variant: "success",
    });
    setName("");
    setEmail("");
    setMsg("");
  }

  const card = "rounded-2xl bg-[var(--card)] border border-[var(--border)] p-5";

  return (
    <Container className="py-8">
      <div className={card}>
        <h1 className="text-2xl font-bold">Contacto</h1>
        <p className="text-sm opacity-80 mt-1">
          ¿Necesitas ayuda con un pedido? Escríbenos y te respondemos.
        </p>

        <form onSubmit={onSubmit} className="mt-4 grid gap-3">
          <div className="grid gap-1">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="msg">Mensaje</Label>
            <textarea
              id="msg"
              rows={5}
              className="rounded-xl px-3 py-2 text-sm bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--ring)]"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Cuéntanos en qué podemos ayudarte"
            />
          </div>
          <Button type="submit" className="mt-2 w-full sm:w-auto">
            Enviar
          </Button>

          <p className="text-xs opacity-70 mt-2">
            También puedes escribir a{" "}
            <a className="underline" href="mailto:soporte@tienda.com">
              soporte@tienda.com
            </a>
            .
          </p>
        </form>
      </div>
    </Container>
  );
}
