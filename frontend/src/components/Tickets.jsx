import React, { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Clock, Inbox, Trash2 } from "lucide-react";
import { api, fmtDate } from "@/lib/api";

const STATUS_LABEL = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
};

const STATUS_STYLE = {
  aberto: "bg-rose-50 text-rose-700 border-rose-200",
  em_andamento: "bg-amber-50 text-amber-800 border-amber-200",
  resolvido: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function Tickets({ refreshKey, onChange }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params = filter ? { status: filter } : {};
      const { data } = await api.get("/tickets", { params });
      setTickets(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [filter, refreshKey]);

  const updateStatus = async (id, status) => {
    await api.patch(`/tickets/${id}`, { status });
    await load();
    onChange?.();
  };

  const remove = async (id) => {
    await api.delete(`/tickets/${id}`);
    await load();
    onChange?.();
  };

  return (
    <div className="space-y-6" data-testid="tickets-view">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Chamados</h2>
          <p className="text-sm text-zinc-500 mt-1">Notificações abertas para as transportadoras.</p>
        </div>
        <div className="flex items-center gap-1 border border-zinc-200 bg-white p-1 rounded-sm">
          {["", "aberto", "em_andamento", "resolvido"].map((s) => (
            <button
              key={s || "all"}
              data-testid={`tickets-filter-${s || "all"}`}
              onClick={() => setFilter(s)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-sm transition-colors ${
                filter === s ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              {s ? STATUS_LABEL[s] : "Todos"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="border border-zinc-200 bg-white p-12 text-center text-zinc-400">
          <Loader2 className="w-5 h-5 animate-spin inline" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="border border-zinc-200 bg-white p-16 text-center">
          <Inbox className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Nenhum chamado registrado{filter ? " com este status." : "."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tickets.map((t) => (
            <article
              key={t.id}
              data-testid={`ticket-${t.id}`}
              className="border border-zinc-200 bg-white p-4 hover:border-zinc-400 transition-colors"
            >
              <header className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="font-mono-data text-xs text-zinc-500">{t.codigo_rastreamento || "—"}</div>
                  <h3 className="font-display text-lg font-bold tracking-tight mt-0.5">{t.destinatario || "—"}</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {t.loja} • {t.cidade}/{t.uf}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-semibold uppercase tracking-wider ${
                    STATUS_STYLE[t.status]
                  }`}
                >
                  {STATUS_LABEL[t.status]}
                </span>
              </header>

              <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                <div>
                  <div className="text-zinc-500 uppercase tracking-wider text-[10px]">Forma</div>
                  <div className="font-medium text-zinc-800 mt-0.5">{t.forma_envio || "—"}</div>
                </div>
                <div>
                  <div className="text-zinc-500 uppercase tracking-wider text-[10px]">Atraso</div>
                  <div className="font-medium text-rose-700 mt-0.5">{t.days_late || 0} dia(s)</div>
                </div>
              </div>

              <p className="text-sm text-zinc-700 mb-3 line-clamp-2">{t.motivo}</p>

              <footer className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                  <Clock className="w-3 h-3" />
                  {new Date(t.created_at).toLocaleString("pt-BR")}
                </div>
                <div className="flex items-center gap-1">
                  {t.status !== "em_andamento" && t.status !== "resolvido" && (
                    <button
                      data-testid={`ticket-progress-${t.id}`}
                      onClick={() => updateStatus(t.id, "em_andamento")}
                      className="text-xs px-2.5 py-1 border border-zinc-300 hover:border-zinc-900 hover:bg-zinc-50 rounded-sm"
                    >
                      Em andamento
                    </button>
                  )}
                  {t.status !== "resolvido" && (
                    <button
                      data-testid={`ticket-resolve-${t.id}`}
                      onClick={() => updateStatus(t.id, "resolvido")}
                      className="text-xs px-2.5 py-1 border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 rounded-sm inline-flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Resolver
                    </button>
                  )}
                  <button
                    data-testid={`ticket-delete-${t.id}`}
                    onClick={() => remove(t.id)}
                    className="text-xs px-2 py-1 text-zinc-500 hover:text-rose-700"
                    aria-label="Excluir chamado"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
