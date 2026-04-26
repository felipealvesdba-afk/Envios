# Delivery Tracker — PRD

## Problem Statement
"projeto delivery-tracker está apresentando erro ao importar a planilha. preciso criar um sistema que leia a planilha importada, verifique os envios que estão em atraso e monte um relatório."

The original `/app` workspace contained only the boilerplate React/FastAPI scaffold. The deployed `delivery-tracker-329.preview.emergentagent.com` UI shell existed but the local code was empty. We rebuilt the full system from scratch in this sandbox using a real Brazilian SLA spreadsheet provided by the user as reference.

## User Persona
- **Operador de Logística (B2B)** — precisa identificar rapidamente quais entregas estão atrasadas, abrir chamados com a transportadora e exportar relatórios em CSV para acompanhamento operacional.

## Core Requirements (static)
1. Importar planilha CSV (delimitador `;` ou `,`, UTF-8 / Latin-1, datas DD/MM/AAAA).
2. Detectar atrasos automaticamente:
   - Sem entrega + previsão < hoje → atrasado
   - Com entrega tardia (data de entrega > previsão) → atrasado
   - Cancelada / Devolvida / Extraviada → excluído do cálculo
3. Dashboard com 4 KPIs (Total, Em Atraso, Chamados Abertos, Taxa de Atraso).
4. Gráfico de atrasos por forma de envio.
5. Tabela completa de entregas atrasadas com busca + filtros (forma envio, situação).
6. Abertura de chamados (1 chamado ativo por pedido).
7. Exportar relatório de atrasos em CSV (BOM + `;` para Excel-friendly).
8. CRUD de chamados (aberto / em andamento / resolvido).

## Architecture
- **Backend**: FastAPI + Motor (Mongo async) + Pandas.
- **Frontend**: React 19 + Tailwind + shadcn/ui + Recharts + lucide-react.
- **Storage**: MongoDB collections `orders` (pedidos importados) e `tickets`.
- **CSV parsing**: pandas com sniff de encoding (utf-8-sig → utf-8 → latin-1 → cp1252) e separador (`;` → `,`); normalização de cabeçalhos pt-BR via dicionário de aliases.

## What's been implemented (2026-04-26)
- ✅ Backend completo: 13 endpoints sob `/api` (import, dashboard, orders, tickets, report).
- ✅ Frontend completo: 4 abas (Dashboard, Atrasadas, Chamados, Importar) + modal de chamado.
- ✅ Drag-and-drop de upload CSV.
- ✅ Cálculo server-side de `is_late` / `days_late` / `status_bucket`.
- ✅ Relatório CSV com BOM (Excel pt-BR friendly).
- ✅ Tipografia Chivo + IBM Plex Sans, paleta high-contrast Swiss style.
- ✅ Test suite backend: 25/25 verdes (iteration_1 + iteration_2).
- ✅ Validado com a planilha real do usuário (1.731 linhas, 57 atrasos, 3.3% taxa).

## Refactor pass (2026-04-26)
- ✅ Backend: `import_csv()` quebrado em helpers (`_validate_upload`, `_read_csv_smart`, `_row_get`, `_build_order_doc`, `_summarize_buckets`) — complexidade ciclomática 23 → ~6.
- ✅ Frontend: `useCallback` em todos os loaders (Dashboard, LateDeliveries, Tickets); Recharts config movido para constantes do módulo; sub-componentes extraídos (`ChartSection`, `HighlightsSection`, `FiltersBar`, `LateTable`, `TicketCard`, etc.); ternários aninhados eliminados; constantes nomeadas (`BYTES_PER_KB`, `SEARCH_DEBOUNCE_MS`).
- ✅ Logging em `catch` blocks (sem mais `swallow silente`).
- ✅ Lint: ruff + eslint 100% verdes.
- ✅ Regressão: 25/25 testes ainda passam.

## P1 / Backlog
- [ ] Tornar o import atômico (insert-then-delete vs delete-then-insert).
- [ ] Tie-breaker estável em paginação de `/api/orders` (`days_late, id`).
- [ ] Auth/role para proteger `DELETE /api/import` (destrutivo).
- [ ] Histórico de importações (atualmente cada import substitui todos os dados).
- [ ] Multi-tenant por `sla_conta` (campo já capturado no ingest).
- [ ] Notificação automática à transportadora ao abrir chamado (email/webhook).
- [ ] Refatorar `server.py` em routers separados quando passar de ~600 linhas.

## P2 / Future
- [ ] Anexar evidências/imagens ao chamado.
- [ ] Integração com APIs de transportadoras para rastreio em tempo real.
- [ ] Alertas proativos (Slack/Email) quando taxa de atraso ultrapassar X%.
