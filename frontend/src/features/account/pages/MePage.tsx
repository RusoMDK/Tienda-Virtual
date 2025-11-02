import Container from "@/layout/Container";
import { Button } from "@/ui";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useNavigate } from "react-router-dom";

export default function MePage() {
  const nav = useNavigate();
  const setToken = useAuthStore((s) => s.setToken);
  const setUser = useAuthStore((s) => s.setUser);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get("/me")).data as { id: string; email: string; name?: string | null; role: string },
    retry: (count, err: any) => {
      const st = err?.response?.status;
      if (st === 401) return false;
      return count < 2;
    },
  });

  async function logout() {
    try { await api.post("/auth/logout"); } catch {}
    setToken(null);
    setUser(null);
    nav("/");
  }

  return (
    <Container className="py-10 max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Mi cuenta</h2>
        <Button variant="secondary" onClick={logout}>Salir</Button>
      </div>

      {isLoading && <div className="opacity-70">Cargando…</div>}
      {isError && (
        <div className="rounded-2xl border border-red-900/40 bg-red-900/10 p-4">
          <div className="text-sm">No pudimos cargar tu perfil.</div>
          <div className="mt-2">
            <Button size="sm" onClick={() => refetch()}>Reintentar</Button>
          </div>
        </div>
      )}

      {data && (
        <div className="rounded-2xl border border-zinc-800 bg-[var(--card)] p-5 space-y-2">
          <div><span className="opacity-70 text-sm">Email:</span> <b>{data.email}</b></div>
          <div><span className="opacity-70 text-sm">Nombre:</span> <b>{data.name || "—"}</b></div>
          <div><span className="opacity-70 text-sm">Rol:</span> <b>{data.role}</b></div>
        </div>
      )}
    </Container>
  );
}
