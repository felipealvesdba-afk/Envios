import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

export const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return iso;
  }
};

export const fmtNumber = (n) => new Intl.NumberFormat("pt-BR").format(n ?? 0);

export const cn = (...args) => args.filter(Boolean).join(" ");
