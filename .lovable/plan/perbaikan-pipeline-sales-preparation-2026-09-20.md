# Perbaikan Pipeline Sales Preparation

Tujuan: alur Kandidat → QC → Sales Preparation → Ready Outreach jadi sinkron, angka akurat, dan aman untuk ratusan/ribuan kandidat. Tanpa tabel baru, tanpa migrasi, tanpa menyentuh Discovery, Candidate Inbox, atau data CRM lama.

## Aturan status (disepakati)

- Status penemuan: urusan Discovery/enrichment saja.
- Hasil validasi otomatis: sinyal kualitas, bukan pintu masuk Sales Preparation.
- Keputusan QC (manusia): satu-satunya pintu masuk Sales Preparation.
- Tahap penjualan: baru berarti setelah QC approved.

Sales Preparation hanya memproses kandidat yang: QC approved, bukan duplikat, belum punya materi aktif, dan punya kontak bersumber. Kandidat yang sudah dipromosikan ke CRM tidak dibuatkan materi baru.

## Yang akan berubah

1. `src/lib/prospecting-salesprep.server.ts`
   - Generator memakai QC approved sebagai gerbang (bukan hasil validasi), menolak duplikat, melewati kandidat tanpa kontak bersumber dan yang sudah punya materi aktif atau sudah jadi prospek CRM.
   - Mengembalikan hasil rinci: `scanned`, `prepared`, `skipped`, `failed`, plus alasan per kandidat.
   - Setiap kegagalan simpan/ubah status ditangkap dan dilaporkan; tidak ada hasil sukses semu.
   - Papan dihitung ulang dari satu sumber query: Menunggu QC, Qualified (approved tanpa materi), Sales Prepared (punya materi aktif), Ready Outreach, dan Belum memenuhi syarat.
   - Mode batch: pemrosesan bertahap per potongan kecil (misal 25 kandidat per panggilan) dengan penanda posisi, sehingga tidak ada satu permintaan besar yang menggantung.

2. `src/lib/prospecting.functions.ts`
   - Fungsi manual (1 kandidat) dan fungsi batch (per kampanye/filter, satu potongan per panggilan) dipisah, keduanya mengembalikan ringkasan hasil.

3. `src/components/admin/SalesPrepPanel.tsx`
   - Kartu angka jadi: Menunggu QC Review, Qualified, Sales Prepared, Ready Outreach (+ catatan kandidat belum memenuhi syarat).
   - Daftar kandidat QC approved yang belum punya materi, dengan tombol manual "Siapkan penjualan" per kandidat.
   - Tombol baru "Siapkan penjualan massal" untuk kampanye/filter terpilih: berjalan bertahap dengan tampilan progres (total, diproses, berhasil, gagal, dilewati) dan laporan ringkas saat selesai; bisa dihentikan.
   - Tombol nonaktif bila tidak ada kandidat memenuhi syarat.

4. `src/routes/_authenticated/admin.prospects.tsx`
   - Menyambungkan dua fungsi tersebut; pesan hasil mengikuti angka server ("25 materi persiapan berhasil dibuat." / "Tidak ada kandidat yang memenuhi syarat. Kandidat masih menunggu QC approval."), sukses tidak pernah ditampilkan saat hasil 0.

5. `src/lib/admin/sales-prep.ts` + pengujian
   - Penambahan aturan kelayakan (kontak bersumber, sudah punya materi, sudah di CRM) beserta pengujiannya.

6. `docs/OUTBOUND-SOP.md` — tabel gerbang tahap disesuaikan.

## Risiko dan penanganannya

- Angka Qualified akan turun drastis (saat ini 314 kandidat masih menunggu QC). Ini memang kondisi sebenarnya; kartu "Menunggu QC Review" membuatnya jelas, dan kandidat mengalir begitu di-approve di tab QC review.
- Batch panjang: dibatasi per potongan dan diulang dari sisi tampilan, jadi tidak membebani server; progres terlihat dan bisa dihentikan.
- Materi ganda: sebelum menyimpan versi baru, versi aktif lama dinonaktifkan (tetap tersimpan sebagai riwayat) dan kandidat yang sudah punya materi aktif dilewati kecuali diminta ulang secara manual.
- Tidak ada perubahan skema, tidak ada penghapusan data, Discovery dan Candidate Inbox tidak disentuh.

## Verifikasi

Pengujian otomatis, pemeriksaan tipe, dan build; lalu uji alur satu kandidat (QC approve → siapkan → Ready Outreach) dan uji batch pada kampanye besar untuk memastikan progres dan jumlah berhasil sesuai.
