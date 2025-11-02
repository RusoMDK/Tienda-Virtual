// src/pages/RegisterPage.tsx
import { Button, Input, Label } from "@/ui";
import { useToast } from "@/ui";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { register as apiRegister } from "@/features/auth/api";
import { useAuth } from "@/hooks/useAuth";
import { useMemo, useState } from "react";
import { Eye, EyeOff, ShieldCheck, UserPlus } from "lucide-react";
import AuthShell from "./AuthShell";

const Schema = z
  .object({
    name: z.string().min(1, "Requerido").max(80),
    email: z.string().email("Email inválido"),
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .max(72, "Demasiado larga")
      .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), {
        message: "Usa letras y números",
      }),
    confirm: z.string().min(8, "Mínimo 8 caracteres"),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Las contraseñas no coinciden",
  });

type Form = z.infer<typeof Schema>;

function scorePassword(pwd: string) {
  let s = 0;
  if (pwd.length >= 8) s++;
  if (pwd.length >= 12) s++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s++;
  if (/\d/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  return Math.min(s, 4);
}
function strengthLabel(score: number) {
  return ["Muy débil", "Débil", "Media", "Buena", "Fuerte"][score] ?? "—";
}

export default function RegisterPage() {
  const { login } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const next = sp.get("next") || "/";

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<Form>({ resolver: zodResolver(Schema) });

  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const pwd = watch("password") || "";
  const score = useMemo(() => scorePassword(pwd), [pwd]);

  async function onSubmit(data: Form) {
    try {
      const payload = {
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password,
      };
      await apiRegister(payload);
      await login(payload.email, payload.password);
      toast({ title: "Cuenta creada 🎉", variant: "success" });
      nav(next, { replace: true });
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        (e?.response?.status === 409
          ? "Ese email ya está registrado"
          : "No se pudo crear la cuenta");
      setError("email", { message: msg });
      toast({ title: msg, variant: "error" });
    }
  }

  const brand = (
    <>
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs bg-[rgb(var(--elev-rgb))]">
        <UserPlus size={14} className="opacity-80" />
        Regístrate en segundos
      </div>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)]">
          tienda
        </span>
      </h1>
      <p className="mt-2 text-[15px] text-[rgb(var(--fg-rgb)/0.75)]">
        Crea tu cuenta para comprar más rápido y seguir tus órdenes.
      </p>
      <ul className="mt-6 space-y-3 text-sm text-[rgb(var(--fg-rgb)/0.8)]">
        <li className="flex items-start gap-3">
          <span className="mt-1 h-2 w-2 rounded-full bg-[rgb(var(--primary-rgb))]" />
          Guardamos tus direcciones y pedidos
        </li>
        <li className="flex items-start gap-3">
          <span className="mt-1 h-2 w-2 rounded-full bg-[rgb(var(--accent-rgb))]" />
          Notificaciones de estado y entregas
        </li>
        <li className="flex items-start gap-3">
          <span className="mt-1 h-2 w-2 rounded-full bg-[rgb(var(--primary-rgb))]" />
          Inicio de sesión seguro
        </li>
      </ul>
    </>
  );

  const form = (
    <>
      <div className="mb-5">
        <h2 className="text-xl font-semibold">Crear cuenta</h2>
        <p className="text-sm text-[rgb(var(--fg-rgb)/0.72)]">
          Regístrate para comprar más rápido
        </p>
      </div>

      {(errors.email || errors.password || errors.confirm) && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-4 rounded-xl border px-3 py-2 text-sm"
          style={{
            background: "rgb(239 68 68 / 0.08)",
            borderColor: "rgb(239 68 68 / 0.35)",
            color: "rgb(239 68 68)",
          }}
        >
          {errors.email?.message ||
            errors.password?.message ||
            errors.confirm?.message}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Nombre */}
        <div>
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            placeholder="Tu nombre"
            autoComplete="name"
            disabled={isSubmitting}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
            {...register("name")}
          />
          {errors.name && (
            <p
              id="name-error"
              className="text-xs mt-1"
              style={{ color: "rgb(239 68 68)" }}
            >
              {errors.name.message}
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="tu@email..."
            autoComplete="email"
            disabled={isSubmitting}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...register("email")}
          />
          {errors.email && (
            <p
              id="email-error"
              className="text-xs mt-1"
              style={{ color: "rgb(239 68 68)" }}
            >
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password + medidor (toggle minimal centrado) */}
        <div>
          <Label htmlFor="password">Contraseña</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPwd ? "text" : "password"}
              placeholder="Mín. 8 caracteres"
              autoComplete="new-password"
              disabled={isSubmitting}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "pwd-error" : undefined}
              className="pr-10"
              {...register("password")}
            />
            <button
              type="button"
              aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
              title={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
              onClick={() => setShowPwd((s) => !s)}
              aria-pressed={showPwd}
              className={[
                "absolute right-2 top-1/2 -translate-y-1/2",
                "inline-flex h-7 w-7 items-center justify-center",
                "rounded-md bg-transparent",
                "text-[rgb(var(--fg-rgb)/0.55)] hover:text-[rgb(var(--fg-rgb))]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring-rgb))]",
                "transition",
              ].join(" ")}
            >
              {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Barra de fuerza */}
          <div className="mt-2">
            <div className="h-1.5 w-full rounded bg-[rgb(var(--zinc-200))] overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${(score / 4) * 100}%`,
                  background:
                    score <= 1
                      ? "#ef4444"
                      : score === 2
                      ? "#f59e0b"
                      : score === 3
                      ? "#22c55e"
                      : "#10b981",
                }}
              />
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-[rgb(var(--fg-rgb)/0.8)]">
              <ShieldCheck size={14} className="opacity-70" />
              Fortaleza: {strengthLabel(score)}
            </div>
          </div>

          {errors.password && (
            <p
              id="pwd-error"
              className="text-xs mt-1"
              style={{ color: "rgb(239 68 68)" }}
            >
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Confirmación (toggle minimal centrado) */}
        <div>
          <Label htmlFor="confirm">Confirmar contraseña</Label>
          <div className="relative">
            <Input
              id="confirm"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              disabled={isSubmitting}
              aria-invalid={!!errors.confirm}
              aria-describedby={errors.confirm ? "confirm-error" : undefined}
              className="pr-10"
              {...register("confirm")}
            />
            <button
              type="button"
              aria-label={
                showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              title={showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
              onClick={() => setShowConfirm((s) => !s)}
              aria-pressed={showConfirm}
              className={[
                "absolute right-2 top-1/2 -translate-y-1/2",
                "inline-flex h-7 w-7 items-center justify-center",
                "rounded-md bg-transparent",
                "text-[rgb(var(--fg-rgb)/0.55)] hover:text-[rgb(var(--fg-rgb))]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring-rgb))]",
                "transition",
              ].join(" ")}
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.confirm && (
            <p
              id="confirm-error"
              className="text-xs mt-1"
              style={{ color: "rgb(239 68 68)" }}
            >
              {errors.confirm.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          full
          disabled={isSubmitting}
          className="shadow-sm"
        >
          {isSubmitting ? "Creando…" : "Crear cuenta"}
        </Button>
      </form>

      <p className="text-sm text-[rgb(var(--fg-rgb)/0.75)] mt-5">
        ¿Ya tienes cuenta?{" "}
        <Link to="/login" className="underline hover:opacity-100 opacity-90">
          Inicia sesión
        </Link>
      </p>
    </>
  );

  // en register: brand a la IZQUIERDA, form a la DERECHA (inverso del login)
  return <AuthShell mode="register" brand={brand} form={form} />;
}
