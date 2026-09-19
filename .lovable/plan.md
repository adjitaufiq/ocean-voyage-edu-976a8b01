# Perbaikan Status Pipeline Kandidat (Sales Preparation)

## Temuan dari data & kode

Data nyata sekarang (315 kandidat):

| candidate_status | validation_status | qc_status | sales_stage | jumlah |
| --- | --- | --- | --- | --- |
| discovered | validated | new | qualified | 309 |
| enriching | validated | new | qualified | 4 |
| verified | validated | new | qualified | 1 |
| discovered | validated | approved | qualified | 1 |

Jadi hampir semua kandidat berhenti di QC "new". Halaman Sales Preparation menghitung "Qualified" dari `sales_stage` (default `qualified` untuk semua baris), sementara generator hanya membuat materi untuk kandidat `qc_status = approved`. Hasilnya: counter Qualified 100, prepared 0, dan tombol tetap memunculkan toast sukses walau `prepared = 0`.

## 1. Source of truth

Tidak membuat status baru. Tetap empat field, tapi dengan peran yang tegas dan satu status turunan untuk tampilan:

- `candidate_status` — status teknis penemuan/enrichment (discovered, enriching, verified, pending_review, approved, rejected).
- `validation_status` — hasil validasi bisnis otomatis (pending / validated / rejected).
- `qc_status` — keputusan manusia (new / reviewed / approved / rejected / duplicate).
- `sales_stage` — hanya tahap penjualan setelah QC approved (qualified / sales_prepared / ready_outreach).

Aturan baru: `sales_stage` tidak lagi berarti apa-apa sebelum QC approved. Semua hitungan dan daftar di tab Sales Preparation disaring dulu dengan `qc_status = 'approved'`.

## 2. State machine

```text
discovered ──validasi──> validated ──QC manusia──> qc approved
                 │                          │
                 └──> rejected              ├─> qualified (siap dibuatkan materi)
                                            ├─> sales_prepared (materi aktif ada)
                                            └─> ready_outreach (kontak bersumber + materi)
                                                        └─> promote ke prospects (CRM)
```

Transisi `sales_stage` hanya boleh terjadi bila `qc_status = 'approved'`.

## 3. Perubahan minimum yang aman

Tanpa migrasi data destruktif; tidak ada kolom dihapus, tidak ada baris diubah massal.

- `src/lib/prospecting-salesprep.server.ts`
  - `buildSalesPrepBoard`: filter dasar `qc_status = 'approved'` dan bukan duplikat. Counter dihitung dari baris hasil filter itu: Qualified = approved tanpa materi aktif, Sales Prepared = punya materi aktif, Ready Outreach = `sales_stage = 'ready_outreach'`. Tambah counter `awaitingQc` supaya panel bisa menjelaskan kandidat yang tertahan di QC.
  - `prepareSalesForCandidates`: query utama pakai `qc_status = 'approved'` (bukan hanya `validation_status`), dan kembalikan `skippedReasons` ringkas (belum QC approved / duplikat) agar UI punya pesan jelas.
- `src/lib/prospecting.functions.ts`: teruskan field tambahan hasil di atas (tipe balikan saja).
- `src/components/admin/SalesPrepPanel.tsx`
  - Tombol "Siapkan penjualan" nonaktif jika tidak ada kandidat QC approved yang belum punya materi.
  - Toast mengikuti hasil: `prepared > 0` → sukses dengan jumlah; `prepared = 0` → peringatan berisi alasan ("X kandidat menunggu QC review").
  - Setelah mutation, refresh board (invalidate query) supaya kartu selalu sinkron dengan database.
  - Tambah baris ringkas "Menunggu QC review: N" dengan tautan ke tab QC review.
- `src/routes/_authenticated/admin.prospects.tsx`: blok Acquisition pipeline memakai angka yang sama dengan board (prepared/ready dari sumber yang sudah difilter), dan tombol "Siapkan penjualan" di tab QC review hanya muncul untuk baris approved.

Migrasi kandidat lama: tidak perlu. 310 kandidat existing sudah `validated` + `qc_status = new`; setelah perbaikan mereka tampil sebagai "menunggu QC review" dan mengalir normal begitu di-approve di tab QC review. Satu kandidat yang sudah approved akan langsung muncul sebagai Qualified yang bisa disiapkan.

## 4. Hasil yang dijamin

- Counter dashboard dihitung dari query yang sama dengan daftar kartu — tidak bisa berbeda.
- Tombol hanya aktif saat ada kandidat eligible.
- Tidak ada toast sukses palsu: `prepared = 0` selalu memunculkan pesan alasan.
- Kartu Sales Preparation selalu di-refresh dari database setelah aksi.

## Verifikasi

`bunx vitest run`, `bunx tsgo --noEmit`, `bun run build`, plus uji manual: approve satu kandidat di QC review → jumlah Qualified naik → klik Siapkan penjualan → kartu muncul dan Sales Prepared naik.
