# Phase 6/6 — Feedback Loop, CRM Intelligence, Re-analysis

Hasil audit dulu, lalu rencana. Tidak ada pipeline baru, tidak ada CRM baru, chatbot dan Order Brief tidak disentuh.

## Hasil audit Phase 1-5

Yang sudah benar:
- Kandidat, prospek, konsultasi, dan percakapan AI semuanya sudah tertaut ke satu identitas bisnis lewat tautan entitas; materi penjualan dan Ready Outreach sudah membaca analisis konsultan lewat tautan itu.
- Versi analisis sudah punya versi mesin, versi pengetahuan, sidik jari masukan, dan revisi sumber; analisis tidak dibuat ulang kalau masukannya sama.
- Riwayat aktivitas kandidat dan prospek tetap utuh di tempat lama.

Celah yang membuat Phase 6 belum jalan:
1. Tabel temuan bisnis (fakta/dugaan) sudah ada sejak Phase 1 tetapi **belum pernah diisi** — hanya dibaca di halaman detail. Jadi siklus hidup temuan belum berjalan.
2. **Tidak ada tempat menyimpan respons customer**. Balasan WhatsApp, email, catatan sales, dan catatan konsultasi tidak masuk ke identitas bisnis.
3. **Keberatan customer tidak tersimpan** sama sekali; panduan keberatan hanya dihasilkan mesin, tidak pernah belajar dari jawaban nyata.
4. Penanda "analisis kedaluwarsa" di layar Ready Outreach hanya membandingkan waktu perubahan data kandidat, bukan status analisis. Tidak ada pemicu kedaluwarsa dari temuan baru.
5. Analisis konsultan tidak membaca temuan terkonfirmasi, jadi informasi baru dari customer tidak pernah mengubah diagnosis.
6. Ringkasan konteks penjualan dihitung ulang setiap dibaca dan tidak tersimpan berversi.

## Yang akan dibangun

### Basis data (aditif, tanpa hapus/ubah data lama)
- `business_interactions` — log respons customer per bisnis: kanal (whatsapp/email/catatan sales/catatan konsultasi/CRM), arah, isi pesan, waktu, rujukan data lama (kandidat/prospek/percakapan), pencatat.
- `business_objections` — kategori keberatan, kutipan, respons yang dipakai, hasil penyelesaian, rujukan interaksi.
- `sales_context_snapshots` — snapshot berversi untuk Sales Agent (profil, analisis aktif, fakta terkonfirmasi, dugaan aktif, keyakinan, pertanyaan berikutnya, panduan keberatan, info customer terbaru). Snapshot lama tidak pernah ditimpa.
- `business_findings` ditambah kolom: `topic_key` (untuk mencocokkan dugaan lama dengan jawaban baru), `superseded_by_id`, `interaction_id`.
- `business_consultant_analyses` ditambah `stale_reason` (alasan kedaluwarsa, agar peringatan bisa menjelaskan sebabnya).

### Modul logika murni (bisa diuji, tanpa database)
- `src/lib/admin/response-analysis.ts` — membaca teks respons customer dan menghasilkan temuan (fakta vs dugaan), kategori keberatan, keyakinan, dan sumber. Netral industri; tidak ada kosakata kuliner.
- `src/lib/admin/finding-lifecycle.ts` — aturan siklus hidup: dugaan lama dengan topik sama menjadi *rejected* atau *superseded*, temuan baru ditambahkan sebagai *confirmed*, riwayat tidak pernah dihapus; memutuskan apakah analisis perlu ditandai kedaluwarsa.

### Layanan server
- `src/lib/crm-intelligence.server.ts` — mencatat respons customer ke identitas bisnis, menulis temuan + keberatan, menandai analisis kedaluwarsa bila temuan penting berubah, dan membaca riwayat kecerdasan CRM per bisnis.
- `src/lib/consultant-engine.service.ts` (perluasan, bukan penulisan ulang):
  - masukan analisis kini membaca temuan terkonfirmasi dan menyingkirkan dugaan yang sudah ditolak;
  - analisis aktif dibaca lewat penanda analisis aktif sehingga statusnya (aktif/kedaluwarsa) ikut terbaca;
  - fungsi analisis ulang khusus bisnis yang kedaluwarsa, menghasilkan versi baru dan menyimpan snapshot konteks penjualan baru. Versi lama tetap tersimpan.
- Aturan pembuatan ulang tidak berubah: aktivitas CRM biasa, follow up, atau perubahan waktu **tidak** memicu analisis ulang.

### Fungsi server + tampilan
- `src/lib/crm-intelligence.functions.ts` — catat respons customer, catat keberatan, jalankan analisis ulang, baca kecerdasan bisnis (semuanya dengan pemeriksaan hak akses yang sudah ada).
- `SalesPrepPanel` — kotak "Catat respons customer" pada kartu materi, daftar keberatan tersimpan, dan peringatan tegas bila analisis kedaluwarsa: "Analisis bisnis sudah berubah, perlu diperbarui sebelum follow up." disertai tombol perbarui; tombol WhatsApp tetap butuh ceklis lengkap.
- Halaman detail bisnis — bagian riwayat interaksi, temuan (fakta terkonfirmasi vs dugaan aktif vs ditolak), dan keberatan.

### Pengujian
- Uji siklus hidup temuan (dugaan booking ditolak setelah customer bilang sudah pakai aplikasi booking, temuan baru tercatat, riwayat tetap ada).
- Uji ujung-ke-ujung logika: penemuan → analisis → materi → respons customer → temuan → analisis versi baru → konteks penjualan baru, untuk salon, klinik, bengkel, agency, EO, retail, laundry, education, interior, dan jasa umum; termasuk pemeriksaan tidak ada kosakata kuliner dan tidak ada diagnosis ganda.

## Yang tidak disentuh
Chatbot dan alur percakapannya, Order Brief beserta PDF dan proposal, pipeline penemuan, CRM prospek lama, serta seluruh riwayat yang sudah ada.

## Risiko
- Menandai analisis kedaluwarsa membuat sebagian kartu Ready Outreach menampilkan peringatan sampai analisis diperbarui — ini memang tujuannya, tetapi perlu tombol perbarui yang mudah agar tidak menghambat sales.
- Pembacaan teks respons customer berbasis aturan kata kunci; hasilnya selalu berupa temuan berkeyakinan, bukan kebenaran mutlak, dan tetap bisa dikoreksi manusia.
