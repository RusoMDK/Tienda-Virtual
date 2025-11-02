// src/pages/LoginPage.tsx
import { Button, Input, Label } from "@/ui";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useToast } from "@/ui";
import { useState } from "react";
import { Eye, EyeOff, Shield, Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import AuthShell from "./AuthShell";

const LoginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(1, "La contraseña es obligatoria")
    .max(72, "Demasiado larga"),
  totp: z
    .string()
    .optional()
    .transform((v) => (v ? v.trim() : v))
    .refine((v) => !v || /^\d{6}$/.test(v), {
      message: "Debe tener 6 dígitos",
    }),
  remember: z.boolean().optional(),
});
type LoginValues = z.infer<typeof LoginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const toast = useToast();
  const next = sp.get("next") || "/";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    watch,
  } = useForm<LoginValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: "", password: "", totp: "", remember: true },
  });

  const [showPwd, setShowPwd] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const totpValue = watch("totp");

  async function onSubmit(values: LoginValues) {
    try {
      await login(values.email, values.password, values.totp || undefined);
      toast({ title: "¡Bienvenido! 👋", variant: "success" });
      nav(next, { replace: true });
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "Credenciales inválidas o 2FA requerido";
      setError("root", { message: msg });
      setError("password", { message: "Revisa tus datos" });
      toast({ title: msg, variant: "error" });
    }
  }

  const brand = (
    <>
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs bg-[rgb(var(--elev-rgb))]">
        <Lock size={14} className="opacity-80" />
        Acceso seguro en segundos
      </div>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)]">
          tienda
        </span>
      </h1>
      <p className="mt-2 text-[15px] text-[rgb(var(--fg-rgb)/0.75)]">
        Inicia sesión y sigue tu compra. Rápido, seguro y listo para ti.
      </p>
      <ul className="mt-6 space-y-3 text-sm text-[rgb(var(--fg-rgb)/0.85)]">
        <li className="flex items-start gap-3">
          <span className="mt-1 h-2 w-2 rounded-full bg-[rgb(var(--primary-rgb))]" />
          Tus pedidos y direcciones siempre a mano
        </li>
        <li className="flex items-start gap-3">
          <span className="mt-1 h-2 w-2 rounded-full bg-[rgb(var(--accent-rgb))]" />
          Seguimiento de órdenes en tiempo real
        </li>
        <li className="flex items-start gap-3">
          <span className="mt-1 h-2 w-2 rounded-full bg-[rgb(var(--primary-rgb))]" />
          Protección opcional con código 2FA
        </li>
      </ul>
    </>
  );

  const form = (
    <>
      <div className="mb-5">
        <h2 className="text-xl font-semibold">Iniciar sesión</h2>
        <p className="text-sm text-[rgb(var(--fg-rgb)/0.72)]">
          Entra para continuar con tu compra
        </p>
      </div>

      {errors.root?.message && (
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
          {errors.root.message}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              className="mt-1 text-xs"
              style={{ color: "rgb(239 68 68)" }}
            >
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password con toggle minimal */}
        <div>
          <Label htmlFor="pwd">Contraseña</Label>
          <div className="relative">
            <Input
              id="pwd"
              type={showPwd ? "text" : "password"}
              autoComplete="current-password"
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
          {errors.password && (
            <p
              id="pwd-error"
              className="mt-1 text-xs"
              style={{ color: "rgb(239 68 68)" }}
            >
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Opciones */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-[rgb(var(--fg-rgb)/0.85)]">
            <input
              type="checkbox"
              className="accent-[rgb(var(--primary-rgb))]"
              onChange={(e) => setShow2FA(e.target.checked)}
              checked={show2FA || !!totpValue}
            />
            <span className="inline-flex items-center gap-1">
              <Shield size={14} /> Usar código 2FA
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm text-[rgb(var(--fg-rgb)/0.85)]">
            <input
              type="checkbox"
              className="accent-[rgb(var(--primary-rgb))]"
              defaultChecked
              {...register("remember")}
            />
            Mantener sesión
          </label>
        </div>

        {(show2FA || !!totpValue) && (
          <div>
            <Label htmlFor="totp">Código 2FA</Label>
            <Input
              id="totp"
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              disabled={isSubmitting}
              aria-invalid={!!errors.totp}
              aria-describedby={errors.totp ? "totp-error" : undefined}
              {...register("totp")}
            />
            {errors.totp && (
              <p
                id="totp-error"
                className="mt-1 text-xs"
                style={{ color: "rgb(239 68 68)" }}
              >
                {errors.totp.message}
              </p>
            )}
          </div>
        )}

        <Button
          type="submit"
          full
          disabled={isSubmitting}
          className="shadow-sm"
        >
          {isSubmitting ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <div className="mt-5 flex items-center justify-between text-sm">
        <Link to="/register" className="underline opacity-90 hover:opacity-100">
          Crear cuenta
        </Link>
        <Link
          to="/forgot-password"
          className="underline opacity-70 hover:opacity-100"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
    </>
  );

  return <AuthShell mode="login" brand={brand} form={form} />;
}
