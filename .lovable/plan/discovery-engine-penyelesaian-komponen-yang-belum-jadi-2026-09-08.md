# Discovery Engine — penyelesaian komponen yang belum jadi

Melanjutkan Sales Intelligence yang sudah ada. Tidak membuat aplikasi baru, tidak mengulang AI Screening, Lead Scoring, Digital Gap, QC Pipeline, dan Sales Preparation — semuanya dipakai ulang apa adanya.

## 1. File yang berubah

Baru:
- `src/lib/integrations/discovery/provider.ts` — kontrak penyedia data: `searchBusinesses()`, `getBusinessDetail()`, `normalizeResult()`, plus `resolveDiscoveryProvider(name)`.
- `src/lib/integrations/discovery/mock.provider.ts` — penyedia uji (data deterministik, bisa dipakai sekarang tanpa koneksi apa pun).
- `src/lib/integrations/discovery/google-maps.provider.ts` — pembungkus tipis di atas `maps.server.ts` yang sudah ada; aktif otomatis begitu koneksi Google Maps dipasang, jika belum terpasang ia melapor "belum terkonfigurasi" tanpa mematikan sisanya.
- `src/lib/integrations/discovery/apify.provider.ts` — cadangan masa depan memakai klien Apify yang sudah ada.
- `src/lib/prospecting-discovery.server.ts` — pemecah kampanye menjadi tugas + pekerja penemuan.
- `src/routes/api/public/hooks/discovery-worker.ts` — jalur pemanggilan terjadwal (dilindungi kunci penjadwal yang sudah dipakai hook lain).
- `src/lib/prospecting-discovery.test.ts` — pengujian dengan penyedia uji.

Diubah:
- `src/lib/prospecting.functions.ts` — fungsi server: buat tugas, jalankan batch, ulangi tugas gagal, baca ringkasan Discovery.
- `src/routes/_authenticated/admin.prospects.tsx` — tab **Discovery** baru.
- `docs/OUTBOUND-SOP.md` — satu bagian cara kerja Discovery.

## 2. Database yang berubah

Tidak ada migrasi baru. Semua tabel yang dibutuhkan sudah dibuat pada langkah sebelumnya: `discovery_tasks`, `candidate_sources`, `candidate_status_history`, `discovery_usage_daily`, serta kolom penemuan pada `prospect_campaigns` dan `prospect_candidates`.

## 3. Risiko migration

Rendah — tanpa perubahan skema, tanpa penghapusan data. Risiko yang tersisa bersifat operasional: pemakaian kuota penyedia data (dibatasi jumlah tugas per jalan dan pencatat kuota harian) dan tugas yang berjalan dobel (dicegah kunci sewa satu-jalan + penanda tugas idempoten, sehingga tugas yang sudah selesai dilewati, bukan diulang).

## 4. Cara kerja singkat

- **Pemecah kampanye:** kata kunci × wilayah menghasilkan baris `discovery_tasks` (menunggu → berjalan → selesai / gagal), dibatasi target kandidat kampanye.
- **Pekerja:** ambil sejumlah kecil tugas menunggu → panggil penyedia → normalkan → cek kembar (ID tempat, nama+alamat, sudah ada di CRM) → tolak yang tutup permanen / kategori tak sesuai → simpan kandidat dengan skor dan alasan dari mesin screening yang sudah ada → catat sumber data, riwayat status, dan pemakaian harian.
- **Ketahanan:** batas kerja per jalan, percobaan ulang berbatas dengan jeda, pencatatan galat pada tugas, berhenti total saat penyedia menolak kredensial.
- **Tanpa** peramban, extension, Playwright, atau Puppeteer.

## 5. Testing plan

- Pengujian unit dengan penyedia uji: pemecahan kampanye menghasilkan jumlah tugas benar; jalan kedua tidak menggandakan kandidat (idempoten); kandidat kembar ditandai bukan dihapus; usaha tutup permanen ditolak; tugas gagal naik hitungan percobaan lalu berhenti di batas.
- Pengujian penyedia: kontrak yang sama dipenuhi penyedia uji dan Google Maps; penyedia yang belum terkonfigurasi melapor jelas.
- Pemeriksaan tipe, seluruh pengujian yang ada, dan build produksi.
- Cek tampilan tab Discovery memakai kampanye contoh dengan penyedia uji.
