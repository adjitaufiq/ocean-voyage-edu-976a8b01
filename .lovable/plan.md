# Refactor alur penjualan + lapisan kandidat

Sebagian besar rangka sudah ada (lapisan Kandidat, verifikasi Apify, validasi, ICP, pipeline). Yang belum: kunci anti-duplikat yang tegas, penyimpanan kontak pada kandidat, penyisipan massal, dan status sesuai penamaan baru. Semua perubahan bersifat menambah — tidak ada tabel atau alur lama yang dihapus.

## 1. Perubahan database (satu migrasi tambahan)

Pada `prospect_candidates`:
- Kolom baru: `website`, `contact_data` (jsonb, diisi hanya oleh sumber eksternal), `dedupe_key` (teks, terisi otomatis dari nama ternormalisasi + kota).
- Indeks unik parsial pada `dedupe_key` agar penemuan ulang tidak menumpuk data kembar; indeks bantu pada `candidate_status` dan `campaign_id`.
- Status tambahan sebagai alias penamaan baru: `raw`, `processing`, `verified_candidate`, `duplicate`. Status lama (`discovered`, `enriching`, `verified`, `pending_review`, `approved`, `rejected`, `promoted`, `enrichment_failed`) tetap sah, jadi data lama tidak rusak.
- Trigger pengisi `dedupe_key` saat simpan.

Tidak ada `DROP`, tidak ada perubahan tipe, tidak ada perubahan aturan akses tabel lama.

## 2. Berkas yang berubah

- `src/lib/admin/prospect-candidates.ts` — status baru + label, peta perpindahan status, pemetaan alias status lama→baru.
- `src/lib/prospecting-candidates.server.ts` — penemuan AI menyimpan sekaligus (bulk insert) alih-alih satu per satu, menyaring kembar lewat `dedupe_key`, mencatat riwayat secara massal, dan menandai kandidat kembar sebagai `duplicate` alih-alih membuangnya diam-diam.
- `src/lib/prospecting-apify.server.ts` — menulis hasil verifikasi ke `contact_data` + `website` pada kandidat, dan memperketat syarat promosi (bisnis terbukti ada, bukti eksternal ada, cek kembar lolos, ambang kepercayaan lolos, sudah disetujui manusia).
- `src/routes/_authenticated/admin.prospects.tsx` — filter dan label status baru pada tab Candidate inbox.
- `docs/CANDIDATE-GOVERNANCE.md` — daur hidup diperbarui.

## 3. Alur lama vs baru

```text
Lama : AI Discovery -> prospects -> validasi -> sales
Baru : AI Discovery -> prospect_candidates (raw)
        -> verifikasi data eksternal (Google Maps dulu, waterfall)
        -> deteksi kembar
        -> validasi
        -> penilaian kepercayaan
        -> prospects -> Sales Queue
```

Antrean penjualan tetap hanya membaca tabel `prospects` dengan tahap `sales_ready` — kandidat mentah, kembar, atau ditolak tidak pernah muncul di sana. Perilaku ini sudah berlaku dan akan diuji ulang.

## 4. Risiko

- Indeks unik `dedupe_key` bisa menolak baris jika data lama sudah punya kembar. Ditangani dengan indeks unik parsial (hanya baris berstatus aktif) dan pengisian nilai bertahap sebelum indeks dibuat.
- Penyisipan massal mengembalikan galat per-batch, bukan per-baris; ringkasan hasil penemuan akan menyebut jumlah tersimpan/dilewati agar tetap jelas.
- Status baru berdampingan dengan status lama; layar bisa terasa punya dua penamaan. Diatasi dengan label yang menyatu di UI.

## 5. Cara membatalkan

Setiap langkah berdiri sendiri: hapus indeks dan kolom baru (`website`, `contact_data`, `dedupe_key`) lalu kembalikan daftar status ke bentuk lama — data dan alur lama tetap utuh karena tidak ada yang dihapus atau diubah tipenya. Di sisi kode, perubahan hanya menambah cabang baru sehingga bisa dikembalikan per berkas.
