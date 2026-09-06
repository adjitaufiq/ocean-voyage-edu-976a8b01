# Candidate Governance — sebelum fase Apify

Dokumen ini menutup PROMPT 1 PATCH (Data Governance Hardening). Tidak ada workflow
atau integrasi baru di sini — hanya aturan yang sudah berjalan di kode.

## 1. Daur hidup kandidat

```text
discovered ──► enriching ──► verified ──► pending_review ──► approved ──► promoted
     │             │             │              │                │
     └─────────────┴─────────────┴──────────────┴────────────────┴──► rejected ──► discovered
```

- `discovered` — hasil hipotesis AI. Tidak pernah berisi kontak.
- `enriching` — sedang dilengkapi sumber eksternal.
- `verified` — keberadaan usaha dan kontak sudah beratribusi sumber.
- `pending_review` — masuk antrean tinjauan manusia. Butuh skor ICP >= 60.
- `approved` — disetujui manusia; tercatat siapa, kapan, dan catatannya.
- `promoted` — sudah menjadi prospek di pipeline penjualan.
- `rejected` — ditolak dengan alasan; bisa dipulihkan ke `discovered`.

Skor bagus **tidak pernah** memindahkan kandidat sendiri. Promosi ke prospek hanya
mungkin setelah status `approved`.

## 2. Model kepemilikan data

| Pemilik | Field yang boleh ditulis |
| --- | --- |
| AI | why_match_icp, potential_problem_hypothesis, buying_signal_hypothesis, suggested_solution, discovery_reason |
| Sumber eksternal | phone, email, address, website, business_existence |
| Manusia | approval, sales_decision, outcome |

Aturan ini hidup di `FIELD_OWNERSHIP` / `fieldOwner()` (`src/lib/admin/prospect-candidates.ts`).
AI tidak boleh mengisi kontak; kontak tanpa sumber dikosongkan saat discovery.

## 3. Peta perpindahan status

`CANDIDATE_TRANSITIONS` + `canTransition()` menolak lompatan status. UI Candidate
inbox hanya menampilkan tombol untuk transisi yang sah:

- **Ajukan tinjauan** muncul bila transisi ke `pending_review` sah dan ICP >= `ICP_REVIEW_THRESHOLD` (60).
- **Setujui** muncul hanya dari `pending_review`.
- **Tolak** / **Pulihkan** tersedia sesuai status saat ini.

## 4. Prioritas ICP

Setiap kandidat menyimpan `icp_score` dan `icp_reason` (mis. "industri cocok,
lokasi bukan prioritas"). Kelulusan ICP adalah syarat terpisah dari bukti
keberadaan usaha — keduanya harus terpenuhi sebelum tinjauan.

## 5. Jejak audit

Tabel `prospect_candidate_events` mencatat setiap perubahan penting: event, field,
nilai lama → baru, jenis aktor (`ai` / `external` / `human` / `system`), label dan
id aktor, sumber data + URL, alasan, dan waktu. Baris tidak bisa diubah maupun
dihapus (hanya SELECT/INSERT untuk workspace). Riwayat ini tampil lewat tombol
**Riwayat** pada tiap kandidat.

## 6. Dampak database

- `prospect_candidates`: status bertambah `pending_review`, `approved`; kolom baru
  `icp_reason`, `approved_by`, `approved_by_email`, `approved_at`, `approval_note`,
  `review_requested_at`.
- Tabel baru `prospect_candidate_events` (append-only) + indeks per kandidat.
- Alur lama (Prospects, validasi, audit, Daily Sales Queue) tidak berubah.
