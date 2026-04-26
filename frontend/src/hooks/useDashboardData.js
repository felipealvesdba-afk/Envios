import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

const HIGHLIGHTS_LIMIT = 8;

/**
 * Centralizes Dashboard data fetching. Refetches when refreshKey changes.
 */
export function useDashboardData(refreshKey) {
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
        api.get("/orders/late/highlights", { params: { limit: HIGHLIGHTS_LIMIT } }),
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

  return { stats, byCarrier, highlights, loading };
}
