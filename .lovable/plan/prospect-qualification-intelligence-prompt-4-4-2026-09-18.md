# Prospect Qualification Intelligence (Prompt 4.4)

Mengubah kandidat hasil penemuan Google Maps menjadi peluang penjualan tervalidasi, memakai pipeline yang sudah ada — tidak ada sistem baru, tidak ada tabel lama yang dihapus.

## 1. Perubahan data

Sebagian besar kolom sudah ada di kandidat: skor, suhu lead (Hot/Warm/Cold), alasan lead, celah digital, solusi disarankan, prioritas penjualan, serta status QC + peninjau + alasan + waktu.

Yang ditambahkan (semuanya opsional, aman untuk data lama):

- `pain_signal` — sinyal masalah bisnis
- `validation_status` (`pending` / `validated` / `rejected`) + `validation_reason` + `validated_at`
- `validation_checks` (rincian 7 pemeriksaan) dan `qualified_at`
- Status QC tambahan: `contact_ready` (siap dihubungi), melengkapi New / Reviewed / Approved / Rejected / Duplicate

Tidak ada tabel baru: menambah kolom ke kandidat lebih aman daripada tabel skor terpisah yang harus disinkronkan.

## 2. Alur data

```text
Discovery (Maps/mock)
   -> Validasi bisnis (7 cek)  -> rejected + alasan
   -> Analisis celah digital
   -> Skor 0-100 + Hot/Warm/Cold
   -> Alasan lead, sinyal masalah, solusi, prioritas
   -> Antrean QC (Approve / Reject / Duplicate / Minta verifikasi / Contact ready)
   -> Promosi jadi prospek (gate manusia, seperti sekarang)
```

Validasi memeriksa: bisnis benar ada, lokasi valid, kategori sesuai kampanye, bisnis masih aktif, bukan duplikat, kontak valid & bersumber, negara sesuai aturan (Indonesia / +62). Kandidat gagal validasi tidak dihapus — statusnya jadi ditolak dengan alasan tercatat.

Penilaian tetap deterministik (fakta dari Maps: rating, ulasan, kategori, lokasi, status website, kelengkapan kontak) sehingga angkanya bisa dipertanggungjawabkan; AI hanya menulis kalimat alasan/solusi, tidak pernah mengarang fakta kontak.

## 3. File yang berubah

- `src/lib/admin/qualification.ts` (baru) — aturan validasi, analisis celah digital, rumus skor, label, dan penyusun alasan; bisa diuji tanpa database.
- `src/lib/prospecting-qualification.server.ts` (baru) — menjalankan kualifikasi per kandidat / per kampanye, menulis hasil + riwayat status.
- `src/lib/prospecting-discovery.server.ts` — kandidat baru langsung lewat kualifikasi; ringkasan dashboard menambah hitungan Found / Validated / Qualified / Hot.
- `src/lib/prospecting-candidates.server.ts` — aksi QC (approve, reject, duplicate, minta verifikasi, contact ready) menyimpan peninjau, waktu, alasan.
- `src/lib/prospecting.functions.ts` — fungsi server baru (kualifikasi ulang, aksi QC), tetap dengan pemeriksaan login + hak akses penjualan.
- `src/routes/_authenticated/admin.prospects.tsx` — tab QC Review dengan tombol aksi, dan kartu Hot Lead Dashboard dengan filter kategori, lokasi, skor, celah digital, dan solusi.
- `src/lib/admin/qualification.test.ts` (baru) + `docs/OUTBOUND-SOP.md` diperbarui.

## 4. Risiko & penanganan

- Kandidat lama belum punya hasil kualifikasi -> tombol "Kualifikasi ulang" per kampanye untuk mengisi mundur; tampilan tetap aman saat nilai kosong.
- Aturan validasi terlalu ketat bisa menolak bisnis yang sebenarnya layak -> penolakan selalu menyimpan alasan dan bisa dikembalikan lewat QC.
- Skor berubah untuk kandidat yang sudah ditinjau -> kualifikasi ulang tidak menimpa keputusan QC manusia.
- Volume besar -> kualifikasi berjalan bertahap per batch, mengikuti pola pekerja penemuan yang sudah ada.

Implementasi dilakukan bertahap: data & aturan, lalu QC, lalu dashboard.
