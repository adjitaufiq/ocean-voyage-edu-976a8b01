# KERJAKU V4 — Sales Intelligence Architecture (DESIGN VALIDATION, belum diimplementasi)

Status: **menunggu persetujuan**. Tidak ada migrasi/tabel yang dibuat sampai dokumen ini disetujui.
Prinsip: additive, tidak menghapus tabel lama, tidak merombak backend, feature flag, migrasi bertahap.

---

## 1. FINAL DATABASE ARCHITECTURE

### 1.1 Tabel baru (5) + 1 extension

| Tabel | Fungsi | Penulis data |
|---|---|---|
| `prospect_candidates` | Kandidat mentah hasil discovery (AI/manual/import). Tidak punya kontak. | AI Discovery Agent, human |
| `prospect_enrichments` | Bukti fakta eksternal per kandidat (Apify/Maps/website/social). Append-only. | Verification Agent (server) |
| `entity_match_candidates` | Pasangan kandidat/prospect yang diduga entitas sama. | Entity Resolution Agent |
| `background_jobs` | Antrean kerja async + lease/lock + retry. | Semua agent |
| `prospect_outcomes` | Hasil sales (won/lost/no_response/wrong_fit). | Human |

Extension: `pg_trgm` (fuzzy name matching) + index GIN pada nama ternormalisasi.

### 1.2 Kolom tambahan pada tabel existing (additive, nullable/default)

`prospects`:
- `candidate_id uuid null references prospect_candidates(id)` — jejak asal.
- `trust_score int not null default 0`
- `trust_breakdown jsonb not null default '{}'`
- `business_name_normalized text` (diisi trigger, juga backfill untuk baris lama)
- `external_verified_at timestamptz null`

`prospect_campaigns`:
- `pipeline_version text not null default 'v3'` (`v3` = alur sekarang, `v4` = alur kandidat)
- `enrichment_budget_daily int not null default 50` — pagar biaya Apify.

`prospect_icp_config`: dipakai apa adanya untuk menyimpan feature flag + threshold (tidak ada kolom baru).

Tidak ada kolom lama yang di-drop, di-rename, atau berubah tipe.

### 1.3 Skema field utama

```text
prospect_candidates
  id, workspace_scope(default 'default'), campaign_id -> prospect_campaigns
  business_name, business_name_normalized, industry, city, country
  why_match_icp, potential_problem_hypothesis, buying_signal_hypothesis
  suggested_solution, discovery_reason
  discovery_method ('ai_discovery'|'manual'|'import'|'apify_search')
  discovery_query, discovery_source, raw_payload jsonb (raw_ai_response)
  candidate_status ('discovered'|'enriching'|'verified'|'rejected'|'promoted')
  duplicate_status ('unchecked'|'unique'|'suspected'|'duplicate')
  duplicate_of -> prospect_candidates(id)
  icp_score int, trust_score int, trust_breakdown jsonb
  rejected_reason, promoted_prospect_id -> prospects(id)
  created_by, created_at, updated_at

prospect_enrichments   (APPEND ONLY — tidak pernah di-update/overwrite)
  id, candidate_id -> prospect_candidates(id)
  prospect_id -> prospects(id) null      (untuk re-enrich prospect lama)
  source_type ('google_maps'|'website'|'instagram'|'linkedin'|'company_database')
  provider ('apify'|'internal_fetch'|'manual'), actor (actor id apify)
  source_url, raw_response jsonb, verified_fields jsonb
  confidence_score int (0-100), status ('ok'|'not_found'|'error')
  error_message, fetched_at, created_at

entity_match_candidates
  id, candidate_a uuid, candidate_b uuid, b_kind ('candidate'|'prospect')
  name_similarity numeric, phone_similarity numeric, address_similarity numeric
  overall_similarity numeric
  status ('pending'|'confirmed'|'rejected'), reviewed_by, reviewed_at, note
  created_at
  UNIQUE(candidate_a, candidate_b)

background_jobs
  id, job_type ('discovery'|'enrich_maps'|'enrich_website'|'enrich_social'
                |'entity_resolution'|'score'|'promote')
  payload jsonb, status ('queued'|'running'|'completed'|'failed'|'cancelled')
  attempt int default 0, max_attempts int default 3
  locked_at, locked_by, run_after, last_error, result jsonb
  created_at, updated_at
  index (status, run_after)

prospect_outcomes
  id, prospect_id -> prospects(id), lead_id -> consultations(id) null
  outcome ('won'|'lost'|'no_response'|'wrong_fit')
  reason, deal_value numeric, sales_cycle_days int
  recorded_by, created_at
```

---

## 2. ENTITY RELATIONSHIP DIAGRAM

```text
prospect_campaigns
   |1
   |          n
   +----> prospect_candidates ----1:n----> prospect_enrichments
                |  |                              ^
                |  |                              | (re-verify prospect lama)
                |  +----n:n(pairs)---- entity_match_candidates
                |
                | promote (1:0..1)
                v
            prospects ----1:n----> prospect_activities   (existing)
                |     ----1:n----> prospect_audits       (existing)
                |     ----1:n----> prospect_outcomes     (baru)
                |
                | convert (existing)
                v
            consultations (lead CRM)  ->  proposals  ->  invoices

background_jobs  --(payload.candidate_id / prospect_id)-->  semua di atas
```

Relasi lama (`prospects -> prospect_activities/audits/campaigns -> consultations`) tidak berubah.

---

## 3. CANDIDATE LIFECYCLE FLOW

```text
[AI Discovery Agent]  (tanpa kontak sama sekali)
        |
        v
  discovered ------------------------------> rejected
        | queue: enrich_maps                   ^  (ICP gagal / Maps tidak menemukan
        v                                      |   bisnis / duplicate confirmed)
   enriching                                   |
        |                                      |
   1. GOOGLE MAPS (sumber fakta utama) --gagal-+
        |  ok: official name, address, phone, website, category,
        |      rating, review count, place_id, maps url
        v
   2. BUSINESS EXISTENCE CHECK (place_id ada + status bukan permanently_closed)
        |
        v
   3. WEBSITE VERIFICATION      (hanya jika langkah 2 lulus)
        |
        v
   4. SOCIAL VERIFICATION       (hanya jika langkah 2 lulus)
        |
        v
   5. ENTITY RESOLUTION  --similarity tinggi--> entity_match_candidates (pending)
        |                                        -> human review, tidak auto-merge
        v
   6. TRUST SCORE
        |
        v
    verified   --(lolos 5 gate promosi)-->  promote_candidate()  -->  promoted
                                                    |
                                                    v
                                            prospects (alur sales existing:
                                            validation ladder, audit, outreach,
                                            convert to lead)  -> prospect_outcomes
```

Gate promosi (semua wajib):
1. Business existence terverifikasi (Google Maps).
2. Minimal satu `prospect_enrichments` sukses.
3. Duplicate check lulus (`unique`, atau `suspected` yang sudah di-reject reviewer).
4. `icp_score >= ICP_THRESHOLD` (default 60, dapat diatur).
5. `trust_score >= TRUST_THRESHOLD` (default 65, dapat diatur).

Kandidat tidak pernah muncul di Daily Sales Queue. Queue tetap hanya membaca `prospects`.

---

## 4. DATA OWNERSHIP RULE

| Aktor | Boleh menulis | Dilarang |
|---|---|---|
| AI Discovery Agent | `business_name`, `industry`, `city`, `country`, hipotesis, alasan, `raw_payload` | telepon, email, alamat, website, URL Maps, URL sosial, klaim "verified" |
| Verification Agent (Apify/fetch) | `prospect_enrichments.*` dan field fakta pada candidate/prospect yang berasal dari enrichment (`contact_phone`, `contact_email`, `website`, `google_maps_url`, `social_media`, `*_source`, `*_source_url`) | menulis insight/hipotesis |
| Intelligence Agent (AI) | `business_profile`, `opportunity_reason`, `recommended_solution`, `sales_approach`, `buying_signal`, `decision_maker` (hipotesis, wajib menyebut evidence) | mengubah field fakta eksternal |
| Human | promosi, verdict duplicate, approve outreach, `prospect_outcomes`, koreksi manual (tercatat sebagai `manual` source) | — |

Penegakan (tiga lapis, bukan sekadar dokumen):
- **Schema**: field fakta pada candidate hanya diisi lewat fungsi `applyEnrichment()`; kolom `*_source` wajib terisi saat field fakta terisi (CHECK constraint pasangan value+source).
- **Kode**: discovery prompt + parser AI membuang field kontak secara paksa (whitelist field, bukan blacklist).
- **Audit**: setiap perubahan field fakta menulis baris `prospect_activities` dengan aktor (`ai` / `external:<provider>` / `human:<email>`).

---

## 5. AUDIT TRAIL STRATEGY

1. **Immutable evidence** — `prospect_enrichments` append-only (tidak ada UPDATE/DELETE untuk role non-service). Menyimpan provider, actor, timestamp, source_url, raw_response, verified_fields, confidence.
2. **Field-level provenance** — tiap field fakta punya `*_source` + `*_source_url` (sudah ada di `prospects`, ditambahkan juga di candidate) sehingga pertanyaan "darimana nomor ini?" dijawab satu klik ke enrichment row.
3. **Change log** — perubahan status kandidat, promosi, duplicate verdict, dan koreksi manual ditulis ke `prospect_activities` (tabel existing) dengan `meta.actor_kind`.
4. **Job trace** — tiap enrichment menyimpan `job_id` sehingga bisa ditelusuri: job -> enrichment -> field -> prospect.
5. **Random audit** — sistem audit 10% yang sudah ada tetap berjalan, ditambah kolom evidence dari enrichment.
6. **Retensi** — raw_response disimpan penuh; tidak ada penghapusan otomatis pada fase ini.

---

## 6. MIGRATION IMPACT TERHADAP TABEL EXISTING

| Objek | Dampak | Risiko |
|---|---|---|
| `prospects` | +5 kolom nullable/default, +trigger normalisasi nama, backfill `business_name_normalized` | Rendah. Query lama tetap valid (`SELECT` kolom eksplisit). |
| `prospect_campaigns` | +2 kolom dengan default | Rendah. Kampanye lama otomatis `pipeline_version = 'v3'`. |
| `prospect_activities` | Tidak berubah struktur; dipakai untuk log baru | Nihil |
| `prospect_audits`, `prospect_runs`, `prospect_job_state`, `prospect_icp_config` | Tidak berubah | Nihil |
| RLS/GRANT | Tabel baru memakai pola existing: read `has_workspace_access`, write `can_work_leads`, admin `can_manage_business`; `service_role` untuk worker. RLS tabel lama **tidak disentuh**. | Nihil |
| `consultations`, `clients`, `invoices`, `proposals`, portal, billing | Tidak disentuh | Nihil |
| Kode existing | `PROSPECT_LIST_COLUMNS` bertambah kolom baru; `isQueueEligible` ditambah syarat trust score **hanya jika flag v4 aktif** | Rendah, terlindung feature flag |

Urutan migrasi bertahap (5 migrasi terpisah, tiap tahap bisa berhenti tanpa merusak):
- M1: `prospect_candidates` + `pg_trgm` + kolom `business_name_normalized` & backfill.
- M2: `prospect_enrichments` + kolom trust pada `prospects`.
- M3: `entity_match_candidates`.
- M4: `background_jobs` (+ jadwal worker).
- M5: `prospect_outcomes` + kolom kampanye.

---

## 7. RISIKO & MITIGASI

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Biaya Apify meledak (enrichment massal) | Tagihan tak terkendali | Budget harian per kampanye (`enrichment_budget_daily`), batch kecil per putaran worker, website/social hanya jalan bila Maps lulus, circuit breaker saat provider error beruntun, semua lewat antrean (tidak ada enrichment dari klik massal) |
| Dua alur (v3 & v4) hidup bersamaan | Kebingungan operasional | Feature flag per kampanye + tab UI terpisah; v3 tetap default sampai owner menyalakan |
| Duplicate merge salah | Data prospect rusak | Tidak ada auto-merge; hanya usulan + review manusia |
| Worker double-run / race | Enrichment dobel, biaya dobel | Lease `locked_at`/`locked_by` + klaim kondisional, unique key (candidate, source_type, hari) untuk dedupe |
| Google Maps tidak menemukan bisnis nyata (usaha kecil tanpa listing) | Kandidat valid ikut ditolak | Status `rejected` dengan alasan spesifik + jalur override manual oleh human (tercatat sebagai `manual` source, trust dibatasi 40) |
| AI tetap "mengarang" kontak | Kembali ke masalah lama | Parser whitelist: field kontak dari AI dibuang di server sebelum insert, plus CHECK constraint value-tanpa-source ditolak |
| Data lama tidak punya trust score | Prospect lama hilang dari queue | Backfill trust dari validation/contact quality yang sudah ada; syarat trust hanya berlaku untuk prospect asal v4 |
| Kunci Apify bocor | Kredensial hilang | Hanya `process.env` di server function/route lewat connector gateway; tidak pernah masuk bundle klien |
| pg_cron worker gagal diam-diam | Antrean menumpuk | `background_jobs` punya status + last_error; panel job di UI + alert lewat automation log existing |

---

## URUTAN IMPLEMENTASI SETELAH DISETUJUI

1. Candidate Layer (M1) + discovery tanpa kontak + tab Candidate Inbox.
2. Koneksi Apify + Verification Storage (M2) + Google Maps sebagai sumber utama.
3. Website & Social verification (bergantung Maps lulus).
4. Entity Resolution (M3) + tab review duplikat.
5. Trust Score + `promote_candidate()` + gate promosi.
6. Async job system (M4) + worker terjadwal.
7. Outcome loop (M5) + tab Sales Outcome + rekomendasi ICP.

Lima pertanyaan uji kelulusan sistem: asal nomor (evidence row), keberadaan bisnis (Maps place_id), alasan kecocokan (ICP breakdown), confidence (trust_score + breakdown), pola yang menghasilkan deal (outcomes vs ICP).
