import { useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { Button, Input, Label } from "@/ui";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (file: File) => void; // entrega un File listo para subir
};

type Shape = "square" | "circle";

export default function AvatarCropperDialog({
  open,
  onClose,
  onConfirm,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [shape, setShape] = useState<Shape>("square");
  const [zoom, setZoom] = useState(1);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!open) {
      setSrc(null);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
      setCroppedArea(null);
      setShape("square");
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  const hasImage = !!src;

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    if (!/^image\/(png|jpe?g|webp|avif)$/i.test(file.type)) {
      alert("Formato no soportado. Usa PNG, JPG, WebP o AVIF.");
      e.currentTarget.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Archivo muy pesado. Máximo 5 MB.");
      e.currentTarget.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setSrc(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  function onCropComplete(_area: Area, areaPixels: Area) {
    setCroppedArea(areaPixels);
  }

  async function handleConfirm() {
    if (!src || !croppedArea) return;
    setIsProcessing(true);
    try {
      const blob = await getCroppedBlob(src, croppedArea, shape);
      const file = new File(
        [blob],
        `avatar-${Date.now()}.${shape === "circle" ? "png" : "jpg"}`,
        { type: shape === "circle" ? "image/png" : "image/jpeg" }
      );
      onConfirm(file);
      onClose();
    } catch {
      alert("No se pudo procesar la imagen.");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div
      aria-hidden={!open}
      className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}
    >
      {/* Backdrop */}
      <div
        onClick={isProcessing ? undefined : onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* Modal */}
      <div
        className={`absolute left-1/2 top-1/2 w-[min(92vw,720px)] -translate-x-1/2 -translate-y-1/2 transition-all
          ${open ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
      >
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl overflow-hidden">
          <div className="p-5 border-b border-[var(--border)]">
            <h3 className="text-lg font-semibold">Editar avatar</h3>
            <p className="text-sm opacity-70">
              Recorte 1:1. Puedes elegir cuadrado o circular.
            </p>
          </div>

          <div className="p-5 space-y-4">
            {!hasImage ? (
              <div className="grid gap-3">
                <Label className="text-sm opacity-80">
                  Selecciona una imagen
                </Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif"
                  onChange={onPickFile}
                />
                <p className="text-xs opacity-60">
                  Máx. 5 MB. PNG, JPG, WebP o AVIF.
                </p>
              </div>
            ) : (
              <>
                <div className="relative w-full h-[320px] rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface-1)]">
                  <Cropper
                    image={src}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                    cropShape={shape === "circle" ? "round" : "rect"}
                    showGrid={false}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Label className="text-sm opacity-80">Zoom</Label>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant={shape === "square" ? "default" : "secondary"}
                    onClick={() => setShape("square")}
                  >
                    Cuadrado
                  </Button>
                  <Button
                    variant={shape === "circle" ? "default" : "secondary"}
                    onClick={() => setShape("circle")}
                  >
                    Circular
                  </Button>
                </div>

                <div className="text-xs opacity-60">
                  Archivo final {shape === "circle" ? "PNG" : "JPG"} 512×512.
                </div>
              </>
            )}
          </div>

          <div className="p-5 border-t border-[var(--border)] flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={isProcessing}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!hasImage || isProcessing}
            >
              {isProcessing ? "Procesando…" : "Guardar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────── helpers

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.crossOrigin = "anonymous";
    img.src = src;
  });
}

async function getCroppedBlob(
  imageSrc: string,
  crop: Area,
  shape: "square" | "circle"
): Promise<Blob> {
  const img = await loadImage(imageSrc);
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");

  if (shape === "square") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
  } else {
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
  }

  ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, size, size);

  if (shape === "circle") {
    ctx.restore();
    return new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b as Blob), "image/png", 0.92)
    );
  }
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b as Blob), "image/jpeg", 0.9)
  );
}
