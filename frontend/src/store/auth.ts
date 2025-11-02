// src/store/auth.ts
import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";

type Role = "ADMIN" | "CUSTOMER";
export type User = { id: string; email: string; name?: string | null; role: Role };

type AuthState = {
  /** indica que ya rehidrató desde localStorage (útil para gates de UI) */
  hydrated: boolean;

  /** JWT de acceso en memoria (no en cookie) */
  accessToken: string | null;

  /** usuario logueado (para pintar header, etc.) */
  user: User | null;

  /** setters */
  setToken: (t: string | null) => void;
  setUser: (u: User | null) => void;

  /** limpia token + user (solo front) */
  logoutLocal: () => void;

  /** marca rehidratación completa */
  markHydrated: () => void;
};

const storage: StateStorage = {
  getItem: (name) => {
    const v = localStorage.getItem(name);
    return v ?? null;
  },
  setItem: (name, value) => {
    localStorage.setItem(name, value);
  },
  removeItem: (name) => {
    localStorage.removeItem(name);
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      hydrated: false,
      accessToken: null,
      user: null,

      setToken: (t) => set({ accessToken: t }),
      setUser: (u) => set({ user: u }),

      logoutLocal: () => {
        set({ accessToken: null, user: null });
      },

      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "auth",
      storage: createJSONStorage(() => storage),
      version: 1,
      /** solo persistimos lo necesario */
      partialize: (s) => ({ accessToken: s.accessToken, user: s.user }),
      /** señal para saber que ya cargó desde storage */
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    }
  )
);

/** Helpers de conveniencia para usar fuera de componentes (interceptors, etc.) */
export const authSelectors = {
  token: () => useAuthStore.getState().accessToken,
  user: () => useAuthStore.getState().user,
  isAuthed: () => !!useAuthStore.getState().accessToken,
};

/** Limpieza total del persist (por si necesitas un “panic logout”) */
export function resetAuthPersist() {
  useAuthStore.persist?.clearStorage?.();
  useAuthStore.setState({ accessToken: null, user: null });
}
