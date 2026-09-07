# Trust Score Engine + Entity Resolution

Satu angka kepercayaan untuk setiap prospek, plus pendeteksi usaha kembar yang lebih pintar (mengenali "PT ABC Indonesia" = "ABC Indonesia").

## 1. Skema database baru (additive, tidak menghapus apa pun)

Pada tabel prospek (`prospects`):
- `trust_score` (0–100), `trust_tier` (untrusted / emerging / trusted / verified), `trust_breakdown` (rincian skor + alasan), `trust_computed_at`.
- Kolom kandidat `trust_score` sudah ada; ditambah `trust_breakdown`, `trust_tier`.

Tabel baru `entity_match_candidates`:
- `id`, `prospect_a`, `prospect_b` (boleh kandidat atau prospek, ditandai `entity_kind`), `similarity_score` (0–100), `match_reason` (jsonb), `status` (`flagged` / `needs_review` / `confirmed_duplicate` / `not_duplicate` / `ignored`), `reviewed_by`, `reviewed_at`, `created_at`, `updated_at`.
- GRANT untuk pengguna terautentikasi + service role, RLS: baca untuk anggota workspace, tulis untuk peran sales/admin/owner.

Pencocokan mirip:
- Ekstensi `pg_trgm` (sudah aktif) + indeks GIN pada `business_name_normalized` di `prospects` dan `prospect_candidates`.
- Indeks tambahan pada domain website dan telepon untuk pencocokan cepat.

## 2. Formula Trust Score

```text
trust = 0.25*ICP fit + 0.25*validation + 0.15*AI quality + 0.35*external verification
```

- ICP fit: `fit_score` prospek / `icp_score` kandidat.
- Validation: `validation_score` (6 pengecekan yang sudah ada).
- AI quality: skor `quality_gate`.
- External verification: skor bukti Apify saat ini (Google Maps place_id 45, telepon 20, alamat 10, website 15, social 10) — dipertahankan, kini jadi komponen berbobot terbesar.

Komponen yang belum punya data dihitung 0 dan alasannya dicatat, sehingga prospek tanpa bukti eksternal tidak bisa naik tier tinggi.

Tier: 90–100 verified, 75–89 trusted, 50–74 emerging, <50 untrusted.

`trust_breakdown` menyimpan tiap komponen + daftar alasan ("Google Maps terverifikasi", "Website aktif", "Cocok ICP").

## 3. Algoritma entity resolution

Nama dinormalkan lebih dulu (huruf kecil, buang PT/CV/UD/Tbk/dll., buang tanda baca, rapikan spasi) — fungsi `normalize_business_name` yang sudah ada dipakai kembali.

Skor kemiripan (0–100) gabungan sinyal:
- kemiripan nama (trigram) — bobot 40
- domain website sama — 25
- nomor telepon sama (dinormalkan) — 20
- email sama — 10
- kota sama — 5
- `place_id` Google Maps sama — langsung 100 (bukti kuat)

Keputusan: ≥85 ditandai otomatis (`flagged`), 60–84 masuk antrean tinjauan manusia (`needs_review`), <60 diabaikan. **Tidak ada penggabungan otomatis**; owner memutuskan.

## 4. File yang berubah

- `src/lib/admin/prospecting.ts` — bobot trust, tier, helper breakdown (client-safe).
- `src/lib/admin/prospect-candidates.ts` — tipe trust tier/breakdown pada kandidat.
- `src/lib/entity-resolution.server.ts` (baru) — pencarian kandidat kembar + penilaian kemiripan + penyimpanan hasil.
- `src/lib/prospecting-trust.server.ts` (baru) — hitung & simpan trust score/tier/breakdown untuk satu atau banyak prospek.
- `src/lib/prospecting-apify.server.ts` — promosi memakai trust engine terpadu.
- `src/lib/prospecting.functions.ts` — server function baru: hitung ulang trust, jalankan entity resolution, tinjau hasil pencocokan.
- `src/routes/_authenticated/admin.prospects.tsx` — badge Trust tier + rincian skor pada daftar/detail, tab **Duplicate review**.
- `docs/OUTBOUND-SOP.md` — aturan tier dan tinjauan duplikat.
- Pengujian baru di `src/lib/__tests__` untuk formula skor dan pencocokan entity.

## 5. Risiko & mitigasi

- **Prospek lama nilainya turun** karena belum punya bukti eksternal. Mitigasi: hitung ulang massal saat migrasi selesai; Sales Queue tetap memakai aturan lama sampai tier terisi, lalu beralih ke `trusted`+.
- **Positif palsu pada nama umum** (mis. "Kopi Kita"). Mitigasi: nama saja tidak pernah mencapai ambang otomatis tanpa sinyal kedua.
- **Beban query trigram** pada data besar. Mitigasi: indeks GIN + batasi kandidat pembanding per kota/negara.
- Rollback: kolom dan tabel bersifat tambahan; cukup berhenti memakai trust engine — data lama tidak tersentuh.
