// src/features/account/pages/ProfilePage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { getMe, updateMe, type Me } from "@/features/account/api/profile";
import { uploadAvatar } from "@/lib/cloudinary";
import AvatarCropperDialog from "@/features/account/components/AvatarCropperDialog";
import PhoneInput from "@/components/PhoneInput";

import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Button,
  Input,
  Label,
  Badge,
} from "@/ui";
import { useToast } from "@/ui";

/* ───────────────── Validation ───────────────── */
const Schema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "Requerido")
    .max(60, "Máx. 60 caracteres"),
  middleName: z.string().trim().max(60, "Máx. 60 caracteres").optional(),
  lastName: z
    .string()
    .trim()
    .min(1, "Requerido")
    .max(120, "Máx. 120 caracteres"),
  ci: z.string().trim().min(3, "Requerido").max(64, "Máx. 64 caracteres"),
  // opcional, "" => null; valida E.164 solo al enviar
  phone: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z
      .union([
        z
          .string()
          .regex(
            /^\+\d{6,15}$/,
            "Teléfono inválido (usa formato internacional)"
          ),
        z.null(),
      ])
      .optional()
  ),
});
type FormValues = z.infer<typeof Schema>;

/* ───────────────── Utils ───────────────── */
function initialsFrom(name?: string | null, email?: string) {
  const base = (name && name.trim()) || email || "";
  if (!base) return "U";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}
function splitFullName(full?: string | null) {
  const s = (full || "").trim().replace(/\s+/g, " ");
  if (!s) return { firstName: "", middleName: "", lastName: "" };
  const p = s.split(" ");
  if (p.length === 1) return { firstName: p[0], middleName: "", lastName: "" };
  if (p.length === 2)
    return { firstName: p[0], middleName: "", lastName: p[1] };
  return { firstName: p[0], middleName: p[1], lastName: p.slice(2).join(" ") };
}
function joinFullName(first?: string, middle?: string, last?: string) {
  return [first, middle, last]
    .map((x) => (x || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}
function Req({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children} <span className="text-red-400">*</span>
    </span>
  );
}

/* ───────────────── Page ───────────────── */
export default function ProfilePage() {
  const toast = useToast();
  const qc = useQueryClient();

  // Perfil
  const me = useQuery({ queryKey: ["me"], queryFn: getMe });

  // Form (validación solo al enviar)
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    clearErrors,
    formState: { isDirty, isSubmitting, errors, isSubmitted },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      ci: "",
      phone: null,
    },
    mode: "onSubmit",
  });

  useEffect(() => {
    if (me.data) {
      const { firstName, middleName, lastName } = splitFullName(me.data.name);
      reset({
        firstName,
        middleName,
        lastName,
        ci: (me.data as any).ci ?? "",
        phone: (me.data.phone as any) ?? null,
      });
    }
  }, [me.data, reset]);

  // Oculta errores 2s después de mostrarlos
  useEffect(() => {
    if (isSubmitted && Object.keys(errors).length) {
      const t = setTimeout(() => clearErrors(), 2000);
      return () => clearTimeout(t);
    }
  }, [errors, isSubmitted, clearErrors]);

  const phoneVal = watch("phone"); // E.164 | null

  const saveMut = useMutation({
    mutationFn: (patch: Partial<Me>) => updateMe(patch),
    onSuccess: (updated: Me) => {
      qc.setQueryData(["me"], (prev: Me | undefined) => ({
        ...(prev ?? {}),
        ...(updated ?? {}),
      }));
      toast({ title: "Perfil actualizado", variant: "success" });
      const { firstName, middleName, lastName } = splitFullName(updated.name);
      reset(
        {
          firstName,
          middleName,
          lastName,
          ci: (updated as any).ci ?? "",
          phone: (updated.phone as any) ?? null,
        },
        { keepValues: true, keepDirty: false }
      );
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message || "No se pudo actualizar";
      toast({ title: msg, variant: "error" });
    },
  });

  const onSubmit = (v: FormValues) => {
    const full = joinFullName(v.firstName, v.middleName, v.lastName);
    const payload: Partial<Me> = {
      name: full || null,
      ci: v.ci,
      phone: (v.phone as any) ?? null,
    };
    saveMut.mutate(payload);
  };

  // Avatar (crop + subida firmada)
  const [cropperOpen, setCropperOpen] = useState(false);
  const avatarUrl = useMemo(
    () => me.data?.avatarUrl || null,
    [me.data?.avatarUrl]
  );

  const avatarMut = useMutation({
    mutationFn: async (file: File) => {
      // ➜ usa alias "avatars" y nombre fijo avatar_<userId>; overwrite + invalidate ON
      const { url, publicId: pid } = await uploadAvatar(file, me.data?.id);
      const updated = await updateMe({
        avatarUrl: url,
        avatarPublicId: pid,
      } as any);
      return updated;
    },
    onSuccess: (updated: Me) => {
      qc.setQueryData(["me"], (prev: Me | undefined) => ({
        ...(prev ?? {}),
        ...(updated ?? {}),
      }));
      toast({ title: "Avatar actualizado", variant: "success" });
    },
    onError: (e: any) => {
      const msg =
        e?.message ||
        e?.response?.data?.message ||
        "No se pudo subir el avatar";
      toast({ title: msg, variant: "error" });
    },
  });

  const removeAvatarMut = useMutation({
    mutationFn: async () =>
      updateMe({ avatarUrl: null, avatarPublicId: null } as any),
    onSuccess: (updated: Me) => {
      qc.setQueryData(["me"], (prev: Me | undefined) => ({
        ...(prev ?? {}),
        ...(updated ?? {}),
      }));
      toast({ title: "Avatar eliminado", variant: "success" });
    },
    onError: () =>
      toast({ title: "No se pudo eliminar el avatar", variant: "error" }),
  });

  const twoFA = me.data?.twoFactorEnabled;

  // Hint temporal para Email readOnly
  const [showEmailHint, setShowEmailHint] = useState(false);
  const emailHintTO = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flashEmailHint() {
    if (emailHintTO.current) clearTimeout(emailHintTO.current);
    setShowEmailHint(true);
    emailHintTO.current = setTimeout(() => setShowEmailHint(false), 1800);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Lateral: 4/12, centrado */}
      <Card className="lg:col-span-4 h-full">
        <CardContent className="h-full p-6 flex items-center">
          {me.isLoading ? (
            <div className="opacity-70 text-sm">Cargando…</div>
          ) : me.data ? (
            <div className="w-full flex flex-col items-center text-center gap-4">
              <div className="w-28 h-28 rounded-2xl bg-[var(--surface-1)] border border-[var(--border)] overflow-hidden flex items-center justify-center text-xl font-semibold">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span>{initialsFrom(me.data.name, me.data.email)}</span>
                )}
              </div>

              <div className="space-y-0.5">
                <div className="text-base font-semibold">
                  {me.data.name || "Sin nombre"}
                </div>
                <div className="text-xs opacity-80 break-all">
                  {me.data.email}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge>{me.data.role}</Badge>
                <Badge variant={twoFA ? "success" : "secondary"}>
                  {twoFA ? "2FA activo" : "2FA inactivo"}
                </Badge>
              </div>

              <div className="w-full grid gap-2 mt-1">
                <Button
                  onClick={() => setCropperOpen(true)}
                  disabled={avatarMut.isPending}
                >
                  {avatarMut.isPending ? "Subiendo…" : "Cambiar avatar"}
                </Button>
                {me.data.avatarUrl && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const ok = confirm("¿Eliminar avatar?");
                      if (ok) removeAvatarMut.mutate();
                    }}
                    disabled={removeAvatarMut.isPending || avatarMut.isPending}
                  >
                    {removeAvatarMut.isPending
                      ? "Eliminando…"
                      : "Quitar avatar"}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm opacity-70">
              No pudimos cargar tu perfil. Intenta recargar.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form principal: 8/12 */}
      <Card className="lg:col-span-8 h-full">
        <CardHeader className="pb-2">
          <h2 className="text-base font-semibold">Información personal</h2>
          <p className="text-xs opacity-70">
            Los campos marcados con <span className="text-red-400">*</span> son
            obligatorios.
          </p>
        </CardHeader>

        <CardContent className="grid gap-4">
          {me.isLoading && <div className="text-sm opacity-70">Cargando…</div>}
          {me.data && (
            <>
              {/* Fila 1: Primer nombre + Segundo nombre */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-[13px] font-medium">
                    <Req>Primer Nombre</Req>
                  </Label>
                  <Input placeholder="Ej. Juan" {...register("firstName")} />
                  {errors.firstName && (
                    <p className="text-xs text-red-400">
                      {errors.firstName.message}
                    </p>
                  )}
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-[13px] font-medium">
                    Segundo Nombre (Opcional)
                  </Label>
                  <Input placeholder="Ej. Pablo" {...register("middleName")} />
                  {errors.middleName && (
                    <p className="text-xs text-red-400">
                      {errors.middleName.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Fila 2: Apellidos */}
              <div className="grid gap-1.5">
                <Label className="text-[13px] font-medium">
                  <Req>Apellidos</Req>
                </Label>
                <Input
                  placeholder="Ej. Pérez Gómez"
                  {...register("lastName")}
                />
                {errors.lastName && (
                  <p className="text-xs text-red-400">
                    {errors.lastName.message}
                  </p>
                )}
              </div>

              {/* Fila 3: CI / Pasaporte + Email (lado a lado) */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-[13px] font-medium">
                    <Req>CI / Pasaporte</Req>
                  </Label>
                  <Input placeholder="Ej. 91010112345" {...register("ci")} />
                  {errors.ci && (
                    <p className="text-xs text-red-400">{errors.ci.message}</p>
                  )}
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-[13px] font-medium">
                    <Req>Email</Req>
                  </Label>
                  <Input
                    value={me.data.email}
                    readOnly
                    onFocus={flashEmailHint}
                    onKeyDown={flashEmailHint}
                    onPointerDown={flashEmailHint}
                    className={
                      showEmailHint ? "ring-1 ring-red-400 transition-all" : ""
                    }
                  />
                  {showEmailHint && (
                    <p
                      className="text-[11px] text-red-500 animate-pulse"
                      aria-live="polite"
                    >
                      No editable desde aquí
                    </p>
                  )}
                </div>
              </div>

              {/* Fila 4: Prefijo + Teléfono (opcional), debajo */}
              <div className="grid gap-1.5">
                <Label className="text-[13px] font-medium">
                  Prefijo + Teléfono (Opcional)
                </Label>
                <PhoneInput
                  id="profile-phone"
                  label=""
                  compact
                  className="w-full [&_select]:w-[88px] [&_input]:flex-1 [&_.text-xs.opacity-70]:hidden"
                  value={phoneVal ?? null}
                  onChange={(next) =>
                    setValue("phone", next ?? null, {
                      shouldDirty: true,
                    })
                  }
                  preferredISOs={[
                    "ES",
                    "MX",
                    "CO",
                    "AR",
                    "CL",
                    "PE",
                    "US",
                    "CU",
                  ]}
                  defaultIso="ES"
                />
                {errors.phone && (
                  <p className="text-xs text-red-400">
                    {errors.phone.message as string}
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between gap-2 pt-2">
          <div className="text-xs opacity-70">
            {isDirty ? "Tienes cambios sin guardar" : "Sin cambios pendientes"}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                if (me.data) {
                  const { firstName, middleName, lastName } = splitFullName(
                    me.data.name
                  );
                  reset({
                    firstName,
                    middleName,
                    lastName,
                    ci: (me.data as any).ci ?? "",
                    phone: (me.data.phone as any) ?? null,
                  });
                }
              }}
              disabled={!isDirty || isSubmitting || saveMut.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit(onSubmit)}
              disabled={!isDirty || isSubmitting || saveMut.isPending}
            >
              {saveMut.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Cropper (cuadrado/circular) */}
      <AvatarCropperDialog
        open={cropperOpen}
        onClose={() => setCropperOpen(false)}
        onConfirm={(file) => {
          setCropperOpen(false);
          avatarMut.mutate(file);
        }}
      />
    </div>
  );
}
