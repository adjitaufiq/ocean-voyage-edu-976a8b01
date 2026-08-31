# KERJAKU — Keyword / Entity Map

Satu intent = satu URL kanonik. Halaman pendukung tidak boleh menargetkan intent utama
yang sama dengan halaman pilar.

| Search Theme | Intent | Primary URL | Supporting URL | Proof Asset | CTA | Coverage | Cannibalization Risk | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| jasa pembuatan website | Komersial | /jasa-pembuatan-website | /insight/dari-proses-manual-menjadi-sistem-digital | Website KERJAKU sendiri | Diskusikan kebutuhan website | Ada | Sedang — URL lama `/jasa-pembuatan-website-aplikasi-landing-page` masih hidup sebagai halaman ringkasan layanan | LIVE |
| jasa pembuatan website profesional | Komersial | /jasa-pembuatan-website | — | Website KERJAKU sendiri | Diskusikan kebutuhan website | Ada | Rendah — varian frasa, tidak dibuat halaman terpisah | LIVE |
| jasa pembuatan aplikasi | Komersial | /jasa-pembuatan-aplikasi-custom | /insight/kapan-bisnis-butuh-aplikasi-custom | RO MEMORY, QResto | Mulai konsultasi | Ada | Rendah | LIVE |
| jasa pembuatan aplikasi custom | Komersial | /jasa-pembuatan-aplikasi-custom | /insight/biaya-pembuatan-aplikasi-custom | RO MEMORY | Mulai konsultasi | Ada | Rendah | LIVE |
| jasa web application | Komersial | /jasa-pembuatan-aplikasi-custom | /insight/aplikasi-custom-vs-software-siap-pakai | DOMPET GUE | Mulai konsultasi | Ada | Rendah | LIVE |
| aplikasi custom untuk bisnis | Komersial | /jasa-pembuatan-aplikasi-custom | /insight/fitur-mvp-aplikasi-bisnis | MATERIAL ESTIMATOR | Mulai konsultasi | Ada | Rendah | LIVE |
| jasa pembuatan sistem perusahaan | Komersial | /jasa-dashboard-bisnis | /insight/kapan-excel-tidak-cukup-untuk-operasional-bisnis | RO MEMORY | Bahas kebutuhan dashboard | Parsial — bagian "sistem perusahaan" perlu diperkuat di halaman yang sama | Sedang | PERLU PENGUATAN |
| jasa dashboard bisnis | Komersial | /jasa-dashboard-bisnis | /insight/dashboard-vs-sistem-operasional | Dashboard admin KERJAKU | Bahas kebutuhan dashboard | Ada | Rendah | LIVE |
| jasa AI automation | Komersial | /jasa-ai-automation-bisnis | /insight/ai-automation-vs-chatbot | AI Consultant, AI Business Assistant | Coba AI Consultant | Ada | Rendah | LIVE |
| jasa integrasi AI | Komersial | /jasa-ai-automation-bisnis | /insight/ai-assistant-vs-chatbot, /cara-kerjaku-menggunakan-ai | AI Business Assistant | Coba AI Consultant | Ada | Rendah | LIVE |
| KERJAKU (branded) | Navigasional | / | /build, /products | Semua produk & build log | Coba AI Consultant | Ada | Tidak ada | LIVE |

## Keputusan anti-kanibalisasi

- `/jasa-pembuatan-website` menjadi halaman kanonik untuk intent website.
- `/jasa-pembuatan-website-aplikasi-landing-page` dipertahankan (URL publik lama, sudah
  memiliki sinyal) tetapi diposisikan sebagai halaman ringkasan seluruh layanan, bukan
  halaman intent website. Jangan menambah penargetan frasa "jasa pembuatan website" di
  halaman tersebut.
- Tidak dibuat `/jasa-sistem-dashboard-bisnis` terpisah; intent "sistem perusahaan"
  diperkuat di dalam `/jasa-dashboard-bisnis`.
