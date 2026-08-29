/**
 * KERJAKU BUILD LOG — first-party engineering/product notes.
 * Only verified, already-shipped behaviour is documented here.
 * No private prompts, scoring thresholds, credentials, or customer data.
 */
import type { DocPageContent } from "./types";

export type BuildLogEntry = DocPageContent & {
  slug: string;
  /** Short label shown on the hub card. */
  summary: string;
  /** Name of the system the entry documents. */
  project: string;
  projectStatus: "LIVE" | "IN DEVELOPMENT";
  datePublished: string;
  dateModified: string;
  /** Standardised proof labels rendered as chips. */
  proof: ("LIVE PROJECT" | "LIVE DEMO" | "CASE STUDY" | "BUILD LOG")[];
  /** Publicly accessible demo, only when it truly exists. */
  demoUrl?: string;
  demoLabel?: string;
  /** Vertical workflow rendered as lightweight HTML/CSS. */
  flow?: string[];
  /** Optional demo video (component renders nothing when absent). */
  video?: { src: string; poster?: string; caption: string };
};

const PUBLISHED = "2026-08-29";

const cta = {
  title: "Ingin sistem seperti ini di bisnis Anda?",
  body: "Ceritakan alur kerja yang sedang berjalan ke AI Consultant KERJAKU. Kebutuhan digali langkah demi langkah, lalu dirangkum menjadi order brief yang ditinjau manusia.",
  button: "Coba AI Consultant",
};

const entry = (
  e: Omit<BuildLogEntry, "datePublished" | "dateModified" | "cta" | "breadcrumb" | "path"> & {
    path?: string;
  },
): BuildLogEntry => {
  const path = e.path ?? `/build/${e.slug}`;
  return {
    ...e,
    path,
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    cta,
    breadcrumb: [
      { name: "Beranda", path: "/" },
      { name: "Build Log", path: "/build" },
      { name: e.project, path },
    ],
  };
};

export const buildLogs: BuildLogEntry[] = [
  entry({
    slug: "ai-consultant-kerjaku",
    project: "AI Consultant KERJAKU",
    projectStatus: "LIVE",
    proof: ["BUILD LOG", "LIVE PROJECT"],
    demoUrl: "https://kerjaku.space/#konsultasi",
    demoLabel: "Coba AI Consultant",
    eyebrow: "BUILD LOG 01",
    h1: "Bagaimana KERJAKU Membangun AI Consultant yang Mengubah Percakapan Menjadi Kebutuhan Sistem",
    title: "Build Log: AI Consultant KERJAKU — Percakapan Menjadi Kebutuhan Sistem",
    description:
      "Catatan pembangunan AI Consultant KERJAKU: percakapan satu pertanyaan pada satu waktu, penggalian kebutuhan terstruktur, kualifikasi prospek, sampai tercatat rapi di CRM.",
    summary:
      "Bukan chatbot FAQ: percakapan yang menggali kebutuhan dan menghasilkan ringkasan kebutuhan yang bisa ditinjau.",
    answer:
      "AI Consultant KERJAKU adalah asisten percakapan di halaman utama yang menggali kebutuhan pengunjung secara bertahap — jenis bisnis, alur kerja, pengguna sistem, masalah utama, fitur yang diharapkan, dan rentang waktu — lalu merangkumnya menjadi ringkasan kebutuhan terstruktur yang tersimpan sebagai catatan prospek untuk ditinjau tim.",
    intro:
      "Chatbot FAQ menjawab pertanyaan. Yang dibutuhkan sebuah build agency berbeda: memahami kondisi bisnis seseorang cukup dalam sehingga percakapan bisa dilanjutkan menjadi pekerjaan nyata. Entri ini menjelaskan bagaimana bagian itu dibangun.",
    flow: [
      "Pengunjung",
      "Percakapan",
      "Penggalian masalah",
      "Kebutuhan terstruktur",
      "Konteks bisnis",
      "Kualifikasi",
      "CRM",
    ],
    sections: [
      {
        id: "masalah",
        heading: "Masalah yang ingin diselesaikan",
        blocks: [
          {
            kind: "list",
            items: [
              "Formulir kontak hanya menghasilkan satu kalimat kebutuhan yang terlalu umum.",
              "Kebutuhan sebenarnya baru terlihat setelah beberapa kali tanya jawab.",
              "Konteks percakapan sering hilang saat prospek ditindaklanjuti beberapa hari kemudian.",
              "Pemetaan kebutuhan manual memakan waktu sebelum penawaran bisa disusun.",
            ],
          },
        ],
      },
      {
        id: "pengguna",
        heading: "Target pengguna",
        blocks: [
          {
            kind: "p",
            text: "Pemilik bisnis dan penanggung jawab operasional yang tahu masalahnya, tetapi belum tentu tahu bentuk sistem yang dibutuhkan. Percakapan dirancang memakai bahasa kerja sehari-hari, bukan istilah teknis.",
          },
        ],
      },
      {
        id: "cara-kerja",
        heading: "Cara kerjanya",
        blocks: [
          {
            kind: "steps",
            items: [
              {
                title: "Satu pertanyaan pada satu waktu",
                body: "Percakapan mengikuti jawaban sebelumnya, sehingga pengunjung tidak dihadapkan pada formulir panjang di awal.",
              },
              {
                title: "Penggalian terstruktur",
                body: "Enam area digali: jenis bisnis, alur kerja berjalan, pengguna sistem, masalah utama, fitur yang diharapkan, dan rentang waktu.",
              },
              {
                title: "Ringkasan kebutuhan",
                body: "Hasil percakapan dirangkum menjadi daftar kebutuhan yang bisa dibaca ulang oleh pengunjung maupun tim, bukan hanya transkrip percakapan.",
              },
              {
                title: "Kualifikasi & pencatatan",
                body: "Kelengkapan kebutuhan dan kesiapan calon pelanggan dinilai, lalu tersimpan sebagai satu catatan prospek beserta konteksnya di CRM internal.",
              },
              {
                title: "Versi kebutuhan",
                body: "Ringkasan versi awal berasal dari percakapan; versi final ditetapkan manusia setelah ditinjau, dan keduanya tersimpan agar perubahan bisa ditelusuri.",
              },
            ],
          },
        ],
      },
      {
        id: "keputusan",
        heading: "Keputusan teknis (tingkat tinggi)",
        blocks: [
          {
            kind: "cards",
            items: [
              {
                title: "Percakapan streaming",
                body: "Jawaban dikirim bertahap agar percakapan terasa responsif di jaringan seluler, dan kegagalan jaringan tidak menghapus konteks yang sudah terkumpul.",
              },
              {
                title: "Sesi yang bisa dilanjutkan",
                body: "Satu perangkat bisa melanjutkan konsultasi sebelumnya atau memulai konsultasi baru secara sadar, sehingga satu pengunjung dapat menghasilkan beberapa kebutuhan berbeda tanpa saling menimpa.",
              },
              {
                title: "Penyimpanan sebagai sumber kebenaran",
                body: "Notifikasi dan dokumen mengambil data dari catatan prospek yang tersimpan, bukan dari isi percakapan mentah, sehingga isinya konsisten di semua kanal.",
              },
              {
                title: "Pemisahan aturan dan model",
                body: "Aturan bisnis yang harus pasti dijalankan secara deterministik; model bahasa dipakai untuk memahami dan merangkum, bukan untuk menetapkan angka.",
              },
            ],
          },
        ],
      },
      {
        id: "batas",
        heading: "Batas yang disengaja",
        blocks: [
          {
            kind: "list",
            items: [
              "Tidak memberikan harga final. Angka ditetapkan manusia setelah ruang lingkup ditinjau.",
              "Tidak menjanjikan komitmen kerja atau tenggat di dalam percakapan.",
              "Ringkasan kebutuhan berstatus draf sampai ditinjau tim.",
              "Detail internal seperti instruksi sistem dan kriteria penilaian tidak ditampilkan.",
            ],
          },
        ],
      },
      {
        id: "pelajaran",
        heading: "Pelajaran",
        blocks: [
          {
            kind: "p",
            text: "Kualitas percakapan lebih ditentukan oleh urutan pertanyaan daripada oleh panjang jawaban. Ketika satu pertanyaan diajukan pada satu waktu, jawaban yang masuk jauh lebih spesifik, dan ringkasan yang dihasilkan bisa langsung dipakai sebagai bahan diskusi teknis.",
          },
          {
            kind: "p",
            text: "Pelajaran kedua: bagian tersulit bukan menghasilkan teks, melainkan menjaga agar satu percakapan menjadi satu catatan prospek yang benar — tanpa duplikat dan tanpa menimpa data lama.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Apakah AI Consultant KERJAKU sama dengan chatbot FAQ?",
        a: "Tidak. Chatbot FAQ mencocokkan pertanyaan dengan jawaban siap pakai. AI Consultant menggali kondisi bisnis, menyusun kebutuhan terstruktur, dan menyimpannya sebagai catatan prospek untuk ditindaklanjuti manusia.",
      },
      {
        q: "Apakah percakapan langsung menghasilkan harga?",
        a: "Tidak. Percakapan menghasilkan pemahaman kebutuhan dan order brief. Penawaran harga disusun setelah ruang lingkup ditinjau tim KERJAKU.",
      },
    ],
    related: [
      {
        to: "/cara-kerjaku-menggunakan-ai",
        label: "Bagaimana KERJAKU Menggunakan AI",
        note: "Gambaran menyeluruh tiga lapis AI di operasional KERJAKU.",
      },
      {
        to: "/build/workflow-konsultasi-sampai-invoice",
        label: "Build Log: Dari Konsultasi ke Order Brief, Proposal, dan Invoice",
      },
      { to: "/jasa-ai-automation-bisnis", label: "Jasa AI Automation Bisnis" },
    ],
  }),

  entry({
    slug: "ai-business-assistant",
    project: "AI Business Assistant",
    projectStatus: "LIVE",
    proof: ["BUILD LOG", "LIVE PROJECT"],
    eyebrow: "BUILD LOG 02",
    h1: "AI Business Assistant KERJAKU: Bukan Sekadar Bot Notifikasi",
    title: "Build Log: AI Business Assistant KERJAKU — Bukan Bot Notifikasi",
    description:
      "Catatan pembangunan AI Business Assistant KERJAKU: konteks bisnis dari CRM, prospek, proyek, proposal, dan invoice; ringkasan harian, prioritas, rekomendasi, dan aksi yang dikonfirmasi manusia.",
    summary:
      "Asisten pemilik bisnis yang membaca konteks operasional, bukan sekadar meneruskan notifikasi.",
    answer:
      "AI Business Assistant KERJAKU adalah asisten internal untuk pemilik bisnis yang membaca konteks operasional — prospek, proyek, proposal, invoice, dan tugas — lalu menyusun ringkasan harian, menandai prioritas, menjawab pertanyaan tentang kondisi bisnis, dan menyiapkan tindakan yang tetap dikonfirmasi manusia sebelum dijalankan.",
    intro:
      "Bot notifikasi mengubah satu kejadian menjadi satu pesan. Asisten bisnis melakukan hal berbeda: membaca keadaan, menghubungkan beberapa sumber data, lalu mengusulkan langkah berikutnya. Entri ini menjelaskan perbedaan itu pada sistem yang benar-benar dipakai KERJAKU setiap hari.",
    flow: [
      "Data operasional",
      "Konteks bisnis",
      "Penalaran",
      "Percakapan",
      "Rekomendasi",
      "Konfirmasi manusia",
      "Aksi terkendali",
    ],
    sections: [
      {
        id: "perbedaan",
        heading: "Bot notifikasi vs asisten bisnis",
        blocks: [
          {
            kind: "cards",
            items: [
              {
                title: "Bot notifikasi",
                body: "Alurnya satu arah: kejadian → pesan. Tidak tahu apa yang terjadi kemarin, tidak bisa ditanya balik, dan tidak bisa membedakan mana yang mendesak.",
              },
              {
                title: "AI Business Assistant",
                body: "Alurnya berlapis: konteks bisnis → penalaran → percakapan → rekomendasi → aksi terkendali. Bisa ditanya, bisa menjelaskan alasannya, dan menunggu konfirmasi untuk tindakan yang mengubah data.",
              },
            ],
          },
        ],
      },
      {
        id: "kemampuan",
        heading: "Kemampuan yang benar-benar berjalan",
        blocks: [
          {
            kind: "list",
            items: [
              "Ringkasan harian kondisi bisnis yang dikirim ke kanal internal.",
              "Membaca konteks prospek, proyek, proposal, invoice, dan tugas pemilik.",
              "Menjawab pertanyaan operasional lewat percakapan, bukan hanya laporan statis.",
              "Menandai prioritas dan tindak lanjut yang belum tuntas.",
              "Menyimpan catatan/memori konteks agar percakapan berikutnya tidak dimulai dari nol.",
              "Menyiapkan aksi seperti pencatatan tugas, dengan konfirmasi untuk hal sensitif.",
            ],
          },
        ],
      },
      {
        id: "kendali",
        heading: "Kendali manusia untuk aksi sensitif",
        blocks: [
          {
            kind: "p",
            text: "Asisten tidak memiliki wewenang penuh. Membaca data dan menyusun usulan berjalan otomatis; mengirim dokumen ke pelanggan, mengubah nilai komersial, atau menutup pekerjaan tetap memerlukan keputusan manusia. Setiap tindakan yang berdampak keluar tercatat sehingga bisa ditelusuri.",
          },
        ],
      },
      {
        id: "keputusan",
        heading: "Keputusan teknis (tingkat tinggi)",
        blocks: [
          {
            kind: "cards",
            items: [
              {
                title: "Konteks dirakit dari sumber data resmi",
                body: "Ringkasan disusun dari catatan CRM dan dokumen yang tersimpan, bukan dari percakapan bebas, agar angka yang disebut konsisten dengan sistem.",
              },
              {
                title: "Batas akses per peran",
                body: "Asisten hanya menjangkau data yang boleh diakses penggunanya. Area pelanggan dan dokumen privat tidak dibuka ke jalur publik.",
              },
              {
                title: "Ketahanan penyedia AI",
                body: "Permintaan dialihkan antar kunci dan penyedia model saat terjadi pembatasan kuota, sehingga ringkasan harian tetap terkirim.",
              },
              {
                title: "Idempotensi",
                body: "Notifikasi dan ringkasan dijaga agar tidak terkirim ganda ketika proses diulang.",
              },
            ],
          },
        ],
      },
      {
        id: "pelajaran",
        heading: "Pelajaran",
        blocks: [
          {
            kind: "p",
            text: "Nilai asisten muncul dari kualitas konteks, bukan dari kecanggihan kalimatnya. Begitu data prospek, proyek, dan tagihan berada dalam satu sumber kebenaran, ringkasan harian berubah dari sekadar rekap menjadi daftar keputusan.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Apa itu AI Business Assistant KERJAKU?",
        a: "Asisten internal untuk pemilik bisnis yang membaca konteks operasional, menyusun ringkasan harian, menjawab pertanyaan, dan menyiapkan tindakan yang dikonfirmasi manusia sebelum dijalankan.",
      },
      {
        q: "Apakah asisten ini bekerja sepenuhnya otonom?",
        a: "Tidak. Aksi yang mengubah data penting atau menyentuh pelanggan selalu melalui konfirmasi manusia.",
      },
    ],
    related: [
      { to: "/cara-kerjaku-menggunakan-ai", label: "Bagaimana KERJAKU Menggunakan AI" },
      {
        to: "/insight/ai-assistant-vs-chatbot",
        label: "AI Assistant vs Chatbot",
        note: "Perbedaan konsep yang mendasari keputusan build ini.",
      },
      { to: "/jasa-ai-automation-bisnis", label: "Jasa AI Automation Bisnis" },
    ],
  }),

  entry({
    slug: "workflow-konsultasi-sampai-invoice",
    project: "AI-Assisted Commercial Workflow",
    projectStatus: "LIVE",
    proof: ["BUILD LOG", "LIVE PROJECT"],
    eyebrow: "BUILD LOG 03",
    h1: "Dari Konsultasi ke Order Brief, Proposal, dan Invoice dalam Satu Workflow",
    title: "Build Log: Workflow Konsultasi → Order Brief → Proposal → Invoice | KERJAKU",
    description:
      "Catatan pembangunan alur komersial KERJAKU: konsultasi AI, kebutuhan terstruktur, CRM, analisis solusi, order brief, proposal, invoice, dan tindak lanjut proyek dalam satu workflow terintegrasi.",
    summary:
      "Satu rantai kerja terintegrasi dari percakapan pertama sampai tagihan, dengan dokumen yang saling konsisten.",
    answer:
      "KERJAKU menjalankan alur komersialnya dalam satu workflow terintegrasi: konsultasi AI menghasilkan kebutuhan terstruktur, kebutuhan tercatat di CRM, dianalisis menjadi order brief, order brief menjadi dasar proposal, dan proposal menjadi dasar invoice — sehingga isi dan angka setiap dokumen konsisten satu sama lain.",
    intro:
      "Masalah paling mahal di pekerjaan jasa bukan menulis dokumen, melainkan dokumen yang tidak sinkron: brief berkata A, proposal berkata B, invoice berkata C. Workflow ini dibangun untuk menutup celah itu.",
    flow: [
      "Konsultasi AI",
      "Kebutuhan terstruktur",
      "CRM",
      "Analisis solusi",
      "Order Brief",
      "Proposal",
      "Invoice",
      "Tindak lanjut / Proyek",
    ],
    sections: [
      {
        id: "prinsip",
        heading: "Prinsip: satu sumber kebenaran",
        blocks: [
          {
            kind: "p",
            text: "Order brief final adalah sumber kebenaran. Proposal disusun mengikuti brief tersebut, dan invoice mengikuti angka pada proposal. Tidak ada dokumen yang mengarang ruang lingkup baru di tengah jalan.",
          },
          {
            kind: "list",
            items: [
              "Kebutuhan pelanggan dan rekomendasi tim ditulis terpisah agar tidak tertukar.",
              "Fitur yang sudah termasuk tidak diulang sebagai rekomendasi tambahan.",
              "Angka pada invoice mengikuti proposal yang disetujui.",
              "Setiap dokumen punya versi, sehingga perubahan bisa ditelusuri.",
            ],
          },
        ],
      },
      {
        id: "tahap",
        heading: "Tahapan yang dijalankan",
        blocks: [
          {
            kind: "steps",
            items: [
              {
                title: "Konsultasi",
                body: "Kebutuhan digali lewat percakapan, lalu dirangkum menjadi daftar kebutuhan terstruktur.",
              },
              {
                title: "Pencatatan CRM",
                body: "Prospek dan konteksnya tersimpan sebagai satu catatan, lengkap dengan sumber dan riwayat.",
              },
              {
                title: "Analisis solusi",
                body: "Masalah dipetakan ke solusi: mana yang menjadi solusi inti, mana yang menjadi peluang pengembangan lanjutan.",
              },
              {
                title: "Order brief",
                body: "Kondisi bisnis, masalah, tujuan, dan rekomendasi ruang lingkup disusun menjadi dokumen yang ditinjau bersama pelanggan.",
              },
              {
                title: "Proposal",
                body: "Ruang lingkup yang disepakati diterjemahkan menjadi tahapan pengerjaan dan rincian investasi.",
              },
              {
                title: "Invoice",
                body: "Tagihan mengikuti proposal, termasuk skema pembayaran bertahap dan detail rekening.",
              },
              {
                title: "Tindak lanjut",
                body: "Setelah dokumen terkirim, pengingat dan ringkasan harian menjaga agar tidak ada tindak lanjut yang tertinggal.",
              },
            ],
          },
        ],
      },
      {
        id: "kecepatan",
        heading: "Tentang klaim kecepatan",
        blocks: [
          {
            kind: "p",
            text: "Halaman ini sengaja tidak mencantumkan angka durasi. Yang bisa dipertanggungjawabkan adalah bentuk kerjanya: seluruh rantai berjalan dalam satu workflow terintegrasi tanpa menyalin ulang data antar dokumen.",
          },
        ],
      },
      {
        id: "pelajaran",
        heading: "Pelajaran",
        blocks: [
          {
            kind: "p",
            text: "Otomasi dokumen baru bernilai setelah aturan bisnisnya tegas. Sebelum aturan seperti anti-duplikasi fitur dan pemisahan kebutuhan versus rekomendasi ditetapkan, hasil otomatis justru menambah pekerjaan koreksi.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Apakah dokumen dikirim otomatis ke pelanggan?",
        a: "Tidak. Dokumen berstatus draf sampai ditinjau dan disetujui manusia, baru kemudian dikirim.",
      },
      {
        q: "Apakah AI menentukan harga?",
        a: "Tidak. Angka dan ruang lingkup komersial ditetapkan manusia; AI membantu menyusun struktur dan narasinya.",
      },
    ],
    related: [
      { to: "/cara-kerjaku-menggunakan-ai", label: "Bagaimana KERJAKU Menggunakan AI" },
      { to: "/build/ai-consultant-kerjaku", label: "Build Log: AI Consultant KERJAKU" },
      { to: "/jasa-dashboard-bisnis", label: "Jasa Dashboard Bisnis" },
    ],
  }),

  entry({
    slug: "ro-memory",
    project: "RO MEMORY",
    projectStatus: "LIVE",
    proof: ["BUILD LOG", "LIVE DEMO", "CASE STUDY"],
    demoUrl: "https://demo-ro-memory.kerjaku.space",
    demoLabel: "Buka live demo RO MEMORY",
    eyebrow: "BUILD LOG 04",
    h1: "Bagaimana KERJAKU Membangun RO MEMORY untuk Aktivitas Kerja Lapangan",
    title: "Build Log: RO MEMORY — Sistem Aktivitas Kerja Lapangan | KERJAKU",
    description:
      "Catatan pembangunan RO MEMORY: mencatat kunjungan lapangan menjadi data terstruktur, memantau tindak lanjut, menyajikan dashboard performa, dan menyiapkan laporan dengan bantuan AI.",
    summary:
      "Dari catatan kunjungan yang tersebar menjadi data terstruktur, dashboard, dan laporan yang siap dipresentasikan.",
    answer:
      "RO MEMORY adalah sistem aktivitas lapangan buatan KERJAKU: mencatat kunjungan dan hasilnya sebagai data terstruktur, menyimpan database workshop dan pelanggan, memantau rencana terhadap realisasi, menyajikan dashboard performa, serta membantu penyusunan laporan dan pengingat tindak lanjut.",
    intro:
      "RO MEMORY berangkat dari pekerjaan lapangan yang nyata: data kunjungan tersebar di catatan dan spreadsheet, dan laporan selalu dirakit ulang dari nol setiap periode.",
    flow: [
      "Aktivitas lapangan",
      "Pencatatan terstruktur",
      "Tindak lanjut",
      "Dashboard",
      "Analitik",
      "Laporan & pengingat",
    ],
    sections: [
      {
        id: "masalah",
        heading: "Masalah yang dipecahkan",
        blocks: [
          {
            kind: "list",
            items: [
              "Riwayat kunjungan dan profil pelanggan tersebar di beberapa file.",
              "Progres rencana terhadap realisasi tidak terlihat harian.",
              "Laporan menyita waktu karena data harus dirakit ulang.",
              "Informasi penting dari lapangan hilang karena tidak langsung dicatat.",
            ],
          },
        ],
      },
      {
        id: "pengguna",
        heading: "Target pengguna",
        blocks: [
          {
            kind: "p",
            text: "Pekerja lapangan dan atasannya. Pekerja lapangan butuh pencatatan yang cepat dari ponsel; atasan butuh gambaran cakupan area dan tindak lanjut tanpa harus meminta laporan manual.",
          },
        ],
      },
      {
        id: "cara-kerja",
        heading: "Bagaimana sistemnya bekerja",
        blocks: [
          {
            kind: "steps",
            items: [
              {
                title: "Database workshop & pelanggan",
                body: "Profil, kontak, lokasi, dan riwayat interaksi tersimpan terpusat sehingga konteks tersedia sebelum kunjungan dilakukan.",
              },
              {
                title: "Rencana & realisasi kunjungan",
                body: "Jadwal kunjungan direncanakan, hasilnya dicatat, dan realisasinya dibandingkan dengan rencana.",
              },
              {
                title: "Catatan cepat di lapangan",
                body: "Informasi penting dicatat saat itu juga, lalu terhubung ke pelanggan yang bersangkutan.",
              },
              {
                title: "Dashboard & analitik",
                body: "Cakupan area, aktivitas, dan performa tervisualisasi sehingga bisa dibaca tanpa mengolah spreadsheet.",
              },
              {
                title: "Bantuan AI untuk laporan",
                body: "Ringkasan kunjungan dan laporan disiapkan sebagai draf, lalu ditinjau pengguna sebelum tersimpan atau dikirim.",
              },
              {
                title: "Automation & pengingat",
                body: "Pengingat tindak lanjut, berbagi laporan, dan cadangan data berjalan otomatis di latar belakang.",
              },
            ],
          },
        ],
      },
      {
        id: "pelajaran",
        heading: "Pelajaran",
        blocks: [
          {
            kind: "p",
            text: "Sistem lapangan berhasil atau gagal pada detik-detik pertama pemakaian. Jika mencatat satu kunjungan butuh lebih lama daripada menulis di catatan ponsel, sistem akan ditinggalkan. Karena itu kecepatan input diprioritaskan di atas kelengkapan formulir.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Apakah RO MEMORY bisa dicoba?",
        a: "Ya, tersedia demo publik di demo-ro-memory.kerjaku.space untuk melihat alur pencatatan dan dashboardnya.",
      },
      {
        q: "Apakah sistem serupa bisa dibuat untuk industri lain?",
        a: "Bisa. Pola yang sama — pencatatan terstruktur, tindak lanjut, dashboard, dan laporan otomatis — dipakai untuk tim penjualan, teknisi, maupun distribusi.",
      },
    ],
    related: [
      {
        to: "/products/ro-memory",
        label: "Halaman produk RO MEMORY",
        note: "Rincian kemampuan dan status produk.",
      },
      { to: "/jasa-pembuatan-aplikasi-custom", label: "Jasa Pembuatan Aplikasi Custom" },
      {
        to: "/insight/digitalisasi-proses-manual-spreadsheet",
        label: "Digitalisasi Proses Manual dari Spreadsheet",
      },
    ],
  }),
];

export function getBuildLog(slug: string) {
  return buildLogs.find((b) => b.slug === slug);
}
