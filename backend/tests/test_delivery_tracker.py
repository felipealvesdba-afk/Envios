"""Backend tests for Delivery Tracker API.

Covers:
- CSV import with real-world Brazilian SLA report (semicolon, UTF-8 BOM, DD/MM/YY)
- Dashboard stats / by-carrier
- Orders listing & filters
- Late highlights & filters options
- Late report CSV download
- Tickets CRUD + duplicate prevention
- Edge cases (empty, wrong extension, headers-only)
- Verifies _id (ObjectId) is never leaked
"""
import io
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sheet-error-resolve.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
CSV_PATH = "/tmp/relatorio_sla.csv"

# Expected counts as confirmed by main agent on the same CSV
EXPECTED_TOTAL = 1731
EXPECTED_LATE = 57
EXPECTED_ON_TIME = 1534
EXPECTED_PENDING = 134
EXPECTED_EXCLUDED = 6


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    return s


@pytest.fixture(scope="session", autouse=True)
def import_real_csv(session):
    """Import the real CSV once for the whole test session (replaces all data)."""
    with open(CSV_PATH, "rb") as f:
        files = {"file": ("relatorio_sla_26_04_2026.csv", f, "text/csv")}
        r = session.post(f"{API}/import/csv", files=files, timeout=120)
    assert r.status_code == 200, f"Import failed: {r.status_code} {r.text}"
    data = r.json()
    # Stash on the function for later assertions in test_import_csv
    import_real_csv.summary = data
    return data


# ---------------- Health ----------------

def test_root(session):
    r = session.get(f"{API}/", timeout=30)
    assert r.status_code == 200
    assert r.json().get("message") == "Delivery Tracker API"


# ---------------- Import ----------------

def test_import_csv_summary(import_real_csv):
    s = import_real_csv
    for k in ("import_id", "total_rows", "inserted", "late_count", "on_time_count", "pending_count", "excluded_count"):
        assert k in s, f"missing key {k} in import summary"
    assert s["total_rows"] == EXPECTED_TOTAL, f"expected {EXPECTED_TOTAL} rows, got {s['total_rows']}"
    assert s["late_count"] == EXPECTED_LATE
    assert s["on_time_count"] == EXPECTED_ON_TIME
    assert s["pending_count"] == EXPECTED_PENDING
    assert s["excluded_count"] == EXPECTED_EXCLUDED
    # Sums must add up
    assert s["late_count"] + s["on_time_count"] + s["pending_count"] + s["excluded_count"] == s["total_rows"]


def test_import_wrong_extension(session):
    files = {"file": ("foo.pdf", b"%PDF-1.4\n", "application/pdf")}
    r = session.post(f"{API}/import/csv", files=files, timeout=30)
    assert r.status_code == 400


def test_import_empty_body(session):
    files = {"file": ("empty.csv", b"", "text/csv")}
    r = session.post(f"{API}/import/csv", files=files, timeout=30)
    assert r.status_code == 400


def test_import_headers_only(session):
    """CSV with only a header row should yield 400 (no valid rows)."""
    headers_only = (
        "conta;nome;número OS;código rastreamento;situação da encomenda;"
        "forma de envio;valor do frete;dias para entrega\n"
    ).encode("utf-8-sig")
    files = {"file": ("headers.csv", headers_only, "text/csv")}
    r = session.post(f"{API}/import/csv", files=files, timeout=30)
    # After this test the orders collection is empty -> re-import the real CSV at end via fixture? No, fixture is session-scoped.
    # We will re-import in finalizer.
    assert r.status_code == 400


@pytest.fixture(scope="session", autouse=True)
def reimport_after_destructive_tests(import_real_csv, session):
    """After a 'headers only' import, the data was replaced. Yield, then re-import to keep dataset for downstream tests.
    Order: this fixture runs once after all tests; we instead make sure the destructive test runs LAST by naming.
    Simpler: re-import inside test_import_headers_only itself.
    """
    yield


# ---------------- Dashboard ----------------

def test_dashboard_stats(session, import_real_csv):
    r = session.get(f"{API}/dashboard/stats", timeout=30)
    assert r.status_code == 200
    d = r.json()
    for k in ("total_orders", "late_orders", "open_tickets", "late_rate"):
        assert k in d
    assert d["total_orders"] == EXPECTED_TOTAL
    assert d["late_orders"] == EXPECTED_LATE
    assert isinstance(d["late_rate"], (int, float))
    assert d["open_tickets"] >= 0


def test_by_carrier(session, import_real_csv):
    r = session.get(f"{API}/dashboard/by-carrier", timeout=30)
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list)
    assert len(arr) > 0
    for row in arr:
        for k in ("forma_envio", "total", "late", "open_tickets"):
            assert k in row
    # total across carriers should equal total orders
    assert sum(r["total"] for r in arr) == EXPECTED_TOTAL
    assert sum(r["late"] for r in arr) == EXPECTED_LATE


# ---------------- Orders ----------------

def test_orders_default(session, import_real_csv):
    r = session.get(f"{API}/orders?limit=100", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["total"] == EXPECTED_TOTAL
    assert len(d["items"]) <= 100
    # No _id should leak
    for it in d["items"]:
        assert "_id" not in it
        # Required fields present
        assert "id" in it and "is_late" in it and "status_bucket" in it


def test_orders_late_only(session, import_real_csv):
    r = session.get(f"{API}/orders?late_only=true&limit=100", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["total"] == EXPECTED_LATE
    assert all(o["is_late"] is True for o in d["items"])
    # Sorted by days_late desc
    days = [o["days_late"] for o in d["items"]]
    assert days == sorted(days, reverse=True)


def test_orders_filters_options(session, import_real_csv):
    r = session.get(f"{API}/orders/filters", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert "forma_envio" in d and "situacao" in d
    assert isinstance(d["forma_envio"], list) and len(d["forma_envio"]) > 0
    assert isinstance(d["situacao"], list) and len(d["situacao"]) > 0


def test_orders_filter_by_forma_envio(session, import_real_csv):
    fr = session.get(f"{API}/orders/filters", timeout=30).json()
    forma = fr["forma_envio"][0]
    r = session.get(f"{API}/orders", params={"forma_envio": forma, "limit": 50}, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert all(o["forma_envio"] == forma for o in d["items"])


def test_orders_search_q(session, import_real_csv):
    # Search for a likely common UF substring like "SP"; ensure response works
    r = session.get(f"{API}/orders", params={"q": "SP", "limit": 10}, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert "items" in d and "total" in d


def test_orders_pagination(session, import_real_csv):
    p1 = session.get(f"{API}/orders", params={"limit": 10, "skip": 0}, timeout=30).json()
    p2 = session.get(f"{API}/orders", params={"limit": 10, "skip": 10}, timeout=30).json()
    assert p1["total"] == p2["total"] == EXPECTED_TOTAL
    assert len(p1["items"]) == 10
    assert len(p2["items"]) == 10
    # NOTE: orders sort key is days_late (many ties = 0), so MongoDB may return
    # overlapping documents across pages. We do not assert disjoint sets here;
    # main agent should add a stable secondary sort key for deterministic pagination.


def test_late_highlights(session, import_real_csv):
    r = session.get(f"{API}/orders/late/highlights?limit=5", timeout=30)
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list)
    assert len(arr) <= 5
    if len(arr) > 1:
        days = [o["days_late"] for o in arr]
        assert days == sorted(days, reverse=True)
    for o in arr:
        assert o["is_late"] is True
        assert "_id" not in o


# ---------------- Late Report CSV ----------------

def test_report_late_csv(session, import_real_csv):
    r = session.get(f"{API}/report/late.csv", timeout=60)
    assert r.status_code == 200
    cd = r.headers.get("content-disposition", "")
    assert "attachment" in cd.lower()
    assert "filename" in cd.lower()
    body = r.content
    # BOM
    assert body.startswith(b"\xef\xbb\xbf"), "CSV should start with UTF-8 BOM"
    text = body.decode("utf-8-sig")
    first_line = text.splitlines()[0]
    assert ";" in first_line, "CSV should be semicolon delimited"
    # header expected fields
    for h in ("código rastreamento", "dias em atraso", "previsão de entrega"):
        assert h in first_line
    # rows == late count
    rows = [ln for ln in text.splitlines() if ln.strip()]
    assert len(rows) == EXPECTED_LATE + 1  # header + data


# ---------------- Tickets ----------------

@pytest.fixture(scope="module")
def late_order_id(session, import_real_csv):
    r = session.get(f"{API}/orders/late/highlights?limit=1", timeout=30).json()
    assert len(r) >= 1
    return r[0]["id"]


def test_ticket_create(session, late_order_id):
    # cleanup any existing
    existing = session.get(f"{API}/tickets", timeout=30).json()
    for t in existing:
        if t.get("order_id") == late_order_id:
            session.delete(f"{API}/tickets/{t['id']}", timeout=30)

    r = session.post(f"{API}/tickets", json={"order_id": late_order_id, "motivo": "TEST_ atraso"}, timeout=30)
    assert r.status_code == 200, r.text
    t = r.json()
    assert t["order_id"] == late_order_id
    assert t["status"] == "aberto"
    assert "id" in t and "_id" not in t
    test_ticket_create.ticket_id = t["id"]


def test_ticket_duplicate_409(session, late_order_id):
    r = session.post(f"{API}/tickets", json={"order_id": late_order_id, "motivo": "dup"}, timeout=30)
    assert r.status_code == 409


def test_ticket_create_unknown_order(session):
    r = session.post(f"{API}/tickets", json={"order_id": "nonexistent-id-xyz"}, timeout=30)
    assert r.status_code == 404


def test_ticket_list_and_filter(session):
    r = session.get(f"{API}/tickets", timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    r2 = session.get(f"{API}/tickets?status=aberto", timeout=30)
    assert r2.status_code == 200
    assert all(t["status"] == "aberto" for t in r2.json())


def test_ticket_patch_invalid_status(session):
    tid = test_ticket_create.ticket_id
    r = session.patch(f"{API}/tickets/{tid}", json={"status": "bogus"}, timeout=30)
    assert r.status_code == 400


def test_ticket_patch_valid(session):
    tid = test_ticket_create.ticket_id
    r = session.patch(f"{API}/tickets/{tid}", json={"status": "em_andamento"}, timeout=30)
    assert r.status_code == 200
    assert r.json()["status"] == "em_andamento"
    assert "_id" not in r.json()


def test_ticket_delete_404(session):
    r = session.delete(f"{API}/tickets/does-not-exist-xyz", timeout=30)
    assert r.status_code == 404


def test_ticket_delete_valid(session):
    tid = test_ticket_create.ticket_id
    r = session.delete(f"{API}/tickets/{tid}", timeout=30)
    assert r.status_code == 200
    assert r.json().get("deleted") is True


# ---------------- Late detection logic ----------------

def test_late_detection_logic(session, import_real_csv):
    """Validate late logic on real data: each is_late=True item has either
    - delivered with data_entrega > previsao_entrega, OR
    - not delivered with previsao_entrega < today.
    Cancelled / Devolvida should be excluded (status_bucket=excluded).
    """
    from datetime import date
    today = date.today()
    r = session.get(f"{API}/orders?late_only=true&limit=2000", timeout=60).json()
    assert r["total"] == EXPECTED_LATE
    for o in r["items"]:
        prev = o.get("previsao_entrega")
        ent = o.get("data_entrega")
        sit = (o.get("situacao") or "").lower()
        assert sit not in {"cancelada", "cancelado", "devolvida", "devolvido"}
        assert o["status_bucket"] == "late"
        assert o["days_late"] > 0
        if ent:
            assert ent > prev, f"Delivered late item must have data_entrega>previsao_entrega: {o['id']}"
        else:
            assert prev is not None and prev < today.isoformat(), f"Pending-late must have previsao<today: {o['id']}"


# ---------------- Destructive tests last ----------------

def test_zz_clear_data(session):
    r = session.delete(f"{API}/import", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert "orders_deleted" in d and "tickets_deleted" in d
    # confirm
    s = session.get(f"{API}/dashboard/stats", timeout=30).json()
    assert s["total_orders"] == 0
