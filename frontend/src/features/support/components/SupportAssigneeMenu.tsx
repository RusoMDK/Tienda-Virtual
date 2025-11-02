// src/features/support/components/SupportAssigneeMenu.tsx
import { useEffect, useMemo, useState } from "react";
import { listAgents, assignConversation } from "../api";
import type { UserLite } from "../types";
import { useToast, Button, Input } from "@/ui";
import { Loader2, UserPlus2, UserMinus2, Search } from "lucide-react";
import { useAuthStore } from "@/store/auth";

export default function SupportAssigneeMenu({
  conversationId,
  currentAssignee,
  onChanged,
}: {
  conversationId: string;
  currentAssignee: UserLite | null | undefined;
  onChanged?: (u: UserLite | null) => void;
}) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<UserLite[]>([]);
  const toast = useToast();
  const me = useAuthStore((s) => s.me);

  async function load() {
    setLoading(true);
    try {
      const res = await listAgents({ q, ps: 10 });
      setList(res.items);
    } catch {
      toast({ title: "No se pudieron cargar agentes", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  // carga inicial
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // búsqueda con Enter o botón (no spamea)
  const canSelfAssign = useMemo(() => {
    const role = me?.role;
    return role === "ADMIN" || role === "SUPPORT";
  }, [me?.role]);

  async function handleAssign(agentId: string | null) {
    try {
      await assignConversation(conversationId, agentId);
      const newAssignee = agentId
        ? list.find((u) => u.id === agentId) ?? currentAssignee ?? null
        : null;
      onChanged?.(newAssignee);
      toast({
        title: agentId ? "Conversación asignada" : "Asignación quitada",
        variant: "success",
      });
    } catch {
      toast({ title: "No se pudo asignar", variant: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs opacity-70">Asignación</div>

      {/* Actual */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))]">
        <div className="text-sm min-w-0">
          {currentAssignee ? (
            <>
              <span className="font-medium truncate">
                {currentAssignee.name || currentAssignee.email}
              </span>
              <span className="opacity-70"> ({currentAssignee.email})</span>
            </>
          ) : (
            <span className="opacity-70">Sin asignar</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canSelfAssign && (
            <Button
              size="sm"
              onClick={() => handleAssign(me?.id ?? null)}
              title="Asignarme"
            >
              <UserPlus2 size={14} className="mr-1" />
              Asignarme
            </Button>
          )}
          {currentAssignee && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleAssign(null)}
              title="Quitar asignación"
            >
              <UserMinus2 size={14} className="mr-1" />
              Quitar
            </Button>
          )}
        </div>
      </div>

      {/* Buscador */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 opacity-70"
          />
          <Input
            className="pl-8 w-full"
            placeholder="Buscar agente por nombre o email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter") await load();
            }}
          />
        </div>
        <Button variant="secondary" onClick={load} disabled={loading}>
          Buscar
        </Button>
      </div>

      <div className="rounded-xl border border-[rgb(var(--border-rgb))] overflow-hidden">
        {loading ? (
          <div className="p-3 text-sm flex items-center gap-2 opacity-70">
            <Loader2 className="animate-spin" size={16} />
            Cargando…
          </div>
        ) : list.length === 0 ? (
          <div className="p-3 text-sm opacity-70">Sin resultados.</div>
        ) : (
          <ul className="max-h-64 overflow-auto divide-y divide-[rgb(var(--border-rgb))]">
            {list.map((u) => (
              <li
                key={u.id}
                className="p-2 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {u.name || u.email}
                  </div>
                  <div className="text-xs opacity-70 truncate">{u.email}</div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAssign(u.id)}
                  title="Asignar a este agente"
                >
                  <UserPlus2 size={14} className="mr-1" />
                  Asignar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
