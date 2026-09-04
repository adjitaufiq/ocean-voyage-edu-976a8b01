# KERJAKU Outbound Sales Acquisition — SOP & Role Matrix

Outbound melengkapi CRM inbound. **Prospek bukan lead**: data prospek hidup di tabel
`prospects` dan baru masuk CRM (`consultations`) setelah seorang manusia menyetujui handoff.

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

8. **Draft outreach** — draft disimpan sebagai teks. Sistem **tidak pernah** mengirim pesan
   otomatis; setiap pesan harus personal dan consultative.
9. **Approval manusia** — status `ready` → `approved` hanya oleh manusia berwenang.
10. **Kirim manual** — setelah dikirim, catat lewat "Catat outreach" (`sent` / `reply` /
    `no_reply`) dan tentukan jadwal follow-up.
11. **Follow-up** — scan automation membuat task internal saat follow-up jatuh tempo dan saat
    prospek `ready` menganggur >3 hari. Task ini hanya pengingat internal.
12. **Handoff** — prospek yang berminat dikonversi jadi lead CRM; scoring, proposal, dan
    billing memakai alur inbound yang sudah ada.
13. **DO_NOT_CONTACT** — sekali ditandai, follow-up dihentikan dan outreach ditolak sistem.

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
