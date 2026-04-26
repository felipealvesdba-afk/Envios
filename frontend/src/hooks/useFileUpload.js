import { useCallback, useState } from "react";
import { api } from "@/lib/api";

const ACCEPTED_EXTENSION = /\.(csv|txt)$/i;

function extractErrorMessage(e) {
  const msg = e?.response?.data?.detail || e.message || "Falha ao importar.";
  return typeof msg === "string" ? msg : JSON.stringify(msg);
}

/**
 * Encapsulates CSV upload state machine: pick → validate → upload → result/error.
 * Returns: { file, uploading, result, error, dragOver, ...actions }
 */
export function useFileUpload({ onImported }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    setFile(null);
    setResult(null);
    setError(null);
  }, []);

  const selectFiles = useCallback((files) => {
    setError(null);
    setResult(null);
    const f = files?.[0];
    if (!f) return;
    if (!ACCEPTED_EXTENSION.test(f.name)) {
      setError("Selecione um arquivo .csv válido.");
      return;
    }
    setFile(f);
  }, []);

  const upload = useCallback(async () => {
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
      setError(extractErrorMessage(e));
    } finally {
      setUploading(false);
    }
  }, [file, onImported]);

  const clearAll = useCallback(async () => {
    if (!window.confirm("Remover todos os pedidos e chamados importados?")) return;
    await api.delete("/import");
    reset();
    onImported?.({ cleared: true });
  }, [onImported, reset]);

  return {
    file,
    uploading,
    result,
    error,
    dragOver,
    setDragOver,
    selectFiles,
    upload,
    reset,
    clearAll,
  };
}
