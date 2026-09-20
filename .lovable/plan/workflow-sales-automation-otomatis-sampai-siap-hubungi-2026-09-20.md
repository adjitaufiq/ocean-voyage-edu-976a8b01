# Workflow Sales Automation — otomatis sampai siap hubungi

Tujuan: kandidat mengalir sendiri dari pencarian sampai materi siap kirim. Manusia hanya memvalidasi kandidat yang sudah matang, lalu menghubungi. Tidak ada aplikasi baru, tidak ada tabel lama dihapus, Discovery dan data CRM lama tidak disentuh.

## Alur akhir

```text
Discovery (otomatis)
  -> Candidate Inbox + AI screening otomatis
       -> AI Qualified / Perlu ditinjau / Ditolak
  -> QC otomatis berbasis aturan (auto approve bila keyakinan tinggi)
       -> keyakinan rendah = antre tinjauan manusia
  -> Sales Preparation otomatis (brief + draf pesan + bukti)
  -> Pending Verification -> ceklis manusia -> Verified Ready Outreach
  -> Tombol WhatsApp / Salin / Lihat sumber / Tandai sudah dihubungi
  -> CRM: Dihubungi -> Dibalas -> Demo -> Tertarik -> Deal / Gagal
```

## 1. Screening otomatis di Candidate Inbox

Perluas mesin kualifikasi yang sudah ada (`src/lib/admin/qualification.ts`) dengan **skor keyakinan** terpisah dari skor kualifikasi: seberapa lengkap dan terpercaya fakta yang dipegang (ada Place ID, alamat, telepon bersumber, rating/ulasan, cek website). Hasilnya tiga label otomatis: AI Qualified, Perlu ditinjau, Ditolak — semua dengan alasan dan sumber tercatat.

## 2. QC otomatis

Aturan auto-approve (`src/lib/admin/qc-rules.ts`, baru): kategori sesuai kampanye, bisnis aktif, sumber data ada, peluang ditemukan, dan keyakinan di atas ambang. Memenuhi semua → QC approved otomatis oleh sistem (pencatat: "auto"), selebihnya tetap masuk antrean tinjauan manusia. Keputusan manusia selalu menang dan tidak pernah ditimpa ulang oleh aturan.

## 3. Sales Preparation otomatis

Begitu QC approved (otomatis atau manual), materi penjualan dibuat tanpa diminta, memakai generator bertahap yang sudah ada. Tombol manual dan massal tetap ada untuk regenerasi dan kontrol mutu.

## 4. Evidence Panel

Setiap materi menyimpan daftar bukti: **data → sumber → keyakinan** (nama, lokasi, kategori, rating/ulasan, status website, telepon/WhatsApp, media sosial). Ditampilkan sebagai panel di kartu materi dan lewat tombol "Lihat sumber".

## 5. Gerbang verifikasi manusia

Ready Outreach tidak lagi satu tombol. Tujuh ceklis: nama sesuai sumber, lokasi sesuai, rating/ulasan sesuai, cek website valid, nomor WhatsApp valid, peluang masuk akal, draf pesan sudah sesuai. Belum lengkap → **Pending Verification**. Lengkap → **Verified Ready Outreach**, barulah aksi kontak terbuka.

## 6. Aksi outreach

Tombol pada kandidat terverifikasi: Hubungi WhatsApp (membuka wa.me dengan nomor terverifikasi dan draf terisi), Salin pesan, Lihat sumber, Sunting pesan, Tandai sudah dihubungi. Menandai sudah dihubungi mencatat aktivitas dan memindahkan kandidat ke tahap CRM.

## 7. Tahap CRM

Tahap lanjutan: Dihubungi → Dibalas → Demo dijadwalkan → Tertarik → Deal → Gagal, dicatat di riwayat kandidat dan aktivitas CRM yang sudah ada.

## Perubahan data (aditif, tanpa hapus)

Pada kandidat: `confidence_score`, `screening_label`, `auto_qc_reason`, `verification_checklist` (jsonb), `verified_ready_at`, `verified_by`, `contact_stage` (dihubungi → gagal).
Pada materi penjualan: `evidence` (jsonb).
Semua nullable dengan nilai bawaan aman, plus GRANT dan RLS mengikuti pola tabel yang sama.

## File yang berubah

- Baru: `src/lib/admin/qc-rules.ts`, `src/lib/admin/evidence.ts`, `src/lib/admin/verification.ts` (+ berkas pengujian masing-masing), `src/components/admin/EvidencePanel.tsx`, `src/components/admin/OutreachActions.tsx`.
- Diubah: `src/lib/admin/qualification.ts` (keyakinan + label), `src/lib/prospecting-qualification.server.ts` (tulis hasil screening + auto QC), `src/lib/prospecting-discovery.server.ts` (screening dan QC otomatis saat kandidat disimpan, lalu memicu pembuatan materi), `src/lib/prospecting-salesprep.server.ts` (simpan bukti, gerbang ceklis), `src/lib/prospecting-candidates.server.ts` (tahap kontak CRM), `src/lib/prospecting.functions.ts` (fungsi ceklis, tandai dihubungi, ubah tahap kontak), `src/components/admin/SalesPrepPanel.tsx` + `QualificationPanel.tsx`, `src/routes/_authenticated/admin.prospects.tsx`, `docs/OUTBOUND-SOP.md`.

## Risiko

- Auto-approve terlalu longgar → ambang keyakinan konservatif, alasan selalu tercatat, dan QC manusia bisa membatalkan kapan saja.
- Kandidat lama (314 menunggu QC) → disediakan tombol jalankan screening ulang per kampanye; tidak ada baris yang ditimpa diam-diam.
- Volume besar → semua pekerjaan otomatis tetap bertahap per potongan seperti pekerja penemuan sekarang.
- Salah kontak → nomor hanya dipakai bila bersumber dan ceklis manusia lengkap.

## Verifikasi

Pengujian unit untuk aturan QC, keyakinan, bukti, dan ceklis; pemeriksaan tipe; build; lalu uji alur satu kandidat dan uji massal di halaman admin.
