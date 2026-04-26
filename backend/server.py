from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Query
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import csv
import logging
import math
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, date, timezone
import pandas as pd

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Delivery Tracker API")
api_router = APIRouter(prefix="/api")

# ---------------- Helpers ----------------

# Final statuses (delivered/cancelled/returned). Anything else is "in transit / pending".
TERMINAL_OK = {"entregue"}
TERMINAL_EXCLUDE = {"cancelada", "cancelado", "devolvida", "devolvido", "extraviada", "extraviado"}

# Header normalization aliases (lowercase, stripped, BOM removed)
COLUMN_ALIASES = {
    "slaconta": "sla_conta",
    "sla conta": "sla_conta",
    "conta": "sla_conta",
    "nome": "loja",
    "número os": "numero_os",
    "numero os": "numero_os",
    "código rastreamento": "codigo_rastreamento",
    "codigo rastreamento": "codigo_rastreamento",
    "situação da encomenda": "situacao",
    "situacao da encomenda": "situacao",
    "forma de envio": "forma_envio",
    "valor do frete": "valor_frete",
    "dias para entrega": "dias_para_entrega",
    "data de envio": "data_envio",
    "previsão de entrega": "previsao_entrega",
    "previsao de entrega": "previsao_entrega",
    "primeira tentativa de entrega": "primeira_tentativa",
    "data de entrega": "data_entrega",
    "destinatário": "destinatario",
    "destinatario": "destinatario",
    "cpf_cnpj": "cpf_cnpj",
    "e-mail": "email",
    "email": "email",
    "endereço": "endereco",
    "endereco": "endereco",
    "número": "numero",
    "numero": "numero",
    "complemento": "complemento",
    "bairro": "bairro",
    "cep": "cep",
    "cidade": "cidade",
    "uf": "uf",
    "etiqueta": "etiqueta",
    "dimensões (comp/alt/larg)": "dimensoes",
    "dimensoes (comp/alt/larg)": "dimensoes",
    "peso": "peso",
    "valor declarado": "valor_declarado",
    "referencia": "referencia",
    "referência": "referencia",
    "chave da nf": "chave_nf",
    "data da coleta": "data_coleta",
    "data do último rastreio": "data_ultimo_rastreio",
    "data do ultimo rastreio": "data_ultimo_rastreio",
    "descrição do último rastreio": "descricao_ultimo_rastreio",
    "descricao do ultimo rastreio": "descricao_ultimo_rastreio",
    "tentativas de entrega": "tentativas_entrega",
    "id importação": "id_importacao",
    "id importacao": "id_importacao",
}


def _normalize_header(h: str) -> str:
    if h is None:
        return ""
    s = str(h).strip().lstrip("\ufeff").lower()
    return COLUMN_ALIASES.get(s, s.replace(" ", "_"))


def _parse_date(value: Any) -> Optional[date]:
    """Parse a Brazilian date (DD/MM/YY or DD/MM/YYYY) into date object."""
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    s = str(value).strip()
    if not s or s.lower() in {"nan", "nat", "none", "null"}:
        return None
    for fmt in ("%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d", "%d-%m-%Y", "%d-%m-%y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    # last attempt via pandas
    try:
        ts = pd.to_datetime(s, dayfirst=True, errors="coerce")
        if pd.isna(ts):
            return None
        return ts.date()
    except Exception:
        return None


def _to_iso(d: Optional[date]) -> Optional[str]:
    return d.isoformat() if d else None


def _compute_late(situacao: str, prev: Optional[date], entrega: Optional[date], today: date):
    """Return (is_late, days_late, status_bucket). status_bucket in: late, on_time, pending, excluded."""
    s = (situacao or "").strip().lower()
    if s in TERMINAL_EXCLUDE:
        return False, 0, "excluded"
    # Delivered
    if s in TERMINAL_OK or entrega is not None:
        if entrega and prev:
            diff = (entrega - prev).days
            if diff > 0:
                return True, diff, "late"
            return False, 0, "on_time"
        # Delivered but missing dates -> assume on time
        return False, 0, "on_time"
    # Not delivered yet
    if prev is None:
        return False, 0, "pending"
    diff = (today - prev).days
    if diff > 0:
        return True, diff, "late"
    return False, 0, "pending"


# ---------------- Models ----------------

class ImportSummary(BaseModel):
    import_id: str
    total_rows: int
    inserted: int
    late_count: int
    on_time_count: int
    pending_count: int
    excluded_count: int


class TicketCreate(BaseModel):
    order_id: str
    motivo: Optional[str] = None


class TicketUpdate(BaseModel):
    status: str  # aberto | em_andamento | resolvido


class Ticket(BaseModel):
    id: str
    order_id: str
    codigo_rastreamento: Optional[str] = None
    destinatario: Optional[str] = None
    forma_envio: Optional[str] = None
    motivo: Optional[str] = None
    status: str = "aberto"
    created_at: str
    updated_at: str


# ---------------- Endpoints ----------------

@api_router.get("/")
async def root():
    return {"message": "Delivery Tracker API"}


@api_router.post("/import/csv", response_model=ImportSummary)
async def import_csv(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith((".csv", ".txt")):
        raise HTTPException(status_code=400, detail="Envie um arquivo .csv")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")

    # Try common encodings
    df = None
    last_error: Optional[str] = None
    for enc in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        for sep in (";", ","):
            try:
                df = pd.read_csv(
                    io.BytesIO(content),
                    sep=sep,
                    encoding=enc,
                    dtype=str,
                    keep_default_na=False,
                    engine="python",
                    on_bad_lines="skip",
                )
                # Heuristic: must have more than 5 columns (real data)
                if df.shape[1] >= 5:
                    raise StopIteration
            except StopIteration:
                break
            except Exception as e:  # pragma: no cover
                last_error = f"{enc}/{sep}: {e}"
                df = None
                continue
        if df is not None and df.shape[1] >= 5:
            break

    if df is None or df.empty:
        raise HTTPException(status_code=400, detail=f"Não foi possível ler o CSV. {last_error or ''}")

    # Normalize headers
    df.columns = [_normalize_header(c) for c in df.columns]

    import_id = str(uuid.uuid4())
    today = datetime.now(timezone.utc).date()

    docs: List[Dict[str, Any]] = []
    late_count = on_time_count = pending_count = excluded_count = 0

    def _get(row, k):
        v = row.get(k, "")
        if v is None:
            return ""
        s = str(v).strip()
        return "" if s.lower() in {"nan", "nat", "none"} else s

    for _, row in df.iterrows():
        def get(k, _r=row):
            return _get(_r, k)
        situacao = get("situacao")
        prev_d = _parse_date(row.get("previsao_entrega"))
        entrega_d = _parse_date(row.get("data_entrega"))
        envio_d = _parse_date(row.get("data_envio"))
        coleta_d = _parse_date(row.get("data_coleta"))
        ultimo_d = _parse_date(row.get("data_ultimo_rastreio"))
        primeira_d = _parse_date(row.get("primeira_tentativa"))

        is_late, days_late, bucket = _compute_late(situacao, prev_d, entrega_d, today)

        if bucket == "late":
            late_count += 1
        elif bucket == "on_time":
            on_time_count += 1
        elif bucket == "pending":
            pending_count += 1
        else:
            excluded_count += 1

        doc = {
            "id": str(uuid.uuid4()),
            "import_id": import_id,
            "sla_conta": get("sla_conta"),
            "loja": get("loja"),
            "numero_os": get("numero_os"),
            "codigo_rastreamento": get("codigo_rastreamento"),
            "situacao": situacao,
            "forma_envio": get("forma_envio") or "Não informado",
            "valor_frete": get("valor_frete"),
            "dias_para_entrega": get("dias_para_entrega"),
            "data_envio": _to_iso(envio_d),
            "previsao_entrega": _to_iso(prev_d),
            "primeira_tentativa": _to_iso(primeira_d),
            "data_entrega": _to_iso(entrega_d),
            "destinatario": get("destinatario"),
            "cpf_cnpj": get("cpf_cnpj"),
            "email": get("email"),
            "endereco": get("endereco"),
            "numero": get("numero"),
            "complemento": get("complemento"),
            "bairro": get("bairro"),
            "cep": get("cep"),
            "cidade": get("cidade"),
            "uf": get("uf"),
            "etiqueta": get("etiqueta"),
            "peso": get("peso"),
            "valor_declarado": get("valor_declarado"),
            "referencia": get("referencia"),
            "data_coleta": _to_iso(coleta_d),
            "data_ultimo_rastreio": _to_iso(ultimo_d),
            "descricao_ultimo_rastreio": get("descricao_ultimo_rastreio"),
            "tentativas_entrega": get("tentativas_entrega"),
            "is_late": is_late,
            "days_late": days_late,
            "status_bucket": bucket,
            "imported_at": datetime.now(timezone.utc).isoformat(),
        }
        docs.append(doc)

    if not docs:
        raise HTTPException(status_code=400, detail="Nenhuma linha válida encontrada.")

    # Replace dataset on each import (single-tenant simple model)
    await db.orders.delete_many({})
    await db.orders.insert_many(docs)

    return ImportSummary(
        import_id=import_id,
        total_rows=len(docs),
        inserted=len(docs),
        late_count=late_count,
        on_time_count=on_time_count,
        pending_count=pending_count,
        excluded_count=excluded_count,
    )


@api_router.delete("/import")
async def clear_data():
    res1 = await db.orders.delete_many({})
    res2 = await db.tickets.delete_many({})
    return {"orders_deleted": res1.deleted_count, "tickets_deleted": res2.deleted_count}


@api_router.get("/dashboard/stats")
async def dashboard_stats():
    total = await db.orders.count_documents({})
    late = await db.orders.count_documents({"is_late": True})
    tickets_open = await db.tickets.count_documents({"status": {"$in": ["aberto", "em_andamento"]}})
    rate = round((late / total) * 100, 1) if total else 0.0
    return {
        "total_orders": total,
        "late_orders": late,
        "open_tickets": tickets_open,
        "late_rate": rate,
    }


@api_router.get("/dashboard/by-carrier")
async def by_carrier():
    pipeline = [
        {
            "$group": {
                "_id": {"$ifNull": ["$forma_envio", "Não informado"]},
                "total": {"$sum": 1},
                "late": {"$sum": {"$cond": ["$is_late", 1, 0]}},
            }
        },
        {"$sort": {"late": -1, "total": -1}},
    ]
    results = []
    async for doc in db.orders.aggregate(pipeline):
        results.append(
            {
                "forma_envio": doc["_id"] or "Não informado",
                "total": doc["total"],
                "late": doc["late"],
            }
        )
    # add tickets open by forma_envio
    tickets_pipeline = [
        {"$match": {"status": {"$in": ["aberto", "em_andamento"]}}},
        {"$group": {"_id": {"$ifNull": ["$forma_envio", "Não informado"]}, "open_tickets": {"$sum": 1}}},
    ]
    tickets_map: Dict[str, int] = {}
    async for d in db.tickets.aggregate(tickets_pipeline):
        tickets_map[d["_id"] or "Não informado"] = d["open_tickets"]
    for r in results:
        r["open_tickets"] = tickets_map.get(r["forma_envio"], 0)
    return results


@api_router.get("/orders")
async def list_orders(
    late_only: bool = False,
    forma_envio: Optional[str] = None,
    situacao: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = Query(500, le=2000),
    skip: int = 0,
):
    query: Dict[str, Any] = {}
    if late_only:
        query["is_late"] = True
    if forma_envio:
        query["forma_envio"] = forma_envio
    if situacao:
        query["situacao"] = situacao
    if q:
        regex = {"$regex": q, "$options": "i"}
        query["$or"] = [
            {"destinatario": regex},
            {"codigo_rastreamento": regex},
            {"numero_os": regex},
            {"cidade": regex},
            {"loja": regex},
        ]
    cursor = db.orders.find(query, {"_id": 0}).sort("days_late", -1).skip(skip).limit(limit)
    items = await cursor.to_list(length=limit)
    total = await db.orders.count_documents(query)
    return {"items": items, "total": total}


@api_router.get("/orders/late/highlights")
async def late_highlights(limit: int = 10):
    cursor = db.orders.find({"is_late": True}, {"_id": 0}).sort("days_late", -1).limit(limit)
    return await cursor.to_list(length=limit)


@api_router.get("/orders/filters")
async def filter_options():
    forma = await db.orders.distinct("forma_envio")
    sit = await db.orders.distinct("situacao")
    return {
        "forma_envio": sorted([f for f in forma if f]),
        "situacao": sorted([s for s in sit if s]),
    }


@api_router.get("/report/late.csv")
async def report_late_csv():
    cursor = db.orders.find({"is_late": True}, {"_id": 0}).sort("days_late", -1)
    rows = await cursor.to_list(length=10000)

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    headers = [
        "código rastreamento",
        "número OS",
        "loja",
        "destinatário",
        "forma de envio",
        "situação",
        "previsão de entrega",
        "data de entrega",
        "dias em atraso",
        "cidade",
        "uf",
        "último rastreio",
    ]
    writer.writerow(headers)
    for r in rows:
        writer.writerow(
            [
                r.get("codigo_rastreamento", ""),
                r.get("numero_os", ""),
                r.get("loja", ""),
                r.get("destinatario", ""),
                r.get("forma_envio", ""),
                r.get("situacao", ""),
                r.get("previsao_entrega", "") or "",
                r.get("data_entrega", "") or "",
                r.get("days_late", 0),
                r.get("cidade", ""),
                r.get("uf", ""),
                r.get("descricao_ultimo_rastreio", ""),
            ]
        )
    output.seek(0)
    csv_bytes = ("\ufeff" + output.getvalue()).encode("utf-8")  # BOM for Excel
    fname = f"relatorio_atrasos_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@api_router.post("/tickets", response_model=Ticket)
async def create_ticket(payload: TicketCreate):
    order = await db.orders.find_one({"id": payload.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    existing = await db.tickets.find_one({"order_id": payload.order_id, "status": {"$in": ["aberto", "em_andamento"]}})
    if existing:
        raise HTTPException(status_code=409, detail="Já existe chamado aberto para este pedido")

    now = datetime.now(timezone.utc).isoformat()
    ticket = {
        "id": str(uuid.uuid4()),
        "order_id": payload.order_id,
        "codigo_rastreamento": order.get("codigo_rastreamento"),
        "destinatario": order.get("destinatario"),
        "forma_envio": order.get("forma_envio"),
        "loja": order.get("loja"),
        "cidade": order.get("cidade"),
        "uf": order.get("uf"),
        "days_late": order.get("days_late", 0),
        "motivo": payload.motivo or f"Atraso de {order.get('days_late', 0)} dia(s) na entrega",
        "status": "aberto",
        "created_at": now,
        "updated_at": now,
    }
    await db.tickets.insert_one(ticket)
    ticket.pop("_id", None)
    return Ticket(**ticket)


@api_router.get("/tickets")
async def list_tickets(status: Optional[str] = None):
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    cursor = db.tickets.find(query, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=1000)


@api_router.patch("/tickets/{ticket_id}")
async def update_ticket(ticket_id: str, payload: TicketUpdate):
    if payload.status not in {"aberto", "em_andamento", "resolvido"}:
        raise HTTPException(status_code=400, detail="Status inválido")
    res = await db.tickets.find_one_and_update(
        {"id": ticket_id},
        {"$set": {"status": payload.status, "updated_at": datetime.now(timezone.utc).isoformat()}},
        return_document=True,
        projection={"_id": 0},
    )
    if not res:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    return res


@api_router.delete("/tickets/{ticket_id}")
async def delete_ticket(ticket_id: str):
    res = await db.tickets.delete_one({"id": ticket_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    return {"deleted": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
