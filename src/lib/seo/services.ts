/** Intent-focused service page content (money pages). */
import type { DocPageContent } from "./types";

const cta = (button = "Mulai konsultasi") => ({
  title: "Ceritakan kebutuhan Anda, kami bantu petakan solusinya",
  body: "AI Consultant KERJAKU akan menggali kondisi bisnis, alur kerja, dan kebutuhan sistem Anda, lalu menyusun order brief yang bisa langsung ditinjau bersama tim.",
  button,
});

export const customAppService: DocPageContent = {
  path: "/jasa-pembuatan-aplikasi-custom",
  breadcrumb: [
    { name: "Beranda", path: "/" },
    { name: "Jasa Pembuatan Aplikasi Custom", path: "/jasa-pembuatan-aplikasi-custom" },
  ],
  eyebrow: "APLIKASI CUSTOM",
  h1: "Jasa Pembuatan Aplikasi Custom & Sistem Internal Bisnis",
  title: "Jasa Pembuatan Aplikasi Custom & Sistem Internal | KERJAKU",
  description:
    "KERJAKU membangun aplikasi custom dan sistem internal berbasis web untuk mendigitalkan alur kerja operasional: input lapangan, approval, data terpusat, dan pelaporan.",
  answer:
    "Aplikasi custom adalah sistem yang dibangun mengikuti alur kerja bisnis Anda, bukan sebaliknya. KERJAKU membangunnya sebagai aplikasi web yang bisa dibuka dari desktop maupun ponsel, dengan hak akses pengguna, data terpusat, dan laporan yang mengikuti proses kerja yang sudah berjalan.",
  intro:
    "Ketika pekerjaan operasional sudah tidak lagi muat di spreadsheet dan grup chat, yang dibutuhkan bukan aplikasi baru yang generik, melainkan sistem yang mengikuti cara tim Anda bekerja.",
  sections: [
    {
      id: "masalah",
      heading: "Kondisi yang biasanya memicu kebutuhan aplikasi custom",
      blocks: [
        {
          kind: "list",
          items: [
            "Data operasional tersebar di beberapa file dan perangkat, sehingga sulit dipastikan mana yang paling baru.",
            "Proses approval dan tindak lanjut berjalan lewat chat sehingga jejaknya hilang.",
            "Input lapangan masih manual dan baru direkap saat laporan dibutuhkan.",
            "Software siap pakai memaksa tim mengubah alur kerja yang sebenarnya sudah efektif.",
            "Tidak ada pembatasan akses, semua orang bisa melihat dan mengubah semua data.",
            "Rekap bulanan memakan waktu berhari-hari karena data harus disatukan manual.",
          ],
        },
      ],
    },
    {
      id: "cakupan",
      heading: "Yang KERJAKU bangun",
      blocks: [
        {
          kind: "cards",
          items: [
            {
              title: "Sistem operasional internal",
              body: "Pencatatan aktivitas, master data, penugasan, status pekerjaan, dan riwayat perubahan dalam satu sumber data.",
            },
            {
              title: "Digitalisasi alur kerja",
              body: "Form kerja, alur approval bertingkat, notifikasi, dan aturan status agar proses berjalan tanpa saling menunggu kabar.",
            },
            {
              title: "Aplikasi web mobile-friendly",
              body: "Dipakai langsung dari ponsel di lapangan maupun desktop di kantor, tanpa instalasi aplikasi terpisah.",
            },
            {
              title: "Hak akses & audit trail",
              body: "Peran pengguna, pembatasan data per divisi atau area, serta catatan siapa mengubah apa dan kapan.",
            },
          ],
        },
      ],
    },
    {
      id: "proses",
      heading: "Cara kerja pengembangan",
      blocks: [
        {
          kind: "steps",
          items: [
            {
              title: "Pemetaan alur kerja",
              body: "Menelusuri proses nyata: siapa mengerjakan apa, data apa yang berpindah, dan di mana proses tersendat.",
            },
            {
              title: "Order brief & prioritas",
              body: "Kebutuhan diterjemahkan menjadi daftar fitur inti dan fitur lanjutan, lengkap dengan alasan bisnisnya.",
            },
            {
              title: "Pembangunan bertahap",
              body: "Fondasi dibangun lebih dulu agar sistem bisa dipakai lebih cepat, lalu dikembangkan sesuai kebutuhan.",
            },
            {
              title: "Uji pakai & penyesuaian",
              body: "Sistem diuji dengan data dan kebiasaan kerja tim, lalu disesuaikan sebelum dipakai penuh.",
            },
          ],
        },
      ],
    },
  ],
  faq: [
    {
      q: "Apa bedanya aplikasi custom dengan software siap pakai?",
      a: "Software siap pakai memberi fitur standar yang cepat dipakai, tetapi alur kerja harus mengikuti aplikasinya. Aplikasi custom dibangun mengikuti proses bisnis Anda, sehingga cocok ketika alur kerja menjadi keunggulan atau tidak umum.",
    },
    {
      q: "Apakah sistem bisa dikembangkan bertahap?",
      a: "Bisa. KERJAKU biasanya membangun fondasi terlebih dahulu (data inti dan alur utama), lalu menambah modul lanjutan setelah sistem dipakai dan kebutuhannya terbukti.",
    },
    {
      q: "Apakah data lama bisa dipindahkan?",
      a: "Data dari spreadsheet atau sistem lama dapat diimpor selama strukturnya bisa dipetakan. Pemetaan ini dibahas pada tahap order brief.",
    },
  ],
  related: [
    {
      to: "/insight/aplikasi-custom-vs-software-siap-pakai",
      label: "Aplikasi Custom vs Software Siap Pakai",
      note: "Kapan membangun sendiri lebih masuk akal dibanding berlangganan.",
    },
    {
      to: "/insight/dari-proses-manual-menjadi-sistem-digital",
      label: "Dari Proses Manual Menjadi Sistem Digital",
      note: "Urutan digitalisasi yang tidak membuat tim menolak sistem baru.",
    },
    {
      to: "/products/ro-memory",
      label: "RO MEMORY",
      note: "Contoh sistem operasional lapangan yang dibangun sendiri oleh KERJAKU.",
    },
  ],
  cta: cta("Diskusikan sistem yang dibutuhkan"),
};

export const aiAutomationService: DocPageContent = {
  path: "/jasa-ai-automation-bisnis",
  breadcrumb: [
    { name: "Beranda", path: "/" },
    { name: "Jasa AI & Automation Bisnis", path: "/jasa-ai-automation-bisnis" },
  ],
  eyebrow: "AI & AUTOMATION",
  h1: "Jasa AI Automation untuk Operasional Bisnis",
  title: "Jasa AI Automation Bisnis & AI Assistant Internal | KERJAKU",
  description:
    "KERJAKU membangun AI assistant dan automation yang terhubung ke data bisnis: ringkasan otomatis, notifikasi, pencatatan cepat, dan alur kerja yang berjalan sendiri.",
  answer:
    "AI automation yang berguna bukan chatbot yang menjawab pertanyaan umum, melainkan asisten yang terhubung ke data bisnis Anda dan dapat menjalankan pekerjaan berulang: merangkum aktivitas, menyusun laporan, mengingatkan tindak lanjut, dan meneruskan informasi ke orang yang tepat.",
  intro:
    "KERJAKU memakai AI di operasional sendiri setiap hari. Karena itu penerapan AI untuk klien selalu dimulai dari pekerjaan berulang yang jelas, bukan dari teknologinya.",
  sections: [
    {
      id: "beda",
      heading: "AI assistant vs chatbot sederhana",
      blocks: [
        {
          kind: "cards",
          items: [
            {
              title: "Chatbot sederhana",
              body: "Menjawab pertanyaan dari daftar jawaban yang sudah disiapkan. Tidak mengetahui kondisi data bisnis dan tidak bisa melakukan tindakan.",
            },
            {
              title: "AI assistant terhubung data",
              body: "Membaca data yang diizinkan, menjawab berdasarkan kondisi terkini, membuat ringkasan, dan memicu tindakan seperti mencatat atau mengirim notifikasi.",
            },
          ],
        },
      ],
    },
    {
      id: "penerapan",
      heading: "Penerapan yang biasanya paling cepat terasa",
      blocks: [
        {
          kind: "list",
          items: [
            "Ringkasan aktivitas harian atau mingguan yang dikirim otomatis ke Telegram atau email.",
            "Pencatatan cepat lewat percakapan, termasuk mengubah catatan bebas menjadi data terstruktur.",
            "Kualifikasi dan perapian data prospek sebelum masuk ke tim penjualan.",
            "Penyusunan draf dokumen kerja seperti brief atau rekap, dengan peninjauan manusia sebelum dikirim.",
            "Notifikasi berbasis kondisi, misalnya pekerjaan yang belum ditindaklanjuti melewati batas waktu.",
          ],
        },
      ],
    },
    {
      id: "kontrol",
      heading: "Kendali dan batasan",
      blocks: [
        {
          kind: "p",
          text: "Setiap alur AI yang KERJAKU bangun memiliki titik peninjauan manusia pada keluaran yang menyangkut pelanggan, harga, atau komitmen kerja. AI menyiapkan, manusia memutuskan.",
        },
        {
          kind: "list",
          items: [
            "Akses data dibatasi sesuai peran pengguna.",
            "Keluaran penting berstatus draf sampai disetujui.",
            "Aktivitas otomatis tercatat sehingga bisa ditelusuri.",
            "Alur dapat dimatikan tanpa menghentikan sistem utama.",
          ],
        },
      ],
    },
  ],
  faq: [
    {
      q: "Apakah AI ini akan menggantikan tim?",
      a: "Tidak. Penerapan yang KERJAKU sarankan menyasar pekerjaan berulang seperti rekap, pengingat, dan perapian data, sehingga tim bisa fokus pada keputusan dan hubungan dengan pelanggan.",
    },
    {
      q: "Apakah data bisnis kami dipakai untuk melatih model?",
      a: "Tidak. Data digunakan untuk menjalankan alur kerja Anda, dan akses dibatasi sesuai peran pengguna di sistem.",
    },
    {
      q: "Apakah AI bisa dipasang di sistem yang sudah ada?",
      a: "Bisa, selama sistem tersebut menyediakan akses data yang jelas. Jika belum, biasanya kami rapikan struktur datanya lebih dulu.",
    },
  ],
  related: [
    {
      to: "/insight/ai-assistant-vs-chatbot",
      label: "AI Assistant vs Chatbot",
      note: "Perbedaan yang menentukan apakah AI benar-benar membantu operasional.",
    },
    {
      to: "/cara-kerjaku-menggunakan-ai",
      label: "Bagaimana KERJAKU Menggunakan AI",
      note: "Alur AI internal KERJAKU dari konsultasi sampai proyek berjalan.",
    },
    {
      to: "/insight/contoh-ai-automation-untuk-bisnis",
      label: "Contoh AI Automation yang Berguna",
      note: "Daftar penerapan yang dampaknya terasa dalam pekerjaan harian.",
    },
  ],
  cta: cta("Bahas automation yang tepat"),
};

export const dashboardService: DocPageContent = {
  path: "/jasa-dashboard-bisnis",
  breadcrumb: [
    { name: "Beranda", path: "/" },
    { name: "Jasa Dashboard Bisnis", path: "/jasa-dashboard-bisnis" },
  ],
  eyebrow: "DASHBOARD & DATA",
  h1: "Jasa Pembuatan Dashboard Bisnis & Visibilitas Data Operasional",
  title: "Jasa Pembuatan Dashboard Bisnis & Monitoring Data | KERJAKU",
  description:
    "KERJAKU membangun dashboard operasional, penjualan, dan aktivitas lapangan agar kondisi bisnis terlihat harian tanpa rekap manual.",
  answer:
    "Dashboard bisnis adalah tampilan terpusat yang menjawab pertanyaan operasional harian: apa yang sedang berjalan, apa yang tertinggal, dan bagaimana pencapaian dibanding target. KERJAKU membangunnya di atas data yang sudah dihasilkan sistem kerja Anda, sehingga angkanya tidak perlu direkap manual.",
  intro:
    "Dashboard hanya berguna kalau datanya bisa dipercaya. Karena itu pekerjaan biasanya dimulai dari merapikan sumber data, bukan dari memilih jenis grafik.",
  sections: [
    {
      id: "jenis",
      heading: "Jenis dashboard yang sering dibutuhkan",
      blocks: [
        {
          kind: "cards",
          items: [
            {
              title: "Dashboard operasional",
              body: "Status pekerjaan berjalan, antrean, keterlambatan, dan beban kerja per tim atau area.",
            },
            {
              title: "Dashboard penjualan",
              body: "Pipeline, konversi tiap tahap, pencapaian terhadap target, dan aktivitas tindak lanjut.",
            },
            {
              title: "Dashboard aktivitas lapangan",
              body: "Kunjungan, cakupan area, riwayat interaksi pelanggan, dan hasil dari setiap aktivitas.",
            },
            {
              title: "Ringkasan untuk pimpinan",
              body: "Tampilan ringkas berisi indikator utama beserta konteksnya, siap dipakai saat rapat.",
            },
          ],
        },
      ],
    },
    {
      id: "fondasi",
      heading: "Fondasi data sebelum visualisasi",
      blocks: [
        {
          kind: "list",
          items: [
            "Menentukan definisi tiap indikator agar satu istilah berarti sama di semua divisi.",
            "Menyatukan sumber data operasional ke dalam struktur yang konsisten.",
            "Menetapkan waktu pembaruan data dan siapa yang bertanggung jawab mengisinya.",
            "Menyediakan penelusuran dari angka ringkasan ke data rincinya.",
          ],
        },
      ],
    },
    {
      id: "sistem-perusahaan",
      heading: "Dashboard bisnis vs sistem perusahaan",
      blocks: [
        {
          kind: "p",
          text: "Dashboard menampilkan kondisi, sistem perusahaan yang menghasilkan datanya. Banyak kebutuhan yang disebut \u201cdashboard\u201d sebenarnya butuh dua-duanya: pencatatan kerja yang rapi di sisi operasional, lalu ringkasan untuk pimpinan di atasnya.",
        },
        {
          kind: "list",
          items: [
            "Sistem operasional perusahaan: pencatatan pekerjaan, status, penugasan, dan riwayat aktivitas tiap tim.",
            "Hak akses per peran, sehingga staf lapangan, supervisor, dan pimpinan melihat cakupan data yang berbeda.",
            "Dashboard di atas sistem tersebut, membaca data yang sama tanpa rekap ulang.",
            "Bila pencatatan operasional belum ada, pekerjaan dimulai dari sistemnya dulu, lalu dashboard menyusul.",
          ],
        },
        {
          kind: "p",
          text: "Pola ini dipakai pada RO MEMORY: aktivitas lapangan dicatat lewat sistem, dan dashboard beserta laporannya dihasilkan dari catatan itu.",
        },
      ],
    },
    {
      id: "hasil",
      heading: "Yang berubah setelah dashboard berjalan",
      blocks: [
        {
          kind: "p",
          text: "Rapat berpindah dari mempertanyakan angka menjadi membahas tindakan. Rekap manual berkurang karena laporan mengambil data langsung dari aktivitas yang tercatat, dan masalah operasional terlihat lebih awal.",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Kami masih memakai Excel, apakah harus diganti total?",
      a: "Tidak harus. Excel tetap cocok untuk analisis sekali pakai. Yang biasanya dipindahkan adalah pencatatan operasional harian yang dipakai banyak orang secara bersamaan.",
    },
    {
      q: "Apakah dashboard bisa dibuka dari ponsel?",
      a: "Bisa. Dashboard dibangun berbasis web dan menyesuaikan tampilan untuk layar ponsel maupun desktop.",
    },
    {
      q: "Apakah setiap orang melihat data yang sama?",
      a: "Tidak harus. Tampilan dapat dibatasi sesuai peran, misalnya per area, per tim, atau ringkasan penuh untuk pimpinan.",
    },
  ],
  related: [
    {
      to: "/insight/kapan-excel-tidak-cukup-untuk-operasional-bisnis",
      label: "Kapan Excel Tidak Lagi Cukup",
      note: "Tanda-tanda operasional sudah melewati batas kemampuan spreadsheet.",
    },
    {
      to: "/products/ro-memory",
      label: "RO MEMORY",
      note: "Dashboard aktivitas lapangan yang dipakai untuk pekerjaan nyata.",
    },
  ],
  cta: cta("Bahas kebutuhan dashboard"),
};

export const websiteService: DocPageContent = {
  path: "/jasa-pembuatan-website",
  breadcrumb: [
    { name: "Beranda", path: "/" },
    { name: "Jasa Pembuatan Website", path: "/jasa-pembuatan-website" },
  ],
  eyebrow: "WEBSITE & LANDING PAGE",
  h1: "Jasa Pembuatan Website Perusahaan & Landing Page",
  title: "Jasa Pembuatan Website Perusahaan & Landing Page | KERJAKU",
  description:
    "KERJAKU membangun company profile dan landing page yang cepat, rapi di mesin pencari, dan mengarahkan pengunjung ke satu tindakan yang jelas.",
  answer:
    "Halaman ini untuk kebutuhan kehadiran publik: company profile, halaman layanan, dan landing page kampanye. Jika yang dibutuhkan adalah sistem kerja internal, aplikasi custom adalah jalur yang tepat.",
  intro:
    "Website bisnis dinilai dari dua hal: seberapa cepat pengunjung memahami apa yang Anda kerjakan, dan seberapa mudah mereka mengambil langkah berikutnya.",
  sections: [
    {
      id: "cakupan",
      heading: "Cakupan pekerjaan",
      blocks: [
        {
          kind: "cards",
          items: [
            {
              title: "Company profile",
              body: "Struktur halaman yang menjelaskan layanan, bukti pekerjaan, dan cara menghubungi, dengan metadata serta schema yang benar.",
            },
            {
              title: "Landing page konversi",
              body: "Satu halaman dengan satu tujuan: menjelaskan penawaran dan mengarahkan pengunjung ke formulir atau percakapan.",
            },
            {
              title: "Fondasi SEO teknis",
              body: "Judul dan deskripsi unik per halaman, canonical, sitemap, data terstruktur, serta halaman yang bisa ditemukan crawler.",
            },
            {
              title: "Performa & mobile",
              body: "Gambar dioptimalkan dan dimuat bertahap, tata letak stabil, dan pengalaman utama diuji di layar ponsel.",
            },
          ],
        },
      ],
    },
    {
      id: "konversi",
      heading: "Bagaimana pengunjung diarahkan",
      blocks: [
        {
          kind: "p",
          text: "Setiap halaman memiliki satu tindakan utama. Di website KERJAKU sendiri, tindakan tersebut adalah percakapan dengan AI Consultant yang langsung menggali kebutuhan, sehingga prospek masuk dengan konteks yang sudah jelas.",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Apakah domain dan hosting termasuk?",
      a: "Bisa disertakan sesuai kebutuhan, termasuk pengaturan domain dan penerbitan situs. Rinciannya disepakati saat penyusunan brief.",
    },
    {
      q: "Apakah kami bisa mengubah isi halaman sendiri?",
      a: "Bisa, jika kebutuhan pembaruannya rutin. Pada kasus itu kami sarankan menambahkan pengelolaan konten agar tim Anda tidak bergantung pada developer.",
    },
    {
      q: "Berapa lama pengerjaannya?",
      a: "Bergantung jumlah halaman dan kesiapan materi. Landing page tunggal jauh lebih cepat dibanding company profile dengan banyak halaman layanan.",
    },
  ],
  related: [
    {
      to: "/jasa-pembuatan-aplikasi-custom",
      label: "Jasa Pembuatan Aplikasi Custom",
      note: "Untuk kebutuhan sistem kerja internal, bukan halaman publik.",
    },
    {
      to: "/jasa-pembuatan-website-aplikasi-landing-page",
      label: "Ringkasan seluruh layanan KERJAKU",
      note: "Gambaran menyeluruh layanan website, aplikasi, dan automation.",
    },
  ],
  cta: cta("Diskusikan kebutuhan website"),
};

export const serviceDocs = [
  customAppService,
  aiAutomationService,
  dashboardService,
  websiteService,
];
