# Unified AI Sales OS — Layered Architecture Audit & Migration Map

Status: AUDIT ONLY. No business logic changed. Chatbot, Order Brief, proposal, discovery, CRM history untouched.

---

## 1. Audit

### A. Current authority modules (make strategic decisions today)
| Module | Decides |
|---|---|
| `src/lib/admin/consultant-engine.ts` + `consultant-engine.service.ts` | problem hypotheses, core solution, features, package, sales angle, objections (intended authority, versioned) |
| `src/lib/admin/sales-prep.ts` + `prospecting-salesprep.server.ts` (legacy rules) | sales approach, solution, reason (fallback when unified mode is not `on`) |
| `src/lib/admin/sales-ai.ts` | lead analysis, next action, message strategy (legacy Sales Agent AI) |
| `src/lib/order-brief-insight.ts` | problems, features, package for Order Brief |
| `src/lib/admin/proposal-from-brief.ts` | scope, package, pricing narrative for proposals |
| `src/lib/admin/package-decision-sop.ts`, `problem-solution-map.ts` | package / problem→solution rules (knowledge, used by several deciders) |
| `src/routes/api/public/consultant-chat.ts` | chatbot recommendations during conversation |
| `src/lib/assistant.server.ts` + `assistant-tools.server.ts` | Sales Assistant answers, suggested actions |
| `src/lib/prospecting-qualification.server.ts`, `admin/qc-rules.ts` | lead score, auto-QC approve/reject |
| `src/lib/prospecting.server.ts` / discovery | ICP fit hypothesis, suggested solution at discovery time |

### B. Historical memory candidates
Tables: `ai_conversations`, `consultations`, `conversation_requirements`, `prospects` + `prospect_activities` + `prospect_audits` (legacy CRM archive), `prospect_candidates` + `candidate_status_history` + `prospect_candidate_events`, `prospect_enrichments`, `candidate_sources`, `business_interactions`, `business_objections`, `business_findings`, `business_consultant_analyses` (all versions), `sales_preparations` (history versions), `sales_context_snapshots`, `proposals` + `proposal_versions`, `invoices`, `lead_ai_activities`, `assistant_memories`, `automation_logs`, `acquisition_events`.
Files: `consultant-library.ts`, `industry-context`, `feature-library`, `package-decision-sop.ts` (knowledge, not memory).

### C. Execution modules (should only execute)
`sales-pipeline.server.ts` (orchestrator), `prospecting-discovery.server.ts`, `prospecting-apify.server.ts`, `prospecting-validation.server.ts`, `entity-resolution.server.ts`, `crm-intelligence.server.ts` (record/lifecycle), `lead-notify.server.ts`, Telegram hooks, WhatsApp link + verification (`admin/verification.ts`), `billing.server.ts`.

### D. Formatter modules
`admin/consultant-outreach.ts`, `admin/evidence.ts`, `proposal-doc.ts`, `proposal-pdf.ts`, Order Brief renderer/PDF, `SalesPrepPanel.tsx`, `CustomerFeedbackBox.tsx`, `QualificationPanel.tsx`, `SalesAssistant.tsx`, MCP tools (`mcp/tools/*`).

### E. Deprecated decision paths (eventually stop deciding independently)
1. Legacy rules in `sales-prep.ts` (approach/solution) → fallback only, then read-only.
2. `sales-ai.ts` lead diagnosis → read Consultant Analysis via snapshot.
3. `order-brief-insight.ts` feature/package choice → Consultant Engine → Order Brief adapter.
4. `proposal-from-brief.ts` package selection → consume analysis package.
5. Discovery `suggested_solution` → stays as hypothesis evidence only.
6. Sales Assistant free-form recommendations → answer from snapshot.
7. Chatbot → remains untouched; output becomes evidence (findings) only.

---

## 2. Architecture maps

### Current
```text
DATA SOURCES: Google Maps/Apify, website, chatbot, consultations, manual, CRM
   ↓
CURRENT DECISION SOURCES (parallel, overlapping):
   Consultant Engine | legacy sales-prep rules | sales-ai | order-brief-insight
   | proposal-from-brief | chatbot | Sales Assistant | discovery AI | auto-QC
   ↓
EXECUTION: scheduled pipeline, Ready Outreach, WhatsApp, CRM, proposal/PDF, Telegram
   ↓
FEEDBACK: business_interactions/objections → findings → stale → re-analysis (Phase 6)
          (only reaches Consultant Engine; other deciders ignore it)
```

### Target
```text
DATA SOURCES
   ↓
BUSINESS ENTITY (ensureBusinessEntity, links)
   ↓
HISTORICAL MEMORY (conversations, CRM archive, findings, outcomes, prior analyses)
   ↓
CONSULTANT ENGINE (single strategic authority, versioned)
   ↓
SALES CONTEXT SNAPSHOT (versioned)
   ↓
EXECUTION (sales prep adapter, outreach, Order Brief adapter, proposal, assistant)
   ↓
FEEDBACK LOOP → findings → stale → Consultant Engine

Cross-layer: Policy & Guardrail | Orchestrator (sales-pipeline) | Observability (automation_logs, provenance)
```

---

## 3. Migration dependency map
| Module | Current role | Future role | Risk | Priority |
|---|---|---|---|---|
| consultant-engine(.service) | authority (partial) | sole authority | Med | P1 |
| sales-intelligence.server (snapshot) | computed reader | canonical snapshot provider | Med | P1 |
| unified-cutover + outreach guard | guardrail (flag) | Policy layer core | Low | P1 |
| prospecting-salesprep / sales-prep | decider + formatter | adapter only | High | P2 |
| sales-pipeline.server | orchestrator + some rules | pure orchestrator | Med | P2 |
| crm-intelligence.server | feedback recorder | feedback loop | Low | P2 |
| sales-ai.ts | decider | snapshot consumer | High | P3 |
| assistant.server / tools | decider | snapshot consumer | Med | P3 |
| order-brief-insight | decider | adapter input | High (customer-facing) | P4 |
| proposal-from-brief | decider | adapter | High (pricing) | P4 |
| qualification / qc-rules | decider (score/QC) | policy rule (stays) | Low | P3 |
| discovery AI | hypothesis generator | evidence producer | Low | P5 |
| consultant-chat (chatbot) | decider in-chat | untouched; evidence source | Very high if touched | never modify |
| automation_logs / provenance | partial logging | Observability layer | Low | P1 |

---

## 4. Hidden risks
- **Duplicate authority:** same entity can get package X from Consultant Engine, Y from Order Brief, Z from proposal. No arbitration today.
- **Missing boundaries:** knowledge files (`package-decision-sop`, `problem-solution-map`) imported directly by several deciders → any change shifts multiple outputs.
- **DB dependency:** `sales_preparations` linkage columns nullable; legacy rows have no analysis_id; `prospects` (242 legacy) mostly lack place_id → weak entity links; 100 auto-linked "suggested" matches may be wrong.
- **Staleness:** two stale signals coexist (candidate `updated_at` label vs `stale_reason`) → contradictory UI.
- **Rollback:** flag stored in `prospect_job_state`; if row missing, default applies — confirm default stays safe. Analysis versions append-only (good); snapshot/prep history preserved.
- **Feature flag:** single global flag; no per-campaign scope; `on` blocks Ready Outreach → may drain queue if analysis step rate-limited (AI quota).
- **Breaking changes:** Order Brief/proposal output drift visible to customers; Sales Assistant answers changing; hourly cron cost increase from analysis step; MCP tools read shapes that may change.
- **Observability gap:** no single decision log linking prep → analysis → findings → evidence across all execution modules (only sales prep has provenance).

---

## 5. Implementation order (no code yet)
1. **Step 1 — Observability first:** unified decision log (who decided, source, analysis version) for every decider, read-only instrumentation. No behaviour change.
2. **Step 2 — Policy layer consolidation:** one guard module (permission, stale, version, confidence, override) reused by Ready Outreach, pipeline, assistant. Unify the two stale signals.
3. **Step 3 — Snapshot as the only read contract:** execution modules read `sales_context_snapshots`; add a shared `getDecisionContext(entityId)`.
4. **Step 4 — Run unified mode in `shadow` and compare** Consultant Engine vs legacy outputs via decision log; then `on`.
5. **Step 5 — Sales Agent AI + Sales Assistant** consume snapshot (legacy diagnosis kept as fallback behind flag).
6. **Step 6 — Historical Memory layer:** read adapter over conversations, CRM archive, outcomes, feeding Consultant Engine input (read-only).
7. **Step 7 — Order Brief / proposal adapters** (renderers untouched), behind a separate flag, with side-by-side comparison.
8. **Step 8 — Orchestrator cleanup:** move remaining decision rules out of `sales-pipeline.server.ts` into policy.
9. **Step 9 — Retire legacy deciders to read-only fallback** after metrics confirm parity. Never delete.
