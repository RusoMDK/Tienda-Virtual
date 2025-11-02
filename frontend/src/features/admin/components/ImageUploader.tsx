// src/features/admin/components/ImageUploader.tsx
import { useCallback, useMemo, useRef, useState } from "react";
import { Button, Input } from "@/ui";
import { uploadToCloudinary } from "@/features/uploads/cloudinary";
import { adminUploadDelete } from "@/features/admin/api";
import {
  UploadCloud,
  Trash2,
  ArrowUp,
  ArrowDown,
  Star,
  Link as LinkIcon,
  GripVertical,
} from "lucide-react";

export type UImage = {
  url: string;
  publicId?: string;
  position?: number;
  alt?: string;
};

type Props = {
  value: UImage[];
  onChange: (next: UImage[]) => void;
  max?: number; // default 8
};

export default function ImageUploader({
  value = [],
  onChange,
  max = 8,
}: Props) {
  // ───────────────────────────────── UI state
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [url, setUrl] = useState("");

  const [draggingOver, setDraggingOver] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragTo, setDragTo] = useState<number | null>(null);

  const canAdd = value.length < max;

  // ───────────────────────────────── Helpers
  const sortByPosition = useCallback(
    (arr: UImage[]) =>
      [...arr].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    []
  );

  const dedup = useCallback((arr: UImage[]) => {
    const seen = new Set<string>();
    const out: UImage[] = [];
    for (const it of arr) {
      const key = (
        it.publicId ? `pid:${it.publicId}` : `url:${it.url}`
      ).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(it);
    }
    return out;
  }, []);

  const normalize = useCallback(
    (arr: UImage[]) =>
      sortByPosition(arr).map((img, idx) => ({ ...img, position: idx })),
    [sortByPosition]
  );

  const limitMax = useCallback((arr: UImage[]) => arr.slice(0, max), [max]);

  const setPrimary = useCallback(
    (index: number) => {
      const copy = [...value];
      const [item] = copy.splice(index, 1);
      copy.unshift(item);
      onChange(normalize(copy));
    },
    [value, onChange, normalize]
  );

  const move = useCallback(
    (index: number, dir: -1 | 1) => {
      const j = index + dir;
      if (j < 0 || j >= value.length) return;
      const next = [...value];
      const tmp = next[index];
      next[index] = next[j];
      next[j] = tmp;
      onChange(normalize(next));
    },
    [value, onChange, normalize]
  );

  const removeAt = useCallback(
    async (idx: number) => {
      const next = [...value];
      const [removed] = next.splice(idx, 1);
      onChange(normalize(next));
      // borrar en cloudinary si aplica (no bloqueante)
      if (removed?.publicId) {
        try {
          await adminUploadDelete(removed.publicId);
        } catch {
          /* noop */
        }
      }
    },
    [value, onChange, normalize]
  );

  // ───────────────────────────────── Uploads
  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || !files.length || !canAdd) return;

      const remaining = Math.max(0, max - value.length);
      const list = Array.from(files).slice(0, remaining);

      setBusy(true);
      setProgress(`Preparando…`);

      try {
        const uploaded: UImage[] = [];
        let i = 0;
        for (const file of list) {
          i += 1;
          setProgress(`Subiendo ${i}/${list.length}…`);
          const { url, publicId } = await uploadToCloudinary(file);
          uploaded.push({ url, publicId });
        }

        const next = limitMax(dedup(normalize([...value, ...uploaded])));
        onChange(next);
      } catch (err) {
        // eslint-disable-next-line no-alert
        alert((err as Error)?.message || "No se pudo subir");
      } finally {
        setBusy(false);
        setProgress("");
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [value, onChange, max, canAdd, dedup, normalize, limitMax]
  );

  const addByUrl = useCallback(() => {
    const u = url.trim();
    if (!u) return;
    try {
      // validación simple
      new URL(u);
    } catch {
      // eslint-disable-next-line no-alert
      alert("URL inválida");
      return;
    }
    const next = limitMax(dedup(normalize([...value, { url: u }])));
    onChange(next);
    setUrl("");
  }, [url, value, onChange, dedup, normalize, limitMax]);

  // Pegar desde portapapeles (imágenes o URL)
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      if (!canAdd) return;
      const files = e.clipboardData.files;
      if (files && files.length) {
        e.preventDefault();
        await handleFiles(files);
        return;
      }
      const text = e.clipboardData.getData("text/plain");
      if (text && /^https?:\/\//i.test(text.trim())) {
        e.preventDefault();
        setUrl(text.trim());
      }
    },
    [canAdd, handleFiles]
  );

  // ───────────────────────────────── Drag & drop
  const onDropZoneDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  const onDropZoneEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(true);
  }, []);
  const onDropZoneLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(false);
  }, []);
  const onDropZone = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDraggingOver(false);
      const files = e.dataTransfer?.files;
      await handleFiles(files);
    },
    [handleFiles]
  );

  // drag reordenar tiles
  const onDragStartTile = (idx: number) => (e: React.DragEvent) => {
    setDragFrom(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  };
  const onDragOverTile = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragTo(idx);
  };
  const onDropTile = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragFrom ?? Number(e.dataTransfer.getData("text/plain"));
    const to = idx;
    setDragFrom(null);
    setDragTo(null);
    if (Number.isNaN(from) || from === to) return;
    const next = [...value];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(normalize(next));
  };
  const onDragEndTile = () => {
    setDragFrom(null);
    setDragTo(null);
  };

  const thumbs = useMemo(() => sortByPosition(value), [value, sortByPosition]);

  // ───────────────────────────────── Render
  return (
    <div className="space-y-3" onPaste={handlePaste}>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.currentTarget.files)}
        />
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!canAdd || busy}
          className="inline-flex items-center gap-2"
          aria-label="Añadir imágenes"
          title="Añadir imágenes"
        >
          <UploadCloud size={16} />
          Añadir imágenes
        </Button>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Pegar URL https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-64"
            aria-label="URL de imagen"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={addByUrl}
            disabled={!url.trim()}
            className="inline-flex items-center gap-1"
          >
            <LinkIcon size={14} />
            Añadir por URL
          </Button>
        </div>

        <div className="text-xs opacity-70 ml-auto">
          {thumbs.length}/{max} {busy && `· ${progress}`}
        </div>
      </div>

      {/* Dropzone */}
      <div
        ref={dropRef}
        onDragEnter={onDropZoneEnter}
        onDragOver={onDropZoneDrag}
        onDragLeave={onDropZoneLeave}
        onDrop={onDropZone}
        className={[
          "relative rounded-2xl border border-dashed",
          draggingOver
            ? "border-emerald-500/60 bg-emerald-500/5"
            : "border-zinc-700",
          "transition-colors",
        ].join(" ")}
      >
        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-3">
          {thumbs.map((img, idx) => {
            const isPrimary = idx === 0;
            const isDropTarget = dragTo === idx && dragFrom !== null;
            return (
              <div
                key={(img.publicId || img.url) + idx}
                draggable
                onDragStart={onDragStartTile(idx)}
                onDragOver={onDragOverTile(idx)}
                onDrop={onDropTile(idx)}
                onDragEnd={onDragEndTile}
                className={[
                  "group relative rounded-xl overflow-hidden border bg-[var(--card)]",
                  "transition-all",
                  isDropTarget
                    ? "border-emerald-500/60 ring-2 ring-emerald-500/30"
                    : "border-zinc-800",
                ].join(" ")}
                title={img.alt || img.url}
              >
                {/* Thumb */}
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={img.url}
                    alt={img.alt || `Imagen ${idx + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>

                {/* Overlay actions */}
                <div className="absolute inset-x-0 bottom-0 p-2 flex items-center justify-between gap-2 bg-black/45 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition">
                  <div className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-zinc-900/70 border border-zinc-700">
                    <GripVertical size={12} className="opacity-70" />#{idx + 1}
                  </div>

                  <div className="flex items-center gap-1">
                    {!isPrimary && (
                      <Button
                        size="xs"
                        onClick={() => setPrimary(idx)}
                        title="Marcar como principal"
                        aria-label="Marcar como principal"
                      >
                        <Star size={12} className="mr-1" /> Principal
                      </Button>
                    )}
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      aria-label="Subir"
                    >
                      <ArrowUp size={12} />
                    </Button>
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => move(idx, +1)}
                      disabled={idx === thumbs.length - 1}
                      aria-label="Bajar"
                    >
                      <ArrowDown size={12} />
                    </Button>
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => removeAt(idx)}
                      aria-label="Eliminar"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>

                {/* Badge primaria */}
                {isPrimary && (
                  <div className="absolute left-2 top-2 text-[10px] px-2 py-0.5 rounded bg-emerald-500 text-black font-semibold shadow">
                    Principal
                  </div>
                )}
              </div>
            );
          })}

          {/* Placeholders durante upload */}
          {busy && (
            <div className="rounded-xl overflow-hidden border border-zinc-800 bg-[var(--card)] animate-pulse">
              <div className="aspect-[4/3] bg-zinc-800/50" />
              <div className="p-2 h-7 bg-zinc-900/40" />
            </div>
          )}

          {/* Placeholder para agregar */}
          {canAdd && !busy && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="border border-dashed border-zinc-700 rounded-xl text-sm opacity-80 hover:opacity-100 grid place-content-center min-h-[6rem] sm:min-h-[8rem] md:min-h-[9rem]"
              title="Añadir imágenes"
            >
              + Añadir
            </button>
          )}
        </div>

        {/* Drop overlay text */}
        {draggingOver && (
          <div className="pointer-events-none absolute inset-0 grid place-content-center">
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs">
              Suelta archivos para subir
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
