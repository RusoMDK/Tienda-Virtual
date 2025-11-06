import { useMemo, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import Papa from "papaparse";
import {
  adminListProducts,
  adminUpdateProduct,
  adminAdjustStock,
  adminDeleteProduct,
  adminCreateProduct,
  adminGetStockLedger,
} from "../api";
import {
  Button,
  Input,
  Skeleton,
  Badge,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Label,
} from "@/ui";
import { useToast } from "@/ui";
import { api } from "@/lib/api";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Upload,
  Download,
  Trash2,
  Pencil,
  X,
  Check,
  PackageMinus,
  Search,
  Copy,
} from "lucide-react";
import ImageUploader, { type UImage } from "../components/ImageUploader";
import { uploadProductImage } from "@/features/uploads/cloudinary";
import Dropdown from "@/ui/dropdown";
import Modal from "@/ui/modal";

/* ─────────────────────────────────────────────────────────────
   Tipos y helpers
   ───────────────────────────────────────────────────────────── */
type AdminProduct = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  price: number; // cents
  currency: string;
  stock: number;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
  category?: { name: string; slug: string } | null;
  categorySlug?: string | null;

  // Campos enriquecidos
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  condition?: "NEW" | "USED" | "REFURBISHED" | null;
  warrantyMonths?: number | null;
  homeDelivery?: boolean | null;
  tags?: string[] | null;
  sku?: string | null;
  barcode?: string | null;

  // En algunas APIs podrían venir las imágenes
  images?: { url: string; publicId?: string; position?: number }[];
};

type ListResp = {
  items: AdminProduct[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type Cat = {
  slug: string;
  name: string;
  sub?: { slug: string; name: string }[];
};

// Dinámico por moneda del producto
const fmtMoney = (cents: number, currency: string) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: (currency || "USD").toUpperCase(),
  }).format(Math.max(0, cents) / 100);

const strToCents = (s: string) => {
  const n = Number(
    String(s)
      .replace(/[^\d.,-]/g, "")
      .replace(",", ".")
  );
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
};

function parseBool(v: any): boolean | undefined {
  if (v == null) return undefined;
  const s = String(v).trim().toLowerCase();
  if (["true", "1", "yes", "y", "si", "sí"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  return undefined;
}

function parseImages(v: any): UImage[] | undefined {
  if (!v) return undefined;
  const txt = String(v);
  const parts =
    txt.indexOf("|") >= 0
      ? txt.split("|")
      : txt.indexOf(",") >= 0
      ? txt.split(",")
      : [txt];
  const urls = parts.map((p) => p.trim()).filter(Boolean);
  if (!urls.length) return undefined;
  return urls.map((url, i) => ({ url, position: i }));
}

function parsePriceFromRow(row: Record<string, any>): number | null {
  if (row.price_cents != null && String(row.price_cents).trim() !== "") {
    const n = Number(String(row.price_cents).replace(/[^\d-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  if (row.price != null && String(row.price).trim() !== "") {
    const cents = strToCents(String(row.price));
    return cents ?? null;
  }
  return null;
}

const imagesToUrls = (arr: UImage[] | undefined) =>
  (arr ?? []).map((im) => im.url);

/** Helper simple para carpeta por nombre cuando aún no hay slug */
const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/* ─────────────────────────────────────────────────────────────
   Etiquetas humanas para motivos de stock
   ───────────────────────────────────────────────────────────── */
const STOCK_REASONS = [
  { code: "MANUAL_ADJUSTMENT", label: "Ajuste manual" },
  { code: "ORDER_PLACED", label: "Pedido creado" },
  { code: "ORDER_CANCELLED_RESTORE", label: "Restituir (cancelación)" },
  { code: "REFUND_RETURN", label: "Devolución" },
] as const;
type StockReasonCode = (typeof STOCK_REASONS)[number]["code"];
const labelFromReason = (code: string) =>
  STOCK_REASONS.find((r) => r.code === code)?.label ?? "—";

/* ─────────────────────────────────────────────────────────────
   Componente principal
   ───────────────────────────────────────────────────────────── */
export default function AdminProductsPage() {
  const [sp, setSp] = useSearchParams();
  const qc = useQueryClient();
  const toast = useToast();

  // Query params
  const page = Number(sp.get("page") || 1);
  const pageSize = Number(sp.get("pageSize") || 20); // default 20, opciones 10/20/50
  const qParam = sp.get("q") || "";
  const sort = (sp.get("sort") as string) || "createdAt:desc";
  const status = sp.get("status") || "active"; // active|inactive|all
  const cat = sp.get("cat") || "all";

  // Búsqueda con debounce
  const [qLocal, setQLocal] = useState(qParam);
  useEffect(() => setQLocal(qParam), [qParam]);
  const debounceRef = useRef<number | null>(null);
  function applySearchDebounced(next: string) {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const nxt = new URLSearchParams(sp);
      next ? nxt.set("q", next) : nxt.delete("q");
      nxt.set("page", "1");
      setSp(nxt, { replace: true });
    }, 350);
  }

  // Categorías (públicas para combos)
  const { data: categories = [] } = useQuery<Cat[]>({
    queryKey: ["admin:categories-public"],
    queryFn: async () => {
      const { data } = await api.get("/categories");
      return data as Cat[];
    },
    staleTime: 5 * 60_000,
  });

  const catOptions = useMemo(() => {
    const parents = (categories || []).filter((c) => c.slug !== "all");
    const flat: { value: string; label: string }[] = [
      { value: "all", label: "Todas" },
    ];
    parents.forEach((p) => {
      (p.sub || []).forEach((s) => {
        flat.push({ value: s.slug, label: `${p.name} › ${s.name}` });
      });
      flat.push({ value: p.slug, label: `${p.name} (todo)` });
    });
    return flat;
  }, [categories]);

  // Lista de productos
  const { data, isLoading, isError } = useQuery<ListResp>({
    queryKey: [
      "admin:products",
      { page, pageSize, q: qParam, sort, status, cat },
    ],
    queryFn: () =>
      adminListProducts({
        page,
        pageSize,
        q: qParam,
        sort,
        status,
        cat: cat !== "all" ? cat : undefined,
      } as any),
    keepPreviousData: true,
    staleTime: 30_000,
  });

  // Selección
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(
    () => setSelected(new Set()),
    [page, pageSize, qParam, sort, status, cat]
  );
  const allChecked = useMemo(
    () => !!data?.items?.length && data.items.every((p) => selected.has(p.id)),
    [data, selected]
  );
  function toggleAll() {
    if (!data?.items) return;
    setSelected(allChecked ? new Set() : new Set(data.items.map((p) => p.id)));
  }
  function toggleOne(id: string) {
    setSelected((curr) => {
      const n = new Set(curr);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  /* ───────────── mutations ───────────── */
  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<AdminProduct> }) =>
      adminUpdateProduct(id, patch),
    onSuccess: () => {
      toast({ title: "Producto actualizado", variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin:products"] });
    },
    onError: () => toast({ title: "No se pudo actualizar", variant: "error" }),
  });

  const adjustMut = useMutation({
    mutationFn: ({
      id,
      delta,
      reason,
      note,
    }: {
      id: string;
      delta: number;
      reason?: StockReasonCode | string;
      note?: string;
    }) => adminAdjustStock(id, delta, reason, note),
    onSuccess: () => {
      toast({ title: "Stock ajustado", variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin:products"] });
      if (adjOpen && adjProduct?.id) {
        qc.invalidateQueries({
          queryKey: ["admin:stock-ledger", adjProduct.id],
        });
      }
    },
    onError: () => toast({ title: "No se pudo ajustar", variant: "error" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminDeleteProduct(id),
    onSuccess: () => {
      toast({ title: "Producto eliminado", variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin:products"] });
    },
    onError: () => toast({ title: "No se pudo eliminar", variant: "error" }),
  });

  const createMut = useMutation({
    mutationFn: (payload: {
      name: string;
      description: string;
      price: number;
      currency: string;
      active: boolean;
      categorySlug?: string;
      images?: string[]; // URLs

      brand?: string;
      model?: string;
      color?: string;
      condition?: "NEW" | "USED" | "REFURBISHED";
      warrantyMonths?: number;
      homeDelivery?: boolean;
      tags?: string[];
      sku?: string;
      barcode?: string;
    }) => adminCreateProduct(payload as any),
    onSuccess: () => {
      toast({ title: "Producto creado", variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin:products"] });
      closeModal();
    },
    onError: (e: any) => {
      toast({
        title: e?.response?.data?.error || "No se pudo crear",
        variant: "error",
      });
    },
  });

  const patchMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      adminUpdateProduct(id, payload),
    onSuccess: () => {
      toast({ title: "Cambios guardados", variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin:products"] });
      closeModal();
    },
    onError: (e: any) => {
      toast({
        title: e?.response?.data?.error || "No se pudo guardar",
        variant: "error",
      });
    },
  });

  /* ───────────── edición inline precio ───────────── */
  const [editPriceId, setEditPriceId] = useState<string | null>(null);
  const [editPriceStr, setEditPriceStr] = useState<string>("");

  function startEditPrice(p: AdminProduct) {
    setEditPriceId(p.id);
    setEditPriceStr((p.price / 100).toString());
  }
  async function saveEditPrice(p: AdminProduct) {
    const cents = strToCents(editPriceStr);
    if (cents === null || cents < 0) {
      toast({ title: "Precio inválido", variant: "error" });
      return;
    }
    await updateMut.mutateAsync({ id: p.id, patch: { price: cents } as any });
    setEditPriceId(null);
    toast({ title: `Nuevo precio: ${fmtMoney(cents, p.currency)}` });
  }

  /* ───────────── Ajuste de stock (Dialog) ───────────── */
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjProduct, setAdjProduct] = useState<AdminProduct | null>(null);
  const [delta, setDelta] = useState<number>(0);
  const [reason, setReason] = useState<StockReasonCode>("MANUAL_ADJUSTMENT");
  const [note, setNote] = useState<string>("");

  function openAdjust(p: AdminProduct) {
    setAdjProduct(p);
    setDelta(0);
    setReason("MANUAL_ADJUSTMENT");
    setNote("");
    setAdjOpen(true);
  }
  async function applyAdjust() {
    if (!adjProduct || !delta) return;
    await adjustMut.mutateAsync({ id: adjProduct.id, delta, reason, note });
    setAdjOpen(false);
  }

  const { data: ledgerResp, isLoading: ledgerLoading } = useQuery({
    enabled: adjOpen && !!adjProduct?.id,
    queryKey: ["admin:stock-ledger", adjProduct?.id],
    queryFn: () => adminGetStockLedger(adjProduct!.id, 30),
    staleTime: 15_000,
  });

  /* ───────────── ordenamiento ───────────── */
  function currentSortField() {
    const [field] = sort.split(":");
    return field;
  }
  function currentSortDir() {
    return (sort.split(":")[1] as "asc" | "desc") || "desc";
  }
  function toggleSort(field: "name" | "price" | "stock" | "createdAt") {
    const dir =
      currentSortField() === field && currentSortDir() === "asc"
        ? "desc"
        : "asc";
    const nxt = new URLSearchParams(sp);
    nxt.set("sort", `${field}:${dir}`);
    nxt.set("page", "1");
    setSp(nxt, { replace: true });
  }

  /* ───────────── Export / Import CSV ───────────── */
  function exportCSV() {
    if (!data?.items?.length) return;
    const headers = [
      "id",
      "slug",
      "name",
      "price_cents",
      "currency",
      "stock",
      "active",
      "categorySlug",
      "createdAt",
    ];
    const rows = data.items.map((p) => [
      p.id,
      p.slug,
      p.name.replace(/"/g, '""'),
      String(p.price),
      (p.currency || "usd").toLowerCase(),
      String(p.stock),
      String(p.active),
      p.category?.slug || p.categorySlug || "",
      p.createdAt,
    ]);
    const csv =
      headers.join(",") +
      "\n" +
      rows
        .map((r) => r.map((c) => (/,|\n|"/.test(c) ? `"${c}"` : c)).join(","))
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products_page${data.page}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadTemplateCSV() {
    const headers = [
      "name",
      "description",
      "price",
      "currency",
      "active",
      "categorySlug",
      "images",
      "stock",
    ].join(",");
    const exampleRow = [
      "Camiseta negra premium",
      "Algodón 100%, corte unisex",
      "19.99",
      "usd",
      "true",
      "ropa-camisetas",
      "https://img1.jpg|https://img2.jpg",
      "10",
    ]
      .map((c) =>
        /,|\n|"/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c
      )
      .join(",");
    const blob = new Blob([headers + "\n" + exampleRow], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products_template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const importRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  function triggerImport() {
    importRef.current?.click();
  }
  async function handleParsedRows(rows: Record<string, any>[]) {
    if (!rows.length) {
      toast({ title: "El CSV no tiene filas", variant: "warning" });
      return;
    }
    let ok = 0,
      fail = 0;
    setImporting(true);
    try {
      for (const row of rows) {
        const name = String(row.name ?? "").trim();
        if (!name) {
          fail++;
          continue;
        }
        const priceCents = parsePriceFromRow(row);
        if (priceCents == null || priceCents < 0) {
          fail++;
          continue;
        }

        const imgs = parseImages(row.images) ?? [];
        const payload = {
          name,
          description: String(row.description ?? "").trim(),
          price: priceCents,
          currency: String(row.currency || "usd").toLowerCase(),
          active: parseBool(row.active) ?? true,
          categorySlug: row.categorySlug
            ? String(row.categorySlug).trim()
            : undefined,
          images: imagesToUrls(imgs), // URLs
        };

        try {
          const created = await adminCreateProduct(payload as any);
          ok++;

          const stockRaw = row.stock;
          const stockNum = Number(String(stockRaw).replace(/[^\d-]/g, ""));
          if (Number.isFinite(stockNum) && stockNum !== 0) {
            try {
              await adminAdjustStock(
                created.id,
                stockNum,
                "MANUAL_ADJUSTMENT",
                "import csv"
              );
            } catch {}
          }
        } catch {
          fail++;
        }
      }
      qc.invalidateQueries({ queryKey: ["admin:products"] });
      toast({
        title: `Importación completada`,
        description: `Creados: ${ok} • Fallidos: ${fail}`,
        variant: fail ? "warning" : "success",
      });
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = "";
    }
  }
  function onImportFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => handleParsedRows((res.data as any[]).filter(Boolean)),
      error: () => toast({ title: "No se pudo leer el CSV", variant: "error" }),
    });
  }

  /* ───────────── Modal Crear/Editar ───────────── */
  type FormState = {
    id?: string;
    slug?: string; // para carpeta products/<slug> en edición

    name: string;
    description: string;
    priceStr: string;
    currency: string;
    active: boolean;
    categorySlug?: string;
    images: UImage[];

    // Campos de calidad
    brand: string;
    model: string;
    color: string;
    condition: "" | "NEW" | "USED" | "REFURBISHED";
    warrantyMonths: string; // input texto
    homeDelivery: boolean;
    tagsStr: string; // "gaming, laptop, 16gb"
    sku: string;
    barcode: string;
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<FormState>({
    name: "",
    description: "",
    priceStr: "",
    currency: "usd",
    active: true,
    categorySlug: undefined,
    images: [],

    brand: "",
    model: "",
    color: "",
    condition: "",
    warrantyMonths: "",
    homeDelivery: true,
    tagsStr: "",
    sku: "",
    barcode: "",
  });
  const [loadingDetail, setLoadingDetail] = useState(false); // ahora no lo usamos para fetch, solo para overlay si quieres en un futuro

  function openCreate() {
    setMode("create");
    setForm({
      name: "",
      description: "",
      priceStr: "",
      currency: "usd",
      active: true,
      categorySlug: undefined,
      images: [],

      brand: "",
      model: "",
      color: "",
      condition: "",
      warrantyMonths: "",
      homeDelivery: true,
      tagsStr: "",
      sku: "",
      barcode: "",
    });
    setModalOpen(true);
  }

  // 👉 Ahora no llamamos adminGetProduct: usamos directamente el producto de la tabla
  function openEdit(p: AdminProduct) {
    setMode("edit");
    setModalOpen(true);
    setForm({
      id: p.id,
      slug: p.slug,
      name: p.name ?? "",
      description: p.description ?? "",
      priceStr: (p.price / 100).toString(),
      currency: p.currency || "usd",
      active: !!p.active,
      categorySlug: p.categorySlug || p.category?.slug,
      images:
        (p as any).images?.map((im: any) => ({
          url: im.url,
          publicId: im.publicId || "",
          position: im.position ?? 0,
        })) ?? [],

      brand: (p as any).brand ?? "",
      model: (p as any).model ?? "",
      color: (p as any).color ?? "",
      condition: ((p as any).condition as any) ?? "",
      warrantyMonths:
        (p as any).warrantyMonths != null
          ? String((p as any).warrantyMonths)
          : "",
      homeDelivery: !!(p as any).homeDelivery,
      tagsStr: Array.isArray((p as any).tags) ? (p as any).tags.join(", ") : "",
      sku: (p as any).sku ?? "",
      barcode: (p as any).barcode ?? "",
    });
  }

  function closeModal() {
    setModalOpen(false);
    setLoadingDetail(false);
  }

  function formValid(): string | null {
    if (!form.name.trim()) return "El nombre es obligatorio";
    const cents = strToCents(form.priceStr);
    if (cents === null || cents < 0) return "Precio inválido";

    if (form.warrantyMonths.trim()) {
      const n = Number(form.warrantyMonths.trim());
      if (!Number.isFinite(n) || n < 0) return "Garantía inválida";
    }

    return null;
  }

  async function submitForm() {
    const err = formValid();
    if (err) return toast({ title: err, variant: "error" });

    const price = strToCents(form.priceStr)!;

    const warrantyRaw = form.warrantyMonths.trim();
    const warrantyNum = warrantyRaw === "" ? undefined : Number(warrantyRaw);

    const tags =
      form.tagsStr
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean) || [];

    const basePayload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price,
      currency: form.currency,
      active: form.active,
      categorySlug: form.categorySlug || undefined,
      images: imagesToUrls(form.images),

      brand: form.brand.trim() || undefined,
      model: form.model.trim() || undefined,
      color: form.color.trim() || undefined,
      condition: form.condition || undefined,
      warrantyMonths:
        warrantyNum != null && Number.isFinite(warrantyNum)
          ? warrantyNum
          : undefined,
      homeDelivery: form.homeDelivery,
      tags: tags.length ? tags : undefined,
      sku: form.sku.trim() || undefined,
      barcode: form.barcode.trim() || undefined,
    };

    if (mode === "create") {
      await createMut.mutateAsync(basePayload);
    } else if (mode === "edit" && form.id) {
      await patchMut.mutateAsync({
        id: form.id,
        payload: basePayload,
      });
    }
  }

  /* ───────────── Acciones masivas ───────────── */
  async function bulkSetActive(next: boolean) {
    if (!selected.size) return;
    const ids = Array.from(selected);
    let ok = 0,
      fail = 0;
    for (const id of ids) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await updateMut.mutateAsync({ id, patch: { active: next } as any });
        ok++;
      } catch {
        fail++;
      }
    }
    setSelected(new Set());
    toast({
      title: "Actualización masiva",
      description: `Éxitos: ${ok} • Fallos: ${fail}`,
      variant: fail ? "warning" : "success",
    });
  }

  async function bulkDelete() {
    if (!selected.size) return;
    const ids = Array.from(selected);
    let ok = 0,
      fail = 0;
    for (const id of ids) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await deleteMut.mutateAsync(id);
        ok++;
      } catch {
        fail++;
      }
    }
    setSelected(new Set());
    toast({
      title: "Eliminación masiva",
      description: `Eliminados: ${ok} • Fallidos: ${fail}`,
      variant: fail ? "warning" : "success",
    });
  }

  /* ───────────── Atajos de teclado ───────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const typing = tag === "input" || tag === "textarea" || tag === "select";
      if (typing) return;
      if (e.key === "/") {
        e.preventDefault();
        const el = document.getElementById("adm-prod-search");
        (el as HTMLInputElement | null)?.focus();
      }
      if (e.key.toLowerCase() === "n") openCreate();
      if (e.key === "Delete" && selected.size) {
        if (window.confirm(`¿Eliminar ${selected.size} producto(s)?`)) {
          bulkDelete();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.size]);

  /* ───────────── UI ───────────── */
  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <Card>
        <CardContent className="p-4 md:p-5">
          <div className="grid gap-3 md:gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            {/* IZQUIERDA: búsqueda + filtros */}
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <div className="relative w-full sm:w-[360px] md:w-[420px]">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 opacity-70"
                />
                <Input
                  id="adm-prod-search"
                  className="pl-9 h-10 w-full"
                  placeholder="Buscar por nombre, descripción o slug"
                  value={qLocal}
                  onChange={(e) => {
                    setQLocal(e.target.value);
                    applySearchDebounced(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const nxt = new URLSearchParams(sp);
                      qLocal ? nxt.set("q", qLocal) : nxt.delete("q");
                      nxt.set("page", "1");
                      setSp(nxt, { replace: true });
                    }
                  }}
                />
              </div>

              {/* Estado: segmented pills */}
              <div className="inline-flex rounded-xl border border-[rgb(var(--border-rgb))] p-1 bg-[rgb(var(--card-2-rgb))]">
                {[
                  { v: "active", t: "Activos" },
                  { v: "inactive", t: "Inactivos" },
                  { v: "all", t: "Todos" },
                ].map((opt) => {
                  const on = status === opt.v;
                  return (
                    <button
                      key={opt.v}
                      aria-pressed={on}
                      onClick={() => {
                        const nxt = new URLSearchParams(sp);
                        nxt.set("status", opt.v);
                        nxt.set("page", "1");
                        setSp(nxt, { replace: true });
                      }}
                      className={[
                        "px-3 py-1.5 text-sm rounded-lg transition-colors",
                        on
                          ? "bg-[rgb(var(--accent-rgb))] text-black"
                          : "hover:bg-[rgb(var(--muted-rgb))]/60",
                      ].join(" ")}
                    >
                      {opt.t}
                    </button>
                  );
                })}
              </div>

              {/* Categoría */}
              <select
                className="h-10 rounded-xl bg-[rgb(var(--card-rgb))] border border-[rgb(var(--border-rgb))] px-3 text-sm outline-none"
                value={cat}
                onChange={(e) => {
                  const nxt = new URLSearchParams(sp);
                  nxt.set("cat", e.target.value);
                  nxt.set("page", "1");
                  setSp(nxt, { replace: true });
                }}
                title="Filtrar por categoría"
              >
                {catOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              {/* Tamaño de página (Dropdown con flecha que rota) */}
              <Dropdown
                align="left"
                trigger={({ open, toggle }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    title="Tamaño de página"
                    className="inline-flex items-center gap-1 h-10 rounded-xl bg-[rgb(var(--card-rgb))] border border-[rgb(var(--border-rgb))] px-3 text-sm outline-none"
                  >
                    <span>{pageSize} / página</span>
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${
                        open ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                )}
                items={[10, 20, 50].map((n) => ({
                  label: `${n} / página`,
                  onSelect: () => {
                    const nxt = new URLSearchParams(sp);
                    nxt.set("pageSize", String(n));
                    nxt.set("page", "1");
                    setSp(nxt, { replace: true });
                  },
                }))}
              />
            </div>

            {/* DERECHA: acciones */}
            <div className="flex justify-start lg:justify-end items-center gap-2">
              <input
                ref={importRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => onImportFile(e.target.files)}
              />

              <Button
                onClick={openCreate}
                className="inline-flex items-center gap-1 h-10"
                title="Crear producto (N)"
              >
                <Plus size={16} />
                Nuevo
              </Button>

              <Button
                variant="secondary"
                onClick={triggerImport}
                disabled={importing}
                title="Importar CSV"
                className="inline-flex items-center gap-1 h-10"
              >
                <Upload size={16} />
                {importing ? "Importando…" : "Importar"}
              </Button>

              <Button
                variant="secondary"
                onClick={downloadTemplateCSV}
                title="Descargar plantilla"
                className="inline-flex items-center gap-1 h-10"
              >
                <Download size={16} />
                Plantilla
              </Button>

              <Button
                variant="secondary"
                onClick={exportCSV}
                title="Exportar página"
                className="inline-flex items-center gap-1 h-10"
              >
                <Download size={16} />
                Exportar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Barra de acciones masivas flotante */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 shadow-lg rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] px-3 py-2">
          <div className="flex items-center gap-3">
            <div className="text-sm opacity-80">
              {selected.size} seleccionados
            </div>
            <div className="h-5 w-px bg-[rgb(var(--border-rgb))]" />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => bulkSetActive(true)}
            >
              Activar
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => bulkSetActive(false)}
            >
              Desactivar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => {
                if (!window.confirm(`¿Eliminar ${selected.size} producto(s)?`))
                  return;
                await bulkDelete();
              }}
              className="inline-flex items-center gap-1"
            >
              <Trash2 size={14} />
              Eliminar
            </Button>
          </div>
        </div>
      )}

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto rounded-2xl">
            <table className="min-w-full text-sm">
              <thead className="bg-[rgb(var(--card-2-rgb))] sticky top-0 z-10">
                <tr>
                  <th className="p-3 w-10">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      aria-label="Seleccionar página visible"
                    />
                  </th>
                  <th className="text-left p-3">
                    <button
                      className="inline-flex items-center gap-1 hover:opacity-100 opacity-90"
                      onClick={() => toggleSort("name")}
                      title="Ordenar por nombre"
                    >
                      Nombre{" "}
                      {currentSortField() === "name" ? (
                        currentSortDir() === "asc" ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )
                      ) : null}
                    </button>
                  </th>
                  <th className="text-left p-3">Categoría</th>
                  <th className="text-left p-3">
                    <button
                      className="inline-flex items-center gap-1 hover:opacity-100 opacity-90"
                      onClick={() => toggleSort("price")}
                      title="Ordenar por precio"
                    >
                      Precio{" "}
                      {currentSortField() === "price" ? (
                        currentSortDir() === "asc" ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )
                      ) : null}
                    </button>
                  </th>
                  <th className="text-left p-3">
                    <button
                      className="inline-flex items-center gap-1 hover:opacity-100 opacity-90"
                      onClick={() => toggleSort("stock")}
                      title="Ordenar por stock"
                    >
                      Stock{" "}
                      {currentSortField() === "stock" ? (
                        currentSortDir() === "asc" ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )
                      ) : null}
                    </button>
                  </th>
                  <th className="text-left p-3">Activo</th>
                  <th className="text-left p-3">
                    <button
                      className="inline-flex items-center gap-1 hover:opacity-100 opacity-90"
                      onClick={() => toggleSort("createdAt")}
                      title="Ordenar por fecha de creación"
                    >
                      Creado{" "}
                      {currentSortField() === "createdAt" ? (
                        currentSortDir() === "asc" ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )
                      ) : null}
                    </button>
                  </th>
                  <th className="text-right p-3 w-[250px]">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {isLoading &&
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr
                      key={i}
                      className="border-t border-[rgb(var(--border-rgb))]"
                    >
                      <td className="p-3">
                        <Skeleton className="h-4 w-4" />
                      </td>
                      <td className="p-3">
                        <Skeleton className="h-4 w-48" />
                      </td>
                      <td className="p-3">
                        <Skeleton className="h-4 w-32" />
                      </td>
                      <td className="p-3">
                        <Skeleton className="h-4 w-20" />
                      </td>
                      <td className="p-3">
                        <Skeleton className="h-4 w-16" />
                      </td>
                      <td className="p-3">
                        <Skeleton className="h-4 w-10" />
                      </td>
                      <td className="p-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="p-3 text-right">
                        <Skeleton className="h-8 w-40 ml-auto" />
                      </td>
                    </tr>
                  ))}

                {!isLoading && isError && (
                  <tr>
                    <td
                      colSpan={8}
                      className="p-6 text-center text=[rgb(var(--danger-rgb))]"
                    >
                      No se pudo cargar la lista. Intenta más tarde.
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  data?.items?.map((p) => {
                    const low = p.stock <= 3 && p.stock > 0;
                    const out = p.stock === 0;
                    return (
                      <tr
                        key={p.id}
                        className="border-t border-[rgb(var(--border-rgb))] hover:bg-[rgb(var(--muted-rgb))]/60 transition-colors"
                      >
                        <td className="p-3 align-top">
                          <input
                            aria-label="Seleccionar fila"
                            type="checkbox"
                            checked={selected.has(p.id)}
                            onChange={() => toggleOne(p.id)}
                          />
                        </td>

                        <td className="p-3 align-top">
                          <div className="font-medium leading-snug flex items-center gap-2">
                            {p.name}
                            <button
                              className="p-1 rounded hover:bg-[rgb(var(--card-2-rgb))]"
                              title="Copiar ID"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(p.id);
                                  toast({ title: "ID copiado" });
                                } catch {
                                  toast({
                                    title: "No se pudo copiar",
                                    variant: "error",
                                  });
                                }
                              }}
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                          <div className="opacity-60 text-xs">{p.slug}</div>
                        </td>

                        <td className="p-3 align-top">
                          <div className="opacity-80 text-xs">
                            {p.category?.name || (
                              <span className="opacity-50">—</span>
                            )}
                          </div>
                        </td>

                        {/* Precio (edición inline) */}
                        <td className="p-3 align-top">
                          {editPriceId === p.id ? (
                            <div className="flex items-center gap-1.5">
                              <Input
                                autoFocus
                                value={editPriceStr}
                                onChange={(e) =>
                                  setEditPriceStr(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEditPrice(p);
                                  if (e.key === "Escape") setEditPriceId(null);
                                }}
                                className="w-28 h-9"
                              />
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => saveEditPrice(p)}
                                disabled={updateMut.isPending}
                                aria-label="Guardar"
                                title="Guardar"
                              >
                                <Check size={14} />
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setEditPriceId(null)}
                                aria-label="Cancelar"
                                title="Cancelar"
                              >
                                <X size={14} />
                              </Button>
                            </div>
                          ) : (
                            <button
                              className="underline-offset-2 hover:underline"
                              onClick={() => startEditPrice(p)}
                              title="Editar precio"
                            >
                              {fmtMoney(p.price, p.currency)}
                            </button>
                          )}
                        </td>

                        {/* Stock */}
                        <td className="p-3 align-top">
                          <div className="inline-flex items-center gap-2">
                            <span
                              className={
                                out
                                  ? "text-[rgb(248_113_113)]"
                                  : low
                                  ? "text-[rgb(250_204_21)]"
                                  : ""
                              }
                            >
                              {p.stock}
                            </span>
                            {(low || out) && (
                              <Badge variant="secondary" className="text-xs">
                                {out ? "Sin stock" : "Bajo"}
                              </Badge>
                            )}
                          </div>
                        </td>

                        {/* Activo */}
                        <td className="p-3 align-top">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={p.active}
                              onChange={async (e) => {
                                await updateMut.mutateAsync({
                                  id: p.id,
                                  patch: { active: e.target.checked } as any,
                                });
                              }}
                              disabled={updateMut.isPending}
                            />
                            <span className="opacity-70 text-xs">
                              {p.active ? "Activo" : "Inactivo"}
                            </span>
                          </label>
                        </td>

                        <td className="p-3 align-top">
                          <div className="opacity-70 text-xs">
                            {new Date(p.createdAt).toLocaleString()}
                          </div>
                        </td>

                        {/* Acciones */}
                        <td className="p-3 align-top text-right">
                          <div className="inline-flex gap-1.5">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openAdjust(p)}
                              aria-label="Ajustar stock"
                              title="Ajustar stock"
                            >
                              <PackageMinus size={15} />
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openEdit(p)}
                              aria-label="Editar"
                              title="Editar"
                            >
                              <Pencil size={14} />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={async () => {
                                if (!window.confirm(`¿Eliminar "${p.name}"?`))
                                  return;
                                await deleteMut.mutateAsync(p.id);
                              }}
                              aria-label="Eliminar"
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {!isLoading && !!data && data.items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center opacity-70">
                      Sin resultados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Paginación */}
      {!!data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="secondary"
            disabled={data.page <= 1}
            onClick={() => {
              const nxt = new URLSearchParams(sp);
              nxt.set("page", String(data.page - 1));
              setSp(nxt, { replace: true });
            }}
          >
            Anterior
          </Button>
          <div className="self-center text-sm opacity-70">
            {data.page} / {data.totalPages}
          </div>
          <Button
            variant="secondary"
            disabled={data.page >= data.totalPages}
            onClick={() => {
              const nxt = new URLSearchParams(sp);
              nxt.set("page", String(data.page + 1));
              setSp(nxt, { replace: true });
            }}
          >
            Siguiente
          </Button>
        </div>
      )}

      {/* Dialog: Ajustar stock (más ancho) */}
      <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
        <DialogContent className="w-[min(900px,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle>Ajustar stock</DialogTitle>
            <DialogDescription>
              Modifica el stock y deja un registro claro del motivo.
            </DialogDescription>
          </DialogHeader>

          {adjProduct && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-[rgb(var(--border-rgb))] p-4 bg-[rgb(var(--card-rgb))]">
                  <div className="text-xs opacity-70">Producto</div>
                  <div className="font-medium">{adjProduct.name}</div>
                  <div className="text-xs opacity-60">{adjProduct.slug}</div>
                </div>
                <div className="rounded-xl border border-[rgb(var(--border-rgb))] p-4 bg-[rgb(var(--card-rgb))]">
                  <div className="text-xs opacity-70">Stock actual</div>
                  <div className="font-medium">{adjProduct.stock}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block space-y-1">
                  <Label className="text-xs">Delta</Label>
                  <Input
                    type="number"
                    value={Number.isFinite(delta) ? delta : 0}
                    onChange={(e) => setDelta(Number(e.target.value || 0))}
                    placeholder="Ej: 5 o -3"
                    className="w-32"
                  />
                  <div className="text-xs opacity-70">
                    Resultado:{" "}
                    <b>
                      {adjProduct.stock + (Number.isFinite(delta) ? delta : 0)}
                    </b>
                  </div>
                </label>

                <label className="block space-y-1">
                  <Label className="text-xs">Motivo</Label>
                  <select
                    value={reason}
                    onChange={(e) =>
                      setReason(e.target.value as StockReasonCode)
                    }
                    className="w-full h-10 rounded-xl bg-[rgb(var(--card-rgb))] border border-[rgb(var(--border-rgb))] px-3 text-sm outline-none"
                  >
                    {STOCK_REASONS.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block md:col-span-2 space-y-1">
                  <Label className="text-xs">Nota (opcional)</Label>
                  <Input
                    placeholder="Ej: inventario físico, error de carga, etc."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
              </div>

              <div className="rounded-xl border border-[rgb(var(--border-rgb))] overflow-hidden">
                <div className="bg-[rgb(var(--card-2-rgb))] px-3 py-2 text-xs opacity-80">
                  Últimos movimientos (máx. 30)
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {ledgerLoading ? (
                    <div className="p-3 space-y-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-8 w-full" />
                      ))}
                    </div>
                  ) : (ledgerResp?.items?.length ?? 0) > 0 ? (
                    <table className="min-w-full text-xs">
                      <thead className="sticky top-0 bg-[rgb(var(--card-2-rgb))]">
                        <tr>
                          <th className="text-left p-2">Fecha</th>
                          <th className="text-left p-2">Δ</th>
                          <th className="text-left p-2">Motivo</th>
                          <th className="text-left p-2">Nota</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerResp!.items.map((m: any) => (
                          <tr
                            key={m.id}
                            className="border-t border-[rgb(var(--border-rgb))]"
                          >
                            <td className="p-2">
                              {new Date(m.createdAt).toLocaleString()}
                            </td>
                            <td
                              className={`p-2 ${
                                m.delta > 0
                                  ? "text-[rgb(16_185_129)]"
                                  : m.delta < 0
                                  ? "text-[rgb(248_113_113)]"
                                  : ""
                              }`}
                            >
                              {m.delta > 0 ? `+${m.delta}` : m.delta}
                            </td>
                            <td className="p-2">{labelFromReason(m.reason)}</td>
                            <td className="p-2">{m.note || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-3 text-sm opacity-70">
                      Sin movimientos
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setAdjOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={applyAdjust}
                  disabled={!delta || adjustMut.isPending}
                >
                  Aplicar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Crear / Editar (usa tu Modal wide) */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        wide
        title={mode === "create" ? "Nuevo producto" : "Editar producto"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              onClick={submitForm}
              disabled={
                createMut.isPending || patchMut.isPending || loadingDetail
              }
              className="inline-flex items-center gap-1"
            >
              <Check size={16} />
              {mode === "create" ? "Crear" : "Guardar cambios"}
            </Button>
          </div>
        }
      >
        <div className="relative">
          <p className="text-xs opacity-70 mb-4">
            Mantén la información completa. La primera imagen será la principal.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Col formulario */}
            <div className="md:col-span-7 space-y-4">
              {/* Nombre + Marca / Modelo */}
              <div className="space-y-3">
                <label className="block space-y-1.5">
                  <Label className="text-xs">Nombre</Label>
                  <Input
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="Ej: Laptop gamer 15'' RTX 4060"
                  />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block space-y-1.5">
                    <Label className="text-xs">Marca</Label>
                    <Input
                      value={form.brand}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, brand: e.target.value }))
                      }
                      placeholder="Ej: ASUS, Lenovo, etc."
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <Label className="text-xs">Modelo</Label>
                    <Input
                      value={form.model}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, model: e.target.value }))
                      }
                      placeholder="Ej: ROG Strix G15"
                    />
                  </label>
                </div>
              </div>

              {/* Descripción */}
              <label className="block space-y-1.5">
                <Label className="text-xs">Descripción</Label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Detalles clave, especificaciones, materiales, etc."
                  rows={8}
                  className="w-full rounded-xl bg-[rgb(var(--card-rgb))] border border-[rgb(var(--border-rgb))] px-3 py-2 text-sm outline-none resize-y min-h-[160px]"
                />
              </label>

              {/* Precio / Moneda */}
              <div className="grid grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <Label className="text-xs">Precio</Label>
                  <Input
                    value={form.priceStr}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, priceStr: e.target.value }))
                    }
                    placeholder="Ej: 1499.99"
                  />
                </label>

                <label className="block space-y-1.5">
                  <Label className="text-xs">Moneda</Label>
                  <select
                    value={form.currency}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, currency: e.target.value }))
                    }
                    className="w-full h-10 rounded-xl bg-[rgb(var(--card-rgb))] border border-[rgb(var(--border-rgb))] px-3 text-sm outline-none"
                  >
                    <option value="usd">USD</option>
                    <option value="eur">EUR</option>
                    <option value="mxn">MXN</option>
                  </select>
                </label>
              </div>

              {/* Color / Condición */}
              <div className="grid grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <Label className="text-xs">Color principal</Label>
                  <Input
                    value={form.color}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, color: e.target.value }))
                    }
                    placeholder="Ej: negro, rojo, azul..."
                  />
                </label>

                <label className="block space-y-1.5">
                  <Label className="text-xs">Condición</Label>
                  <select
                    value={form.condition}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        condition: e.target.value as FormState["condition"],
                      }))
                    }
                    className="w-full h-10 rounded-xl bg-[rgb(var(--card-rgb))] border border-[rgb(var(--border-rgb))] px-3 text-sm outline-none"
                  >
                    <option value="">No especificar</option>
                    <option value="NEW">Nuevo</option>
                    <option value="USED">Usado</option>
                    <option value="REFURBISHED">Reacondicionado</option>
                  </select>
                </label>
              </div>

              {/* Garantía / Entrega */}
              <div className="grid grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <Label className="text-xs">Garantía (meses)</Label>
                  <Input
                    value={form.warrantyMonths}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        warrantyMonths: e.target.value,
                      }))
                    }
                    placeholder="Ej: 12"
                  />
                </label>

                <div className="block space-y-1.5">
                  <Label className="text-xs">Entrega</Label>
                  <div className="flex items-center h-10">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.homeDelivery}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            homeDelivery: e.target.checked,
                          }))
                        }
                      />
                      <span className="text-sm opacity-80">
                        Disponible envío a domicilio
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Categoría / Estado */}
              <div className="grid grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <Label className="text-xs">Categoría</Label>
                  <select
                    value={form.categorySlug || ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        categorySlug: e.target.value || undefined,
                      }))
                    }
                    className="w-full h-10 rounded-xl bg-[rgb(var(--card-rgb))] border border-[rgb(var(--border-rgb))] px-3 text-sm outline-none"
                  >
                    <option value="">— Sin categoría</option>
                    {catOptions
                      .filter((o) => o.value !== "all")
                      .map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                  </select>
                </label>

                <div className="block space-y-1.5">
                  <Label className="text-xs">Estado</Label>
                  <div className="flex items-center h-10">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.active}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            active: e.target.checked,
                          }))
                        }
                      />
                      <span className="text-sm opacity-80">
                        {form.active ? "Activo" : "Inactivo"}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Tags */}
              <label className="block space-y-1.5">
                <Label className="text-xs">Tags (para búsqueda)</Label>
                <Input
                  value={form.tagsStr}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tagsStr: e.target.value }))
                  }
                  placeholder="Ej: gamer, 16gb ram, rtx 4060"
                />
                <div className="text-[11px] opacity-60">
                  Separados por coma. Se usarán para mejorar la búsqueda y los
                  filtros.
                </div>
              </label>

              {/* SKU / Código de barras */}
              <div className="grid grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <Label className="text-xs">SKU interno</Label>
                  <Input
                    value={form.sku}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sku: e.target.value }))
                    }
                    placeholder="Código interno de inventario"
                  />
                </label>
                <label className="block space-y-1.5">
                  <Label className="text-xs">Código de barras / GTIN</Label>
                  <Input
                    value={form.barcode}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, barcode: e.target.value }))
                    }
                    placeholder="EAN / UPC / GTIN"
                  />
                </label>
              </div>
            </div>

            {/* Col imágenes */}
            <div className="md:col-span-5 space-y-3">
              <div className="text-xs opacity-70">Imágenes</div>
              <ImageUploader
                value={form.images}
                onChange={(next) => setForm((f) => ({ ...f, images: next }))}
                max={8}
                onUpload={async (file) => {
                  try {
                    // Carpeta final: Tienda-Virtual/products/<slug|nombre>
                    const folderSlug =
                      (form.slug && form.slug.trim()) ||
                      slugify(form.name) ||
                      undefined;
                    const up = await uploadProductImage(file, folderSlug);
                    return {
                      url: up.url,
                      publicId: up.publicId,
                      position: form.images?.length || 0,
                    } as UImage;
                  } catch (e: any) {
                    toast({
                      title: e?.message || "No se pudo subir la imagen",
                      variant: "error",
                    });
                    throw e;
                  }
                }}
              />
              <div className="text-[11px] opacity-60">
                Arrastra para reordenar. La primera es la <b>principal</b>.
              </div>
            </div>
          </div>

          {(loadingDetail || createMut.isPending || patchMut.isPending) && (
            <div className="absolute inset-0 rounded-2xl bg-black/30 grid place-content-center">
              <div className="text-sm opacity-90 px-3 py-2 rounded-lg border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] animate-pulse">
                {loadingDetail ? "Cargando…" : "Guardando…"}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
