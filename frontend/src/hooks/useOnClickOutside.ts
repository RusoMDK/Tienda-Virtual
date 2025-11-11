// useOnClickOutside.ts
import { useEffect, useRef } from "react";

/**
 * useOnClickOutside
 * - ref: RefObject del elemento observado (normalmente useRef<HTMLElement | null>(null))
 * - handler: función que se ejecuta cuando se detecta click/touch fuera o Escape
 * - when: activa/desactiva el listener (útil para activar solo cuando el panel está abierto)
 * - opts.debug: (opcional) si es true, imprime info en consola para depuración
 *
 * NOTA: aceptamos RefObject<T | null> para evitar errores de tipos con useRef(..., null).
 */
export function useOnClickOutside<T extends HTMLElement>(
    ref: React.RefObject<T | null>,
    handler: (event?: Event) => void,
    when = true,
    opts?: { debug?: boolean }
) {
    // Guardamos la última versión del handler para no re-registrar listeners cada render.
    const savedHandler = useRef(handler);
    useEffect(() => {
        savedHandler.current = handler;
    }, [handler]);

    useEffect(() => {
        if (!when) return;

        // Handler para eventos pointer/touch/mouse
        const onPointer = (event: Event) => {
            try {
                const el = ref?.current;
                if (!el) {
                    if (opts?.debug) console.debug("[useOnClickOutside] ref.current es null");
                    return;
                }

                // Intentamos composedPath() (mejor para portales / shadow DOM)
                const path = (event as any).composedPath?.() || (event as any).path;

                if (opts?.debug) {
                    console.debug("[useOnClickOutside] event type:", event.type);
                    console.debug("[useOnClickOutside] event.target:", event.target);
                    if (path) console.debug("[useOnClickOutside] composedPath length:", path.length);
                }

                if (path) {
                    // Si el elemento observado aparece en el path -> click dentro -> ignorar
                    if (path.includes(el)) {
                        if (opts?.debug) console.debug("[useOnClickOutside] click DENTRO (composedPath)");
                        return;
                    }
                } else {
                    // Fallback: contains
                    if (el.contains(event.target as Node)) {
                        if (opts?.debug) console.debug("[useOnClickOutside] click DENTRO (contains)");
                        return;
                    }
                }

                // Si llegamos aquí, el click fue fuera -> ejecutamos handler
                if (opts?.debug) console.debug("[useOnClickOutside] click FUERA -> executing handler");
                savedHandler.current(event);
            } catch (err) {
                // Protegemos contra posibles errores en composedPath, etc.
                if (opts?.debug) console.error("[useOnClickOutside] error in onPointer", err);
            }
        };

        // Handler para Escape
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                if (opts?.debug) console.debug("[useOnClickOutside] Escape pressed -> executing handler");
                savedHandler.current(event);
            }
        };

        // Registramos listeners en fase de captura para evitar que stopPropagation prevenga nuestra captura.
        document.addEventListener("pointerdown", onPointer, { capture: true });
        document.addEventListener("touchstart", onPointer, { capture: true });
        // Fallbacks por compatibilidad: mousedown/click (opcional)
        document.addEventListener("mousedown", onPointer, { capture: true });
        // Teclado en burbuja está bien
        document.addEventListener("keydown", onKey);

        return () => {
            document.removeEventListener("pointerdown", onPointer, { capture: true } as any);
            document.removeEventListener("touchstart", onPointer, { capture: true } as any);
            document.removeEventListener("mousedown", onPointer, { capture: true } as any);
            document.removeEventListener("keydown", onKey);
        };
    }, [ref, when, opts?.debug]);
}
