# Phase A — Unified Pipeline Cutover (polishing)

## A1. Hasil audit alur produksi saat ini

```text
Discovery -> Candidate -> [Entity: HANYA backfill manual] -> Qualification/QC otomatis
          -> Sales Preparation (aturan lama, diagnosis sendiri) -> Ready Outreach -> CRM
          [Consultant Engine: hanya dijalankan manual / massal, tidak di jalur otomatis]
```

Gap yang ditemukan di kode:
1. **Entity bukan canonical otomatis.** Discovery menyimpan kandidat baru tanpa membuat/menautkan Business Entity. Tautan hanya terbentuk saat backfill manual dijalankan.
2. **Consultant Engine tidak ada di putaran otomatis.** Siklus terjadwal: rencana -> discovery -> screening/QC -> materi -> ready outreach. Tidak ada langkah analisis konsultan.
3. **Sales Preparation masih mendiagnosis sendiri.** Penyimpanan materi memakai aturan lama (pendekatan, solusi, alasan) dan tidak pernah mengisi kolom tautan entitas / analisis / versi analisis / revisi sumber yang sudah disiapkan di Phase 4.
4. **Ready Outreach tidak memeriksa analisis.** Kenaikan ke Ready Outreach hanya memeriksa QC, materi aktif, dan kontak bersumber. Tidak memeriksa entitas, analisis aktif, status kedaluwarsa, atau versi analisis materi.
5. **Tidak ada saklar cutover / rollback,** dan sumber keputusan (analisis konsultan vs aturan lama) tidak tercatat.

## A2. Perubahan (semua aditif)

**Saklar cutover** — satu pengaturan `unified_pipeline` (mode: `off` | `shadow` | `on`), dibaca server, bawaan `shadow`.
- `off`: perilaku persis seperti sekarang (rollback instan).
- `shadow`: entitas + analisis dibuat, materi tetap aturan lama tapi tertaut ke analisis; hanya peringatan.
- `on`: materi mengambil masalah/solusi/fitur/paket dari analisis terkini; aturan lama hanya cadangan bila analisis tidak tersedia.

**1. Entity otomatis** — setelah kandidat baru disimpan oleh discovery, jalankan resolver entitas yang sudah ada untuk kandidat itu saja (buat/tautkan, tanpa merge paksa). Gagal = dicatat, tidak menghentikan discovery. Backfill manual tetap ada.

**2. Langkah analisis konsultan di siklus terjadwal** — langkah baru antara QC dan materi: kandidat QC approved yang entitasnya belum punya analisis terkini (atau kedaluwarsa) dianalisis, dibatasi per putaran. Memakai mesin dan aturan versi yang sudah ada (tidak generate ulang bila sidik jari sama).

**3. Sales Preparation sebagai adapter** — saat menyimpan materi: isi tautan entitas, id analisis, versi analisis, revisi sumber, dan penanda sumber keputusan (`consultant_analysis` / `legacy_rules`). Mode `on` + analisis tersedia -> ringkasan, arah solusi, dan paket diambil dari analisis; draf pesan memakai penyusun konsultatif Phase 4. Tidak ada diagnosis baru.

**4. Perlindungan Ready Outreach** — pemeriksaan baru: entitas ada, analisis aktif ada, tidak kedaluwarsa, materi memakai versi analisis terbaru. Mode `on`: kandidat yang gagal tidak dinaikkan otomatis dan diberi alasan. Semua mode: kartu menampilkan peringatan dan tombol "Perbarui materi"; tidak pernah membuat diagnosis lama baru.

**5. Logging sumber keputusan** — tiap materi dan tiap putaran mencatat sumber keputusan dan hitungan (dari analisis / cadangan aturan lama / diblokir) ke log otomasi yang sudah ada.

## Perubahan data (aditif)
- `sales_preparations`: `decision_source text` (nullable).
- Pengaturan saklar di tabel ringan baru `pipeline_settings` (key, value) dengan GRANT + RLS (baca tim, ubah pemilik/admin). Tidak ada DROP/DELETE/rename.

## Tidak disentuh
Chatbot (prompt, alur, logika percakapan), renderer Order Brief, PDF/proposal, tabel lama, scheduler/retry/CRM yang ada.

## Detail teknis
- Baru: `src/lib/pipeline-flags.server.ts`, `src/lib/admin/outreach-guard.ts` (+ test).
- Diubah: `prospecting-discovery.server.ts` (resolve entitas per kandidat baru), `entity-resolution.server.ts` (ekspor resolver satu catatan), `sales-pipeline.server.ts` (langkah analisis + guard + log), `prospecting-salesprep.server.ts` (adapter + kolom tautan), `SalesPrepPanel.tsx` (peringatan guard), halaman pengaturan admin (saklar mode).

## A3. Pengujian
Typecheck, seluruh test lama, test baru guard + adapter (mode off/shadow/on, cadangan saat analisis tidak ada), uji 10 industri tanpa kosakata kuliner bocor, build. Lalu laporan dan berhenti.
