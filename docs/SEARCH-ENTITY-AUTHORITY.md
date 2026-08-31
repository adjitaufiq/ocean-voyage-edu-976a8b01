# KERJAKU — Search & AI Entity Authority

Domain: https://kerjaku.space

## Tujuan

Membangun bukti yang bisa dirayapi (crawlable) agar mesin pencari, sistem AI, dan manusia
mengenali KERJAKU sebagai digital product studio untuk website, aplikasi custom, sistem
bisnis, dashboard, dan AI automation. Bukan sekadar peringkat untuk kata "KERJAKU".

## Target search theme

Lihat `docs/KEYWORD-ENTITY-MAP.md` untuk pemetaan lengkap intent → URL → proof → CTA.

## Pilar layanan (commercial intent)

| Pilar | URL | Fokus |
| --- | --- | --- |
| A — Website | `/jasa-pembuatan-website` | Company profile, landing page, fondasi SEO teknis |
| B — Aplikasi custom | `/jasa-pembuatan-aplikasi-custom` | Web application, sistem internal, workflow, hak akses |
| C — Sistem & dashboard | `/jasa-dashboard-bisnis` | Sistem perusahaan, data terpusat, monitoring, laporan |
| D — AI automation | `/jasa-ai-automation-bisnis` | Integrasi AI, business rules, human-in-the-loop |

`/jasa-pembuatan-website-aplikasi-landing-page` dipertahankan sebagai halaman ringkasan
layanan (URL lama), bukan pilar intent.

## Arsitektur entitas

```text
                     KERJAKU  (/)
                        |
        +---------------+---------------+
     WEBSITE        CUSTOM APP      AI AUTOMATION
        |               |               |
        +------- BUSINESS SYSTEM -------+
                        |
                     PRODUCTS  (/products)
                        |
                     BUILD LOG (/build)
                        |
                     INSIGHT   (/insight)
```

- Homepage = entity hub (kini menautkan keempat pilar secara langsung).
- Service page = commercial intent.
- Build Log = experience / proof.
- Insight = informational authority.
- Products = product proof + live demo.
- AI Consultant = konversi.

## Internal linking

Pola kontekstual yang dipakai:

```text
/jasa-pembuatan-aplikasi-custom -> /build/ro-memory -> /insight/kapan-bisnis-butuh-aplikasi-custom -> AI Consultant
/jasa-ai-automation-bisnis -> /build/ai-business-assistant -> /insight/ai-assistant-vs-chatbot -> /cara-kerjaku-menggunakan-ai -> AI Consultant
```

Anchor text natural, tidak mengulang exact-match.

## Structured data

Dipakai hanya bila benar secara semantik: `Organization` + `WebSite` (root),
`Service` (halaman pilar), `SoftwareApplication` (produk), `Article`/`TechArticle`
(insight & build log), `BreadcrumbList`, `FAQPage`. Tidak ada `Review`,
`AggregateRating`, atau `Offer` — tidak ada data faktual yang mendukungnya.

## Strategi gambar (belum dikerjakan)

Rencana: nama file deskriptif (`kerjaku-ai-consultant.webp`,
`kerjaku-business-dashboard.webp`), alt yang menjelaskan isi gambar (bukan keyword
stuffing), width/height eksplisit, format terkompresi, screenshot asli, penempatan HTML
yang bisa dirayapi. Jangan mengganti nama aset yang sudah direferensikan.

## Strategi video (arsitektur, belum ada aset)

Prioritas: AI Consultant demo; Consultation → CRM → Order Brief → Proposal → Invoice;
AI Business Assistant; RO MEMORY. Setiap embed wajib disertai teks penjelas yang
crawlable. `VideoObject` hanya ditambahkan setelah video nyata dipublikasikan — durasi,
tanggal unggah, thumbnail, dan URL tidak boleh dikarang.

## Distribusi eksternal

Lihat `docs/EXTERNAL-AUTHORITY-PLAN.md`.

## Konversi

Primary CTA: Konsultasikan Kebutuhan (AI Consultant).
Secondary: Lihat Project, Lihat Live Demo, Baca Build Story.
Tanpa urgensi palsu.

## Pengukuran

Terhubung ke acquisition/attribution engine yang sudah ada: organic landing visits,
AI referral, AI Consultant opens, konsultasi, qualified lead, proposal, deal.
KPI utama konten = qualified lead, bukan impresi.

## Status pekerjaan

- [x] Audit & inventarisasi intent
- [x] Pilar A dipublikasikan di `/jasa-pembuatan-website`
- [x] Homepage menautkan keempat pilar (tidak lagi orphan)
- [x] Dokumentasi search entity & keyword map
- [ ] Penguatan intent "sistem perusahaan" di `/jasa-dashboard-bisnis`
- [ ] Audit alt/nama file gambar + image sitemap
- [ ] Aset video proof + `VideoObject`
