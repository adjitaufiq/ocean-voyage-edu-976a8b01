/** KERJAKU Insight — commercial SEO batch V3. Answer first, no filler. */
import type { ArticleContent } from "./types";
import { base, PUBLISHED_V3 } from "./article-base";

export const moreArticles: ArticleContent[] = [
  base({
    datePublished: PUBLISHED_V3,
    slug: "berapa-lama-membuat-aplikasi-bisnis",
    path: "/insight/berapa-lama-membuat-aplikasi-bisnis",
    eyebrow: "INSIGHT",
    h1: "Berapa Lama Membuat Aplikasi Bisnis?",
    title: "Berapa Lama Membuat Aplikasi Bisnis? Faktor Timeline | KERJAKU",
    description:
      "Yang menentukan lama pembuatan aplikasi bisnis: kejelasan alur kerja, jumlah peran, integrasi, kesiapan data, dan kecepatan pengambilan keputusan di sisi klien.",
    summary: "Faktor yang benar-benar menentukan panjang timeline pembangunan sistem.",
    answer:
      "Lama pembangunan aplikasi bisnis ditentukan oleh kejelasan alur kerja, jumlah peran pengguna, banyaknya integrasi, kesiapan data lama, dan kecepatan keputusan di sisi klien. Timeline yang realistis baru bisa disusun setelah cakupan disepakati dalam order brief, dan pengiriman bertahap hampir selalu lebih cepat memberi manfaat daripada menunggu satu rilis besar.",
    intro:
      "Pertanyaan 'berapa lama' sering dijawab dengan angka yang terdengar enak, lalu meleset. Yang lebih berguna adalah memahami apa yang membuat sebuah proyek cepat atau lambat.",
    sections: [
      {
        id: "penentu",
        heading: "Lima hal yang menentukan panjang timeline",
        blocks: [
          {
            kind: "cards",
            items: [
              {
                title: "Kejelasan alur kerja",
                body: "Alur yang sudah dipahami tim bisa langsung dipetakan. Alur yang masih diperdebatkan akan memakan waktu di tahap perancangan, bukan di tahap coding.",
              },
              {
                title: "Jumlah peran pengguna",
                body: "Setiap peran menambah aturan akses, tampilan, dan pengujian tersendiri.",
              },
              {
                title: "Integrasi",
                body: "Sambungan ke WhatsApp, email, pembayaran, atau sistem lama menambah pekerjaan penyesuaian data dan penanganan kegagalan.",
              },
              {
                title: "Kesiapan data lama",
                body: "Data yang rapi bisa dipindahkan cepat. Data yang tersebar di banyak file butuh pembersihan sebelum bisa dipakai.",
              },
              {
                title: "Kecepatan keputusan",
                body: "Umpan balik yang menumpuk adalah penyebab keterlambatan paling umum, bukan kesulitan teknis.",
              },
            ],
          },
        ],
      },
      {
        id: "tahapan",
        heading: "Tahapan yang dilalui setiap proyek",
        blocks: [
          {
            kind: "steps",
            items: [
              {
                title: "Pemetaan kebutuhan",
                body: "Alur kerja, peran, dan masalah nyata dirangkum menjadi order brief yang bisa ditinjau bersama.",
              },
              {
                title: "Perancangan struktur",
                body: "Data, status, dan hak akses ditetapkan lebih dulu supaya perubahan di kemudian hari tidak merusak sistem.",
              },
              {
                title: "Pembangunan alur inti",
                body: "Alur harian yang paling sering dipakai dibangun lebih dulu agar manfaatnya cepat terasa.",
              },
              {
                title: "Uji pakai oleh tim",
                body: "Sistem diuji dengan data dan kebiasaan kerja nyata, bukan hanya skenario ideal.",
              },
              {
                title: "Rilis dan penyesuaian",
                body: "Setelah dipakai, selalu ada penyesuaian. Ini bagian normal dari siklus, bukan tanda kegagalan.",
              },
            ],
          },
        ],
      },
      {
        id: "mempercepat",
        heading: "Cara mempercepat tanpa mengorbankan kualitas",
        blocks: [
          {
            kind: "list",
            items: [
              "Tetapkan satu pengambil keputusan dari sisi bisnis.",
              "Mulai dari satu alur kerja utama, bukan seluruh sistem sekaligus.",
              "Siapkan contoh data nyata sejak awal.",
              "Tunda fitur pelengkap ke tahap berikutnya, bukan menghapusnya dari rencana.",
              "Sepakati definisi 'selesai' untuk setiap tahap sebelum mulai.",
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Kenapa vendor tidak langsung memberi angka minggu?",
        a: "Karena angka tanpa cakupan hanya tebakan. Setelah alur kerja dan peran pengguna disepakati, estimasi baru bisa dipertanggungjawabkan.",
      },
      {
        q: "Apakah bisa dikerjakan bertahap?",
        a: "Bisa, dan biasanya lebih baik. Alur inti dirilis lebih dulu, lalu dikembangkan berdasarkan pemakaian nyata.",
      },
    ],
    related: [
      {
        to: "/jasa-pembuatan-aplikasi-custom",
        label: "Jasa Pembuatan Aplikasi Custom",
      },
      {
        to: "/build/workflow-konsultasi-sampai-invoice",
        label: "Build Log: Konsultasi sampai Invoice",
        note: "Contoh alur kerja yang dibangun bertahap sampai jadi satu rantai.",
      },
      {
        to: "/insight/fitur-mvp-aplikasi-bisnis",
        label: "Menentukan Fitur MVP Aplikasi Bisnis",
      },
    ],
  }),

  base({
    datePublished: PUBLISHED_V3,
    slug: "dashboard-vs-sistem-operasional",
    path: "/insight/dashboard-vs-sistem-operasional",
    eyebrow: "INSIGHT",
    h1: "Dashboard vs Sistem Operasional: Mana yang Anda Butuhkan?",
    title: "Dashboard vs Sistem Operasional: Bedanya | KERJAKU",
    description:
      "Dashboard menampilkan angka, sistem operasional menjalankan pekerjaan. Cara menentukan mana yang dibutuhkan lebih dulu agar data yang tampil bisa dipercaya.",
    summary: "Beda fungsi dashboard dan sistem operasional, serta urutan membangunnya.",
    answer:
      "Dashboard menampilkan ringkasan angka, sedangkan sistem operasional adalah tempat pekerjaan benar-benar dicatat dan diproses. Dashboard hanya bisa dipercaya jika datanya lahir dari proses kerja yang tercatat rapi, sehingga pada bisnis yang masih mencatat manual, sistem operasional dibangun lebih dulu dan dashboard mengikuti.",
    intro:
      "Banyak permintaan dimulai dengan 'saya ingin dashboard'. Setelah ditelusuri, yang dibutuhkan sering kali bukan grafiknya, melainkan proses yang menghasilkan angkanya.",
    sections: [
      {
        id: "beda",
        heading: "Perbedaan mendasar",
        blocks: [
          {
            kind: "cards",
            items: [
              {
                title: "Dashboard",
                body: "Bersifat membaca. Menyajikan ringkasan, tren, dan peringatan dari data yang sudah ada.",
              },
              {
                title: "Sistem operasional",
                body: "Bersifat menulis. Tempat pesanan dibuat, status diubah, persetujuan diberikan, dan riwayat tersimpan.",
              },
              {
                title: "Sumber angka",
                body: "Dashboard tidak menciptakan data. Kalau prosesnya masih di chat dan spreadsheet, angkanya ikut tidak konsisten.",
              },
              {
                title: "Nilai bisnis",
                body: "Sistem operasional mengurangi kerja manual. Dashboard mempercepat keputusan. Keduanya berbeda tujuan.",
              },
            ],
          },
        ],
      },
      {
        id: "urutan",
        heading: "Urutan yang masuk akal",
        blocks: [
          {
            kind: "steps",
            items: [
              {
                title: "Pastikan proses tercatat di satu tempat",
                body: "Selama pencatatan tersebar, laporan apa pun harus dirakit manual dan selalu terlambat.",
              },
              {
                title: "Tetapkan definisi angka",
                body: "Apa arti 'pesanan selesai' atau 'lead aktif' harus disepakati sebelum ditampilkan sebagai metrik.",
              },
              {
                title: "Bangun dashboard di atas data itu",
                body: "Setelah sumbernya konsisten, dashboard menjadi cerminan kenyataan, bukan tebakan yang rapi.",
              },
            ],
          },
        ],
      },
      {
        id: "kapan-dashboard-dulu",
        heading: "Kapan dashboard boleh dibangun lebih dulu",
        blocks: [
          {
            kind: "p",
            text: "Jika data operasional sudah tersimpan rapi di sistem yang berjalan, misalnya aplikasi kasir, sistem akuntansi, atau basis data internal, maka dashboard bisa dibangun sebagai lapisan pembaca tanpa mengubah sistem yang ada.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Apakah dashboard bisa langsung menarik data dari spreadsheet?",
        a: "Bisa, tetapi hasilnya hanya sebaik kedisiplinan pengisian spreadsheet itu. Kolom yang berubah-ubah akan membuat angka ikut bergeser.",
      },
      {
        q: "Apakah keduanya bisa dibangun sekaligus?",
        a: "Bisa, selama struktur data ditetapkan lebih dulu. Yang tidak disarankan adalah membangun dashboard tanpa sumber data yang stabil.",
      },
    ],
    related: [
      {
        to: "/jasa-dashboard-bisnis",
        label: "Jasa Dashboard Bisnis",
      },
      {
        to: "/insight/kapan-excel-tidak-cukup-untuk-operasional-bisnis",
        label: "Kapan Excel Tidak Cukup untuk Operasional Bisnis",
      },
    ],
  }),

  base({
    datePublished: PUBLISHED_V3,
    slug: "cara-digitalisasi-workflow-bisnis",
    path: "/insight/cara-digitalisasi-workflow-bisnis",
    eyebrow: "INSIGHT",
    h1: "Cara Digitalisasi Workflow Bisnis Tanpa Mengacaukan Operasional",
    title: "Cara Digitalisasi Workflow Bisnis Secara Bertahap | KERJAKU",
    description:
      "Langkah digitalisasi workflow bisnis: memetakan alur nyata, memilih satu alur prioritas, menetapkan status dan pemilik, lalu memindahkan tim secara bertahap.",
    summary: "Urutan praktis memindahkan alur kerja manual ke sistem digital.",
    answer:
      "Digitalisasi workflow paling aman dilakukan bertahap: petakan alur yang benar-benar berjalan, pilih satu alur dengan frekuensi tinggi, tetapkan status dan pemilik setiap langkah, bangun versi digitalnya, jalankan berdampingan dengan cara lama selama masa transisi, lalu perluas ke alur berikutnya setelah tim terbiasa.",
    intro:
      "Kegagalan digitalisasi jarang disebabkan teknologi. Penyebab paling umum adalah memindahkan semuanya sekaligus, lalu tim kembali ke cara lama saat ada satu hambatan.",
    sections: [
      {
        id: "langkah",
        heading: "Enam langkah yang berulang di setiap proyek",
        blocks: [
          {
            kind: "steps",
            items: [
              {
                title: "Petakan alur yang nyata",
                body: "Catat cara kerja yang benar-benar dipakai, termasuk jalan pintas tidak resmi. Alur di kertas kebijakan sering berbeda dari kenyataan.",
              },
              {
                title: "Pilih satu alur prioritas",
                body: "Ambil alur paling sering diulang dan paling sering menimbulkan kesalahan.",
              },
              {
                title: "Tetapkan status dan pemilik",
                body: "Setiap langkah harus punya nama status yang jelas dan satu pihak yang bertanggung jawab.",
              },
              {
                title: "Bangun versi digitalnya",
                body: "Fokus pada input, perpindahan status, dan riwayat. Laporan menyusul setelah data mengalir.",
              },
              {
                title: "Jalankan berdampingan",
                body: "Selama masa transisi, cara lama tetap ada sebagai jaring pengaman sampai tim yakin.",
              },
              {
                title: "Perluas ke alur berikutnya",
                body: "Setelah satu alur stabil, alur berikutnya jauh lebih cepat karena strukturnya sudah ada.",
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
              "Menyalin formulir kertas apa adanya tanpa menyederhanakan langkah.",
              "Memaksa semua tim pindah pada hari yang sama.",
              "Tidak menyiapkan cara menangani kasus pengecualian.",
              "Melewatkan pelatihan singkat sehingga sistem dipakai setengah-setengah.",
              "Mengukur keberhasilan dari jumlah fitur, bukan dari berkurangnya kerja manual.",
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Berapa lama masa transisi yang wajar?",
        a: "Cukup sampai satu siklus kerja penuh berjalan tanpa perlu kembali ke cara lama, misalnya satu periode penagihan atau satu bulan operasional.",
      },
      {
        q: "Apakah semua proses perlu didigitalkan?",
        a: "Tidak. Proses yang jarang terjadi dan tidak berisiko sering lebih murah dibiarkan manual.",
      },
    ],
    related: [
      {
        to: "/insight/dari-proses-manual-menjadi-sistem-digital",
        label: "Dari Proses Manual Menjadi Sistem Digital",
      },
      {
        to: "/jasa-pembuatan-aplikasi-custom",
        label: "Jasa Pembuatan Aplikasi Custom",
      },
    ],
  }),

  base({
    datePublished: PUBLISHED_V3,
    slug: "fitur-mvp-aplikasi-bisnis",
    path: "/insight/fitur-mvp-aplikasi-bisnis",
    eyebrow: "INSIGHT",
    h1: "Menentukan Fitur MVP Aplikasi Bisnis",
    title: "Cara Menentukan Fitur MVP Aplikasi Bisnis | KERJAKU",
    description:
      "Cara memilih fitur tahap pertama aplikasi bisnis: fokus pada satu alur inti, peran pengguna minimum, dan fitur yang menghilangkan kerja manual paling besar.",
    summary: "Kriteria memilih fitur tahap pertama agar sistem cepat berguna.",
    answer:
      "Fitur MVP aplikasi bisnis adalah kumpulan fitur minimum yang membuat satu alur kerja utama bisa dijalankan penuh dari awal sampai selesai tanpa kembali ke cara manual. Fitur yang hanya mempercantik tampilan, laporan tambahan, dan integrasi opsional ditunda ke tahap berikutnya.",
    intro:
      "MVP sering disalahartikan sebagai versi murah. Sebenarnya MVP adalah versi paling fokus: sedikit fitur, tetapi satu alur kerja benar-benar tuntas.",
    sections: [
      {
        id: "kriteria",
        heading: "Kriteria memilih fitur tahap pertama",
        blocks: [
          {
            kind: "cards",
            items: [
              {
                title: "Menuntaskan satu alur",
                body: "Pengguna harus bisa menyelesaikan pekerjaan dari awal sampai akhir tanpa berpindah ke WhatsApp atau spreadsheet.",
              },
              {
                title: "Frekuensi tinggi",
                body: "Fitur yang dipakai setiap hari memberi dampak lebih besar daripada fitur bulanan.",
              },
              {
                title: "Menghilangkan kerja manual",
                body: "Prioritaskan yang memangkas pengetikan ulang, penyalinan data, dan pencarian dokumen.",
              },
              {
                title: "Menjadi fondasi",
                body: "Struktur data dan status yang dibuat sekarang akan dipakai fitur berikutnya, jadi harus dirancang benar sejak awal.",
              },
            ],
          },
        ],
      },
      {
        id: "tunda",
        heading: "Yang aman ditunda",
        blocks: [
          {
            kind: "list",
            items: [
              "Laporan lanjutan yang belum jelas siapa pembacanya.",
              "Pengaturan yang sangat fleksibel padahal hanya satu konfigurasi yang dipakai.",
              "Integrasi ke sistem yang belum tentu dipertahankan.",
              "Aplikasi mobile terpisah jika versi web sudah bisa dipakai di ponsel.",
              "Fitur AI yang belum punya data untuk dipelajari.",
            ],
          },
        ],
      },
      {
        id: "ukuran",
        heading: "Cara mengukur keberhasilan MVP",
        blocks: [
          {
            kind: "p",
            text: "Ukurannya bukan jumlah fitur yang selesai, melainkan berkurangnya pekerjaan manual dan kesalahan pada alur yang dipilih. Jika tim masih mencatat ganda setelah rilis, cakupan MVP-nya terlalu sempit atau alurnya belum tuntas.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Apakah MVP berarti kualitasnya lebih rendah?",
        a: "Tidak. Cakupannya lebih kecil, tetapi bagian yang dibangun tetap harus stabil, aman, dan siap dipakai harian.",
      },
    ],
    related: [
      {
        to: "/insight/berapa-lama-membuat-aplikasi-bisnis",
        label: "Berapa Lama Membuat Aplikasi Bisnis?",
      },
      {
        to: "/jasa-pembuatan-aplikasi-custom",
        label: "Jasa Pembuatan Aplikasi Custom",
      },
    ],
  }),

  base({
    datePublished: PUBLISHED_V3,
    slug: "ai-business-assistant",
    path: "/insight/ai-business-assistant",
    eyebrow: "INSIGHT",
    h1: "AI Business Assistant: Apa yang Benar-Benar Bisa Dikerjakan",
    title: "AI Business Assistant untuk Operasional Bisnis | KERJAKU",
    description:
      "Apa itu AI business assistant, pekerjaan yang layak diserahkan kepadanya, batas yang harus dijaga, dan syarat data agar hasilnya bisa dipercaya.",
    summary: "Kapabilitas nyata AI business assistant dan batas pemakaiannya.",
    answer:
      "AI business assistant adalah asisten yang terhubung ke data operasional bisnis sehingga bisa merangkum kondisi harian, mengingatkan pekerjaan yang tertunda, dan menyiapkan draf dokumen. Ia berguna untuk merangkum dan menyiapkan, bukan untuk mengambil keputusan final soal uang, akses, atau data pelanggan.",
    intro:
      "Perbedaan asisten yang berguna dan yang sekadar ramai ada pada satu hal: apakah ia punya akses ke konteks pekerjaan yang sedang berjalan.",
    sections: [
      {
        id: "pekerjaan",
        heading: "Pekerjaan yang layak diserahkan",
        blocks: [
          {
            kind: "cards",
            items: [
              {
                title: "Ringkasan harian",
                body: "Merangkum lead baru, pekerjaan tertunda, dan hal yang perlu ditindaklanjuti hari ini.",
              },
              {
                title: "Penyiapan draf",
                body: "Menyusun draf brief, proposal, atau balasan yang tetap ditinjau manusia sebelum dikirim.",
              },
              {
                title: "Pencarian konteks",
                body: "Menjawab pertanyaan tentang riwayat pekerjaan tanpa harus membuka banyak layar.",
              },
              {
                title: "Pengingat berbasis aturan",
                body: "Menandai hal yang melewati batas waktu atau menyimpang dari standar.",
              },
            ],
          },
        ],
      },
      {
        id: "batas",
        heading: "Batas yang harus dijaga",
        blocks: [
          {
            kind: "list",
            items: [
              "Keputusan yang menyangkut uang, akses, atau data pelanggan tetap butuh persetujuan manusia.",
              "Harga final dan komitmen kontrak tidak ditetapkan oleh asisten.",
              "Setiap tindakan otomatis perlu jejak audit yang bisa diperiksa.",
              "Jawaban tanpa sumber data internal harus ditandai sebagai perkiraan.",
            ],
          },
        ],
      },
      {
        id: "syarat",
        heading: "Syarat agar hasilnya bisa dipercaya",
        blocks: [
          {
            kind: "p",
            text: "Asisten hanya sebaik data yang bisa diaksesnya. Kalau pekerjaan masih tersebar di chat dan spreadsheet pribadi, ringkasan yang dihasilkan akan terdengar meyakinkan tetapi tidak akurat. Sistem operasional yang tercatat rapi adalah prasyaratnya.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Apa bedanya dengan chatbot layanan pelanggan?",
        a: "Chatbot melayani percakapan masuk. Asisten bisnis bekerja di sisi internal dengan konteks operasional dan hasil kerja yang bisa ditindaklanjuti tim.",
      },
      {
        q: "Apakah data bisnis aman?",
        a: "Aksesnya dibatasi sesuai peran dan hanya pada data yang diperlukan, dengan jejak aktivitas yang tersimpan.",
      },
    ],
    related: [
      {
        to: "/build/ai-business-assistant",
        label: "Build Log: AI Business Assistant",
        note: "Rincian implementasi asisten internal KERJAKU.",
      },
      {
        to: "/jasa-ai-automation-bisnis",
        label: "Jasa AI Automation Bisnis",
      },
      {
        to: "/insight/human-in-the-loop-ai-bisnis",
        label: "Human-in-the-Loop dalam AI Bisnis",
      },
    ],
    cta: {
      title: "Ingin asisten yang paham konteks bisnis Anda?",
      body: "Ceritakan pekerjaan harian yang paling menyita waktu ke AI Consultant KERJAKU untuk memetakan bagian mana yang layak dibantu asisten.",
      button: "Mulai konsultasi",
    },
  }),

  base({
    datePublished: PUBLISHED_V3,
    slug: "human-in-the-loop-ai-bisnis",
    path: "/insight/human-in-the-loop-ai-bisnis",
    eyebrow: "INSIGHT",
    h1: "Human-in-the-Loop dalam AI Bisnis",
    title: "Human-in-the-Loop: AI yang Aman Dipakai Bisnis | KERJAKU",
    description:
      "Prinsip human-in-the-loop pada automasi AI: titik mana yang wajib ditinjau manusia, cara menyusun kontrolnya, dan dampaknya terhadap risiko operasional.",
    summary: "Cara menempatkan kontrol manusia pada automasi AI tanpa memperlambat kerja.",
    answer:
      "Human-in-the-loop berarti AI menyiapkan pekerjaan, tetapi manusia menyetujui titik-titik yang berdampak besar. Titik yang wajib ditinjau adalah yang menyangkut uang, komitmen ke pihak luar, perubahan hak akses, dan penghapusan data. Sisa alurnya tetap berjalan otomatis sehingga kecepatan tidak hilang.",
    intro:
      "AI tidak perlu dipercaya seluruhnya atau ditolak seluruhnya. Yang dibutuhkan adalah menentukan di mana persetujuan manusia benar-benar bernilai.",
    sections: [
      {
        id: "titik",
        heading: "Titik yang wajib ditinjau manusia",
        blocks: [
          {
            kind: "list",
            items: [
              "Nilai harga, diskon, dan dokumen penagihan.",
              "Pesan yang dikirim atas nama bisnis ke pelanggan.",
              "Perubahan hak akses pengguna.",
              "Penghapusan atau penggabungan data.",
              "Keputusan yang menimbulkan kewajiban hukum atau kontrak.",
            ],
          },
        ],
      },
      {
        id: "rancangan",
        heading: "Cara merancang kontrolnya",
        blocks: [
          {
            kind: "steps",
            items: [
              {
                title: "Pisahkan menyiapkan dan mengirim",
                body: "AI boleh menyusun draf, tetapi tombol kirim tetap dipegang manusia.",
              },
              {
                title: "Tampilkan dasar keputusan",
                body: "Peninjau perlu melihat data yang dipakai, bukan hanya hasil akhirnya.",
              },
              {
                title: "Simpan jejak",
                body: "Catat siapa menyetujui apa dan kapan, agar bisa ditelusuri saat ada masalah.",
              },
              {
                title: "Batasi dengan aturan tegas",
                body: "Aturan bisnis yang pasti, seperti batas diskon, ditegakkan oleh sistem, bukan diserahkan ke pertimbangan model.",
              },
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Bukankah ini menghilangkan manfaat automasi?",
        a: "Tidak, karena peninjauan hanya diterapkan pada sedikit titik kritis. Pekerjaan penyiapan yang paling memakan waktu tetap otomatis.",
      },
      {
        q: "Kapan kontrol bisa dilonggarkan?",
        a: "Setelah ada riwayat pemakaian yang cukup dan kasus salahnya terbukti kecil serta berdampak rendah.",
      },
    ],
    related: [
      {
        to: "/insight/ai-dan-business-rules",
        label: "AI dan Business Rules",
      },
      {
        to: "/cara-kerjaku-menggunakan-ai",
        label: "Cara KERJAKU Menggunakan AI",
      },
      {
        to: "/jasa-ai-automation-bisnis",
        label: "Jasa AI Automation Bisnis",
      },
    ],
  }),

  base({
    datePublished: PUBLISHED_V3,
    slug: "biaya-pembuatan-website-profesional",
    path: "/insight/biaya-pembuatan-website-profesional",
    eyebrow: "INSIGHT",
    h1: "Biaya Pembuatan Website Profesional: Apa yang Anda Bayar",
    title: "Biaya Pembuatan Website Profesional: Faktornya | KERJAKU",
    description:
      "Komponen yang menentukan biaya pembuatan website profesional: jumlah halaman unik, konten, desain khusus, integrasi, SEO teknis, dan pemeliharaan setelah rilis.",
    summary: "Rincian komponen biaya website profesional dan cara membandingkan penawaran.",
    answer:
      "Biaya website profesional ditentukan oleh jumlah halaman unik, kesiapan konten, tingkat kekhususan desain, integrasi seperti formulir dan WhatsApp, kebutuhan SEO teknis, serta pemeliharaan setelah rilis. Website satu halaman dengan konten siap berbeda jauh dari situs multi-layanan dengan konten yang harus disusun dari nol.",
    intro:
      "Dua penawaran website bisa berbeda berkali lipat meski sama-sama menjanjikan 'website profesional'. Perbedaannya hampir selalu ada pada komponen yang tidak disebut.",
    sections: [
      {
        id: "komponen",
        heading: "Komponen yang menentukan biaya",
        blocks: [
          {
            kind: "cards",
            items: [
              {
                title: "Jumlah halaman unik",
                body: "Halaman dengan struktur berbeda menambah pekerjaan, sedangkan halaman berulang dengan pola sama jauh lebih ringan.",
              },
              {
                title: "Kesiapan konten",
                body: "Teks, foto, dan data layanan yang belum ada harus disusun lebih dulu, dan itu bagian dari pekerjaan.",
              },
              {
                title: "Desain khusus",
                body: "Tampilan yang dirancang dari nol berbeda dengan penyesuaian template.",
              },
              {
                title: "Integrasi",
                body: "Formulir yang masuk ke email atau WhatsApp, kalender, pembayaran, dan pelacakan analitik.",
              },
              {
                title: "SEO teknis",
                body: "Struktur judul, metadata, data terstruktur, sitemap, dan kecepatan muat.",
              },
              {
                title: "Pemeliharaan",
                body: "Domain, hosting, pembaruan konten, dan pemantauan setelah rilis.",
              },
            ],
          },
        ],
      },
      {
        id: "membandingkan",
        heading: "Cara membandingkan penawaran dengan adil",
        blocks: [
          {
            kind: "list",
            items: [
              "Minta daftar halaman, bukan hanya jumlah halaman.",
              "Pastikan siapa yang menyiapkan teks dan foto.",
              "Cek apakah domain dan hosting atas nama Anda.",
              "Tanyakan cakupan revisi dan masa dukungan.",
              "Pastikan Anda bisa memperbarui konten tanpa bergantung penuh pada vendor.",
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Apakah website murah selalu buruk?",
        a: "Tidak selalu, tetapi cakupannya biasanya sempit. Masalah muncul ketika kebutuhan sebenarnya lebih besar daripada yang tercakup.",
      },
      {
        q: "Kenapa biaya pemeliharaan tetap ada?",
        a: "Domain, hosting, keamanan, dan pembaruan konten berjalan terus selama situs dipakai.",
      },
    ],
    related: [
      {
        to: "/jasa-pembuatan-website",
        label: "Jasa Pembuatan Website",
      },
      {
        to: "/insight/website-company-profile-vs-web-app",
        label: "Website Company Profile vs Web App",
      },
      {
        to: "/insight/ciri-website-bisnis-profesional",
        label: "Ciri Website Bisnis yang Profesional",
      },
    ],
  }),

  base({
    datePublished: PUBLISHED_V3,
    slug: "ciri-website-bisnis-profesional",
    path: "/insight/ciri-website-bisnis-profesional",
    eyebrow: "INSIGHT",
    h1: "Ciri Website Bisnis yang Profesional",
    title: "Ciri Website Bisnis Profesional: 8 Standar | KERJAKU",
    description:
      "Standar yang membedakan website bisnis profesional: kejelasan pesan, struktur halaman, kecepatan, tampilan mobile, jalur kontak, kredibilitas, SEO teknis, dan pemeliharaan.",
    summary: "Delapan standar praktis untuk menilai kualitas website bisnis.",
    answer:
      "Website bisnis profesional dikenali dari pesan yang langsung jelas dalam beberapa detik, struktur halaman yang rapi, waktu muat cepat, tampilan mobile yang nyaman, jalur kontak yang mudah, elemen kredibilitas yang benar, SEO teknis yang lengkap, dan pemeliharaan yang berjalan. Tampilan indah tanpa hal-hal ini belum cukup.",
    intro:
      "Profesional di sini bukan soal selera desain, melainkan soal apakah pengunjung cepat paham, cepat percaya, dan mudah menghubungi.",
    sections: [
      {
        id: "standar",
        heading: "Delapan standar yang bisa diperiksa",
        blocks: [
          {
            kind: "cards",
            items: [
              {
                title: "Pesan langsung jelas",
                body: "Dalam beberapa detik pengunjung tahu apa yang Anda kerjakan dan untuk siapa.",
              },
              {
                title: "Struktur halaman rapi",
                body: "Satu judul utama per halaman, subjudul yang berurutan, dan navigasi yang konsisten.",
              },
              {
                title: "Cepat dimuat",
                body: "Gambar dioptimalkan dan halaman tidak menunggu skrip yang tidak perlu.",
              },
              {
                title: "Nyaman di mobile",
                body: "Teks terbaca tanpa memperbesar dan tombol cukup besar untuk disentuh.",
              },
              {
                title: "Jalur kontak jelas",
                body: "Formulir atau WhatsApp mudah ditemukan di setiap tahap halaman.",
              },
              {
                title: "Kredibilitas nyata",
                body: "Identitas bisnis, lokasi, dan cara menghubungi ditulis benar, tanpa klaim yang tidak bisa dibuktikan.",
              },
              {
                title: "SEO teknis lengkap",
                body: "Metadata unik, data terstruktur, sitemap, dan URL yang stabil.",
              },
              {
                title: "Dipelihara",
                body: "Konten diperbarui dan tautan rusak diperbaiki, bukan dibiarkan basi.",
              },
            ],
          },
        ],
      },
      {
        id: "tanda",
        heading: "Tanda website perlu diperbaiki",
        blocks: [
          {
            kind: "list",
            items: [
              "Pengunjung sering bertanya hal yang sebenarnya sudah ada di situs.",
              "Formulir masuk tetapi tidak pernah ditindaklanjuti karena tidak ada pemberitahuan.",
              "Halaman berbeda memakai judul dan deskripsi yang sama.",
              "Situs lambat dibuka dari jaringan seluler.",
              "Informasi layanan sudah tidak sesuai dengan yang dikerjakan sekarang.",
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Apakah perlu blog?",
        a: "Perlu jika calon pelanggan mencari penjelasan sebelum membeli. Jika tidak, lebih baik fokus memperjelas halaman layanan.",
      },
    ],
    related: [
      {
        to: "/jasa-pembuatan-website",
        label: "Jasa Pembuatan Website",
      },
      {
        to: "/insight/biaya-pembuatan-website-profesional",
        label: "Biaya Pembuatan Website Profesional",
      },
    ],
  }),

  base({
    datePublished: PUBLISHED_V3,
    slug: "website-untuk-interior-design",
    path: "/insight/website-untuk-interior-design",
    eyebrow: "INSIGHT",
    h1: "Website untuk Bisnis Interior Design",
    title: "Website untuk Bisnis Interior Design: Struktur | KERJAKU",
    description:
      "Struktur website interior design yang membantu calon klien menilai gaya, memahami cakupan kerja, dan menghubungi studio dengan informasi proyek yang cukup.",
    summary: "Struktur dan konten website yang cocok untuk studio interior design.",
    answer:
      "Website interior design bekerja paling baik ketika portofolio disusun per proyek dengan konteks, bukan sekadar galeri foto. Struktur yang efektif mencakup halaman proyek dengan cakupan kerja, halaman layanan yang menjelaskan tahapan, halaman tentang studio, dan formulir kontak yang menanyakan tipe ruang, luas, lokasi, serta rentang anggaran.",
    intro:
      "Calon klien interior menilai dua hal: apakah gaya Anda cocok, dan apakah proses kerjanya jelas. Website yang hanya memajang foto menjawab setengahnya saja.",
    sections: [
      {
        id: "struktur",
        heading: "Struktur halaman yang disarankan",
        blocks: [
          {
            kind: "steps",
            items: [
              {
                title: "Beranda",
                body: "Menyatakan jenis proyek yang dikerjakan, wilayah layanan, dan gaya yang menjadi kekuatan studio.",
              },
              {
                title: "Portofolio per proyek",
                body: "Setiap proyek punya halaman sendiri dengan tipe ruang, luas, cakupan kerja, dan hasil akhir.",
              },
              {
                title: "Layanan dan tahapan",
                body: "Menjelaskan tahap konsultasi, konsep, gambar kerja, dan pengawasan agar ekspektasi terbentuk sejak awal.",
              },
              {
                title: "Tentang studio",
                body: "Siapa yang mengerjakan, pendekatan desain, dan cara berkomunikasi selama proyek.",
              },
              {
                title: "Kontak dengan formulir terarah",
                body: "Menanyakan tipe ruang, luas, lokasi, target waktu, dan rentang anggaran agar percakapan pertama sudah berisi.",
              },
            ],
          },
        ],
      },
      {
        id: "teknis",
        heading: "Hal teknis yang penting untuk situs berbasis foto",
        blocks: [
          {
            kind: "list",
            items: [
              "Gambar dikompres dan dimuat bertahap agar situs tetap cepat di jaringan seluler.",
              "Setiap gambar diberi teks alternatif yang menjelaskan ruang dan materialnya.",
              "Halaman proyek punya judul dan deskripsi unik agar bisa ditemukan lewat pencarian.",
              "Tata letak diuji pada layar ponsel karena mayoritas kunjungan datang dari sana.",
              "Data terstruktur bisnis lokal dipasang jika studio melayani wilayah tertentu.",
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Apakah perlu menampilkan harga?",
        a: "Tidak wajib. Menyebut rentang cakupan kerja dan meminta rentang anggaran di formulir biasanya lebih berguna daripada daftar harga tetap.",
      },
      {
        q: "Berapa banyak proyek yang perlu ditampilkan?",
        a: "Lebih baik sedikit proyek dengan penjelasan lengkap daripada banyak foto tanpa konteks.",
      },
    ],
    related: [
      {
        to: "/jasa-pembuatan-website",
        label: "Jasa Pembuatan Website",
      },
      {
        to: "/insight/ciri-website-bisnis-profesional",
        label: "Ciri Website Bisnis yang Profesional",
      },
    ],
  }),
];
