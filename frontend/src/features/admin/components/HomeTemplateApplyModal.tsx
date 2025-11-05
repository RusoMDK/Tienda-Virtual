// src/features/admin/home/components/HomeTemplateApplyModal.tsx
import { useRef, useState } from "react";
import { X, Eye } from "lucide-react";
import { Button, Input } from "@/ui";
import type { TemplateDefinition } from "../home/templates";

type HomeTemplateApplyModalProps = {
  open: boolean;
  template: TemplateDefinition | null;
  heroImageUrl: string;
  onHeroImageUrlChange: (value: string) => void;
  isApplying: boolean;
  hasExistingSections: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  preview?: React.ReactNode;
};

export default function HomeTemplateApplyModal({
  open,
  template,
  heroImageUrl,
  onHeroImageUrlChange,
  isApplying,
  hasExistingSections,
  onCancel,
  onConfirm,
  preview,
}: HomeTemplateApplyModalProps) {
  if (!open || !template) return null;

  const hasHero = template.sections.some((s) => s.type === "HERO");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onHeroImageUrlChange(url);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] shadow-xl p-4 md:p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Aplicar plantilla</h2>
            <p className="text-xs opacity-70">
              {hasExistingSections
                ? "Esto reemplazará las secciones actuales del inicio por la plantilla seleccionada."
                : "Se crearán nuevas secciones de inicio con esta plantilla."}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs opacity-60 hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>

        {/* Info de plantilla */}
        <div className="rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-2-rgb))] p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">{template.name}</div>
              {template.description && (
                <p className="text-[11px] opacity-70 mt-0.5">
                  {template.description}
                </p>
              )}
            </div>
            {template.badge && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-[rgb(var(--primary-rgb))] bg-[rgb(var(--primary-rgb)/0.12)]">
                {template.badge}
              </span>
            )}
          </div>

          <div className="text-[11px] opacity-70">
            {template.sections.length} secciones:
          </div>
          <ul className="text-[11px] opacity-80 space-y-1 max-h-32 overflow-auto pr-1">
            {template.sections.map((s) => (
              <li key={s.slug}>
                • <span className="font-medium">{s.title || s.slug}</span>{" "}
                <span className="opacity-60">({s.type})</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Imagen hero opcional */}
        {hasHero && (
          <div className="space-y-2">
            <label className="block text-xs opacity-70">
              Imagen principal del hero
            </label>
            <Input
              value={heroImageUrl}
              onChange={(e) => onHeroImageUrlChange(e.target.value)}
              placeholder="https://tus-imagenes.com/hero.jpg"
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] opacity-60">
                Puedes pegar una URL o subir una imagen para previsualizarla.
              </p>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  size="xs"
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isApplying}
                >
                  Subir imagen
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-2-rgb))] overflow-hidden">
              <div className="h-24 bg-[rgb(var(--muted-rgb))] flex items-center justify-center text-[11px] opacity-70">
                {heroImageUrl ? (
                  <img
                    src={heroImageUrl}
                    alt="Previsualización hero"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>Sin imagen seleccionada</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Vista previa completa */}
        {preview && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold">Vista previa</span>
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] opacity-70 hover:opacity-100"
              >
                <Eye size={12} />
                {showPreview ? "Ocultar vista previa" : "Ver vista previa"}
              </button>
            </div>
            {showPreview && (
              <div className="max-h-72 overflow-auto rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--bg-rgb))] p-3">
                {preview}
              </div>
            )}
          </div>
        )}

        {/* Footer botones */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            size="sm"
            type="button"
            className="bg-transparent border border-[rgb(var(--border-rgb))]"
            onClick={onCancel}
            disabled={isApplying}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            type="button"
            onClick={onConfirm}
            disabled={isApplying}
          >
            {isApplying ? "Aplicando…" : "Aplicar plantilla"}
          </Button>
        </div>
      </div>
    </div>
  );
}
