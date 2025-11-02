import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Input, Label, Button } from "@/ui";
import PhoneInput from "@/components/PhoneInput";
import type { Address } from "@/features/account/api/addresses";

/* ───────── Cuba: Provincias y Municipios ───────── */
type ProvinceCU = { name: string; municipalities: string[] };
const CU_PROVINCES: ProvinceCU[] = [
  {
    name: "Pinar del Río",
    municipalities: [
      "Pinar del Río",
      "Viñales",
      "La Palma",
      "Los Palacios",
      "Consolación del Sur",
      "Sandino",
      "Mantua",
      "Minas de Matahambre",
      "San Juan y Martínez",
      "San Luis",
      "Guane",
    ],
  },
  {
    name: "Artemisa",
    municipalities: [
      "Artemisa",
      "Alquízar",
      "Bahía Honda",
      "Bauta",
      "Caimito",
      "Candelaria",
      "Guanajay",
      "Güira de Melena",
      "Mariel",
      "San Antonio de los Baños",
      "San Cristóbal",
    ],
  },
  {
    name: "La Habana",
    municipalities: [
      "Arroyo Naranjo",
      "Boyeros",
      "Centro Habana",
      "Cerro",
      "Cotorro",
      "Diez de Octubre",
      "Guanabacoa",
      "La Habana del Este",
      "La Habana Vieja",
      "La Lisa",
      "Marianao",
      "Playa",
      "Plaza de la Revolución",
      "Regla",
      "San Miguel del Padrón",
    ],
  },
  {
    name: "Mayabeque",
    municipalities: [
      "Batabanó",
      "Bejucal",
      "Güines",
      "Jaruco",
      "Madruga",
      "Melena del Sur",
      "Nueva Paz",
      "Quivicán",
      "San José de las Lajas",
      "San Nicolás de Bari",
      "Santa Cruz del Norte",
    ],
  },
  {
    name: "Matanzas",
    municipalities: [
      "Matanzas",
      "Cárdenas",
      "Martí",
      "Colón",
      "Perico",
      "Jagüey Grande",
      "Calimete",
      "Ciénaga de Zapata",
      "Jovellanos",
      "Limonar",
      "Pedro Betancourt",
      "Unión de Reyes",
      "Los Arabos",
    ],
  },
  {
    name: "Cienfuegos",
    municipalities: [
      "Cienfuegos",
      "Abreus",
      "Aguada de Pasajeros",
      "Cumanayagua",
      "Cruces",
      "Palmira",
      "Rodas",
      "Lajas",
    ],
  },
  {
    name: "Villa Clara",
    municipalities: [
      "Santa Clara",
      "Camajuaní",
      "Cifuentes",
      "Corralillo",
      "Encrucijada",
      "Manicaragua",
      "Placetas",
      "Quemado de Güines",
      "Ranchuelo",
      "Remedios",
      "Sagua la Grande",
      "Santo Domingo",
      "Caibarién",
    ],
  },
  {
    name: "Sancti Spíritus",
    municipalities: [
      "Sancti Spíritus",
      "Trinidad",
      "Cabaiguán",
      "Fomento",
      "Jatibonico",
      "La Sierpe",
      "Taguasco",
      "Yaguajay",
    ],
  },
  {
    name: "Ciego de Ávila",
    municipalities: [
      "Ciego de Ávila",
      "Morón",
      "Bolivia",
      "Chambas",
      "Ciro Redondo",
      "Florencia",
      "Majagua",
      "Primero de Enero",
      "Venezuela",
      "Baraguá",
    ],
  },
  {
    name: "Camagüey",
    municipalities: [
      "Camagüey",
      "Carlos Manuel de Céspedes",
      "Esmeralda",
      "Florida",
      "Guáimaro",
      "Jimaguayú",
      "Minas",
      "Najasa",
      "Nuevitas",
      "Santa Cruz del Sur",
      "Sibanicú",
      "Sierra de Cubitas",
      "Vertientes",
    ],
  },
  {
    name: "Las Tunas",
    municipalities: [
      "Las Tunas",
      "Amancio",
      "Colombia",
      "Jesús Menéndez",
      "Jobabo",
      "Majibacoa",
      "Manatí",
      "Puerto Padre",
    ],
  },
  {
    name: "Holguín",
    municipalities: [
      "Holguín",
      "Antilla",
      "Báguanos",
      "Banes",
      "Calixto García",
      "Cacocum",
      "Cueto",
      "Frank País",
      "Gibara",
      "Mayarí",
      "Moa",
      "Rafael Freyre",
      "Sagua de Tánamo",
      "Urbano Noris",
    ],
  },
  {
    name: "Granma",
    municipalities: [
      "Bayamo",
      "Bartolomé Masó",
      "Buey Arriba",
      "Campechuela",
      "Cauto Cristo",
      "Guisa",
      "Jiguaní",
      "Manzanillo",
      "Media Luna",
      "Niquero",
      "Pilón",
      "Río Cauto",
      "Yara",
    ],
  },
  {
    name: "Santiago de Cuba",
    municipalities: [
      "Santiago de Cuba",
      "Contramaestre",
      "Guamá",
      "Mella",
      "Palma Soriano",
      "San Luis",
      "Segundo Frente",
      "Songo-La Maya",
      "Tercer Frente",
    ],
  },
  {
    name: "Guantánamo",
    municipalities: [
      "Guantánamo",
      "Baracoa",
      "Caimanera",
      "El Salvador",
      "Imías",
      "Maisí",
      "Manuel Tames",
      "Niceto Pérez",
      "San Antonio del Sur",
      "Yateras",
    ],
  },
  { name: "Isla de la Juventud", municipalities: ["Isla de la Juventud"] },
];

/* ───────── Helpers ───────── */
function splitName(full?: string | null) {
  const s = (full || "").trim().replace(/\s+/g, " ");
  if (!s) return { firstName: "", middleName: "", lastName: "" };
  const p = s.split(" ");
  if (p.length === 1) return { firstName: p[0], middleName: "", lastName: "" };
  if (p.length === 2)
    return { firstName: p[0], middleName: "", lastName: p[1] };
  return { firstName: p[0], middleName: p[1], lastName: p.slice(2).join(" ") };
}
function joinName(first?: string, middle?: string, last?: string) {
  return [first, middle, last]
    .map((x) => (x || "").trim())
    .filter(Boolean)
    .join(" ");
}
function Req({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children} <span className="text-red-400">*</span>
    </span>
  );
}

/* ───────── Persist schema ───────── */
export const AddressSchema = z.object({
  recipientName: z.string().trim().min(1),
  phone: z
    .string()
    .trim()
    .regex(/^\+\d{6,15}$/, "Usa formato internacional"),
  addressLine1: z.string().trim().min(3),
  addressLine2: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  postalCode: z.string().trim().min(3).max(12),
  country: z.literal("CU"),
});
export type AddressFormValues = z.infer<typeof AddressSchema>;

/* ───────── UI schema (campos de la vista) ───────── */
const UISchema = z.object({
  firstName: z.string().trim().min(1, "Requerido"),
  middleName: z.string().trim().optional(),
  lastName: z.string().trim().min(1, "Requerido"),
  ciPassport: z.string().trim().min(3, "Requerido"),
  email: z.string().trim().email("Email inválido"),
  addressLine1: z.string().trim().min(3, "Requerido"),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().min(1, "Requerido"),
  state: z.string().trim().min(1, "Requerido"),
  postalCode: z.string().trim().min(3, "Requerido").max(12, "Máx. 12"),
  phone: z
    .string()
    .trim()
    .regex(/^\+\d{6,15}$/, "Teléfono inválido (E.164)"),
  country: z.literal("CU"),
});
type UIValues = z.infer<typeof UISchema>;

type Props = {
  initialValues?: Partial<Address> | Partial<AddressFormValues>;
  submitting?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
  onSubmit: (values: AddressFormValues) => void;
};

export default function AddressForm({
  initialValues,
  submitting,
  submitLabel = "Guardar dirección",
  onCancel,
  onSubmit,
}: Props) {
  // Normaliza initialValues → UIValues
  const defaults = useMemo<UIValues>(() => {
    const baseCountry = "CU";
    const i = (initialValues || {}) as any;
    const names = splitName(i.recipientName);

    const defaultProvince = i.state || "La Habana";
    const prov =
      CU_PROVINCES.find((p) => p.name === defaultProvince) || CU_PROVINCES[2];
    const defaultCity =
      i.city && prov.municipalities.includes(i.city)
        ? i.city
        : prov.municipalities[0];

    return {
      firstName: i.firstName || names.firstName || "",
      middleName: i.middleName || names.middleName || "",
      lastName: i.lastName || names.lastName || "",
      ciPassport: i.ciPassport || "",
      email: i.email || "",
      addressLine1: i.addressLine1 || "",
      addressLine2: i.addressLine2 || "",
      city: defaultCity,
      state: prov.name,
      postalCode: i.postalCode || "",
      phone: i.phone || "",
      country: baseCountry,
    };
  }, [initialValues]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    clearErrors, // ← para ocultar errores a los 2s
    formState: { errors, isSubmitted },
  } = useForm<UIValues>({
    resolver: zodResolver(UISchema),
    defaultValues: defaults,
    mode: "onSubmit", // ← valida solo al enviar
  });

  const stateVal = watch("state");
  const cityVal = watch("city");

  // Mantiene municipio coherente al cambiar provincia
  useEffect(() => {
    const prov =
      CU_PROVINCES.find((p) => p.name === stateVal) || CU_PROVINCES[2];
    if (!prov.municipalities.includes(cityVal)) {
      setValue("city", prov.municipalities[0], { shouldDirty: true });
    }
  }, [stateVal]); // eslint-disable-line

  // Oculta errores 2s después de mostrarlos
  useEffect(() => {
    if (isSubmitted && Object.keys(errors).length) {
      const t = setTimeout(() => clearErrors(), 2000);
      return () => clearTimeout(t);
    }
  }, [errors, isSubmitted, clearErrors]);

  const provinces = CU_PROVINCES.map((p) => p.name);
  const municipalities =
    CU_PROVINCES.find((p) => p.name === stateVal)?.municipalities ||
    CU_PROVINCES[2].municipalities;

  const submit = (v: UIValues) => {
    const payload: AddressFormValues = {
      recipientName: joinName(v.firstName, v.middleName, v.lastName),
      phone: v.phone,
      addressLine1: v.addressLine1,
      addressLine2: v.addressLine2 || "",
      city: v.city,
      state: v.state,
      postalCode: v.postalCode,
      country: "CU",
    };
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="grid gap-4">
      {/* Fila 1: Primer nombre + Segundo nombre */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-[13px] font-medium">
            <Req>Primer Nombre</Req>
          </Label>
          <Input placeholder="Ej. Juan" {...register("firstName")} />
          {errors.firstName && (
            <p className="text-xs text-red-400">{errors.firstName.message}</p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label className="text-[13px] font-medium">
            Segundo Nombre (opcional)
          </Label>
          <Input placeholder="Ej. Pablo" {...register("middleName")} />
          {errors.middleName && (
            <p className="text-xs text-red-400">{errors.middleName.message}</p>
          )}
        </div>
      </div>

      {/* Fila 2: Apellidos */}
      <div className="grid gap-1.5">
        <Label className="text-[13px] font-medium">
          <Req>Apellidos</Req>
        </Label>
        <Input placeholder="Ej. Pérez Gómez" {...register("lastName")} />
        {errors.lastName && (
          <p className="text-xs text-red-400">{errors.lastName.message}</p>
        )}
      </div>

      {/* Fila 3: CI/Pasaporte + Email */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-[13px] font-medium">
            <Req>CI/Pasaporte</Req>
          </Label>
          <Input placeholder="Ej. 91010112345" {...register("ciPassport")} />
          {errors.ciPassport && (
            <p className="text-xs text-red-400">{errors.ciPassport.message}</p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label className="text-[13px] font-medium">
            <Req>Email</Req>
          </Label>
          <Input placeholder="tu@email.com" {...register("email")} />
          {errors.email && (
            <p className="text-xs text-red-400">{errors.email.message}</p>
          )}
        </div>
      </div>

      {/* Fila 4: Dirección */}
      <div className="grid gap-1.5">
        <Label className="text-[13px] font-medium">
          <Req>Dirección</Req>
        </Label>
        <Input placeholder="Calle y número" {...register("addressLine1")} />
        {errors.addressLine1 && (
          <p className="text-xs text-red-400">{errors.addressLine1.message}</p>
        )}
      </div>

      {/* Fila 5: Apto/Piso (opcional) */}
      <div className="grid gap-1.5">
        <Label className="text-[13px] font-medium">
          Apto / Piso (opcional)
        </Label>
        <Input placeholder="Apto 3B, Piso 2" {...register("addressLine2")} />
      </div>

      {/* Fila 6: Provincia (izq) + Ciudad (der) */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-[13px] font-medium">
            <Req>Provincia / Estado</Req>
          </Label>
          <select
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm"
            {...register("state")}
            value={stateVal}
            onChange={(e) =>
              setValue("state", e.target.value, { shouldDirty: true })
            }
          >
            {provinces.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {errors.state && (
            <p className="text-xs text-red-400">{errors.state.message}</p>
          )}
        </div>

        <div className="grid gap-1.5">
          <Label className="text-[13px] font-medium">
            <Req>Ciudad (Municipio)</Req>
          </Label>
          <select
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm"
            {...register("city")}
            value={cityVal}
            onChange={(e) =>
              setValue("city", e.target.value, { shouldDirty: true })
            }
          >
            {municipalities.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {errors.city && (
            <p className="text-xs text-red-400">{errors.city.message}</p>
          )}
        </div>
      </div>

      {/* Fila 7: País (fijo Cuba) + Código Postal */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-[13px] font-medium">
            <Req>País</Req>
          </Label>
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm select-none">
            <span className="text-base">🇨🇺</span>
            <span className="font-medium">Cuba</span>
            <span className="opacity-60">(CU)</span>
          </div>
          <input type="hidden" {...register("country")} value="CU" />
        </div>

        <div className="grid gap-1.5">
          <Label className="text-[13px] font-medium">
            <Req>Código Postal</Req>
          </Label>
          <Input placeholder="Ej. 10400" {...register("postalCode")} />
          {errors.postalCode && (
            <p className="text-xs text-red-400">{errors.postalCode.message}</p>
          )}
        </div>
      </div>

      {/* Fila 8: Prefijo + teléfono (requerido) */}
      <div className="grid gap-1.5">
        <Label className="text-[13px] font-medium">
          <Req>Prefijo + Teléfono de contacto</Req>
        </Label>
        <PhoneInput
          id="addr-phone"
          label=""
          compact
          className="w-full [&_select]:w-[88px] [&_input]:flex-1 [&_.text-xs.opacity-70]:hidden"
          value={watch("phone")}
          onChange={(next) =>
            setValue("phone", next ?? "", { shouldDirty: true })
          }
          preferredISOs={["CU"]}
          defaultIso="CU"
          required
        />
        {errors.phone && (
          <p className="text-xs text-red-400">{errors.phone.message}</p>
        )}
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
