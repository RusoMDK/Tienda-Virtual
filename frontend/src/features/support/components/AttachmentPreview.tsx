// src/features/support/components/AttachmentPreview.tsx
import { Paperclip, X } from "lucide-react";
import type { NewAttachment, Attachment } from "@/features/support/types";

type Props = {
  att: NewAttachment | Attachment;
  onRemove?: () => void; // opcional en composer
  compact?: boolean; // en mensajes
};

function formatBytes(b: number) {
  if (!b && b !== 0) return "";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(b) / Math.log(k)), sizes.length - 1);
  return `${(b / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function AttachmentPreview({ att, onRemove, compact }: Props) {
  const isImage = att.mime?.startsWith("image/");
  const name = att.filename || (att as any).publicId || "archivo";

  if (isImage) {
    return (
      <figure
        className={[
          "relative rounded-xl overflow-hidden border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))]",
          compact ? "max-w-full" : "h-24 w-24",
        ].join(" ")}
      >
        {/* la imagen nunca desborda */}
        <img
          src={att.url}
          alt={name}
          className={
            compact
              ? "max-h-48 w-auto block"
              : "h-full w-full object-cover block"
          }
          loading="lazy"
        />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white"
            title="Quitar archivo"
            aria-label="Quitar archivo"
          >
            <X size={14} />
          </button>
        )}
        <figcaption className="sr-only">{name}</figcaption>
      </figure>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border px-2 py-1 text-xs min-w-0 bg-[rgb(var(--card-rgb))]">
      <Paperclip size={14} className="shrink-0" />
      <a
        href={att.url}
        target="_blank"
        rel="noreferrer"
        className="underline truncate max-w-[18rem]"
        title={name}
      >
        {name}
      </a>
      {att.bytes ? (
        <span className="opacity-60 shrink-0">· {formatBytes(att.bytes)}</span>
      ) : null}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto rounded bg-zinc-200/20 px-1.5 py-0.5 shrink-0"
          title="Quitar archivo"
          aria-label="Quitar archivo"
        >
          Quitar
        </button>
      )}
    </div>
  );
}
