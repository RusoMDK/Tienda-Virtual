// src/hooks/useAuthBootstrap.ts
import { useEffect, useRef } from "react";
import { useAuth } from "./useAuth";

/**
 * Ejecuta un refresh inicial una sola vez al montar la app.
 * Evita bucles y tormentas de /auth/refresh.
 * Si no hay cookie de refresh, simplemente no hace nada.
 */
export function useAuthBootstrap() {
  const { refresh } = useAuth();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return; // asegura 1 sola ejecución
    ranRef.current = true;

    let canceled = false;
    (async () => {
      try {
        await refresh(); // usa la cookie HttpOnly para obtener un access token
      } catch {
        // Ignorar: no tener sesión también es un estado válido
      } finally {
        if (canceled) return;
        // opcional: aquí podrías marcar un flag "bootstrapped" en un store si lo necesitas
      }
    })();

    return () => {
      canceled = true;
    };
  }, [refresh]);
}
