# Prompt 4.5 — Sales Preparation Intelligence

Melanjutkan pipeline yang sudah ada (Discovery → Qualification → Hot Lead). Tidak ada aplikasi baru, tidak ada tabel lama yang diubah/dihapus.

## 1. Alur

```text
Hot Lead (kandidat terkualifikasi, lolos QC)
        |
        v
Sales Preparation
  - ringkasan bisnis otomatis
  - rekomendasi pendekatan penjualan
  - draf pesan pembuka (opening, alasan, nilai, ajakan)
  - pemilihan materi/aset pendukung
        |
        v
Status: Qualified -> Sales Prepared -> Ready Outreach
        |
        v
Outreach (persetujuan manusia) -> Promosi ke daftar prospek -> CRM
```

## 2. Perubahan data

Satu tabel baru `sales_preparations` (satu baris aktif per kandidat, versi lama tetap tersimpan):
- kandidat terkait dan kampanye
- ringkasan bisnis: kondisi digital saat ini, potensi masalah, peluang, solusi KERJAKU
- kategori pendekatan (website / F&B / otomasi) beserta alasannya
- draf pesan: pembuka, alasan menghubungi, nilai yang ditawarkan, ajakan bertindak
- aset terpilih (demo QResto, portofolio website, portofolio sistem, demo dashboard)
- siapa yang membuat, kapan, sumber isi (aturan atau AI), status aktif

Dua kolom tambahan pada kandidat (opsional, aman untuk data lama):
- `sales_stage`: qualified / sales_prepared / ready_outreach
- `sales_prepared_at`

Akses: hanya anggota workspace dengan hak kerja penjualan; hak tulis mengikuti aturan yang sudah dipakai kandidat.

## 3. Cara isinya dibuat

- Fakta (kategori, rating, jumlah ulasan, status website, kota, kelengkapan kontak) diambil dari data kandidat — tidak dikarang.
- Pemetaan pendekatan dan aset bersifat deterministik: tanpa website → website + SEO lokal; restoran/kafe → QResto + pemesanan online; bisnis berkembang / butuh laporan → sistem kustom + dashboard.
- AI hanya merangkai kalimat (ringkasan, peluang, draf pesan) dari fakta tersebut; bila AI gagal, versi berbasis aturan tetap dipakai sehingga fitur tidak pernah kosong.
- Tidak ada pengiriman pesan otomatis. Draf hanya tersimpan sampai manusia menyetujui.

## 4. Sambungan ke CRM

- Saat kandidat dipromosikan menjadi prospek, ringkasan bisnis, solusi, aset, dan draf pesan ikut terbawa ke catatan prospek dan aktivitas CRM, sehingga Sales Queue dan Outreach Assistant yang sudah ada langsung memakainya.
- Status `ready_outreach` menjadi syarat tambahan kandidat masuk antrean penjualan harian.

## 5. Yang dikerjakan

- `src/lib/admin/sales-prep.ts` (baru) — aturan pendekatan, pemetaan aset, penyusun ringkasan dan draf pesan (dapat diuji tanpa database) + berkas pengujian.
- `src/lib/prospecting-salesprep.server.ts` (baru) — membuat/menyimpan persiapan per kandidat atau per kampanye (bertahap), mengubah tahap penjualan, mencatat riwayat.
- `src/lib/prospecting.functions.ts` — tiga fungsi server baru (buat persiapan, ambil persiapan, ubah tahap), tetap memakai penjagaan login + hak penjualan yang ada.
- `src/lib/prospecting-candidates.server.ts` — promosi ke prospek ikut membawa hasil persiapan.
- `src/components/admin/QualificationPanel.tsx` + panel baru `SalesPrepPanel.tsx` — tombol "Siapkan penjualan" pada Hot Lead, tampilan brief, pendekatan, draf pesan (bisa disalin/disunting), aset terpilih, dan tombol "Tandai siap dihubungi".
- `docs/OUTBOUND-SOP.md` — bagian baru Sales Preparation.

## 6. Risiko

- Kandidat lama belum punya persiapan → disediakan tombol buat massal per kampanye, berjalan bertahap.
- Draf AI bisa kurang pas → selalu bisa disunting manusia; tidak ada pengiriman otomatis.
- Volume besar → pembuatan dibatasi per batch seperti pekerja penemuan, dengan hitungan pemakaian harian.
- Menandai "siap dihubungi" tanpa kontak terverifikasi → dicegah; kandidat tanpa kontak bersumber tidak bisa naik tahap.
