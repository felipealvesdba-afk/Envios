import React, { useState } from "react";
import "@/App.css";
import { LayoutDashboard, AlertTriangle, Ticket as TicketIcon, UploadCloud, Truck } from "lucide-react";
import Dashboard from "@/components/Dashboard";
import LateDeliveries from "@/components/LateDeliveries";
import Tickets from "@/components/Tickets";
import ImportCSV from "@/components/ImportCSV";
import TicketModal from "@/components/TicketModal";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "late", label: "Entregas Atrasadas", icon: AlertTriangle },
  { id: "tickets", label: "Chamados", icon: TicketIcon },
  { id: "import", label: "Importar", icon: UploadCloud },
];

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [ticketOrder, setTicketOrder] = useState(null);

  const refreshAll = () => setRefreshKey((k) => k + 1);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-zinc-900 text-white flex items-center justify-center">
                <Truck className="w-5 h-5" strokeWidth={2.2} />
              </div>
              <div>
                <h1 className="font-display text-base sm:text-lg font-black tracking-tight leading-none">
                  Delivery Tracker
                </h1>
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-semibold mt-0.5">
                  Monitor de SLA logístico
                </div>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-[11px] uppercase tracking-[0.2em] font-semibold text-zinc-500">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Operacional
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-1 -mb-px" aria-label="Navegação principal">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                data-testid={`tab-${id}`}
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  tab === id
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-500 hover:text-zinc-900"
                }`}
              >
                <Icon className="w-4 h-4" strokeWidth={2.2} />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {tab === "dashboard" && (
          <Dashboard
            refreshKey={refreshKey}
            onOpenTicket={(order) => setTicketOrder(order)}
            onGoToImport={() => setTab("import")}
          />
        )}
        {tab === "late" && (
          <LateDeliveries
            refreshKey={refreshKey}
            onOpenTicket={(order) => setTicketOrder(order)}
          />
        )}
        {tab === "tickets" && <Tickets refreshKey={refreshKey} onChange={refreshAll} />}
        {tab === "import" && (
          <ImportCSV
            onImported={() => {
              refreshAll();
              setTab("dashboard");
            }}
          />
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-semibold">
        © {new Date().getFullYear()} Delivery Tracker · Operações
      </footer>

      {ticketOrder && (
        <TicketModal
          order={ticketOrder}
          onClose={() => setTicketOrder(null)}
          onCreated={() => {
            refreshAll();
          }}
        />
      )}
    </div>
  );
}
