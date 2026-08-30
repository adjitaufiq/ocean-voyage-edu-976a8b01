/** KERJAKU Insight — practitioner-grade articles. Answer first, no filler. */
import type { ArticleContent } from "./types";

const PUBLISHED = "2026-08-29";

const cta = {
  title: "Punya kondisi serupa di bisnis Anda?",
  body: "Ceritakan alur kerja yang sedang berjalan ke AI Consultant KERJAKU. Kebutuhannya akan digali langkah demi langkah dan dirangkum menjadi order brief yang bisa ditinjau bersama.",
  button: "Mulai konsultasi",
};

const base = (
  a: Omit<ArticleContent, "datePublished" | "dateModified" | "cta" | "breadcrumb"> & {
    cta?: ArticleContent["cta"];
    datePublished?: string;
  },
) =>
  ({
    ...a,
    datePublished: a.datePublished ?? PUBLISHED,
    dateModified: a.datePublished ?? PUBLISHED,
    cta: a.cta ?? cta,
    breadcrumb: [
      { name: "Beranda", path: "/" },
      { name: "Insight", path: "/insight" },
      { name: a.h1, path: a.path },
    ],
  }) satisfies ArticleContent;


export const articles: ArticleContent[] = [
  base({
    slug: "aplikasi-custom-vs-software-siap-pakai",
    path: "/insight/aplikasi-custom-vs-software-siap-pakai",
    eyebrow: "INSIGHT",
    h1: "Aplikasi Custom vs Software Siap Pakai",
    title: "Aplikasi Custom vs Software Siap Pakai: Cara Memilih | KERJAKU",
    description:
      "Kapan bisnis sebaiknya berlangganan software siap pakai dan kapan membangun aplikasi custom. Kriteria keputusan, biaya tersembunyi, dan jalur campuran.",
    summary:
      "Kriteria memilih antara berlangganan software siap pakai dan membangun sistem sendiri.",
    answer:
      "Pilih software siap pakai ketika proses Anda umum dan kecepatan pemakaian lebih penting daripada kecocokan. Pilih aplikasi custom ketika alur kerja Anda adalah keunggulan, ketika data harus menyatu dengan sistem lain, atau ketika biaya penyesuaian dan lisensi per pengguna sudah melampaui biaya membangun.",
    intro:
      "Perdebatan ini jarang soal teknologi. Yang menentukan adalah seberapa unik alur kerja Anda dan berapa lama sistem itu akan dipakai.",
    sections: [
      {
        id: "kriteria",
        heading: "Empat pertanyaan yang menentukan",
        blocks: [
          {
            kind: "steps",
            items: [
              {
                title: "Apakah prosesnya umum?",
                body: "Akuntansi, payroll, dan email adalah proses standar. Membangunnya sendiri hampir selalu merugi.",
              },
              {
                title: "Apakah alur kerja jadi keunggulan?",
                body: "Jika cara Anda bekerja adalah alasan pelanggan bertahan, memaksakan alur software siap pakai berarti membuang keunggulan itu.",
              },
              {
                title: "Berapa lama sistem dipakai?",
                body: "Kebutuhan satu musim cukup dengan langganan. Sistem inti yang dipakai bertahun-tahun layak dimiliki.",
              },
              {
                title: "Apakah data perlu menyatu?",
                body: "Jika angka harus dirakit manual dari beberapa aplikasi setiap bulan, itu tanda batas software siap pakai sudah tercapai.",
              },
            ],
          },
        ],
      },
      {
        id: "biaya",
        heading: "Biaya yang sering luput dihitung",
        blocks: [
          {
            kind: "list",
            items: [
              "Lisensi per pengguna yang tumbuh seiring jumlah tim.",
              "Jam kerja untuk menyiasati fitur yang tidak cocok.",
              "Ekspor-impor manual antar aplikasi setiap periode laporan.",
              "Ketergantungan pada satu vendor untuk perubahan kecil.",
              "Pada sisi custom: pemeliharaan, hosting, dan pengembangan lanjutan setelah rilis.",
            ],
          },
        ],
      },
      {
        id: "jalur-tengah",
        heading: "Jalur campuran yang paling sering dipakai",
        blocks: [
          {
            kind: "p",
            text: "Banyak bisnis tetap memakai software siap pakai untuk fungsi standar, lalu membangun sistem custom hanya untuk proses inti yang membedakan mereka. Keduanya dihubungkan lewat integrasi data, bukan dengan menyalin data secara manual.",
          },
        ],
      },
    ],
    related: [
      {
        to: "/jasa-pembuatan-aplikasi-custom",
        label: "Jasa Pembuatan Aplikasi Custom",
        note: "Membangun sistem internal yang mengikuti alur kerja bisnis Anda.",
      },
      {
        to: "/insight/dari-proses-manual-menjadi-sistem-digital",
        label: "Dari Proses Manual Menjadi Sistem Digital",
      },
    ],
  }),

  base({
    slug: "kapan-excel-tidak-cukup-untuk-operasional-bisnis",
    path: "/insight/kapan-excel-tidak-cukup-untuk-operasional-bisnis",
    eyebrow: "INSIGHT",
    h1: "Kapan Excel Tidak Lagi Cukup untuk Operasional Bisnis",
    title: "Kapan Excel Tidak Lagi Cukup untuk Operasional Bisnis | KERJAKU",
    description:
      "Tanda-tanda spreadsheet sudah melewati batasnya sebagai sistem operasional, dan apa yang sebaiknya dipindahkan lebih dulu.",
    summary: "Tanda spreadsheet sudah melewati batas, dan urutan pemindahannya.",
    answer:
      "Excel mulai tidak cukup ketika beberapa orang harus mengubah data yang sama pada waktu bersamaan, ketika tidak ada yang bisa memastikan versi mana yang terbaru, dan ketika keputusan harian menunggu rekap manual. Selama pemakaiannya satu orang dan sekali pakai, Excel masih alat terbaik.",
    intro:
      "Excel bukan masalahnya. Masalah muncul saat spreadsheet naik jabatan dari alat analisis menjadi sistem operasional bersama.",
    sections: [
      {
        id: "tanda",
        heading: "Tanda batasnya sudah terlewati",
        blocks: [
          {
            kind: "list",
            items: [
              "Muncul file bernama final, revisi, dan fix di folder yang sama.",
              "Data dikunci satu orang karena file sedang dibuka.",
              "Tidak ada jejak siapa mengubah angka dan kapan.",
              "Rekap bulanan butuh berhari-hari karena data disatukan manual.",
              "Rumus rusak saat ada yang menyisipkan baris atau kolom.",
              "Semua orang bisa melihat data yang seharusnya terbatas.",
            ],
          },
        ],
      },
      {
        id: "pindah",
        heading: "Yang sebaiknya dipindahkan lebih dulu",
        blocks: [
          {
            kind: "p",
            text: "Mulai dari pencatatan operasional harian yang diisi banyak orang: aktivitas, status pekerjaan, dan master data pelanggan. Bagian inilah yang paling menderita saat dikerjakan bersama di satu file.",
          },
          {
            kind: "p",
            text: "Analisis sekali pakai, simulasi angka, dan perhitungan cepat justru sebaiknya tetap di spreadsheet. Memaksa semuanya masuk sistem hanya menambah beban tanpa manfaat.",
          },
        ],
      },
      {
        id: "hasil",
        heading: "Perubahan yang biasanya terasa",
        blocks: [
          {
            kind: "list",
            items: [
              "Satu sumber data yang disepakati semua divisi.",
              "Riwayat perubahan yang bisa ditelusuri.",
              "Akses dibatasi sesuai peran.",
              "Laporan terbentuk dari data yang sudah tercatat, bukan dari rekap ulang.",
            ],
          },
        ],
      },
    ],
    related: [
      {
        to: "/jasa-dashboard-bisnis",
        label: "Jasa Dashboard Bisnis",
        note: "Membangun visibilitas data operasional di atas data yang rapi.",
      },
      {
        to: "/jasa-pembuatan-aplikasi-custom",
        label: "Jasa Pembuatan Aplikasi Custom",
      },
    ],
  }),

  base({
    slug: "ai-assistant-vs-chatbot",
    path: "/insight/ai-assistant-vs-chatbot",
    eyebrow: "INSIGHT",
    h1: "AI Assistant vs Chatbot: Apa Bedanya untuk Bisnis?",
    title: "AI Assistant vs Chatbot: Apa Bedanya untuk Bisnis? | KERJAKU",
    description:
      "Perbedaan chatbot penjawab pertanyaan dan AI assistant yang terhubung data bisnis, beserta cara memilih yang sesuai kebutuhan.",
    summary: "Perbedaan mendasar dan cara memilih di antara keduanya.",
    answer:
      "Chatbot menjawab pertanyaan dari jawaban yang sudah disiapkan. AI assistant terhubung ke data bisnis, menjawab berdasarkan kondisi terkini, dan dapat menjalankan tindakan seperti mencatat, meringkas, atau mengirim notifikasi. Perbedaannya bukan pada modelnya, melainkan pada akses data dan izin bertindak.",
    intro:
      "Banyak proyek AI mengecewakan karena yang dipasang chatbot, sementara yang dibutuhkan asisten yang mengerti kondisi bisnis.",
    sections: [
      {
        id: "perbandingan",
        heading: "Perbandingan singkat",
        blocks: [
          {
            kind: "cards",
            items: [
              {
                title: "Chatbot",
                body: "Sumber jawaban statis, tidak tahu kondisi data hari ini, tidak bisa melakukan tindakan. Cocok untuk pertanyaan umum berulang di halaman publik.",
              },
              {
                title: "AI assistant",
                body: "Membaca data yang diizinkan, menjawab sesuai kondisi terkini, menyusun ringkasan, dan memicu tindakan yang tercatat. Cocok untuk pekerjaan operasional internal.",
              },
            ],
          },
        ],
      },
      {
        id: "memilih",
        heading: "Cara memilih",
        blocks: [
          {
            kind: "p",
            text: "Tanyakan satu hal: apakah jawaban yang dibutuhkan berubah setiap hari? Jika ya, chatbot tidak akan cukup, karena jawabannya bergantung pada data yang bergerak.",
          },
          {
            kind: "list",
            items: [
              "Pertanyaan seragam dari calon pelanggan: chatbot memadai.",
              "Pertanyaan tentang status pekerjaan atau angka terkini: butuh assistant terhubung data.",
              "Perlu menjalankan tindakan seperti mencatat atau mengingatkan: butuh assistant dengan izin bertindak.",
            ],
          },
        ],
      },
      {
        id: "kendali",
        heading: "Kendali manusia tetap wajib",
        blocks: [
          {
            kind: "p",
            text: "Semakin besar izin bertindak, semakin penting titik peninjauan. Keluaran yang menyangkut pelanggan, harga, atau komitmen kerja sebaiknya berstatus draf sampai disetujui manusia.",
          },
        ],
      },
    ],
    related: [
      {
        to: "/jasa-ai-automation-bisnis",
        label: "Jasa AI Automation Bisnis",
        note: "Membangun asisten yang terhubung ke data operasional Anda.",
      },
      {
        to: "/cara-kerjaku-menggunakan-ai",
        label: "Bagaimana KERJAKU Menggunakan AI",
      },
    ],
  }),

  base({
    slug: "contoh-ai-automation-untuk-bisnis",
    path: "/insight/contoh-ai-automation-untuk-bisnis",
    eyebrow: "INSIGHT",
    h1: "Contoh AI Automation yang Benar-Benar Berguna untuk Bisnis",
    title: "Contoh AI Automation yang Berguna untuk Bisnis | KERJAKU",
    description:
      "Daftar penerapan AI automation yang dampaknya terasa pada pekerjaan harian, beserta syarat agar penerapannya tidak berhenti di tengah jalan.",
    summary: "Penerapan AI automation yang dampaknya nyata di pekerjaan harian.",
    answer:
      "Penerapan AI yang paling cepat terasa adalah yang menyasar pekerjaan berulang dengan aturan jelas: ringkasan aktivitas otomatis, perapian catatan menjadi data terstruktur, pengingat tindak lanjut berbasis kondisi, penyusunan draf dokumen kerja, dan kualifikasi awal prospek.",
    intro:
      "Automation yang bertahan biasanya membosankan. Ia menghapus pekerjaan yang tidak disukai siapa pun, bukan memamerkan kecanggihan.",
    sections: [
      {
        id: "contoh",
        heading: "Lima penerapan yang layak dicoba lebih dulu",
        blocks: [
          {
            kind: "cards",
            items: [
              {
                title: "Ringkasan aktivitas terjadwal",
                body: "Rekap harian atau mingguan dikirim otomatis ke Telegram atau email, disusun dari data aktivitas yang sudah tercatat.",
              },
              {
                title: "Catatan menjadi data",
                body: "Catatan bebas atau pesan suara dari lapangan dirapikan menjadi bidang data yang konsisten, ditinjau sebelum disimpan.",
              },
              {
                title: "Pengingat berbasis kondisi",
                body: "Notifikasi muncul saat pekerjaan melewati batas waktu atau prospek belum ditindaklanjuti, bukan sekadar pengingat berkala.",
              },
              {
                title: "Draf dokumen kerja",
                body: "Brief, rekap, dan ringkasan disusun otomatis sebagai draf, lalu diperiksa manusia sebelum dikirim ke pelanggan.",
              },
              {
                title: "Kualifikasi prospek awal",
                body: "Percakapan awal menggali kebutuhan dan merapikan datanya, sehingga tim penjualan menerima konteks yang lengkap.",
              },
            ],
          },
        ],
      },
      {
        id: "syarat",
        heading: "Syarat agar automation tidak mati di tengah jalan",
        blocks: [
          {
            kind: "list",
            items: [
              "Data sumbernya sudah tercatat rutin. Automation tidak bisa merangkum data yang tidak ada.",
              "Ada penanggung jawab yang meninjau keluarannya.",
              "Alurnya bisa dimatikan tanpa mengganggu sistem utama.",
              "Aktivitas otomatis tercatat agar bisa ditelusuri saat hasilnya meleset.",
            ],
          },
        ],
      },
    ],
    related: [
      {
        to: "/jasa-ai-automation-bisnis",
        label: "Jasa AI Automation Bisnis",
      },
      {
        to: "/insight/ai-assistant-vs-chatbot",
        label: "AI Assistant vs Chatbot",
      },
    ],
  }),

  base({
    slug: "dari-proses-manual-menjadi-sistem-digital",
    path: "/insight/dari-proses-manual-menjadi-sistem-digital",
    eyebrow: "INSIGHT",
    h1: "Dari Proses Manual Menjadi Sistem Digital",
    title: "Dari Proses Manual Menjadi Sistem Digital: Urutannya | KERJAKU",
    description:
      "Urutan digitalisasi proses kerja yang tidak membuat tim menolak sistem baru, dari pemetaan alur sampai penggunaan penuh.",
    summary: "Urutan digitalisasi yang membuat sistem baru benar-benar dipakai.",
    answer:
      "Digitalisasi berhasil ketika dimulai dari satu proses yang paling sering dikeluhkan, bukan dari seluruh perusahaan sekaligus. Petakan alur nyata, pindahkan pencatatannya lebih dulu, baru bangun laporan dan automation di atas data yang sudah terisi.",
    intro:
      "Sistem baru paling sering gagal bukan karena fiturnya kurang, tetapi karena diminta mengubah terlalu banyak kebiasaan sekaligus.",
    sections: [
      {
        id: "urutan",
        heading: "Urutan yang terbukti bertahan",
        blocks: [
          {
            kind: "steps",
            items: [
              {
                title: "Petakan alur yang sebenarnya",
                body: "Catat proses apa adanya, termasuk jalan pintas yang dipakai tim. Alur di atas kertas sering berbeda dengan praktiknya.",
              },
              {
                title: "Pilih satu titik nyeri",
                body: "Ambil proses yang paling sering menimbulkan keluhan dan datanya paling dibutuhkan orang lain.",
              },
              {
                title: "Pindahkan pencatatannya",
                body: "Buat jalur input sesingkat mungkin. Jika mengisi sistem lebih lama daripada menulis di catatan, tim akan kembali ke cara lama.",
              },
              {
                title: "Bangun laporan di atas data",
                body: "Setelah data terisi rutin, laporan dan dashboard bisa dibentuk tanpa rekap manual.",
              },
              {
                title: "Tambahkan automation",
                body: "Pengingat, ringkasan, dan notifikasi ditambahkan terakhir, ketika datanya sudah bisa dipercaya.",
              },
            ],
          },
        ],
      },
      {
        id: "kesalahan",
        heading: "Kesalahan yang sering terjadi",
        blocks: [
          {
            kind: "list",
            items: [
              "Mendigitalkan proses yang rusak tanpa memperbaikinya lebih dulu.",
              "Meminta terlalu banyak bidang isian sejak hari pertama.",
              "Menjalankan sistem baru bersamaan dengan spreadsheet lama tanpa batas waktu.",
              "Tidak menunjuk siapa yang bertanggung jawab atas kualitas data.",
            ],
          },
        ],
      },
    ],
    related: [
      {
        to: "/jasa-pembuatan-aplikasi-custom",
        label: "Jasa Pembuatan Aplikasi Custom",
      },
      {
        to: "/insight/kapan-excel-tidak-cukup-untuk-operasional-bisnis",
        label: "Kapan Excel Tidak Lagi Cukup",
      },
    ],
  }),

  base({
    slug: "bagaimana-kerjaku-membangun-ro-memory",
    path: "/insight/bagaimana-kerjaku-membangun-ro-memory",
    eyebrow: "BUILD STORY",
    h1: "Bagaimana KERJAKU Membangun RO MEMORY",
    title: "Build Story: Bagaimana KERJAKU Membangun RO MEMORY | KERJAKU",
    description:
      "Catatan pembangunan RO MEMORY, sistem aktivitas lapangan: dari masalah pencatatan, keputusan struktur data, sampai laporan berbasis AI.",
    summary: "Catatan keputusan teknis di balik sistem aktivitas lapangan RO MEMORY.",
    answer:
      "RO MEMORY dibangun dari kebutuhan kerja lapangan sendiri. Urutannya: merapikan master data workshop, memperpendek jalur pencatatan kunjungan, baru menambahkan dashboard dan laporan berbasis AI di atas data yang sudah terisi rutin.",
    intro:
      "Produk ini tidak dimulai dari ide aplikasi, melainkan dari kesulitan menjawab satu pertanyaan sederhana: minggu ini sudah ke mana saja, dan apa hasilnya.",
    sections: [
      {
        id: "titik-awal",
        heading: "Titik awal masalahnya",
        blocks: [
          {
            kind: "p",
            text: "Aktivitas lapangan menghasilkan banyak informasi, tetapi informasi itu tersebar di catatan ponsel, pesan chat, dan ingatan. Saat laporan dibutuhkan, semuanya dirakit ulang dari nol dan sebagian sudah hilang.",
          },
        ],
      },
      {
        id: "keputusan",
        heading: "Keputusan yang menentukan arah",
        blocks: [
          {
            kind: "steps",
            items: [
              {
                title: "Master data lebih dulu",
                body: "Workshop dan pelanggan dijadikan entitas tetap, sehingga setiap aktivitas punya tempat menempel dan riwayatnya terbentuk sendiri.",
              },
              {
                title: "Input dipersingkat",
                body: "Pencatatan diterima dalam bentuk apa adanya, termasuk catatan bebas dan pesan Telegram, baru dirapikan sistem menjadi data terstruktur.",
              },
              {
                title: "Keluaran AI berstatus draf",
                body: "Ringkasan kunjungan dan laporan selalu ditinjau sebelum disimpan, agar data historis tetap layak dipakai untuk analisis.",
              },
              {
                title: "Dashboard dibangun terakhir",
                body: "Visualisasi baru ditambahkan setelah data terisi rutin, karena grafik dari data bolong hanya menyesatkan.",
              },
            ],
          },
        ],
      },
      {
        id: "pelajaran",
        heading: "Pelajaran yang terbawa ke proyek klien",
        blocks: [
          {
            kind: "list",
            items: [
              "Kecepatan input menentukan hidup matinya sebuah sistem operasional.",
              "Fitur cerdas tidak menutupi struktur data yang berantakan.",
              "Peninjauan manusia membuat keluaran AI bisa dipertanggungjawabkan.",
              "Membangun bertahap membuat sistem dipakai lebih cepat dan koreksinya lebih murah.",
            ],
          },
        ],
      },
    ],
    related: [
      {
        to: "/products/ro-memory",
        label: "RO MEMORY",
        note: "Rincian kemampuan sistem aktivitas lapangan ini.",
      },
      {
        to: "/jasa-pembuatan-aplikasi-custom",
        label: "Jasa Pembuatan Aplikasi Custom",
      },
    ],
  }),
];

export function getArticle(slug: string) {
  return articles.find((a) => a.slug === slug);
}
