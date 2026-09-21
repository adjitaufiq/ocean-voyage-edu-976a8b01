# Unified AI Sales Pipeline — satu entitas bisnis, satu jalur

## Tujuan
Semua bisnis hidup di satu jalur: ditemukan → diproses AI → masuk antrean siap hubungi. Manusia hanya mencentang bukti dan menekan WhatsApp. Tidak ada tombol approve, generate, atau pindah tahap manual.

## Keputusan arsitektur
Tetap memakai `prospect_candidates` sebagai entitas bisnis tunggal (sudah memuat nama, lokasi, telepon, website, tautan Maps, sumber, skor, keyakinan, tahap, ceklis, tahap kontak). Materi penjualan tetap di `sales_preparations` sebagai riwayat versi, satu versi aktif per bisnis. Tabel `prospects` lama dibekukan sebagai arsip CRM 2026-09 — tidak dihapus, tidak ditulis lagi oleh pipeline baru.

Alasan tidak membuat tabel `business_leads` baru: seluruh kolom yang diminta sudah ada, migrasi besar berisiko memutus Discovery, QC, dan materi yang sudah berjalan, sementara manfaatnya hanya kosmetik penamaan.

## Perubahan

### 1. Satu sumber angka dashboard
Satu fungsi server `pipelineOverview` mengembalikan seluruh angka dari `prospect_candidates`:
ditemukan, diproses AI, menunggu verifikasi manusia, siap outreach, sudah diverifikasi, sudah dihubungi, ditolak, duplikat.
Blok "CRM pipeline (prospek)" diberi label eksplisit "Arsip CRM lama (2026-09)" agar 242 baris lama tidak lagi terbaca sebagai bagian pipeline aktif.

### 2. Setiap angka bisa diklik
Tiap kartu angka menjadi tombol yang membuka daftar bisnisnya di tab yang sama, dengan detail lengkap: nama, lokasi, rating, website, telepon, sumber, bukti, keyakinan, penalaran AI, peluang, sudut penjualan, draf WhatsApp.

### 3. Hapus tombol manual antar tahap
Dihapus dari tampilan: "Siapkan penjualan", "Siapkan penjualan massal", "Tandai Ready Outreach", "Kembalikan ke Sales Prepared", approve/reject manual massal di tab QC.
Yang tersisa untuk manusia: ceklis verifikasi, Edit pesan, Hubungi WhatsApp, Copy, Lihat sumber, Tandai sudah dihubungi, tahap CRM.
Fungsi servernya dipertahankan (dipakai orkestrasi dan pemulihan), hanya pemicu manualnya yang hilang dari layar.

### 4. Pipeline mengejar sisa antrean
Saat ini 141 bisnis berhenti di tahap "qualified" karena batas kerja per putaran. Putaran diubah agar mengulang potongan kerja sampai antrean habis atau batas waktu aman tercapai, dan frekuensi jadwal dinaikkan dari tiap jam menjadi tiap 15 menit.

### 5. Deteksi duplikat dijalankan otomatis
Seluruh 540 bisnis berstatus duplikat "belum diperiksa". Pemeriksaan duplikat (nama ternormalisasi + kota/provinsi, atau tautan Maps yang sama) dijalankan sebagai tahap tetap dalam setiap putaran, sebelum materi penjualan dibuat. Duplikat tidak dihapus, hanya ditandai dan dikeluarkan dari antrean.

### 6. Bukti wajib, tanpa pengecualian
6 materi aktif tersimpan tanpa bukti. Penyimpanan materi ditolak bila bukti kosong, dan bukti dibangun ulang otomatis dari data bisnis saat dibaca.

### 7. Alasan penolakan wajib
Setiap penolakan otomatis maupun manusia menyimpan salah satu alasan baku: tidak sesuai target, data tidak valid, bisnis tutup, duplikat.

## File yang berubah
- `src/lib/sales-pipeline.server.ts` — tahap duplikat, pengulangan potongan kerja, ringkasan pipeline tunggal
- `src/lib/prospecting-salesprep.server.ts` — bukti wajib, papan memakai ringkasan tunggal
- `src/lib/prospecting-qualification.server.ts` — alasan penolakan baku
- `src/lib/prospecting.functions.ts` — fungsi ringkasan baru, pemicu manual tidak diekspor ke layar
- `src/components/admin/SalesPrepPanel.tsx` — kartu angka bisa diklik, tombol manual antar tahap dihapus
- `src/routes/_authenticated/admin.prospects.tsx` — satu sumber angka, label arsip CRM
- migrasi jadwal: `kerjaku-sales-pipeline` tiap 15 menit
- `docs/OUTBOUND-SOP.md`

## Yang tidak disentuh
Tidak ada tabel dihapus, tidak ada kolom dihapus, tidak ada data lama diubah. Discovery, Candidate Inbox, dan 242 prospek arsip tetap apa adanya.

## Risiko
Angka "Sales prepared" dan "Ready outreach" akan bergeser setelah duplikat ditandai — ini koreksi, bukan kehilangan data. Menaikkan frekuensi jadwal menambah pemakaian kuota Google Maps; batas harian per kampanye tetap berlaku.
