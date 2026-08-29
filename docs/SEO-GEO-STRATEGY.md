# KERJAKU — SEO / GEO / AI Search Strategy

## Entity
KERJAKU = Digital Product Studio (Jakarta, Indonesia).
Kapabilitas: Website, Web App, Custom System, Dashboard, Workflow Automation, AI Integration.
Produk: RO MEMORY, QResto, DOMPET GUE, MATERIAL ESTIMATOR.

## Arsitektur halaman
| Intent | Route |
| --- | --- |
| Brand / hub | `/` |
| Aplikasi custom & sistem internal | `/jasa-pembuatan-aplikasi-custom` |
| AI assistant & workflow automation | `/jasa-ai-automation-bisnis` |
| Dashboard & visibilitas data | `/jasa-dashboard-bisnis` |
| Website, company profile, landing page | `/jasa-pembuatan-website-aplikasi-landing-page` (URL lama dipertahankan) |
| AI proof / E-E-A-T | `/cara-kerjaku-menggunakan-ai` |
| Produk | `/products`, `/products/$slug` |
| Konten | `/insight`, `/insight/$slug` |
| Legal | `/privacy-policy`, `/terms` |

Anti-kanibalisasi: satu intent = satu halaman. Konten layanan website tetap di URL lama agar
tidak memecah sinyal; `websiteService` di `src/lib/seo/services.ts` disimpan sebagai sumber
copy cadangan dan tidak dipublikasikan sebagai route terpisah.

## Struktur teknis
- Konten data-driven: `src/lib/seo/*` (`services`, `products`, `insights`, `ai-proof`).
- Renderer semantik tunggal: `src/components/kerjaku/marketing/DocPage.tsx` (satu H1, breadcrumb,
  section H2, FAQ, related links, CTA ke AI Consultant, footer trust links).
- Head + JSON-LD: `src/lib/seo/head.ts` (canonical, OG, Twitter, BreadcrumbList, FAQPage, Service;
  Article & SoftwareApplication ditambahkan di route terkait). Organization/WebSite ada di `__root.tsx`.
- Sitemap: `src/routes/sitemap[.]xml.ts` — hanya halaman publik kanonik.
- Robots: `public/robots.txt` — blok `/admin`, `/auth`, `/api/`, `/portal/`, `/d/`.
- `public/llms.txt` — ringkasan entitas untuk AI search engine.

## Aturan konten
Tanpa statistik/review palsu, tanpa keyword stuffing, tanpa thin content. Semua klaim harus
mencerminkan pekerjaan nyata yang terlihat di halaman.
