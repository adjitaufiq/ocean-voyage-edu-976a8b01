# KERJAKU Outbound Sales Acquisition — SOP & Role Matrix

Outbound melengkapi CRM inbound. **Prospek bukan lead**: data prospek hidup di tabel
`prospects` dan baru masuk CRM (`consultations`) setelah seorang manusia menyetujui handoff.

## Pipeline akuisisi (sumber utama)

Semua penemuan baru masuk ke pipeline kandidat, tidak pernah langsung ke `prospects`:

`Campaign → prospect_candidates (discovered) → Validation (validated) → QC review (approved)
→ Sales preparation → Ready Outreach → Promote ke prospects/CRM`

Gerbang wajib tiap tahap:

| Tahap | Syarat |
| --- | --- |
| Discovery | Tombol kampanye "Cari kandidat baru" menulis ke `prospect_candidates` |
| Validation | `validation_status = validated` (sinyal kualitas, bukan gerbang Sales preparation) |
| QC | `qc_status = approved` — satu-satunya pintu masuk Sales preparation |
| Sales preparation | `qc_status = approved`, bukan duplikat, belum punya materi aktif, kontak bersumber, belum dipromosikan ke CRM |
| Ready outreach | QC approved + materi persiapan aktif + kontak bersumber |
| Promote CRM | `sales_stage = ready_outreach` (selain approval & anti-duplikat) |

Dashboard Prospects memisahkan **Acquisition pipeline** (kandidat ditemukan, terverifikasi,
QC approved, sales prepared, ready outreach) dari **CRM pipeline** (prospek aktif, dihubungi,
meeting, deal). Data `prospects` lama tetap utuh sebagai riwayat CRM.



## Alur kerja

1. **Discovery** — prospek dibuat manual di `/admin/prospects` (atau dari run discovery
   terbatas). Duplikat dicegah lewat domain website, email, dan nomor WhatsApp ternormalisasi.
2. **Research** — isi ringkasan riset, bukti (evidence), dan sinyal masalah. Tanpa bukti,
   skor bukti = 0.
3. **Scoring** — skor ICP deterministik (industri, kota, peluang digitalisasi, sinyal masalah,
   kelengkapan kontak, bukti). Setiap poin dapat dijelaskan di UI. Kata kunci eksklusi
   (agency, software house, reseller) langsung mendiskualifikasi.
4. **Contact provenance (wajib)** — setiap kontak (telepon, email, website, social) harus disimpan
   bersama *source type* (Google Business Profile, Google Maps, Official Website, Instagram,
   LinkedIn, Facebook, Manual Input) dan *source URL* sebagai bukti. Kontak tanpa sumber dianggap
   tidak terbukti. Level bukti: `verified` (source type kuat + URL bukti), `declared` (sumber
   tercatat tanpa URL), `unknown` (tanpa sumber). Google Maps URL disimpan terpisah untuk audit,
   dan `verified_at` terisi saat verifikasi manusia.
5. **Contact verification** — validasi kontak sebelum prospek dianggap siap sales:
   WhatsApp bisnis / telepon kantor adalah prioritas pertama; email perusahaan atau PIC/LinkedIn
   berikutnya; form website atau social media resmi menjadi fallback. Instagram saja tidak cukup.
   Data yang belum terkonfirmasi diberi status `NEED VERIFICATION` dan tidak boleh diperlakukan
   sebagai prospek siap dihubungi.
6. **Contact quality** — skor deterministik 0–100 (WhatsApp/telepon 40, email bisnis 25, website
   aktif 15, PIC/decision maker 10, social media resmi 10) yang diredam oleh kekuatan bukti tiap
   kanal (verified 100%, declared 60%, unknown 25%). Status `SALES READY` hanya diberikan bila
   telepon atau email memiliki sumber terbukti dan seluruh kanal beratribusi; selebihnya
   `QUALIFIED`, `NEED VERIFICATION`, atau `NOT READY`.
7. **Qualification** — catat Business Profile, Industry Fit, Potential Need, Business Problem,
   Buying Signal, Decision Maker, Opportunity Reason, serta Priority HIGH/MEDIUM/LOW. Fakta,
   dugaan, dan sumber harus dapat dibedakan; jangan mengarang kontak atau buying signal.
8. **Daily Sales Queue** — hanya prospek dengan sumber kontak terbukti (semua kanal beratribusi),
   skor kontak memadai, opportunity reason, relevansi KERJAKU, tidak duplikat, bukan
   `DO_NOT_CONTACT`, dan bukan status terminal. Prospek yang hanya memiliki social media, atau
   yang kontaknya tidak dapat dibuktikan sumbernya, tidak boleh masuk queue.

9. **Draft outreach** — draft disimpan sebagai teks. Sistem **tidak pernah** mengirim pesan
   otomatis; setiap pesan harus personal dan consultative.
10. **Approval manusia** — status `ready` → `approved` hanya oleh manusia berwenang.
11. **Kirim manual** — setelah dikirim, catat lewat "Catat outreach" (`sent` / `reply` /
    `no_reply`) dan tentukan jadwal follow-up.
12. **Follow-up** — scan automation membuat task internal saat follow-up jatuh tempo dan saat
    prospek `ready` menganggur >3 hari. Task ini hanya pengingat internal.
13. **Handoff** — prospek yang berminat dikonversi jadi lead CRM; scoring, proposal, dan
    billing memakai alur inbound yang sudah ada.
14. **DO_NOT_CONTACT** — sekali ditandai, follow-up dihentikan dan outreach ditolak sistem.

## Role matrix

| Aksi | viewer | sales/staff | admin/owner |
| --- | --- | --- | --- |
| Lihat prospek & KPI | ya | ya | ya |
| Buat / ubah prospek, riset, draft | tidak | ya | ya |
| Catat outreach & follow-up | tidak | ya | ya |
| Tandai DO_NOT_CONTACT | tidak | ya | ya |
| Handoff ke CRM | tidak | ya | ya |
| Ubah konfigurasi ICP & bobot skor | tidak | tidak | ya |

## Kontrol biaya & observabilitas

- Batas volume per run/per hari serta jumlah riset per run diatur di konfigurasi ICP
  (`limits.perRun`, `limits.perDay`, `limits.researchPerRun`).
- Setiap run discovery tercatat di `prospect_runs` (status, jumlah ditemukan/disimpan/dilewati,
  jumlah panggilan AI, error).
- Setiap perubahan prospek tercatat di `prospect_activities` beserta aktor.
- Kegagalan scan outbound dicatat di `automation_logs` dengan rule `outbound.follow_up_reminder`.

## Privasi

Hanya data kontak bisnis publik yang disimpan. Tidak ada data pribadi sensitif, tidak ada
pengiriman massal otomatis, dan permintaan berhenti dihormati lewat DO_NOT_CONTACT.

## Aturan automation

| Rule | Efek |
| --- | --- |
| `outbound.follow_up_reminder` | Task internal saat `next_follow_up_at` jatuh tempo |
| `outbound.stale_ready_alert` | Task internal saat prospek `ready` >3 hari tanpa approval |

## Reverifikasi data prospek lama

- Gunakan tombol **Refresh data verification** di header halaman Prospects untuk memindai seluruh prospek lama, atau tombol yang sama di panel detail untuk satu prospek.
- Proses hanya mengisi field sumber (`phone_source`, `email_source`, `website_source`, `social_source` beserta `*_source_url`) bila masih kosong; data lama tidak pernah dihapus.
- Website dicek apakah benar-benar merespons, URL social divalidasi sebagai profil bisnis, lalu contact quality score dan ICP score dihitung ulang serta status SALES READY diperbarui.
- Setiap perubahan tercatat di Activity CRM prospek, sehingga audit sumber data tetap bisa ditelusuri.
- Jalankan reverifikasi minimal sekali per minggu untuk prospek berstatus contact ready yang belum dihubungi.

## Validation & Audit System

Hasil AI discovery **tidak pernah** langsung masuk Daily Sales Queue. Setiap prospek melewati
tahap: `RAW` → `VALIDATING` → `VERIFIED` → `SALES READY`, atau `REJECTED`.

Enam pengecekan wajib pada tahap validasi:

| Check | Lolos bila |
| --- | --- |
| Business existence | Nama bisnis + industri/kota terisi dan tidak generik |
| Google Maps | `google_maps_url` tersedia atau sumber kontak berasal dari Google Business/Maps |
| Contact source | Telepon atau email memiliki source type + source URL yang terbukti |
| Website | Domain benar-benar merespons saat dicek |
| Social match | URL social adalah profil bisnis nyata yang cocok dengan prospek |
| Duplicate | Tidak ada prospek lain dengan domain, email, atau nomor ternormalisasi sama |

Skor validasi berbobot dihitung dari keenam check. Sebelum berpindah ke `SALES READY`,
prospek harus lolos **AI Quality Gate** yang menilai konsistensi klaim AI dengan bukti; hasilnya
disimpan di `quality_gate` dan `quality_gate_passed`. Prospek yang gagal ditandai `REJECTED`
beserta `rejected_reason`. Seluruh transisi tercatat di Activity CRM.

**Daily Sales Queue terkunci**: hanya prospek `validation_stage = sales_ready` yang boleh masuk.

### Random Audit Dashboard

- Owner mengambil sampel acak ~10% prospek tervalidasi lewat tab **Audit**.
- Sampel membekukan klaim AI saat itu (`ai_claims`) beserta temuan validasi.
- Verdict reviewer: `accurate` / `partial` (bobot 0.5) / `inaccurate`.
- Prospek yang dinilai `inaccurate` otomatis ditarik kembali ke tahap validasi dan kehilangan
  status sales ready.
- Akurasi per kampanye dihitung ulang setiap verdict. Bila akurasi < 70%, kampanye ditandai
  `needs_review` dengan alasan, dan batch discovery-nya harus diperiksa sebelum dilanjutkan.
- Riwayat audit tersimpan permanen di `prospect_audits` (tidak boleh dihapus).

## Discovery engine (tab Discovery)

1. **Buat tugas** — pilih kampanye, sistem memecahnya menjadi tugas kata kunci x wilayah
   (maks. 60 per kampanye). Mengulang tidak pernah menggandakan tugas.
2. **Jalankan batch** — maksimum 5 tugas per jalan, tugas dikunci sebelum diproses sehingga
   dua pemanggilan bersamaan tidak menggandakan pekerjaan. Jadwal otomatis memakai
   `/api/public/hooks/discovery-worker` (dilindungi kunci penjadwal).
3. **Ulangi yang gagal** — memasukkan kembali tugas gagal yang masih punya sisa percobaan.
4. Kandidat baru **selalu** masuk Candidate inbox (bukan Sales Queue). Promosi ke prospek
   tetap lewat verifikasi eksternal + persetujuan manusia.
5. Penyedia data: mock (uji, aktif sekarang), Google Maps Platform (aktif otomatis setelah
   koneksi dipasang), Apify (cadangan). Tidak ada browser/extension/Playwright.

## Qualification intelligence & QC review (tab QC review)

Setiap kandidat baru dari discovery langsung melewati kualifikasi otomatis, dan kandidat lama
bisa diproses ulang lewat tombol **Kualifikasi ulang** (per kampanye atau seluruhnya).

1. **Business validation** — 7 pemeriksaan: bisnis benar ada, lokasi valid, kategori sesuai
   kampanye, bisnis masih aktif (tidak tutup permanen), bukan duplikat, kontak valid & bersumber,
   negara sesuai aturan (Indonesia/+62). Kegagalan blocking → `validation_status = rejected`
   beserta `validation_reason`; kandidat tidak pernah dihapus.
2. **Digital gap analysis** — status website (tidak ada / lemah / ada), kehadiran online, dan
   celah operasional (belum ada katalog digital, belum ada sistem pemesanan).
3. **Lead scoring 0–100** — deterministik dari fakta Maps (rating, jumlah ulasan, kategori,
   lokasi, status website) + bonus kualitas data. Label: HOT (>=70), WARM (>=45), COLD.
4. **Sales reasoning** — `lead_reason`, `pain_signal`, `recommended_solution`, `sales_priority`.
5. **QC pipeline** — status `new / reviewed / approved / rejected / duplicate / contacted`.
   Aksi: Approve, Reject (wajib alasan), Mark duplicate, Request verification, Contact ready.
   Setiap aksi menyimpan peninjau, email, waktu, dan alasan ke `candidate_status_history`.
6. **Hot lead dashboard** — hitungan Found / Validated / Rejected / Qualified / Hot / Warm /
   antre QC / disetujui, dengan filter kampanye, kategori, kota, suhu lead, status QC, solusi,
   dan skor minimum.

Kualifikasi ulang **tidak pernah menimpa keputusan manusia**: kandidat dengan `qc_status`
selain `new` dilewati.

## Sales preparation (tab Sales preparation)

Sales preparation **hanya** memproses kandidat dengan `qc_status = approved` (keputusan manusia).
`validation_status` dipakai sebagai sinyal kualitas, bukan gerbang. Kandidat berstatus duplikat,
sudah punya materi aktif, sudah dipromosikan ke CRM, atau tanpa kontak bersumber akan dilewati
beserta alasannya. Tidak ada pesan yang terkirim otomatis.

Dua mode tersedia di tab **Sales preparation**:

- **Manual** — tombol "Siapkan penjualan" per kandidat, untuk QC dan pengujian; boleh membuat
  ulang materi (versi aktif lama dinonaktifkan, tetap tersimpan sebagai riwayat).
- **Massal** — tombol "Siapkan penjualan massal" per kampanye/filter, diproses bertahap per
  potongan kecil dengan progres Total/Diproses/Berhasil/Gagal/Dilewati dan laporan akhir.

Kartu angka papan: Menunggu QC review, Qualified (QC approved tanpa materi aktif), Sales prepared,
Ready outreach, plus catatan kandidat belum memenuhi syarat. Semua angka berasal dari satu sumber
query yang sama dengan daftar kartu. Pesan hasil mengikuti angka server — sukses tidak pernah
ditampilkan bila `prepared = 0`.


1. **Business brief otomatis** — `business_summary`, `current_digital_condition`,
   `potential_problem`, `opportunity`, disusun dari fakta kandidat (kategori, kota, rating,
   ulasan, status website). Tidak ada fakta yang dikarang.
2. **Sales approach** — deterministik: F&B → QResto + online ordering; tanpa website →
   Website bisnis + SEO lokal; bisnis berkembang (ulasan >=150 atau rating >=4.6) →
   custom system + dashboard.
3. **Outreach draft** — pembuka, alasan menghubungi, nilai yang ditawarkan, dan ajakan;
   berbasis data bisnis, bukan template spam. Draf hanya tersimpan sampai manusia menyetujui.
4. **Sales asset matching** — QResto demo, portofolio website, portofolio sistem custom,
   atau demo dashboard analitik.
5. **Sales stage** — `qualified → sales_prepared → ready_outreach`. Naik ke **Ready Outreach**
   ditolak bila kandidat belum tervalidasi atau belum punya kontak bersumber
   (`value` + `source` + `source_url` + `verified_at`). Setiap perubahan tahap dicatat di
   `candidate_status_history`.
6. **Integrasi CRM** — saat kandidat dipromosikan menjadi prospek, brief, solusi, aset, dan draf
   pesan ikut pindah ke catatan prospek dan dicatat sebagai aktivitas CRM. Status
   `ready_outreach` menjadi syarat tambahan masuk Daily Sales Queue.

Versi persiapan lama tidak dihapus: hanya satu baris `sales_preparations.is_active = true`
per kandidat, sisanya tersimpan sebagai riwayat.

## Evidence panel + human verification gate

Setiap materi menyimpan `evidence`: baris **data → sumber → keyakinan** (nama bisnis, kategori,
lokasi, rating & ulasan, website, nomor telepon/WhatsApp). Tidak ada baris yang dikarang; nilai
tanpa sumber ditandai keyakinan rendah.

**Ready Outreach bukan izin menghubungi.** Kandidat di tahap `ready_outreach` berstatus
*Pending Verification* sampai manusia mencentang seluruh ceklis:
nama sesuai sumber, lokasi sesuai, rating/review sesuai, cek website valid, nomor WhatsApp valid,
peluang AI masuk akal, draf pesan sudah sesuai. Ceklis lengkap → *Verified Ready Outreach*
(`verified_ready_at` + `verified_by` terisi).

Setelah verified, panel menampilkan: **Hubungi WhatsApp** (hanya nomor Indonesia valid, draf ikut
terisi), **Copy message**, **Lihat sumber** (Google Maps), dan pilihan tahap CRM
`Dihubungi → Dibalas → Demo dijadwalkan → Tertarik → Deal / Gagal`. Tahap kontak ditolak server
bila ceklis belum lengkap, dan setiap perubahan dicatat di `candidate_status_history`
(`actor_kind = human`).

## Bisnis terpadu (/admin/entities)

Sumber angka utama adalah **satu bisnis = satu baris** (`business_entities` lewat view
`business_entity_overview`). Kandidat, prospek CRM, konsultasi, dan percakapan AI dibaca sebagai
referensi melalui `business_entity_links` — tidak ada data lama yang disalin, dipindah, atau
digabung. Bisnis yang ditemukan Google Maps, ditemukan ulang AI, lalu dipromosikan ke CRM tetap
dihitung **satu**, bukan tiga.

Corong 10 tahap: Ditemukan → Data diperkaya → Terverifikasi → Sesuai target → Dianalisis konsultan →
Materi penjualan siap → Siap dihubungi → Sudah dihubungi → Meeting → Deal. Setiap batang bisa diklik
untuk menyaring daftar.

Filter: pencarian (nama, domain, nomor, kota, kategori, sumber), industri, tahap, sumber data,
status analisis konsultan, status penjualan (materi aktif / belum ada materi / siap dihubungi),
status kontak, dan hanya kemungkinan duplikat. Daftar dipaginasi 25 baris; seluruh perhitungan
dilakukan di basis data (tidak memuat JSON enrichment).

Detail bisnis (`/admin/entities/{id}`): profil, daftar sumber, bukti data → sumber → keyakinan,
temuan fakta vs dugaan, pemahaman konsultan (versi + keyakinan), materi penjualan aktif dan tahap
kontak, serta riwayat CRM gabungan (`candidate_status_history` + `prospect_activities`).

Antrean tinjauan duplikat tetap manual: pasangan berkemiripan tinggi tidak pernah digabung otomatis;
keputusan "Bisnis yang sama" / "Bisnis berbeda" dicatat di `entity_match_history`. CRM lama
(`prospects`, aktivitas, tahap) tidak diubah sama sekali.

## Phase 6 — Umpan balik customer
- Setiap balasan customer (WhatsApp, email, catatan sales/konsultasi/CRM, percakapan AI) dicatat lewat "Respons customer & keberatan" di kartu Ready Outreach atau halaman detail bisnis.
- Sistem menurunkan temuan (fakta/dugaan) dan keberatan. Dugaan yang dibantah jadi "Ditolak", tidak dihapus.
- Bila ada fakta baru, analisis ditandai perlu diperbarui: "Analisis bisnis sudah berubah, perlu diperbarui sebelum follow up." Tekan "Perbarui analisis" sebelum follow up.
- Aktivitas CRM biasa (ubah tahap, follow up) tidak memicu analisis ulang.
