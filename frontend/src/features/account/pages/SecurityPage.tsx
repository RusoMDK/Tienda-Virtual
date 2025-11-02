import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  get2FAStatus,
  start2FASetup,
  verify2FASetup,
  disable2FA,
  regenerateRecoveryCodes,
  changePassword,
} from "@/features/account/api/security";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Button,
  Input,
  Label,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/ui";
import { useToast } from "@/ui";
import { useEffect, useRef, useState } from "react";

/* ----------------- helpers ----------------- */
function downloadTxt(filename: string, lines: string[]) {
  const blob = new Blob([lines.join("\n")], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function copyToClipboard(text: string) {
  try {
    navigator.clipboard.writeText(text);
  } catch {}
}

/* ----------------- tiny ui bits ----------------- */
function CopyIcon({ className = "w-4 h-4" }: { className?: string }) {
  // icono minimal de "copiar"
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M9 9.75a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 .75.75v8.5a.75.75 0 0 1-.75.75h-8.5a.75.75 0 0 1-.75-.75v-8.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M6 6.75A.75.75 0 0 1 6.75 6h8.5a.75.75 0 0 1 .75.75V8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
function CheckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M20 6 9 17l-5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconCopyButton({
  value,
  label = "Copiar",
  onCopied,
  className = "",
}: {
  value?: string;
  label?: string;
  onCopied?: () => void;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => {
        if (!value) return;
        copyToClipboard(value);
        setCopied(true);
        onCopied?.();
        setTimeout(() => setCopied(false), 1200);
      }}
      className={
        // sin borde, sin textura: solo opacidad
        "p-1.5 rounded-md bg-transparent border-0 outline-none " +
        "opacity-60 hover:opacity-100 active:opacity-100 transition " +
        className
      }
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

/* ----------------- schemas ----------------- */
const PwSchema = z
  .object({
    currentPassword: z.string().min(1, "Requerida"),
    newPassword: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Z]/, "Incluye mayúscula")
      .regex(/[a-z]/, "Incluye minúscula")
      .regex(/\d/, "Incluye número")
      .regex(/[^A-Za-z0-9]/, "Incluye símbolo"),
    confirm: z.string().min(1, "Confirma la contraseña"),
  })
  .refine((v) => v.newPassword === v.confirm, {
    path: ["confirm"],
    message: "Las contraseñas no coinciden",
  });
type PwValues = z.infer<typeof PwSchema>;

export default function SecurityPage() {
  const toast = useToast();
  const qc = useQueryClient();

  /* ======== Cambio de contraseña ======== */
  const form = useForm<PwValues>({ resolver: zodResolver(PwSchema) });
  const pwMut = useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      toast({ title: "Contraseña actualizada", variant: "success" });
      form.reset({ currentPassword: "", newPassword: "", confirm: "" });
    },
    onError: (e: any) => {
      const msg =
        e?.response?.data?.message || "No se pudo cambiar la contraseña";
      toast({ title: msg, variant: "error" });
    },
  });

  /* ======== Estado 2FA ======== */
  const twofa = useQuery({ queryKey: ["2faStatus"], queryFn: get2FAStatus });

  /* ======== Flujo de alta 2FA (modal) ======== */
  const [setupData, setSetupData] = useState<{
    otpauthUrl: string;
    secret: string;
    qr?: string;
  } | null>(null);
  const [open, setOpen] = useState(false);

  const startMut = useMutation({
    mutationFn: start2FASetup,
    onSuccess: (data) => {
      setSetupData(data);
      setOpen(true);
      toast({
        title: "Escanea el código con tu app de autenticación",
        variant: "info",
      });
    },
    onError: () =>
      toast({ title: "No se pudo iniciar el 2FA", variant: "error" }),
  });

  // input del código en el modal (con validación efímera)
  const [code, setCode] = useState("");
  const [flashErr, setFlashErr] = useState(false);
  const flashTO = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flashError() {
    if (flashTO.current) clearTimeout(flashTO.current);
    setFlashErr(true);
    flashTO.current = setTimeout(() => setFlashErr(false), 2000);
  }

  const verifyMut = useMutation({
    mutationFn: ({ code }: { code: string }) => verify2FASetup(code),
    onSuccess: (res) => {
      setOpen(false);
      setSetupData(null);
      setCode("");
      qc.invalidateQueries({ queryKey: ["2faStatus"] });
      toast({ title: "2FA habilitado ✅", variant: "success" });
      if (res?.recoveryCodes?.length) {
        downloadTxt("recovery-codes.txt", res.recoveryCodes);
        toast({
          title: "Guarda tus códigos de respaldo",
          description: "Se descargaron como recovery-codes.txt",
          variant: "info",
        });
      }
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message || "Código inválido";
      toast({ title: msg, variant: "error" });
    },
  });

  useEffect(() => {
    return () => {
      if (flashTO.current) clearTimeout(flashTO.current);
    };
  }, []);

  // Si por cualquier razón el estado pasa a enabled, cierra/limpia
  useEffect(() => {
    if (twofa.data?.enabled) {
      setOpen(false);
      setSetupData(null);
      setCode("");
    }
  }, [twofa.data?.enabled]);

  /* ======== Acciones activado ======== */
  const disableMut = useMutation({
    mutationFn: (payload?: { code?: string; password?: string }) =>
      disable2FA(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["2faStatus"] });
      toast({ title: "2FA desactivado", variant: "success" });
    },
    onError: () =>
      toast({ title: "No se pudo desactivar 2FA", variant: "error" }),
  });

  const regenMut = useMutation({
    mutationFn: regenerateRecoveryCodes,
    onSuccess: (res) => {
      const lines = res.recoveryCodes ?? [];
      if (lines.length) {
        downloadTxt("recovery-codes.txt", lines);
        toast({
          title: "Códigos regenerados",
          description: "Se descargaron nuevamente.",
          variant: "success",
        });
      } else {
        toast({ title: "Códigos regenerados", variant: "success" });
      }
    },
    onError: () =>
      toast({ title: "No se pudieron regenerar", variant: "error" }),
  });

  // Botón que reusa setupData si ya existe, o llama a /start si no
  function handleActivateClick() {
    if (setupData) {
      setOpen(true); // reabrir modal con el mismo QR/secret
    } else {
      startMut.mutate();
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* ======= Cambio de contraseña ======= */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Cambio de contraseña</h2>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-1">
            <Label>Contraseña actual</Label>
            <Input
              type="password"
              placeholder="••••••••"
              {...form.register("currentPassword")}
            />
            {form.formState.errors.currentPassword && (
              <p className="text-xs text-red-400">
                {form.formState.errors.currentPassword.message}
              </p>
            )}
          </div>
          <div className="grid gap-1">
            <Label>Nueva contraseña</Label>
            <Input
              type="password"
              placeholder="Mín. 8, mayús, minús, número, símbolo"
              {...form.register("newPassword")}
            />
            {form.formState.errors.newPassword && (
              <p className="text-xs text-red-400">
                {form.formState.errors.newPassword.message}
              </p>
            )}
          </div>
          <div className="grid gap-1">
            <Label>Confirmar nueva contraseña</Label>
            <Input
              type="password"
              placeholder="Repite la nueva"
              {...form.register("confirm")}
            />
            {form.formState.errors.confirm && (
              <p className="text-xs text-red-400">
                {form.formState.errors.confirm.message}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={form.handleSubmit((v) =>
              pwMut.mutate({
                currentPassword: v.currentPassword,
                newPassword: v.newPassword,
              })
            )}
            disabled={pwMut.isPending}
          >
            {pwMut.isPending ? "Guardando…" : "Actualizar contraseña"}
          </Button>
        </CardFooter>
      </Card>

      {/* ======= 2FA ======= */}
      <Card>
        <CardHeader className="flex flex-col gap-1">
          <h2 className="font-semibold">Autenticación en dos pasos (2FA)</h2>
          {twofa.data?.enabled ? (
            <Badge>Activo</Badge>
          ) : (
            <Badge>Inactivo</Badge>
          )}
        </CardHeader>

        <CardContent className="grid gap-4">
          {/* Estado actual */}
          {twofa.isLoading && (
            <div className="text-sm opacity-70">Cargando estado…</div>
          )}
          {twofa.data && (
            <div className="text-sm opacity-80">
              Método: <b>{twofa.data.method || "—"}</b> · Códigos de respaldo
              restantes:{" "}
              <b>
                {Number.isFinite(twofa.data.recoveryCodesRemaining || 0)
                  ? twofa.data.recoveryCodesRemaining
                  : "—"}
              </b>
            </div>
          )}

          {/* Acciones cuando 2FA está inactivo (siempre mostrando botón) */}
          {!twofa.data?.enabled && (
            <div className="rounded-xl border border-[var(--border)] p-3 bg-[var(--card)]">
              <div className="text-sm opacity-80 mb-2">
                Protege tu cuenta con códigos temporales generados por una app
                (Google Authenticator, 1Password, Authy…).
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleActivateClick}
                  disabled={startMut.isPending}
                >
                  {startMut.isPending
                    ? "Preparando…"
                    : setupData
                    ? "Reabrir activación"
                    : "Activar 2FA"}
                </Button>
                {setupData && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSetupData(null);
                      setCode("");
                      startMut.reset();
                      toast({
                        title: "Configuración reiniciada",
                        variant: "info",
                      });
                    }}
                  >
                    Reiniciar
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Acciones cuando ya está activo */}
          {twofa.data?.enabled && (
            <div className="grid gap-2">
              <div className="text-sm opacity-80">
                Si pierdes acceso a tu app, podrás entrar con un código de
                respaldo (úsalos una sola vez y guárdalos en un lugar seguro).
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => regenMut.mutate()}
                  disabled={regenMut.isPending}
                >
                  {regenMut.isPending
                    ? "Generando…"
                    : "Regenerar códigos de respaldo"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const ok = confirm(
                      "¿Deseas desactivar el 2FA? (No recomendado)"
                    );
                    if (ok) disableMut.mutate();
                  }}
                  disabled={disableMut.isPending}
                >
                  {disableMut.isPending ? "Desactivando…" : "Desactivar 2FA"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ======= Modal de activación 2FA (minimal) ======= */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            // cierre del modal → solo limpiamos el input; mantenemos setupData para reabrir
            setCode("");
          }
        }}
      >
        {/* modal más ancho */}
        <DialogContent className="max-w-[900px]">
          <DialogHeader className="mb-1">
            <DialogTitle className="text-lg">Activa tu 2FA</DialogTitle>
            <DialogDescription>
              Escanea el código QR con tu app o usa la clave manual. Luego
              introduce el código de 6 dígitos.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 md:grid-cols-2">
            {/* QR más grande */}
            <div className="flex flex-col items-center justify-center gap-3">
              {setupData?.qr ? (
                setupData.qr.startsWith("<svg") ? (
                  <div
                    className="w-56 h-56 p-3 rounded-lg border border-[var(--border)] bg-[var(--card)]"
                    dangerouslySetInnerHTML={{ __html: setupData.qr }}
                  />
                ) : (
                  <img
                    src={setupData.qr}
                    alt="QR 2FA"
                    className="w-56 h-56 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3"
                  />
                )
              ) : (
                <div className="text-sm opacity-70">Generando QR…</div>
              )}
              <div className="text-xs opacity-70 text-center">
                Escanéalo con Google Authenticator, 1Password o Authy.
              </div>
            </div>

            {/* Secret + otpauth + input */}
            <div className="space-y-4">
              <div>
                <Label className="text-[13px] font-medium">
                  Clave (Base32)
                </Label>
                <div className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-3 text-[12px] break-all flex items-center justify-between gap-2">
                  <span className="opacity-90 font-mono">
                    {setupData?.secret ?? "…"}
                  </span>
                  <IconCopyButton
                    value={setupData?.secret}
                    onCopied={() =>
                      toast({ title: "Clave copiada", variant: "success" })
                    }
                  />
                </div>
              </div>

              <div>
                <Label className="text-[13px] font-medium">otpauth URL</Label>
                <div className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-3 text-[12px] break-all flex items-center justify-between gap-2">
                  <span className="opacity-90 font-mono">
                    {setupData?.otpauthUrl ?? "…"}
                  </span>
                  <IconCopyButton
                    value={setupData?.otpauthUrl}
                    onCopied={() =>
                      toast({ title: "otpauth copiado", variant: "success" })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-[13px] font-medium">Código 2FA</Label>
                <Input
                  placeholder="123456"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={6}
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/[^\d]/g, ""))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && /^\d{6}$/.test(code)) {
                      verifyMut.mutate({ code });
                    }
                  }}
                  className={
                    "text-center tracking-[0.3em] font-medium " +
                    (flashErr ? "ring-1 ring-red-400" : "")
                  }
                />
                {flashErr && (
                  <p className="text-xs text-red-500">
                    Ingresa el código de 6 dígitos
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between gap-2 mt-2">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={verifyMut.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!/^\d{6}$/.test(code)) {
                  flashError();
                  return;
                }
                verifyMut.mutate({ code });
              }}
              disabled={verifyMut.isPending}
            >
              {verifyMut.isPending ? "Verificando…" : "Verificar y activar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
