import React, { useRef, useState } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, Trash2 } from "lucide-react";
import { api } from "@/lib/api";

export default function ImportCSV({ onImported }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const onPick = () => inputRef.current?.click();

  const onFiles = (files) => {
    setError(null);
    setResult(null);
    const f = files?.[0];
    if (!f) return;
    if (!/\.(csv|txt)$/i.test(f.name)) {
      setError("Selecione um arquivo .csv válido.");
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/import/csv", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
      onImported?.(data);
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message || "Falha ao importar.";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setUploading(false);
    }
  };

  const clearAll = async () => {
    if (!window.confirm("Remover todos os pedidos e chamados importados?")) return;
    await api.delete("/import");
    setFile(null);
    setResult(null);
    onImported?.({ cleared: true });
  };

  return (
    <div className="space-y-6 max-w-3xl" data-testid="import-view">
      <div>
        <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Importar Planilha</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Envie o relatório de SLA em formato <span className="font-mono-data">.csv</span>. Aceitamos delimitador
          <span className="font-mono-data"> ; </span>ou
          <span className="font-mono-data"> , </span>, codificação UTF-8 ou Latin-1, datas no formato DD/MM/AAAA.
        </p>
      </div>

      <div
        data-testid="import-dropzone"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFiles(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed bg-white p-10 sm:p-14 text-center transition-colors ${
          dragOver ? "border-zinc-900 bg-zinc-50" : "border-zinc-300"
        }`}
      >
        <input
          ref={inputRef}
          data-testid="import-file-input"
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        <UploadCloud className="w-10 h-10 text-zinc-400 mx-auto mb-3" strokeWidth={1.5} />
        <p className="font-display text-lg font-bold tracking-tight">Arraste o arquivo aqui</p>
        <p className="text-sm text-zinc-500 mt-1">ou</p>
        <button
          data-testid="import-pick-btn"
          onClick={onPick}
          className="mt-3 inline-flex items-center gap-2 bg-zinc-900 text-white hover:bg-zinc-800 rounded-sm px-4 py-2 font-medium text-sm"
        >
          <FileText className="w-4 h-4" /> Selecionar arquivo
        </button>
      </div>

      {file && (
        <div className="border border-zinc-200 bg-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 border border-zinc-200 bg-zinc-50 flex items-center justify-center">
              <FileText className="w-4 h-4 text-zinc-700" />
            </div>
            <div>
              <div className="font-medium text-sm">{file.name}</div>
              <div className="text-xs text-zinc-500">{(file.size / 1024).toFixed(1)} KB</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              data-testid="import-cancel-btn"
              onClick={() => {
                setFile(null);
                setResult(null);
                setError(null);
              }}
              disabled={uploading}
              className="text-xs px-3 py-1.5 border border-zinc-300 hover:bg-zinc-50 rounded-sm disabled:opacity-50"
            >
              Remover
            </button>
            <button
              data-testid="import-submit-btn"
              onClick={handleUpload}
              disabled={uploading}
              className="text-sm font-semibold bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-zinc-400 px-4 py-2 rounded-sm inline-flex items-center gap-2"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {uploading ? "Importando..." : "Importar"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          data-testid="import-error"
          className="border border-rose-200 bg-rose-50 text-rose-800 p-4 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-sm">Erro ao importar</div>
            <div className="text-sm mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {result && (
        <div data-testid="import-success" className="border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-2 text-emerald-800 font-semibold">
            <CheckCircle2 className="w-5 h-5" /> Importação concluída com sucesso
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
            <Stat label="Total" value={result.total_rows} />
            <Stat label="Atrasados" value={result.late_count} accent="text-rose-700" />
            <Stat label="No prazo" value={result.on_time_count} accent="text-emerald-700" />
            <Stat label="Pendentes" value={result.pending_count} accent="text-amber-700" />
            <Stat label="Excluídos" value={result.excluded_count} accent="text-zinc-600" />
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-zinc-200">
        <h3 className="text-sm font-semibold mb-2">Limpar dados</h3>
        <p className="text-xs text-zinc-500 mb-3">Remove todos os pedidos e chamados desta conta.</p>
        <button
          data-testid="import-clear-btn"
          onClick={clearAll}
          className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 border border-zinc-300 hover:border-rose-600 hover:text-rose-700 rounded-sm"
        >
          <Trash2 className="w-3.5 h-3.5" /> Limpar todos os dados
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, accent = "text-zinc-900" }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em] font-semibold text-zinc-500">{label}</div>
      <div className={`font-display text-2xl font-black tabular-nums mt-1 ${accent}`}>{value}</div>
    </div>
  );
}
