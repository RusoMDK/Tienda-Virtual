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
import { useState, useEffect } from "react";
import AddressMapPicker from "@/features/account/components/AddressMapPicker";

function moneyAddr(a: Address) {
  return `${a.addressLine1}${a.addressLine2 ? `, ${a.addressLine2}` : ""}, ${
    a.city
  }${a.state ? `, ${a.state}` : ""} ${a.postalCode}, ${a.country}`;
}

type DraftLocation = {
  lat: number;
  lng: number;
  label?: string;
};

export default function AddressesPage() {
  const qc = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["addresses"],
    queryFn: listAddresses,
  });

  const [editing, setEditing] = useState<Address | null>(null);
  const [draftLocation, setDraftLocation] = useState<DraftLocation | null>(
    null
  );
  const [showModal, setShowModal] = useState(false);

  // Si estás editando una dirección que ya tiene lat/lng, precarga el mapa
  useEffect(() => {
    if (editing && (editing as any).lat && (editing as any).lng) {
      setDraftLocation({
        lat: (editing as any).lat,
        lng: (editing as any).lng,
        label: (editing as any).mapLabel,
      });
    } else if (!editing) {
      setDraftLocation(null);
    }
  }, [editing]);

  function openCreateModal() {
    setEditing(null);
    setDraftLocation(null);
    setShowModal(true);
  }

  function openEditModal(a: Address) {
    setEditing(a);
    setShowModal(true);
  }

  function closeModal() {
    if (createMut.isPending || updateMut.isPending) return;
    setShowModal(false);
    setEditing(null);
    setDraftLocation(null);
  }

  const createMut = useMutation({
    mutationFn: (v: AddressFormValues) => {
      const payload: any = { ...v };
      if (draftLocation) {
        payload.lat = draftLocation.lat;
        payload.lng = draftLocation.lng;
        payload.mapLabel = draftLocation.label;
      }
      return createAddress(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["addresses"] });
      toast({ title: "Dirección guardada", variant: "success" });
      setDraftLocation(null);
      setShowModal(false);
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
    }) => {
      const payload: any = { ...data };
      if (draftLocation) {
        payload.lat = draftLocation.lat;
        payload.lng = draftLocation.lng;
        payload.mapLabel = draftLocation.label;
      }
      return updateAddress(id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["addresses"] });
      setEditing(null);
      setDraftLocation(null);
      setShowModal(false);
      toast({ title: "Dirección actualizada", variant: "success" });
    },
    onError: () => toast({ title: "No se pudo actualizar", variant: "error" }),
  });

  // Update optimista para por-defecto
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

  const modalTitle = editing ? "Editar dirección" : "Nueva dirección";

  return (
    <div className="space-y-6">
      {/* Bloque principal: listado + CTA crear */}
      <Card>
        <CardHeader className="pb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-base md:text-lg">
              Mis direcciones
            </h2>
            <p className="text-xs md:text-sm opacity-70 mt-1">
              Administra tus direcciones de envío y facturación. Puedes marcar
              una como predeterminada para el checkout.
            </p>
          </div>
          <Button size="sm" onClick={openCreateModal} className="mt-2 sm:mt-0">
            Añadir dirección
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="opacity-70 text-sm py-2">Cargando…</div>
          )}
          <div className="space-y-3">
            {data?.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-[var(--border)] p-3 bg-[var(--card)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium flex items-center gap-2">
                      <span className="truncate">{a.recipientName}</span>
                      {a.isDefaultShipping && (
                        <Badge variant="success">Envío</Badge>
                      )}
                      {a.isDefaultBilling && (
                        <Badge variant="outline">Facturación</Badge>
                      )}
                    </div>
                    <div className="text-sm opacity-80 mt-0.5">
                      {moneyAddr(a)}
                    </div>
                    {a.phone && (
                      <div className="text-xs opacity-70 mt-0.5">
                        Tel: {a.phone}
                      </div>
                    )}
                    {(a as any).mapLabel && (
                      <div className="text-[11px] opacity-60 mt-0.5 truncate">
                        Punto en mapa: {String((a as any).mapLabel)}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => openEditModal(a)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="xs"
                      variant="destructive"
                      onClick={() => delMut.mutate(a.id)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  <Button
                    size="xs"
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
                    size="xs"
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
            {data?.length === 0 && !isLoading && (
              <div className="opacity-70 text-sm py-2">
                No tienes direcciones guardadas. Usa el botón{" "}
                <span className="font-medium">“Añadir dirección”</span> para
                crear la primera.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* MODAL: Crear / editar dirección + mapa */}
      {showModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 px-3">
          <div className="relative w-full max-w-5xl rounded-2xl bg-[rgb(var(--card-rgb))] border border-[rgb(var(--border-rgb))] shadow-2xl p-4 md:p-6">
            {/* Cerrar */}
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/85"
            >
              ✕
            </button>

            <div className="mb-4 pr-8">
              <h2 className="font-semibold text-base md:text-lg">
                {modalTitle}
              </h2>
              <p className="text-xs md:text-sm opacity-70 mt-1">
                Completa los datos de la dirección y, si quieres, marca también
                el punto exacto en el mapa para facilitar los envíos.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)]">
              {/* Formulario */}
              <div className="space-y-3">
                <AddressForm
                  initialValues={editing || { country: "CU" }} // Cuba por defecto
                  submitting={createMut.isPending || updateMut.isPending}
                  submitLabel={
                    editing ? "Actualizar dirección" : "Guardar dirección"
                  }
                  onCancel={closeModal}
                  onSubmit={(v) => {
                    if (editing)
                      return updateMut.mutate({ id: editing.id, data: v });
                    return createMut.mutate(v);
                  }}
                />
                <p className="text-[11px] opacity-70">
                  Los campos marcados con{" "}
                  <span className="text-red-400">*</span> son obligatorios.
                </p>
              </div>

              {/* Mapa */}
              <div className="pt-2 border-t md:border-t-0 md:border-l border-[rgb(var(--border-rgb))] md:pl-5 space-y-2">
                <div>
                  <h3 className="text-sm font-semibold">
                    Ubicación en el mapa (opcional)
                  </h3>
                  <p className="text-xs opacity-70">
                    Usa el buscador, el botón de ubicación o haz clic en el mapa
                    para seleccionar tu casa o punto de recogida. El punto se
                    guarda junto con esta dirección.
                  </p>
                </div>
                <AddressMapPicker
                  value={draftLocation ?? undefined}
                  onChange={(pos) => setDraftLocation(pos)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
