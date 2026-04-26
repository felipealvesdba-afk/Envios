import React, { useEffect, useMemo, useState } from "react";
import { Search, Download, Filter, Loader2 } from "lucide-react";
import { api, fmtDate, fmtNumber, API } from "@/lib/api";
import { SituacaoBadge } from "@/components/StatusBadge";

export default function LateDeliveries({ onOpenTicket, refreshKey }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [forma, setForma] = useState("");
  const [situacao, setSituacao] = useState("");
  const [filterOptions, setFilterOptions] = useState({ forma_envio: [], situacao: [] });

  const load = async () => {
    setLoading(true);
    try {
      const params = { late_only: true, limit: 1000 };
      if (q) params.q = q;
      if (forma) params.forma_envio = forma;
      if (situacao) params.situacao = situacao;
      const { data } = await api.get("/orders", { params });
      setRows(data.items || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  };

  const loadFilters = async () => {
    try {
      const { data } = await api.get("/orders/filters");
      setFilterOptions(data);
    } catch {}
  };

  useEffect(() => {
    loadFilters();
  }, [refreshKey]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, forma, situacao, refreshKey]);

  const downloadReport = () => {
    window.open(`${API}/report/late.csv`, "_blank");
  };

  return (
    <div className="space-y-6" data-testid="late-view">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Entregas Atrasadas</h2>
          <p className="text-sm text-zinc-500 mt-1">
            {fmtNumber(total)} entrega(s) em atraso. Use os filtros para refinar a análise.
          </p>
        </div>
        <button
          data-testid="download-report-btn"
          onClick={downloadReport}
          disabled={total === 0}
          className="inline-flex items-center gap-2 bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-zinc-300 disabled:cursor-not-allowed rounded-sm px-4 py-2 font-medium text-sm transition-colors"
        >
          <Download className="w-4 h-4" /> Exportar Relatório (.csv)
        </button>
      </div>

      <div className="border border-zinc-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-6">
          <label className="text-[11px] uppercase tracking-[0.2em] font-semibold text-zinc-500">Busca</label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              data-testid="late-search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nome, código, OS, cidade..."
              className="w-full h-10 rounded-sm border border-zinc-300 bg-white pl-9 pr-3 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900"
            />
          </div>
        </div>
        <div className="sm:col-span-3">
          <label className="text-[11px] uppercase tracking-[0.2em] font-semibold text-zinc-500">Forma de envio</label>
          <select
            data-testid="filter-forma-envio"
            value={forma}
            onChange={(e) => setForma(e.target.value)}
            className="mt-1 w-full h-10 rounded-sm border border-zinc-300 bg-white px-3 text-sm focus:outline-none focus:border-zinc-900"
          >
            <option value="">Todas</option>
            {filterOptions.forma_envio.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-3">
          <label className="text-[11px] uppercase tracking-[0.2em] font-semibold text-zinc-500">Situação</label>
          <select
            data-testid="filter-situacao"
            value={situacao}
            onChange={(e) => setSituacao(e.target.value)}
            className="mt-1 w-full h-10 rounded-sm border border-zinc-300 bg-white px-3 text-sm focus:outline-none focus:border-zinc-900"
          >
            <option value="">Todas</option>
            {filterOptions.situacao.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="border border-zinc-200 bg-white">
        {loading ? (
          <div className="p-12 text-center text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin inline" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-zinc-500">
            Nenhuma entrega atrasada com os filtros atuais.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="late-table">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-200 bg-zinc-50">
                  <th className="text-left px-4 py-3 font-semibold">Rastreamento</th>
                  <th className="text-left px-3 py-3 font-semibold">Loja</th>
                  <th className="text-left px-3 py-3 font-semibold">Destinatário</th>
                  <th className="text-left px-3 py-3 font-semibold">Forma</th>
                  <th className="text-left px-3 py-3 font-semibold">Situação</th>
                  <th className="text-left px-3 py-3 font-semibold">Envio</th>
                  <th className="text-left px-3 py-3 font-semibold">Previsão</th>
                  <th className="text-right px-3 py-3 font-semibold">Atraso</th>
                  <th className="text-right px-4 py-3 font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="row-late border-b border-rose-100"
                    data-testid={`late-row-${r.id}`}
                  >
                    <td className="px-4 py-2.5 font-mono-data text-xs whitespace-nowrap">{r.codigo_rastreamento || "—"}</td>
                    <td className="px-3 py-2.5 text-zinc-700">{r.loja || "—"}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-zinc-900">{r.destinatario || "—"}</div>
                      <div className="text-xs text-zinc-500">
                        {r.cidade}/{r.uf}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-zinc-700">{r.forma_envio}</td>
                    <td className="px-3 py-2.5"><SituacaoBadge situacao={r.situacao} /></td>
                    <td className="px-3 py-2.5 font-mono-data text-xs whitespace-nowrap">{fmtDate(r.data_envio)}</td>
                    <td className="px-3 py-2.5 font-mono-data text-xs whitespace-nowrap">{fmtDate(r.previsao_entrega)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-rose-100 text-rose-800 text-xs font-bold tabular-nums">
                        {r.days_late}d
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        data-testid={`late-open-ticket-${r.id}`}
                        onClick={() => onOpenTicket(r)}
                        className="text-xs font-semibold border border-zinc-900 bg-white hover:bg-zinc-900 hover:text-white text-zinc-900 px-3 py-1.5 rounded-sm transition-colors"
                      >
                        Abrir Chamado
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
