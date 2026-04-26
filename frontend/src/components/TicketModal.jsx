import React, { useState } from "react";
import { api } from "@/lib/api";
import { X, Loader2, Send, AlertTriangle } from "lucide-react";

export default function TicketModal({ order, onClose, onCreated }) {
  const [motivo, setMotivo] = useState(
    order ? `Atraso de ${order.days_late || 0} dia(s) na entrega - ${order.codigo_rastreamento || ""}` : ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!order) return null;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/tickets", { order_id: order.id, motivo });
      onCreated?.();
      onClose?.();
    } catch (e) {
      setError(e?.response?.data?.detail || "Falha ao criar chamado.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm p-4">
      <div
        data-testid="ticket-modal"
        className="bg-white border border-zinc-200 w-full max-w-lg shadow-2xl"
      >
        <header className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-700" />
            <h3 className="font-display text-lg font-bold tracking-tight">Abrir Chamado</h3>
          </div>
          <button
            data-testid="ticket-modal-close"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-900 p-1"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Rastreamento" value={order.codigo_rastreamento} mono />
            <Field label="Forma" value={order.forma_envio} />
            <Field label="Destinatário" value={order.destinatario} />
            <Field label="Atraso" value={`${order.days_late} dia(s)`} accent="text-rose-700" />
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-[0.2em] font-semibold text-zinc-500">
              Motivo / Observação
            </label>
            <textarea
              data-testid="ticket-motivo-input"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-sm border border-zinc-300 bg-white p-3 text-sm focus:outline-none focus:border-zinc-900 resize-none"
              placeholder="Descreva o motivo do chamado..."
            />
          </div>

          {error && (
            <div data-testid="ticket-modal-error" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <footer className="px-5 py-4 border-t border-zinc-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-sm px-4 py-2 border border-zinc-300 hover:bg-zinc-50 rounded-sm"
          >
            Cancelar
          </button>
          <button
            data-testid="ticket-modal-submit"
            onClick={submit}
            disabled={submitting || !motivo.trim()}
            className="inline-flex items-center gap-2 text-sm font-semibold bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-zinc-400 px-4 py-2 rounded-sm"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Confirmar Chamado
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, value, mono, accent }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-zinc-500">{label}</div>
      <div className={`mt-0.5 ${mono ? "font-mono-data text-xs" : "text-sm"} ${accent || "text-zinc-900"} font-medium break-words`}>
        {value || "—"}
      </div>
    </div>
  );
}
