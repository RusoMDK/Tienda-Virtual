// src/features/admin/pages/AdminCategoriesPage.tsx
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Skeleton } from "@/ui";
import { useToast } from "@/ui";
import {
  adminListCategories,
  adminUpsertCategory,
  adminDeleteCategory,
  adminUploadDelete,
} from "../api";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  Plus,
  Trash2,
  Save,
  Search,
  CornerDownRight,
  Image as ImageIcon,
  Upload,
  X,
  Undo2,
  Minimize2,
  Maximize2,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { uploadToCloudinary } from "@/features/uploads/cloudinary";

/* ─────────────────────────────────────────────────────────────
  Tipos y helpers
───────────────────────────────────────────────────────────── */
type Cat = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  imageUrl?: string | null; // sólo subcategorías
  imagePublicId?: string | null; // sólo subcategorías
};

const MAX_DEPTH = 2; // Categoría (nivel 1) -> Subcategoría (nivel 2)

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function getUniqueSlug(base: string, taken: Set<string>) {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

function buildPath(cat: Cat, byId: Map<string, Cat>) {
  const parts = [cat.name];
  let p = cat.parentId ? byId.get(cat.parentId) || null : null;
  while (p) {
    parts.push(p.name);
    p = p.parentId ? byId.get(p.parentId) || null : null;
  }
  return parts.reverse().join(" / ");
}

/* ─────────────────────────────────────────────────────────────
  Bulk create (máximo 2 niveles)
───────────────────────────────────────────────────────────── */
function parseBulkLines(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) =>
      line
        .split(/[>/]/)
        .map((x) => x.trim())
        .filter(Boolean)
    )
    .filter((arr) => arr.length > 0);
}
type BulkPlanItem = { names: string[] };

function BulkModal({
  open,
  onClose,
  onConfirm,
  isBusy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (plan: BulkPlanItem[]) => Promise<void>;
  isBusy: boolean;
}) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<BulkPlanItem[]>([]);
  const [trimmed, setTrimmed] = useState(false);

  useEffect(() => {
    if (!open) {
      setText("");
      setParsed([]);
      setTrimmed(false);
    }
  }, [open]);

  useEffect(() => {
    const lines = parseBulkLines(text);
    let anyTrim = false;
    const arr = lines.map((names) => {
      if (names.length > 2) {
        anyTrim = true;
        return { names: names.slice(0, 2) };
      }
      return { names };
    });
    setParsed(arr);
    setTrimmed(anyTrim);
  }, [text]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-[rgb(0_0_0/0.6)] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] shadow-xl">
        <div className="p-4 border-b border-[rgb(var(--border-rgb))] flex items-center justify-between">
          <div className="font-semibold">Crear categorías en lote</div>
          <button
            className="rounded-lg px-2 py-1 hover:bg-[rgb(var(--muted-rgb))]"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm opacity-80">
            Una ruta por línea, máx. <b>Categoría / Subcategoría</b>. Ejemplos:
          </p>
          <div className="text-xs bg-[rgb(var(--muted-rgb))] border border-[rgb(var(--border-rgb))] rounded-xl p-3">
            <div>Ropa / Camisetas</div>
            <div>Electrónica / Móviles</div>
          </div>

          <textarea
            className="w-full h-44 bg-[rgb(var(--card-2-rgb))] border border-[rgb(var(--border-rgb))] rounded-xl p-3 text-sm"
            placeholder="Ej: Ropa / Camisetas"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <div className="flex items-center justify-between">
            <div className="text-xs opacity-70">
              {parsed.length
                ? `Se crearán/actualizarán ${parsed.length} rutas.`
                : "Nada que crear todavía."}
            </div>
            {trimmed && (
              <div className="flex items-center gap-1 text-xs text-[rgb(var(--danger-rgb))]">
                <AlertTriangle size={14} />
                Se ignoraron niveles extra (&gt; 2).
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-[rgb(var(--border-rgb))] flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isBusy}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm(parsed)}
            disabled={!parsed.length || isBusy}
          >
            <Sparkles size={16} className="mr-1" />
            Crear
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
  Página
───────────────────────────────────────────────────────────── */
export default function AdminCategoriesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  // Datos
  const {
    data: cats,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["admin:categories"],
    queryFn: adminListCategories,
    staleTime: 3 * 60_000,
  });

  // Índices
  const byId = useMemo(() => {
    const m = new Map<string, Cat>();
    ((cats as Cat[]) || []).forEach((c) => m.set(c.id, c));
    return m;
  }, [cats]);

  const roots = useMemo(
    () => ((cats as Cat[]) || []).filter((c) => !c.parentId),
    [cats]
  );

  const childrenOf = useCallback(
    (parentId: string) =>
      ((cats as Cat[]) || []).filter((c) => c.parentId === parentId),
    [cats]
  );

  // Búsqueda (debounce)
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(q.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // Filtro (aplica a raíz o a cualquiera de sus hijos)
  const filteredRoots = useMemo(() => {
    if (!search) return roots;
    return roots.filter((r) => {
      const matchRoot =
        r.name.toLowerCase().includes(search) ||
        r.slug.toLowerCase().includes(search);
      const matchChild = childrenOf(r.id).some(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.slug.toLowerCase().includes(search)
      );
      return matchRoot || matchChild;
    });
  }, [roots, childrenOf, search]);

  // Expand/collapse (solo raíces) + persistencia
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem("adminCats:expanded2");
      if (raw) setExpanded(new Set(JSON.parse(raw)));
      else setExpanded(new Set(roots.map((r) => r.id))); // abrir todo por defecto
    } catch {
      setExpanded(new Set(roots.map((r) => r.id)));
    }
  }, [roots]);
  useEffect(() => {
    try {
      localStorage.setItem(
        "adminCats:expanded2",
        JSON.stringify(Array.from(expanded))
      );
    } catch {}
  }, [expanded]);

  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const expandAll = () => setExpanded(new Set(roots.map((r) => r.id)));
  const collapseAll = () => setExpanded(new Set());

  // Selección + formulario
  const [sel, setSel] = useState<Cat | null>(null);
  useEffect(() => {
    if (sel && !byId.has(sel.id)) setSel(null);
  }, [byId, sel]);

  const [form, setForm] = useState<{
    id?: string;
    name: string;
    slug: string;
    parentId: string | null;
    imageUrl?: string | null;
    imagePublicId?: string | null;
  }>({
    name: "",
    slug: "",
    parentId: null,
    imageUrl: null,
    imagePublicId: null,
  });

  function pick(c: Cat) {
    setSel(c);
    setForm({
      id: c.id,
      name: c.name,
      slug: c.slug,
      parentId: c.parentId,
      imageUrl: c.imageUrl ?? null,
      imagePublicId: c.imagePublicId ?? null,
    });
  }

  // Crear raíz / sub (sólo un nivel)
  function newRoot() {
    setSel(null);
    setSlugTouched(false);
    setForm({
      name: "",
      slug: "",
      parentId: null,
      imageUrl: null,
      imagePublicId: null,
    });
  }
  function newChild() {
    if (!sel) return;
    if (sel.parentId) {
      toast({
        title: "Nivel máximo alcanzado",
        description: "Sólo se permite Categoría → Subcategoría.",
        variant: "warning",
      });
      return;
    }
    setSlugTouched(false);
    setForm({
      id: undefined,
      name: "",
      slug: "",
      parentId: sel.id,
      imageUrl: null,
      imagePublicId: null,
    });
    setExpanded((s) => new Set(s).add(sel.id!));
  }

  // Autogenerar slug si no lo tocaron
  const [slugTouched, setSlugTouched] = useState(false);
  useEffect(() => {
    if (!slugTouched) setForm((f) => ({ ...f, slug: slugify(f.name || "") }));
  }, [form.name, slugTouched]);

  // Slug único
  const allSlugs = useMemo(() => {
    const s = new Set<string>();
    ((cats as Cat[]) || []).forEach((c) => {
      if (!form.id || c.id !== form.id) s.add(c.slug);
    });
    return s;
  }, [cats, form.id]);
  const slugConflict = !!form.slug && allSlugs.has(form.slug);

  // Dropdown de padre: sólo raíces (o vacío) — no mutar `roots` al ordenar
  const parentOptions = useMemo(() => {
    const list = [...roots].sort((a, b) => a.name.localeCompare(b.name));
    return [
      { id: "", name: "— (raíz)" },
      ...list.map((c) => ({ id: c.id, name: c.name })),
    ];
  }, [roots]);

  // Upload (solo subcategoría)
  const [uploading, setUploading] = useState(false);
  const pickFile = () => fileRef.current?.click();

  const doUpload = async (file: File) => {
    if (!form.parentId) {
      toast({
        title: "La imagen sólo aplica a subcategorías.",
        variant: "warning",
      });
      return;
    }
    // límite duro por UX (además de validación en uploadToCloudinary)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Imagen muy pesada",
        description: "Máximo 5MB.",
        variant: "error",
      });
      return;
    }

    // ── NUEVO: carpeta de destino <categories>/<slugPadre>/<slugHijo>
    const parent = byId.get(form.parentId);
    const parentSlug = parent?.slug?.trim();
    const childSlug = (form.slug || slugify(form.name || "")).trim();

    if (!parentSlug || !childSlug) {
      toast({
        title: "Faltan slugs",
        description:
          "Verifica que la subcategoría tenga nombre/slug y que tenga padre.",
        variant: "error",
      });
      return;
    }

    const folderPath = `${parentSlug}/${childSlug}`;

    try {
      setUploading(true);

      const up = await uploadToCloudinary(file, {
        alias: "categories",
        folder: folderPath, // → Tienda-Virtual/categories/<parent>/<child>
        acceptMime: ["image/jpeg", "image/png", "image/webp"],
        maxBytes: 5 * 1024 * 1024,
      });

      setForm((f) => ({
        ...f,
        imageUrl: up.url,
        imagePublicId: up.publicId || null,
      }));
      toast({ title: "Imagen subida", variant: "success" });
    } catch (e: any) {
      toast({ title: e?.message || "No se pudo subir", variant: "error" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onFileChange = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void doUpload(file);
  };
  const onDropImage = async (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) await doUpload(f);
  };
  const clearImage = async () => {
    if (form.imagePublicId) {
      try {
        await adminUploadDelete(form.imagePublicId);
      } catch {}
    }
    setForm((f) => ({ ...f, imageUrl: null, imagePublicId: null }));
  };

  // Mutations
  const qcInvalidate = () =>
    qc.invalidateQueries({ queryKey: ["admin:categories"] });

  const upsertMut = useMutation({
    mutationFn: (payload: {
      id?: string;
      name: string;
      slug: string;
      parentId?: string | null;
      imageUrl?: string | null;
      imagePublicId?: string | null;
    }) => adminUpsertCategory(payload),
    onSuccess: (data: any, vars) => {
      const saved: Cat | null = data?.id
        ? {
            id: data.id,
            name: data.name,
            slug: data.slug,
            parentId: data.parentId ?? null,
            imageUrl: data.imageUrl ?? null,
            imagePublicId: data.imagePublicId ?? null,
          }
        : null;

      if (!vars.id && vars.parentId)
        setExpanded((s) => new Set(s).add(vars.parentId!));
      if (saved) pick(saved);
      else
        setForm({
          name: "",
          slug: "",
          parentId: vars.parentId ?? null,
          imageUrl: null,
          imagePublicId: null,
        });

      toast({ title: "Categoría guardada", variant: "success" });
      qcInvalidate();
    },
    onError: (e: any) => {
      const status = e?.response?.status;
      const msg =
        e?.response?.data?.error ||
        (status === 409 ? "Slug en uso" : "No se pudo guardar");
      toast({ title: msg, variant: "error" });
    },
  });

  const delMut = useMutation({
    mutationFn: (id: string) => adminDeleteCategory(id),
    onSuccess: () => {
      toast({ title: "Categoría eliminada", variant: "success" });
      setLastDeleted(sel);
      setSel(null);
      setForm({
        name: "",
        slug: "",
        parentId: null,
        imageUrl: null,
        imagePublicId: null,
      });
      qcInvalidate();
    },
    onError: (e: any) => {
      // Mensajes más específicos para UX clara
      const status = e?.response?.status;
      const text = (e?.response?.data?.error as string) || "";
      let msg =
        status === 400 || status === 409
          ? text || "No se puede eliminar por relaciones existentes."
          : "No se pudo eliminar.";

      if (/subcategor/i.test(text) || /child/i.test(text)) {
        msg = "No se puede eliminar la categoría: tiene subcategorías.";
      } else if (/product/i.test(text) || /producto/i.test(text)) {
        msg =
          "No se puede eliminar: hay productos vinculados a esta subcategoría.";
      }

      toast({ title: msg, variant: "error" });
    },
  });

  // Guardar / Eliminar
  const canSaveBase =
    form.name.trim().length > 0 && form.slug.trim().length > 0;
  const canSave = canSaveBase && !slugConflict;

  function save() {
    if (!canSave) return;

    let outSlug = form.slug.trim();
    if (slugConflict && !slugTouched) {
      outSlug = getUniqueSlug(outSlug, allSlugs);
      toast({ title: "Slug ajustado", description: `Se usará “${outSlug}”.` });
    } else if (slugConflict) {
      toast({
        title: "Slug en uso",
        description: "Elige otro.",
        variant: "error",
      });
      return;
    }

    upsertMut.mutate({
      id: form.id,
      name: form.name.trim(),
      slug: outSlug,
      parentId: form.parentId || null,
      imageUrl: form.parentId ? form.imageUrl ?? null : null,
      imagePublicId: form.parentId ? form.imagePublicId ?? null : null,
    });
  }

  function remove() {
    if (!form.id) return;

    const isSub = !!form.parentId;
    const hasChildren = ((cats as Cat[]) || []).some(
      (c) => c.parentId === form.id
    );

    if (!isSub && hasChildren) {
      toast({
        title: "No se puede eliminar la categoría",
        description: "Primero elimina o mueve sus subcategorías.",
        variant: "error",
      });
      return;
    }

    const confirmText = isSub
      ? `¿Eliminar la subcategoría “${form.name}”? Si tiene productos vinculados no se eliminará.`
      : `¿Eliminar la categoría “${form.name}”? Solo se puede si no tiene subcategorías.`;

    if (confirm(confirmText)) {
      delMut.mutate(form.id);
    }
  }

  // Deshacer borrado
  const [lastDeleted, setLastDeleted] = useState<Cat | null>(null);
  async function undoDelete() {
    if (!lastDeleted) return;
    try {
      await adminUpsertCategory({
        name: lastDeleted.name,
        slug: getUniqueSlug(lastDeleted.slug, allSlugs),
        parentId: lastDeleted.parentId,
        imageUrl: lastDeleted.imageUrl ?? null,
        imagePublicId: lastDeleted.imagePublicId ?? null,
      });
      setLastDeleted(null);
      toast({ title: "Restaurada", variant: "success" });
      qcInvalidate();
    } catch {
      toast({ title: "No se pudo restaurar", variant: "error" });
    }
  }

  // Atajos
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" || tag === "textarea" || tag === "select";
      if (isTyping) return;
      if (e.key.toLowerCase() === "n") newRoot();
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
      if (e.key === "Delete" && form.id) remove();
      if (e.key.toLowerCase() === "f") {
        (
          document.getElementById("adm-cats-search") as HTMLInputElement | null
        )?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [form.id]);

  /* ───────────────────────────
     Render
  ─────────────────────────── */
  const selectedPath =
    form.id || form.name
      ? buildPath(
          form.id && byId.get(form.id)
            ? (byId.get(form.id) as Cat)
            : ({
                id: "__tmp__",
                name: form.name || "(sin nombre)",
                slug: form.slug || "(sin slug)",
                parentId: form.parentId,
              } as Cat),
          byId
        )
      : "";

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
      {/* Panel izquierdo */}
      <div className="md:col-span-6 space-y-3">
        <div className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] p-3 md:p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative w-full">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 opacity-70"
              />
              <Input
                id="adm-cats-search"
                className="pl-8"
                placeholder="Buscar categoría o slug… (atajo: F)"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={collapseAll}
                title="Contraer todas"
              >
                <Minimize2 size={16} />
              </Button>
              <Button
                variant="secondary"
                onClick={expandAll}
                title="Expandir todas"
              >
                <Maximize2 size={16} />
              </Button>
              <Button onClick={newRoot} title="Nueva categoría (atajo: N)">
                <Plus size={16} className="mr-1" /> Nueva
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] p-3 md:p-4 max-h-[68vh] overflow-auto">
          {isLoading && (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          )}

          {isError && (
            <div className="p-4 text-sm text-[rgb(var(--danger-rgb))]">
              No se pudieron cargar las categorías.
            </div>
          )}

          {!isLoading && !isError && filteredRoots.length === 0 && (
            <div className="p-4 text-sm opacity-70">Sin resultados.</div>
          )}

          {!isLoading && !isError && filteredRoots.length > 0 && (
            <div className="space-y-4">
              {filteredRoots.map((root) => {
                const isOpen = expanded.has(root.id);
                const kids = childrenOf(root.id).sort((a, b) =>
                  a.name.localeCompare(b.name)
                );
                const isSelected = sel?.id === root.id;

                return (
                  <div
                    key={root.id}
                    className={[
                      "rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--elev-rgb))]",
                      isSelected ? "ring-2 ring-[rgb(var(--ring-rgb))]" : "",
                    ].join(" ")}
                  >
                    {/* Cabecera de categoría raíz */}
                    <div
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[rgb(var(--muted-rgb))] rounded-t-xl"
                      onClick={() => toggle(root.id)}
                      title={buildPath(root, byId)}
                    >
                      <button
                        className="p-1 rounded hover:bg-[rgb(var(--card-2-rgb))]"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(root.id);
                        }}
                        aria-label={isOpen ? "Contraer" : "Expandir"}
                      >
                        {isOpen ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </button>
                      <Folder size={16} className="opacity-80" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium leading-tight truncate">
                          {root.name}
                        </div>
                        <div className="text-xs opacity-60 truncate">
                          {root.slug}
                        </div>
                      </div>

                      {kids.length > 0 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-[rgb(var(--border-rgb))]">
                          {kids.length}
                        </span>
                      )}

                      {/* Editar raíz */}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          pick(root);
                        }}
                        title="Editar categoría"
                      >
                        Editar
                      </Button>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSel(root);
                          newChild();
                        }}
                        title="Añadir subcategoría"
                      >
                        <CornerDownRight size={14} className="mr-1" />
                        Sub
                      </Button>
                    </div>

                    {/* Grid de subcategorías */}
                    {isOpen && (
                      <div className="px-3 pb-3">
                        {kids.length === 0 ? (
                          <div className="text-xs opacity-70 px-2 py-3">
                            Sin subcategorías todavía.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                            {kids.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => pick(c)}
                                className={[
                                  "group text-left rounded-xl border border-[rgb(var(--border-rgb))] overflow-hidden",
                                  "bg-[rgb(var(--card-rgb))] hover:bg-[rgb(var(--muted-rgb))] transition",
                                  sel?.id === c.id
                                    ? "ring-2 ring-[rgb(var(--ring-rgb))]"
                                    : "",
                                ].join(" ")}
                                title={buildPath(c, byId)}
                              >
                                <div className="aspect-[3/2] bg-[rgb(var(--card-2-rgb))] overflow-hidden">
                                  {c.imageUrl ? (
                                    <img
                                      src={c.imageUrl}
                                      alt=""
                                      className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform"
                                      loading="lazy"
                                      decoding="async"
                                    />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center opacity-60">
                                      <ImageIcon size={18} />
                                    </div>
                                  )}
                                </div>
                                <div className="p-2">
                                  <div className="text-sm font-medium truncate">
                                    {c.name}
                                  </div>
                                  <div className="text-[11px] opacity-60 truncate">
                                    {c.slug}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Panel derecho (Formulario) */}
      <div className="md:col-span-6 space-y-3">
        {/* Undo */}
        {lastDeleted && (
          <div className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] p-3 flex items-center justify-between">
            <div className="text-sm">
              Eliminaste <strong>{lastDeleted.name}</strong>. ¿Deshacer?
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={undoDelete}>
                <Undo2 size={14} className="mr-1" />
                Deshacer
              </Button>
              <button
                className="rounded-lg px-2 py-1 hover:bg-[rgb(var(--muted-rgb))] text-sm"
                onClick={() => setLastDeleted(null)}
                aria-label="Cerrar"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-semibold">
              {form.id ? "Editar categoría" : "Nueva categoría"}
            </div>
            <div className="flex items-center gap-2">
              <BulkCreate
                cats={(cats as Cat[]) || []}
                onDone={() =>
                  qc.invalidateQueries({ queryKey: ["admin:categories"] })
                }
              />
              {form.id ? (
                <Button
                  variant="destructive"
                  onClick={remove}
                  disabled={delMut.isPending}
                  title="Eliminar (pide confirmación)"
                >
                  <Trash2 size={16} className="mr-1" />
                  Eliminar
                </Button>
              ) : null}
            </div>
          </div>

          {!!selectedPath && (
            <div className="text-xs opacity-70 -mt-2">{selectedPath}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs opacity-70 mb-1">Nombre</label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Ej: Zapatos"
              />
            </div>
            <div>
              <label className="block text-xs opacity-70 mb-1">
                Slug{" "}
                {slugConflict && (
                  <span className="text-[rgb(var(--danger-rgb))]">
                    (en uso)
                  </span>
                )}
              </label>
              <Input
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm((f) => ({ ...f, slug: slugify(e.target.value) }));
                }}
                placeholder="ej: zapatos"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs opacity-70 mb-1">Padre</label>
              <select
                className="w-full bg-[rgb(var(--card-2-rgb))] border border-[rgb(var(--border-rgb))] rounded-xl px-3 py-2 text-sm"
                value={form.parentId || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, parentId: e.target.value || null }))
                }
              >
                {parentOptions.map((o) => (
                  <option key={o.id || "__root__"} value={o.id}>
                    {o.name || "— (raíz)"}
                  </option>
                ))}
              </select>
              <div className="text-xs opacity-60 mt-1">
                Máximo dos niveles. Si seleccionas un padre (raíz), esta será
                una subcategoría.
              </div>
            </div>

            {/* Imagen sólo si es subcategoría */}
            {form.parentId && (
              <div className="md:col-span-2">
                <label className="block text-xs opacity-70 mb-1">
                  Imagen (subcategorías)
                </label>

                {!form.imageUrl ? (
                  <div
                    className="rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-2-rgb))] p-4 flex items-center justify-between"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onDropImage}
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-[rgb(var(--card-rgb))] p-2">
                        <ImageIcon size={20} className="opacity-80" />
                      </div>
                      <div className="text-sm opacity-80">
                        Arrastra una imagen aquí o usa “Subir imagen”.
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => onFileChange(e.target.files)}
                      />
                      <Button onClick={pickFile} disabled={uploading}>
                        <Upload size={16} className="mr-1" />
                        {uploading ? "Subiendo…" : "Subir imagen"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[rgb(var(--border-rgb))] overflow-hidden">
                    <div className="aspect-[16/9] bg-[rgb(var(--card-2-rgb))]">
                      <img
                        src={form.imageUrl}
                        alt="Imagen de subcategoría"
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <div className="p-2 flex items-center justify-between bg-[rgb(var(--card-rgb))]">
                      <div className="text-xs opacity-70 truncate">
                        {form.imagePublicId || "—"}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => onFileChange(e.target.files)}
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={pickFile}
                          disabled={uploading}
                        >
                          Cambiar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={clearImage}
                        >
                          <X size={14} className="mr-1" />
                          Quitar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs opacity-70">
            <div>
              Atajos: <kbd>N</kbd> nueva / <kbd>S</kbd> guardar /{" "}
              <kbd>Delete</kbd> eliminar / <kbd>F</kbd> buscar.
            </div>
            <div className="flex items-center gap-2">
              {!form.id && sel && (
                <Button variant="secondary" onClick={newRoot}>
                  Crear en raíz
                </Button>
              )}
              <Button onClick={save} disabled={!canSave || upsertMut.isPending}>
                <Save size={16} className="mr-1" />
                {upsertMut.isPending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </div>
        </div>

        <div className="text-xs opacity-60">
          Consejo: usa nombres claros y cortos. El slug se genera
          automáticamente (puedes ajustarlo). Máximo 2 niveles: Categoría →
          Subcategoría.
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Subcomponente: botón + modal de creación en lote (2 niveles)
───────────────────────────────────────────────────────────── */
function BulkCreate({ cats, onDone }: { cats: Cat[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  // Búsqueda por nombre/slug
  const mapByNameSlug = useMemo(() => {
    const m = new Map<string, Cat>();
    cats.forEach((c) => {
      m.set(`n:${c.name.toLowerCase()}`, c);
      m.set(`s:${c.slug.toLowerCase()}`, c);
    });
    return m;
  }, [cats]);

  const allSlugs = useMemo(
    () => new Set<string>(cats.map((c) => c.slug)),
    [cats]
  );

  const handleConfirm = async (plan: { names: string[] }[]) => {
    setBusy(true);
    let trimmed = false;
    try {
      for (const item of plan) {
        const path =
          item.names.length > 2
            ? ((trimmed = true), item.names.slice(0, 2))
            : item.names;

        let parentId: string | null = null;
        for (const [idx, rawName] of path.entries()) {
          const name = rawName.trim();
          if (idx >= MAX_DEPTH) break;

          const keyN = `n:${name.toLowerCase()}`;
          let found = mapByNameSlug.get(keyN);
          if (!found && parentId === null) {
            const s = slugify(name);
            found =
              mapByNameSlug.get(`s:${s}`) || mapByNameSlug.get(`n:${name}`);
          }

          if (!found) {
            const slug = getUniqueSlug(slugify(name), allSlugs);
            const created = (await adminUpsertCategory({
              name,
              slug,
              parentId,
            })) as any;
            const cat: Cat = {
              id: created.id,
              name: created.name,
              slug: created.slug,
              parentId: created.parentId ?? null,
              imageUrl: created.imageUrl ?? null,
              imagePublicId: created.imagePublicId ?? null,
            };
            mapByNameSlug.set(`n:${name.toLowerCase()}`, cat);
            mapByNameSlug.set(`s:${slug.toLowerCase()}`, cat);
            allSlugs.add(slug);
            parentId = cat.id;
          } else {
            parentId = found.id;
          }
        }
      }
      if (trimmed) {
        toast({
          title: "Rutas recortadas",
          description:
            "Se ignoraron niveles extra (solo se permite Categoría/Subcategoría).",
        });
      }
      toast({ title: "Creación en lote completa", variant: "success" });
      setOpen(false);
      onDone();
    } catch (e: any) {
      toast({
        title: "Error en creación en lote",
        description: e?.message || "Revisa el formato e inténtalo de nuevo.",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Sparkles size={16} className="mr-1" />
        Crear en lote
      </Button>
      <BulkModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        isBusy={busy}
      />
    </>
  );
}
