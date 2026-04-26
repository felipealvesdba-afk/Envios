import React, { useEffect, useState, useCallback } from "react";
import { Loader2, CheckCircle2, Clock, Inbox, Trash2 } from "lucide-react";
import { api } from "@/lib/api";

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

const FILTERS = [
  { id: "", label: "Todos" },
  { id: "aberto", label: STATUS_LABEL.aberto },
  { id: "em_andamento", label: STATUS_LABEL.em_andamento },
  { id: "resolvido", label: STATUS_LABEL.resolvido },
];

function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-semibold uppercase tracking-wider ${STATUS_STYLE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function TicketCard({ ticket, onUpdate, onDelete }) {
  return (
    <article
      data-testid={`ticket-${ticket.id}`}
      className="border border-zinc-200 bg-white p-4 hover:border-zinc-400 transition-colors"
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="font-mono-data text-xs text-zinc-500">{ticket.codigo_rastreamento || "—"}</div>
          <h3 className="font-display text-lg font-bold tracking-tight mt-0.5">{ticket.destinatario || "—"}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            {ticket.loja} • {ticket.cidade}/{ticket.uf}
          </p>
        </div>
        <StatusPill status={ticket.status} />
      </header>

      <div className="grid grid-cols-2 gap-3 text-xs mb-3">
        <div>
          <div className="text-zinc-500 uppercase tracking-wider text-[10px]">Forma</div>
          <div className="font-medium text-zinc-800 mt-0.5">{ticket.forma_envio || "—"}</div>
        </div>
        <div>
          <div className="text-zinc-500 uppercase tracking-wider text-[10px]">Atraso</div>
          <div className="font-medium text-rose-700 mt-0.5">{ticket.days_late || 0} dia(s)</div>
        </div>
      </div>

      <p className="text-sm text-zinc-700 mb-3 line-clamp-2">{ticket.motivo}</p>

      <footer className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-[11px] text-zinc-500">
          <Clock className="w-3 h-3" />
          {new Date(ticket.created_at).toLocaleString("pt-BR")}
        </div>
        <div className="flex items-center gap-1">
          {ticket.status === "aberto" && (
            <button
              data-testid={`ticket-progress-${ticket.id}`}
              onClick={() => onUpdate(ticket.id, "em_andamento")}
              className="text-xs px-2.5 py-1 border border-zinc-300 hover:border-zinc-900 hover:bg-zinc-50 rounded-sm"
            >
              Em andamento
            </button>
          )}
          {ticket.status !== "resolvido" && (
            <button
              data-testid={`ticket-resolve-${ticket.id}`}
              onClick={() => onUpdate(ticket.id, "resolvido")}
              className="text-xs px-2.5 py-1 border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 rounded-sm inline-flex items-center gap-1"
            >
              <CheckCircle2 className="w-3 h-3" /> Resolver
            </button>
          )}
          <button
            data-testid={`ticket-delete-${ticket.id}`}
            onClick={() => onDelete(ticket.id)}
            className="text-xs px-2 py-1 text-zinc-500 hover:text-rose-700"
            aria-label="Excluir chamado"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </footer>
    </article>
  );
}

function TicketsContent({ loading, tickets, filter, onUpdate, onDelete }) {
  if (loading) {
    return (
      <div className="border border-zinc-200 bg-white p-12 text-center text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin inline" />
      </div>
    );
  }
  if (tickets.length === 0) {
    return (
      <div className="border border-zinc-200 bg-white p-16 text-center">
        <Inbox className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
        <p className="text-sm text-zinc-500">
          Nenhum chamado registrado{filter ? " com este status." : "."}
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {tickets.map((t) => (
        <TicketCard key={t.id} ticket={t} onUpdate={onUpdate} onDelete={onDelete} />
      ))}
    </div>
  );
}

export default function Tickets({ refreshKey, onChange }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter ? { status: filter } : {};
      const { data } = await api.get("/tickets", { params });
      setTickets(data || []);
    } catch (err) {
      console.error("Erro ao carregar chamados", err);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

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
          {FILTERS.map((f) => (
            <button
              key={f.id || "all"}
              data-testid={`tickets-filter-${f.id || "all"}`}
              onClick={() => setFilter(f.id)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-sm transition-colors ${
                filter === f.id ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <TicketsContent
        loading={loading}
        tickets={tickets}
        filter={filter}
        onUpdate={updateStatus}
        onDelete={remove}
      />
    </div>
  );
}
