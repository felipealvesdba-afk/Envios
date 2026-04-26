import React from "react";
import { cn } from "@/lib/api";

const styleMap = {
  late: "bg-rose-50 text-rose-700 border-rose-200",
  on_time: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  excluded: "bg-zinc-100 text-zinc-600 border-zinc-200",
  default: "bg-zinc-100 text-zinc-700 border-zinc-200",
};

const labelMap = {
  late: "Atrasado",
  on_time: "No prazo",
  pending: "Pendente",
  excluded: "Excluído",
};

export function StatusBadge({ bucket, situacao, className }) {
  const variant = styleMap[bucket] || styleMap.default;
  return (
    <span
      data-testid={`status-badge-${bucket || "default"}`}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-semibold uppercase tracking-wider",
        variant,
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {labelMap[bucket] || situacao || "—"}
    </span>
  );
}

export function SituacaoBadge({ situacao }) {
  const s = (situacao || "").toLowerCase();
  let cls = "bg-zinc-100 text-zinc-700 border-zinc-200";
  if (s.includes("entregue")) cls = "bg-emerald-50 text-emerald-700 border-emerald-200";
  else if (s.includes("nova")) cls = "bg-blue-50 text-blue-700 border-blue-200";
  else if (s.includes("postad") || s.includes("trans")) cls = "bg-violet-50 text-violet-700 border-violet-200";
  else if (s.includes("cancel") || s.includes("devolv") || s.includes("extrav"))
    cls = "bg-zinc-100 text-zinc-500 border-zinc-200";
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-sm border text-xs font-medium", cls)}>
      {situacao || "—"}
    </span>
  );
}
