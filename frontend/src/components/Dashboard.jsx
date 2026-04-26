import React, { useEffect, useState, useCallback } from "react";
import { Package, AlertTriangle, Ticket, TrendingDown, Truck, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api, fmtNumber, fmtDate, cn } from "@/lib/api";
import { SituacaoBadge } from "@/components/StatusBadge";

// --- Static recharts config (kept outside component to avoid re-renders) ---
const CHART_MARGIN = { top: 8, right: 16, left: 0, bottom: 24 };
const AXIS_TICK = { fontSize: 12, fill: "#52525B" };
const TOOLTIP_STYLE = {
  border: "1px solid #09090B",
  borderRadius: 0,
  fontSize: 12,
  padding: 12,
  background: "#fff",
};
const TOOLTIP_CURSOR = { fill: "rgba(9,9,11,0.04)" };
const BAR_RADIUS = [2, 2, 0, 0];

const ACCENT_MAP = {
  default: "text-zinc-900",
  danger: "text-rose-700",
  warn: "text-amber-700",
  ok: "text-emerald-700",
};

function KpiCard({ label, value, delta, icon: Icon, accent = "default", testId }) {
  return (
    <div
      data-testid={testId}
      className="border border-zinc-200 bg-white p-5 sm:p-6 hover:border-zinc-400 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] font-semibold text-zinc-500">
            {label}
          </div>
          <div className={cn("mt-3 font-display text-4xl sm:text-5xl font-black tabular-nums", ACCENT_MAP[accent])}>
            {value}
          </div>
          {delta && <div className="mt-2 text-xs text-zinc-500">{delta}</div>}
        </div>
        <div className="shrink-0 w-9 h-9 border border-zinc-200 bg-zinc-50 flex items-center justify-center">
          <Icon className={cn("w-4 h-4", ACCENT_MAP[accent])} strokeWidth={2.2} />
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="w-3 h-3 rounded-sm" style={{ background: color }} /> {label}
    </span>
  );
}

const LEGEND_ITEMS = [
  { color: "#27272a", label: "Total" },
  { color: "#be123c", label: "Atrasados" },
  { color: "#d97706", label: "Chamados" },
];

function ChartByCarrier({ data }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={CHART_MARGIN}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#e4e4e7" />
          <XAxis dataKey="forma_envio" tick={AXIS_TICK} stroke="#a1a1aa" axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_TICK} stroke="#a1a1aa" axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={TOOLTIP_CURSOR} />
          <Bar dataKey="total" fill="#27272a" name="Total" radius={BAR_RADIUS} />
          <Bar dataKey="late" fill="#be123c" name="Atrasados" radius={BAR_RADIUS} />
          <Bar dataKey="open_tickets" fill="#d97706" name="Chamados" radius={BAR_RADIUS} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-zinc-600">
        {LEGEND_ITEMS.map((l) => (
          <Legend key={l.label} color={l.color} label={l.label} />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ onAction }) {
  return (
    <div className="text-center py-12">
      <p className="text-sm text-zinc-500 mb-4">Nenhum dado para exibir. Importe uma planilha para começar.</p>
      <button
        data-testid="empty-import-cta"
        onClick={onAction}
        className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-sm px-4 py-2 font-medium text-sm"
      >
        Importar planilha
      </button>
    </div>
  );
}

function DeliveriesTable({ rows, onOpenTicket }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="dashboard-late-table">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-200">
            <th className="text-left px-5 py-3 font-semibold">Rastreamento</th>
            <th className="text-left px-3 py-3 font-semibold">Destinatário</th>
            <th className="text-left px-3 py-3 font-semibold">Forma</th>
            <th className="text-left px-3 py-3 font-semibold">Situação</th>
            <th className="text-left px-3 py-3 font-semibold">Previsão</th>
            <th className="text-right px-3 py-3 font-semibold">Atraso</th>
            <th className="text-right px-5 py-3 font-semibold">Ação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="row-late border-b border-rose-100" data-testid={`row-late-${r.id}`}>
              <td className="px-5 py-3 font-mono-data text-xs">{r.codigo_rastreamento || "—"}</td>
              <td className="px-3 py-3">
                <div className="font-medium text-zinc-900">{r.destinatario || "—"}</div>
                <div className="text-xs text-zinc-500">
                  {r.cidade}/{r.uf}
                </div>
              </td>
              <td className="px-3 py-3 text-zinc-700">{r.forma_envio}</td>
              <td className="px-3 py-3">
                <SituacaoBadge situacao={r.situacao} />
              </td>
              <td className="px-3 py-3 font-mono-data text-xs">{fmtDate(r.previsao_entrega)}</td>
              <td className="px-3 py-3 text-right">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-rose-100 text-rose-800 text-xs font-bold tabular-nums">
                  {r.days_late}d
                </span>
              </td>
              <td className="px-5 py-3 text-right">
                <button
                  data-testid={`open-ticket-btn-${r.id}`}
                  onClick={() => onOpenTicket(r)}
                  className="text-xs font-semibold border border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800 px-3 py-1.5 rounded-sm transition-colors"
                >
                  Abrir Chamado
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartSection({ loading, data, onGoToImport }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (data.length === 0) {
    return <EmptyState onAction={onGoToImport} />;
  }
  return <ChartByCarrier data={data} />;
}

function HighlightsSection({ loading, rows, empty, onOpenTicket }) {
  if (loading) {
    return (
      <div className="p-12 text-center text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin inline" />
      </div>
    );
  }
  if (rows.length === 0) {
    const message = empty
      ? "Nenhum atraso identificado. Importe uma planilha para começar."
      : "Nenhum atraso identificado. Bom trabalho.";
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-zinc-500">{message}</p>
      </div>
    );
  }
  return <DeliveriesTable rows={rows} onOpenTicket={onOpenTicket} />;
}

export default function Dashboard({ onOpenTicket, onGoToImport, refreshKey }) {
  const [stats, setStats] = useState(null);
  const [byCarrier, setByCarrier] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c, h] = await Promise.all([
        api.get("/dashboard/stats"),
        api.get("/dashboard/by-carrier"),
        api.get("/orders/late/highlights", { params: { limit: 8 } }),
      ]);
      setStats(s.data);
      setByCarrier(c.data || []);
      setHighlights(h.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const empty = stats && stats.total_orders === 0;

  return (
    <div className="space-y-8" data-testid="dashboard-view">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          testId="kpi-total"
          label="Total de Pedidos"
          value={loading ? "—" : fmtNumber(stats?.total_orders ?? 0)}
          icon={Package}
        />
        <KpiCard
          testId="kpi-late"
          label="Em Atraso"
          value={loading ? "—" : fmtNumber(stats?.late_orders ?? 0)}
          icon={AlertTriangle}
          accent="danger"
        />
        <KpiCard
          testId="kpi-tickets"
          label="Chamados Abertos"
          value={loading ? "—" : fmtNumber(stats?.open_tickets ?? 0)}
          icon={Ticket}
          accent="warn"
        />
        <KpiCard
          testId="kpi-rate"
          label="Taxa de Atraso"
          value={loading ? "—" : `${stats?.late_rate ?? 0}%`}
          icon={TrendingDown}
          accent={stats && stats.late_rate > 20 ? "danger" : "default"}
        />
      </div>

      <section className="border border-zinc-200 bg-white">
        <header className="px-5 py-4 border-b border-zinc-200 flex items-baseline justify-between">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight">Atrasos por Forma de Envio</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Distribuição de pedidos atrasados e chamados abertos por parceiro logístico
            </p>
          </div>
          <Truck className="w-5 h-5 text-zinc-400" />
        </header>
        <div className="p-5">
          <ChartSection loading={loading} data={byCarrier} onGoToImport={onGoToImport} />
        </div>
      </section>

      <section className="border border-zinc-200 bg-white">
        <header className="px-5 py-4 border-b border-zinc-200 flex items-baseline justify-between">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight">Entregas atrasadas em destaque</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Linhas em vermelho indicam atraso. Clique em "Abrir Chamado" para notificar a transportadora.
            </p>
          </div>
          <span className="text-xs text-zinc-500 font-mono-data">Top {highlights.length}</span>
        </header>
        <HighlightsSection
          loading={loading}
          rows={highlights}
          empty={empty}
          onOpenTicket={onOpenTicket}
        />
      </section>
    </div>
  );
}
