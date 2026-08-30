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

  base({
    datePublished: PUBLISHED_V2,
    slug: "biaya-pembuatan-aplikasi-custom",
    path: "/insight/biaya-pembuatan-aplikasi-custom",
    eyebrow: "INSIGHT",
    h1: "Berapa Biaya Membuat Aplikasi Custom? Ini Faktor yang Menentukan",
    title: "Berapa Biaya Membuat Aplikasi Custom? Faktor Penentu | KERJAKU",
    description:
      "Faktor yang menentukan biaya pembuatan aplikasi custom: cakupan, peran pengguna, alur kerja, integrasi, dashboard, automasi, AI, keamanan, dan pemeliharaan.",
    summary: "Peta faktor biaya aplikasi custom, bukan daftar harga instan.",
    answer:
      "Tidak ada harga tunggal untuk aplikasi custom karena yang dibayar adalah cakupan kerja, bukan jumlah halaman. Biaya ditentukan oleh berapa banyak peran pengguna, seberapa panjang alur kerja yang diotomasi, jumlah integrasi, kebutuhan dashboard dan automasi, tingkat keamanan, serta pemeliharaan setelah rilis. Angka yang bisa dipertanggungjawabkan baru muncul setelah kebutuhan dipetakan.",
    intro:
      "Pertanyaan pertama yang hampir selalu muncul adalah harga. Masalahnya, dua aplikasi yang terlihat mirip di layar bisa berbeda jauh biayanya karena yang menentukan ada di belakang layar.",
    sections: [
      {
        id: "faktor",
        heading: "Sepuluh faktor yang menggerakkan biaya",
        blocks: [
          {
            kind: "cards",
            items: [
              {
                title: "Cakupan (scope)",
                body: "Jumlah modul yang benar-benar dibangun. Satu modul pencatatan jauh berbeda dengan rantai pesanan sampai penagihan.",
              },
              {
                title: "Peran pengguna",
                body: "Setiap peran menambah aturan hak akses, tampilan, dan pengujian. Sistem satu peran jauh lebih ringan daripada sistem lima peran.",
              },
              {
                title: "Alur kerja",
                body: "Alur dengan persetujuan bertingkat, revisi, dan pembatalan butuh penanganan status yang lebih rumit daripada formulir sederhana.",
              },
              {
                title: "Integrasi",
                body: "Sambungan ke WhatsApp, email, pembayaran, atau sistem lama menambah pekerjaan penyesuaian data dan penanganan kegagalan.",
              },
              {
                title: "Dashboard",
                body: "Angka yang ditampilkan harus dihitung dari data yang konsisten. Biayanya ada di penyiapan data, bukan di grafiknya.",
              },
              {
                title: "Automasi",
                body: "Pengingat, penjadwalan, dan tindakan otomatis perlu aturan yang jelas plus penanganan kasus gagal.",
              },
              {
                title: "AI",
                body: "Fitur berbasis AI menambah biaya perancangan konteks, penanganan keluaran yang tidak pasti, dan mekanisme peninjauan manusia.",
              },
              {
                title: "Keamanan",
                body: "Data pelanggan, dokumen, dan pembayaran menuntut kontrol akses tingkat baris, audit, dan penyimpanan privat.",
              },
              {
                title: "Deployment",
                body: "Domain, lingkungan produksi, backup, dan pemantauan adalah bagian dari pekerjaan, bukan bonus.",
              },
              {
                title: "Pemeliharaan",
                body: "Sistem yang dipakai akan berubah. Anggarkan perbaikan, penyesuaian, dan pengembangan lanjutan setelah rilis.",
              },
            ],
          },
        ],
      },
      {
        id: "pembanding",
        heading: "Cara membaca perbedaan penawaran",
        blocks: [
          {
            kind: "list",
            items: [
              "Bandingkan daftar alur kerja yang dijanjikan, bukan jumlah fitur.",
              "Pastikan peran pengguna dan hak aksesnya disebut eksplisit.",
              "Cek apakah integrasi disebut per sistem, bukan sebagai kata umum.",
              "Tanyakan siapa pemilik kode, data, dan akun hosting setelah rilis.",
              "Pastikan masa dukungan dan cakupan perbaikan tertulis.",
            ],
          },
        ],
      },
      {
        id: "menekan-biaya",
        heading: "Menekan biaya tanpa merusak sistem",
        blocks: [
          {
            kind: "steps",
            items: [
              {
                title: "Mulai dari satu alur yang paling sering dipakai",
                body: "Alur harian yang berulang memberi manfaat paling cepat dan paling mudah diukur.",
              },
              {
                title: "Tunda fitur yang belum punya data",
                body: "Dashboard dan analitik lebih murah dan lebih akurat setelah data terisi rutin.",
              },
              {
                title: "Sederhanakan peran di tahap awal",
                body: "Tambah peran ketika pemakaian sudah stabil, bukan berdasarkan struktur organisasi ideal.",
              },
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Kenapa harga tidak bisa langsung disebut?",
        a: "Karena biaya mengikuti cakupan kerja. Sebelum alur kerja, peran, dan integrasi dipetakan, angka apa pun hanya tebakan yang berpotensi menyesatkan kedua pihak.",
      },
      {
        q: "Apa yang paling sering membengkak?",
        a: "Integrasi ke sistem lama dan perubahan alur kerja di tengah pengerjaan. Keduanya bisa ditekan dengan pemetaan kebutuhan yang jelas di awal.",
      },
      {
        q: "Apakah ada biaya setelah rilis?",
        a: "Ada. Hosting, pemantauan, dan penyesuaian lanjutan perlu dianggarkan agar sistem tetap layak dipakai.",
      },
    ],
    related: [
      {
        to: "/jasa-pembuatan-aplikasi-custom",
        label: "Jasa Pembuatan Aplikasi Custom",
        note: "Cakupan pekerjaan membangun sistem internal.",
      },
      {
        to: "/insight/kapan-bisnis-butuh-aplikasi-custom",
        label: "Kapan Bisnis Membutuhkan Aplikasi Custom",
      },
      {
        to: "/insight/aplikasi-custom-vs-software-siap-pakai",
        label: "Aplikasi Custom vs Software Siap Pakai",
      },
    ],
    cta: {
      title: "Butuh angka yang masuk akal, bukan tebakan?",
      body: "Ceritakan proses kerja dan kebutuhan Anda ke AI Consultant KERJAKU. Hasilnya berupa order brief berisi cakupan yang jelas, sehingga estimasi bisa dibahas berdasarkan pekerjaan nyata.",
      button: "Ceritakan kebutuhan Anda",
    },
  }),

  base({
    datePublished: PUBLISHED_V2,
    slug: "kapan-bisnis-butuh-aplikasi-custom",
    path: "/insight/kapan-bisnis-butuh-aplikasi-custom",
    eyebrow: "INSIGHT",
    h1: "Kapan Bisnis Membutuhkan Aplikasi Custom?",
    title: "Kapan Bisnis Membutuhkan Aplikasi Custom? | KERJAKU",
    description:
      "Tanda konkret bahwa bisnis sudah membutuhkan aplikasi custom, dan kondisi ketika membangun sistem sendiri justru belum perlu.",
    summary: "Tanda kebutuhan sistem custom, dan kapan sebaiknya menunda.",
    answer:
      "Bisnis membutuhkan aplikasi custom ketika alur kerja intinya sudah stabil, dijalankan berulang oleh beberapa orang, dan mulai gagal ditopang alat umum: data tercecer, status pekerjaan tidak jelas, dan laporan harus dirakit manual. Jika prosesnya masih sering berubah dan dijalankan satu orang, membangun sistem sendiri biasanya terlalu dini.",
    intro:
      "Kebutuhan aplikasi custom jarang datang sebagai keinginan teknologi. Biasanya ia muncul sebagai gejala operasional yang berulang setiap minggu.",
    sections: [
      {
        id: "tanda",
        heading: "Tanda yang paling sering muncul",
        blocks: [
          {
            kind: "list",
            items: [
              "Pekerjaan berpindah tangan lewat chat, dan status terbaru hanya diketahui satu orang.",
              "Data yang sama diketik ulang di beberapa tempat.",
              "Laporan bulanan butuh berjam-jam merapikan data sebelum bisa dibaca.",
              "Kesalahan berulang muncul di titik yang sama setiap periode.",
              "Penambahan orang baru justru memperlambat karena tidak ada alur baku.",
              "Keputusan menunggu rekap, bukan menunggu pertimbangan.",
            ],
          },
        ],
      },
      {
        id: "belum-perlu",
        heading: "Kondisi ketika sebaiknya menunda",
        blocks: [
          {
            kind: "cards",
            items: [
              {
                title: "Proses masih berubah tiap bulan",
                body: "Membekukan alur yang belum stabil ke dalam sistem hanya memindahkan kebingungan ke bentuk yang lebih mahal.",
              },
              {
                title: "Volume masih kecil",
                body: "Bila transaksi sedikit dan ditangani satu orang, spreadsheet rapi masih lebih efisien.",
              },
              {
                title: "Masalahnya kebiasaan, bukan alat",
                body: "Jika pencatatan tidak dijalankan disiplin, sistem baru akan kosong dan terlihat gagal.",
              },
              {
                title: "Kebutuhan sepenuhnya standar",
                body: "Akuntansi dan payroll umumnya lebih murah memakai layanan yang sudah ada.",
              },
            ],
          },
        ],
      },
      {
        id: "urutan",
        heading: "Urutan yang aman ketika memutuskan membangun",
        blocks: [
          {
            kind: "steps",
            items: [
              {
                title: "Petakan satu alur inti",
                body: "Tulis langkah nyata dari awal sampai selesai, termasuk siapa yang mengerjakan dan di titik mana sering macet.",
              },
              {
                title: "Tentukan hasil yang ingin berubah",
                body: "Misalnya status pekerjaan bisa dilihat tanpa bertanya, atau rekap bulanan tidak lagi dirakit manual.",
              },
              {
                title: "Bangun bagian yang dipakai harian lebih dulu",
                body: "Pemakaian harian menghasilkan data, dan data itulah yang membuat dashboard serta automasi berguna.",
              },
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Berapa jumlah pengguna minimal agar layak?",
        a: "Tidak ada angka baku. Yang lebih menentukan adalah apakah beberapa orang perlu melihat dan mengubah data yang sama secara bersamaan.",
      },
      {
        q: "Apakah harus langsung sistem besar?",
        a: "Tidak. Sebagian besar kasus lebih aman dimulai dari satu alur inti, lalu diperluas setelah dipakai rutin.",
      },
    ],
    related: [
      {
        to: "/jasa-pembuatan-aplikasi-custom",
        label: "Jasa Pembuatan Aplikasi Custom",
      },
      {
        to: "/insight/kapan-excel-tidak-cukup-untuk-operasional-bisnis",
        label: "Kapan Excel Tidak Lagi Cukup untuk Operasional Bisnis",
      },
      {
        to: "/insight/biaya-pembuatan-aplikasi-custom",
        label: "Berapa Biaya Membuat Aplikasi Custom?",
      },
    ],
    cta: {
      title: "Belum yakin bisnis Anda sudah butuh sistem custom?",
      body: "Ceritakan proses kerja yang sedang berjalan ke AI Consultant KERJAKU. Alurnya akan digali langkah demi langkah agar terlihat bagian mana yang benar-benar perlu dibangun.",
      button: "Mulai konsultasi",
    },
  }),

  base({
    datePublished: PUBLISHED_V2,
    slug: "ai-automation-vs-chatbot",
    path: "/insight/ai-automation-vs-chatbot",
    eyebrow: "INSIGHT",
    h1: "AI Automation vs Chatbot: Mana yang Dibutuhkan Bisnis?",
    title: "AI Automation vs Chatbot: Mana yang Dibutuhkan Bisnis? | KERJAKU",
    description:
      "Perbedaan antara chatbot penjawab pesan dan AI automation yang menjalankan pekerjaan operasional, serta cara memilih sesuai masalah bisnis.",
    summary: "Memilih antara menjawab pesan lebih cepat atau mengurangi kerja manual.",
    answer:
      "Chatbot menangani percakapan; AI automation menangani pekerjaan. Jika masalah Anda adalah pesan masuk yang lambat dibalas, chatbot cukup. Jika masalahnya data diketik ulang, tindak lanjut terlewat, dan dokumen dibuat manual, yang dibutuhkan adalah automasi alur kerja dengan AI di titik yang memang butuh penalaran.",
    intro:
      "Dua istilah ini sering dipakai bergantian, padahal keduanya menyelesaikan masalah yang berbeda dan berbeda pula cara mengukurnya.",
    sections: [
      {
        id: "beda",
        heading: "Perbedaan yang menentukan pilihan",
        blocks: [
          {
            kind: "cards",
            items: [
              {
                title: "Titik kerja",
                body: "Chatbot bekerja di kanal percakapan. AI automation bekerja di dalam alur kerja: data, status, dokumen, dan notifikasi.",
              },
              {
                title: "Hasil akhir",
                body: "Chatbot menghasilkan jawaban. Automasi menghasilkan perubahan nyata seperti data tersimpan atau dokumen terbentuk.",
              },
              {
                title: "Ukuran keberhasilan",
                body: "Chatbot diukur dari kecepatan respons dan tingkat pertanyaan terjawab. Automasi diukur dari berkurangnya pekerjaan manual dan tugas terlewat.",
              },
              {
                title: "Risiko",
                body: "Kesalahan chatbot menghasilkan jawaban keliru. Kesalahan automasi mengubah data, sehingga butuh aturan dan persetujuan manusia.",
              },
            ],
          },
        ],
      },
      {
        id: "contoh",
        heading: "Contoh pemakaian di operasional",
        blocks: [
          {
            kind: "list",
            items: [
              "Chatbot: menjawab pertanyaan berulang tentang layanan dan jam operasional.",
              "AI automation: merapikan hasil percakapan menjadi data kebutuhan yang terstruktur.",
              "AI automation: menyusun draf dokumen dari data yang sudah tersimpan.",
              "AI automation: mengingatkan tindak lanjut berdasarkan status pekerjaan, bukan berdasarkan ingatan.",
            ],
          },
          {
            kind: "p",
            text: "Pada sistem KERJAKU sendiri, percakapan konsultasi tidak berhenti sebagai balasan. Hasilnya dirapikan menjadi kebutuhan terstruktur, tersimpan sebagai lead, lalu dipakai untuk menyusun draf dokumen yang tetap ditinjau manusia sebelum dikirim.",
          },
        ],
      },
      {
        id: "memilih",
        heading: "Cara memilih dalam satu langkah",
        blocks: [
          {
            kind: "p",
            text: "Tulis satu keluhan operasional yang paling sering terjadi. Jika kalimatnya berbunyi \"balasan lambat\", mulailah dari chatbot. Jika kalimatnya berbunyi \"kerjaan dobel\", \"lupa follow up\", atau \"dokumen dibuat manual\", mulailah dari automasi.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Apakah keduanya bisa digabung?",
        a: "Bisa, dan itu pola yang paling berguna: percakapan menangkap kebutuhan, automasi meneruskannya menjadi data dan tindakan.",
      },
      {
        q: "Apakah automasi berarti tanpa manusia?",
        a: "Tidak. Keputusan penting seperti pengiriman dokumen dan perubahan data sensitif sebaiknya tetap melalui persetujuan manusia.",
      },
    ],
    related: [
      {
        to: "/jasa-ai-automation-bisnis",
        label: "Jasa AI Automation Bisnis",
      },
      {
        to: "/insight/ai-assistant-vs-chatbot",
        label: "AI Assistant Bisnis vs Chatbot",
      },
      {
        to: "/insight/contoh-ai-automation-untuk-bisnis",
        label: "Contoh AI Automation untuk Bisnis",
      },
      {
        to: "/cara-kerjaku-menggunakan-ai",
        label: "Cara KERJAKU Menggunakan AI",
        note: "Implementasi AI yang dipakai KERJAKU sendiri.",
      },
    ],
    cta: {
      title: "Coba lihat implementasi AI yang dipakai KERJAKU sendiri",
      body: "Percakapan ini sendiri adalah contohnya. Ceritakan alur kerja Anda ke AI Consultant KERJAKU dan lihat bagaimana kebutuhan diubah menjadi rangkuman terstruktur.",
      button: "Mulai konsultasi",
    },
  }),

  base({
    datePublished: PUBLISHED_V2,
    slug: "website-company-profile-vs-web-app",
    path: "/insight/website-company-profile-vs-web-app",
    eyebrow: "INSIGHT",
    h1: "Website Company Profile vs Web Application: Jangan Salah Pilih",
    title: "Website Company Profile vs Web Application | KERJAKU",
    description:
      "Beda kebutuhan antara website company profile dan web application, cara memilih, serta konsekuensi biaya dan pemeliharaannya.",
    summary: "Memilih antara halaman informasi dan aplikasi berbasis web.",
    answer:
      "Website company profile menjelaskan bisnis kepada pengunjung; web application menjalankan pekerjaan bagi penggunanya. Jika tujuannya membangun kepercayaan dan mendatangkan kontak, cukup company profile atau landing page. Jika pengguna harus login, memasukkan data, dan mengubah status pekerjaan, yang dibutuhkan adalah web application.",
    intro:
      "Salah memilih di titik ini membuat anggaran habis di tempat yang keliru: situs mahal yang tidak menghasilkan kontak, atau aplikasi setengah jadi yang dibangun sebagai website.",
    sections: [
      {
        id: "pembeda",
        heading: "Pembeda utama",
        blocks: [
          {
            kind: "cards",
            items: [
              {
                title: "Tujuan",
                body: "Company profile menjawab \"apakah bisnis ini bisa dipercaya\". Web app menjawab \"bagaimana pekerjaan ini diselesaikan\".",
              },
              {
                title: "Pengguna",
                body: "Company profile ditujukan untuk pengunjung baru. Web app ditujukan untuk pengguna berulang yang punya akun dan peran.",
              },
              {
                title: "Isi",
                body: "Company profile berisi konten dan bukti kerja. Web app berisi data, status, dan aturan alur kerja.",
              },
              {
                title: "Pemeliharaan",
                body: "Company profile diperbarui saat konten berubah. Web app perlu pemantauan, backup, dan penyesuaian berkelanjutan.",
              },
            ],
          },
        ],
      },
      {
        id: "tabel",
        heading: "Panduan cepat memilih",
        blocks: [
          {
            kind: "list",
            items: [
              "Butuh dikenal dan dihubungi calon klien → company profile atau landing page.",
              "Butuh menampilkan portofolio dan layanan secara rapi → company profile.",
              "Butuh pengunjung mengisi formulir lalu tim menindaklanjuti manual → company profile dengan alur kontak yang jelas.",
              "Butuh login, peran pengguna, dan riwayat data → web application.",
              "Butuh pekerjaan berpindah status antar tim → web application.",
              "Butuh laporan otomatis dari data yang diinput sendiri → web application.",
            ],
          },
        ],
      },
      {
        id: "jalur",
        heading: "Jalur bertahap yang umum dipakai",
        blocks: [
          {
            kind: "p",
            text: "Banyak bisnis memulai dengan company profile yang fokus pada kejelasan layanan dan jalur kontak, lalu menambahkan aplikasi internal setelah alur kerjanya stabil. Urutan ini menjaga anggaran tetap terpakai pada kebutuhan yang sudah terbukti.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Apakah company profile bisa berkembang jadi web app?",
        a: "Bisa, selama sejak awal strukturnya rapi. Yang perlu dihindari adalah menambal fitur aplikasi ke situs yang tidak dirancang untuk data dan peran pengguna.",
      },
      {
        q: "Mana yang lebih dulu jika anggaran terbatas?",
        a: "Dahulukan yang menyelesaikan masalah paling mahal. Bila masalahnya tidak dikenal calon klien, situs dulu. Bila masalahnya operasional berantakan, aplikasi dulu.",
      },
    ],
    related: [
      {
        to: "/jasa-pembuatan-website-aplikasi-landing-page",
        label: "Jasa Pembuatan Website & Landing Page",
      },
      {
        to: "/jasa-pembuatan-aplikasi-custom",
        label: "Jasa Pembuatan Aplikasi Custom",
      },
      {
        to: "/insight/kapan-bisnis-butuh-aplikasi-custom",
        label: "Kapan Bisnis Membutuhkan Aplikasi Custom",
      },
    ],
    cta: {
      title: "Masih ragu butuh website atau aplikasi?",
      body: "Ceritakan tujuan dan proses kerja Anda ke AI Consultant KERJAKU agar terlihat mana yang sebenarnya sedang dibutuhkan.",
      button: "Mulai konsultasi",
    },
  }),

  base({
    datePublished: PUBLISHED_V2,
    slug: "ai-dan-business-rules",
    path: "/insight/ai-dan-business-rules",
    eyebrow: "INSIGHT",
    h1: "Kenapa AI Automation Tetap Membutuhkan Business Rules",
    title: "Kenapa AI Automation Tetap Membutuhkan Business Rules | KERJAKU",
    description:
      "Pembagian tugas antara AI dan aturan deterministik: penalaran diserahkan ke AI, sedangkan keamanan, hak akses, dan integritas data dijaga aturan sistem.",
    summary: "Batas kerja AI dan aturan sistem dalam automasi operasional.",
    answer:
      "AI baik untuk menangani hal yang ambigu: bahasa manusia, kebutuhan yang belum tersusun, dan ringkasan. Aturan bisnis deterministik dibutuhkan untuk hal yang tidak boleh salah: keamanan, hak akses, kelayakan, alur kritis, dan integritas data. Automasi yang sehat memakai keduanya, bukan menyerahkan semuanya ke model.",
    intro:
      "Kegagalan automasi berbasis AI jarang terjadi karena modelnya kurang pintar. Lebih sering karena keputusan yang seharusnya pasti ikut diserahkan kepada model.",
    sections: [
      {
        id: "pembagian",
        heading: "Pembagian tugas yang jelas",
        blocks: [
          {
            kind: "cards",
            items: [
              {
                title: "Diserahkan ke AI",
                body: "Memahami kalimat bebas, menggali kebutuhan, merangkum percakapan panjang, dan menyusun draf teks.",
              },
              {
                title: "Dijaga aturan sistem",
                body: "Siapa boleh melihat data apa, kapan sebuah dokumen boleh dikirim, dan status mana yang boleh berpindah ke mana.",
              },
              {
                title: "Diperiksa manusia",
                body: "Keluaran yang berdampak keluar seperti dokumen ke klien dan perubahan data penting.",
              },
              {
                title: "Dicatat sistem",
                body: "Jejak siapa mengubah apa dan kapan, agar kesalahan bisa ditelusuri.",
              },
            ],
          },
        ],
      },
      {
        id: "kenapa",
        heading: "Kenapa aturan tetap diperlukan",
        blocks: [
          {
            kind: "list",
            items: [
              "Keamanan tidak boleh bergantung pada instruksi teks yang bisa diarahkan ulang.",
              "Kelayakan dan hak akses harus punya jawaban yang sama setiap kali diperiksa.",
              "Alur kritis butuh kepastian urutan, bukan interpretasi.",
              "Integritas data menuntut validasi tegas sebelum tersimpan.",
              "Kesalahan harus bisa dijelaskan, dan aturan lebih mudah dijelaskan daripada penalaran model.",
            ],
          },
        ],
      },
      {
        id: "pola",
        heading: "Pola penerapan yang terbukti membantu",
        blocks: [
          {
            kind: "steps",
            items: [
              {
                title: "AI menyusun, sistem memvalidasi",
                body: "Keluaran model diperlakukan sebagai usulan yang harus lolos pemeriksaan struktur dan aturan sebelum dipakai.",
              },
              {
                title: "Aksi berisiko butuh persetujuan",
                body: "Pengiriman dokumen atau perubahan status penting dijalankan setelah dikonfirmasi manusia.",
              },
              {
                title: "Keputusan sensitif dijalankan di sisi server",
                body: "Hak akses dan kelayakan diputuskan oleh sistem, bukan oleh teks yang datang dari percakapan.",
              },
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Bukankah model modern sudah cukup akurat?",
        a: "Akurasi tinggi tetap berarti ada kemungkinan salah. Untuk keputusan yang berdampak pada uang, akses, atau data, kemungkinan salah harus dibatasi aturan tegas.",
      },
      {
        q: "Apakah ini membuat automasi jadi lambat?",
        a: "Tidak, karena aturan hanya diterapkan pada titik kritis. Sisa pekerjaan tetap berjalan otomatis.",
      },
    ],
    related: [
      {
        to: "/jasa-ai-automation-bisnis",
        label: "Jasa AI Automation Bisnis",
      },
      {
        to: "/cara-kerjaku-menggunakan-ai",
        label: "Cara KERJAKU Menggunakan AI",
      },
      {
        to: "/build/ai-business-assistant",
        label: "Build Log: AI Business Assistant",
        note: "Contoh AI yang bekerja dengan konteks operasional dan kontrol manusia.",
      },
    ],
    cta: {
      title: "Ingin automasi yang aman dipakai tim?",
      body: "Diskusikan alur kerja dan titik keputusan kritis Anda ke AI Consultant KERJAKU untuk memetakan bagian mana yang layak diotomasi lebih dulu.",
      button: "Mulai konsultasi",
    },
  }),
];

export function getArticle(slug: string) {
  return articles.find((a) => a.slug === slug);
}
