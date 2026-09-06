# KERJAKU — Sales Intelligence Platform (additive upgrade)

Semua yang ada sekarang tetap jalan. Tidak ada tabel yang dihapus, tidak ada alur lama yang dibongkar. Alur baru dinyalakan lewat sakelar (feature flag) di Pengaturan, jadi bisa dicoba tanpa mengganggu pekerjaan harian.

## Alur baru

```text
AI menemukan kandidat  ->  Kandidat (belum boleh dihubungi)
        -> Pengecekan data nyata (Google Maps, website, sosial via Apify)
        -> Deteksi perusahaan kembar
        -> Skor kepercayaan
        -> Naik jadi Prospect (yang sekarang) -> Sales -> Hasil (menang/kalah)
        -> Pelajaran untuk menyetel pencarian berikutnya
```

## Yang dibangun (7 tahap, urut)

**1. Lapisan Kandidat**
Tabel baru `prospect_candidates`. AI Discovery diubah: hanya boleh menghasilkan nama usaha, industri, kota, alasan cocok, dugaan masalah, dugaan sinyal beli, solusi yang disarankan. Nomor telepon, email, alamat, link Maps, dan sosial media wajib kosong. Kandidat tidak masuk daftar prospect dan tidak bisa dihubungi.

**2. Pengambilan fakta eksternal (Apify)**
Tabel `prospect_enrichments` menyimpan tiap pengambilan data: sumber, URL sumber, jawaban mentah, field yang terbukti, tingkat keyakinan. Tiga pekerjaan: Google Maps (nama resmi, alamat, telepon, website, kategori, rating, jumlah ulasan, place id), cek website (hidup/tidak, SSL, halaman kontak, email), cek sosial (Instagram/LinkedIn ada atau tidak, follower). Data AI tidak pernah ditimpa — fakta eksternal disimpan terpisah lalu dipakai sebagai kebenaran.

**3. Aturan kepemilikan data**
AI: hanya insight, dugaan, rekomendasi. Sumber eksternal: telepon, email, alamat, website, keberadaan sosial. Manusia: persetujuan akhir dan hasil penjualan. Ditegakkan di lapisan penyimpanan, bukan sekadar aturan tertulis.

**4. Deteksi perusahaan kembar**
Aktifkan pencocokan teks di database, tambah kolom nama ternormalisasi ("PT ABC Indonesia" -> "abc indonesia"), tabel `entity_match_candidates` berisi pasangan mirip + skor kemiripan nama/telepon/alamat. Tidak pernah digabung otomatis — selalu ditinjau manusia.

**5. Skor kepercayaan**
Satu angka `trust_score`: kecocokan ICP 30%, kualitas validasi 20%, AI quality gate 15%, verifikasi eksternal 35%. Jika verifikasi eksternal gagal, skor dibatasi maksimal 40. Rinciannya disimpan supaya bisa dijelaskan ("terbukti dari Google Maps dan website").
Kandidat baru boleh naik jadi prospect kalau: usaha terbukti ada, ada minimal satu sumber eksternal, lolos cek kembar, ICP lolos ambang, trust score lolos ambang.

**6. Pekerjaan latar belakang**
Tabel `background_jobs` (antrean, status, percobaan, kunci) + penjadwal. Discovery, pengambilan data Apify, verifikasi, deteksi kembar, dan penilaian massal berjalan di latar dengan batas jumlah per putaran, kunci anti-tabrakan, dan rem otomatis saat penyedia bermasalah. Tidak ada lagi tombol yang menggantung menunggu AI.

**7. Umpan balik hasil penjualan**
Tabel `prospect_outcomes` (menang, kalah, tidak dibalas, salah sasaran, alasan, nilai deal, lama siklus). Dipakai untuk laporan pola ICP yang benar-benar menghasilkan deal dan rekomendasi penyetelan pencarian. Tidak ada pelatihan ulang otomatis — hanya rekomendasi.

## Tampilan

Halaman Prospects jadi lima tab:
Candidate Inbox (temuan AI) · Verification Queue (menunggu bukti) · Verified Prospects (siap dijual, tampilan sekarang) · Intelligence (insight + bukti) · Sales Outcome (hasil & pelajaran).
Tab lama tetap ada di dalam Verified Prospects agar pekerjaan sekarang tidak terganggu.

## Catatan teknis

- Migrasi murni menambah: `prospect_candidates`, `prospect_enrichments`, `entity_match_candidates`, `background_jobs`, `prospect_outcomes`, kolom `trust_score`/`trust_breakdown`/`business_name_normalized`/`candidate_id` pada `prospects`, ekstensi `pg_trgm`. GRANT + RLS mengikuti pola `has_workspace_access` / `can_work_leads` yang sudah dipakai.
- Apify dipanggil lewat connector Lovable dari server route/server function; kunci tetap di server.
- Feature flag `outbound_pipeline_v4` disimpan di `prospect_icp_config`, dikendalikan dari Pengaturan.
- Tidak menyentuh: PR1 atribusi, PR2 SEO, desain homepage, harga, konten publik, RLS yang sudah ada, portal klien, billing.

## Yang saya butuhkan dari Anda

Koneksi Apify (akan saya minta lewat tombol koneksi saat tahap 2). Tanpa itu, tahap 1 dan 3–7 tetap bisa jalan, tapi pengambilan fakta eksternal hanya bisa dari pengecekan website langsung.
