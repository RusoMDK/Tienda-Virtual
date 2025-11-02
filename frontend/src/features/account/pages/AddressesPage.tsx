import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listAddresses,
  createAddress,
  setDefaultAddress,
  deleteAddress,
  updateAddress,
  type Address,
} from "@/features/account/api/addresses";
import AddressForm, { type AddressFormValues } from "../components/AddressForm";
import { Card, CardHeader, CardContent, Button, Badge } from "@/ui";
import { useToast } from "@/ui";
import { useState } from "react";

function moneyAddr(a: Address) {
  return `${a.addressLine1}${a.addressLine2 ? `, ${a.addressLine2}` : ""}, ${
    a.city
  }${a.state ? `, ${a.state}` : ""} ${a.postalCode}, ${a.country}`;
}

export default function AddressesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["addresses"],
    queryFn: listAddresses,
  });

  const [editing, setEditing] = useState<Address | null>(null);

  const createMut = useMutation({
    mutationFn: (v: AddressFormValues) => createAddress(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["addresses"] });
      toast({ title: "Dirección guardada", variant: "success" });
    },
    onError: () => toast({ title: "No se pudo guardar", variant: "error" }),
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<AddressFormValues>;
    }) => updateAddress(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["addresses"] });
      setEditing(null);
      toast({ title: "Dirección actualizada", variant: "success" });
    },
    onError: () => toast({ title: "No se pudo actualizar", variant: "error" }),
  });

  // 🔧 Update optimista para por-defecto (corrige el “toca dos veces”)
  const setDefault = useMutation({
    mutationFn: ({ id, type }: { id: string; type: "shipping" | "billing" }) =>
      setDefaultAddress(id, type),
    onMutate: async ({ id, type }) => {
      await qc.cancelQueries({ queryKey: ["addresses"] });
      const prev = qc.getQueryData<Address[]>(["addresses"]);
      if (prev) {
        const next = prev.map((a) => {
          if (type === "shipping") {
            return { ...a, isDefaultShipping: a.id === id };
          }
          return { ...a, isDefaultBilling: a.id === id };
        });
        qc.setQueryData(["addresses"], next);
      }
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["addresses"], ctx.prev);
      toast({ title: "No se pudo actualizar por defecto", variant: "error" });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["addresses"] });
    },
    onSuccess: () => {
      toast({ title: "Dirección por defecto actualizada", variant: "success" });
    },
  });

  const delMut = useMutation({
    mutationFn: deleteAddress,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["addresses"] });
      toast({ title: "Dirección eliminada", variant: "success" });
    },
    onError: () => toast({ title: "No se pudo eliminar", variant: "error" }),
  });

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <h2 className="font-semibold">Mis direcciones</h2>
        </CardHeader>
        <CardContent>
          {isLoading && <div className="opacity-70 text-sm">Cargando…</div>}
          <div className="space-y-3">
            {data?.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-[var(--border)] p-3 bg-[var(--card)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {a.recipientName}
                      {a.isDefaultShipping && <Badge>Envío</Badge>}
                      {a.isDefaultBilling && <Badge>Facturación</Badge>}
                    </div>
                    <div className="text-sm opacity-80">{moneyAddr(a)}</div>
                    {a.phone && (
                      <div className="text-xs opacity-70 mt-0.5">
                        Tel: {a.phone}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(a)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => delMut.mutate(a.id)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button
                    size="sm"
                    variant={a.isDefaultShipping ? "success" : "secondary"}
                    disabled={a.isDefaultShipping}
                    onClick={() =>
                      setDefault.mutate({ id: a.id, type: "shipping" })
                    }
                  >
                    {a.isDefaultShipping
                      ? "✓ Envío por defecto"
                      : "Envío por defecto"}
                  </Button>
                  <Button
                    size="sm"
                    variant={a.isDefaultBilling ? "success" : "secondary"}
                    disabled={a.isDefaultBilling}
                    onClick={() =>
                      setDefault.mutate({ id: a.id, type: "billing" })
                    }
                  >
                    {a.isDefaultBilling
                      ? "✓ Facturación por defecto"
                      : "Facturación por defecto"}
                  </Button>
                </div>
              </div>
            ))}
            {data?.length === 0 && (
              <div className="opacity-70 text-sm">
                No tienes direcciones guardadas.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex items-start justify-between">
          <h2 className="font-semibold">
            {editing ? "Editar dirección" : "Nueva dirección"}
          </h2>
          <p className="text-xs opacity-70 hidden sm:block">
            Los campos marcados con <span className="text-red-400">*</span> son
            obligatorios.
          </p>
        </CardHeader>
        <CardContent>
          <AddressForm
            initialValues={editing || { country: "CU" }} // Cuba por defecto
            submitting={createMut.isPending || updateMut.isPending}
            submitLabel={editing ? "Actualizar dirección" : "Guardar dirección"}
            onCancel={editing ? () => setEditing(null) : undefined}
            onSubmit={(v) => {
              if (editing) return updateMut.mutate({ id: editing.id, data: v });
              return createMut.mutate(v);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
