/** Indexable product pages for the products KERJAKU builds and runs itself. */
import type { ProductContent } from "./types";

const cta = {
  title: "Butuh sistem serupa untuk bisnis Anda?",
  body: "Produk ini dibangun dari kebutuhan kerja nyata. Ceritakan alur kerja Anda ke AI Consultant KERJAKU, dan kebutuhannya akan dipetakan menjadi order brief yang bisa ditinjau bersama.",
  button: "Mulai konsultasi",
};

export const roMemory: ProductContent = {
  slug: "ro-memory",
  productName: "RO MEMORY",
  applicationCategory: "BusinessApplication",
  status: "LIVE",
  externalUrl: "https://demo-ro-memory.kerjaku.space",
  path: "/products/ro-memory",
  breadcrumb: [
    { name: "Beranda", path: "/" },
    { name: "Produk", path: "/products" },
    { name: "RO MEMORY", path: "/products/ro-memory" },
  ],
  eyebrow: "FIELD ACTIVITY INTELLIGENCE SYSTEM",
  h1: "RO MEMORY — Sistem Intelijen Aktivitas Lapangan",
  title: "RO MEMORY — Sistem Aktivitas Lapangan & Dashboard AI | KERJAKU",
  description:
    "RO MEMORY mengubah aktivitas lapangan menjadi data terstruktur: database workshop, kunjungan dan PJP, smart notes, dashboard performa, laporan AI, dan asisten Telegram.",
  answer:
    "RO MEMORY adalah sistem yang dipakai untuk mengelola aktivitas lapangan: mencatat kunjungan, menyimpan database workshop dan pelanggan, memantau cakupan area, membuat catatan cepat, serta menghasilkan laporan dan ringkasan performa secara otomatis.",
  intro:
    "RO MEMORY lahir dari pekerjaan lapangan sebagai Relationship Officer di industri material interior, ketika data kunjungan, workshop, dan target tersebar di banyak tempat dan laporan selalu dibuat ulang dari nol.",
  sections: [
    {
      id: "masalah",
      heading: "Masalah yang dipecahkan",
      blocks: [
        {
          kind: "list",
          items: [
            "Progres target dan pencapaian tidak terlihat harian.",
            "Data workshop, pelanggan, dan riwayat kunjungan tersebar di beberapa file.",
            "Pembuatan laporan menyita waktu karena data harus dirakit ulang.",
            "Informasi penting dari lapangan hilang karena tidak langsung dicatat.",
            "Sulit menentukan prioritas lokasi kunjungan berikutnya.",
            "Performa kerja sulit dipresentasikan karena datanya belum tervisualisasi.",
          ],
        },
      ],
    },
    {
      id: "kemampuan",
      heading: "Kemampuan utama",
      blocks: [
        {
          kind: "cards",
          items: [
            {
              title: "Master workshop & pelanggan",
              body: "Database terpusat berisi profil workshop, kontak, lokasi, dan riwayat interaksi, sehingga konteks pelanggan tersedia sebelum kunjungan dilakukan.",
            },
            {
              title: "Kunjungan & PJP",
              body: "Perencanaan jadwal kunjungan, pencatatan hasil kunjungan, status tindak lanjut, dan pemantauan rencana terhadap realisasi.",
            },
            {
              title: "Coverage area",
              body: "Pemantauan cakupan wilayah: lokasi mana yang sudah tersentuh, mana yang lama tidak dikunjungi, dan mana yang relevan didatangi berikutnya.",
            },
            {
              title: "Smart notes",
              body: "Catatan bebas dari lapangan dirapikan menjadi data terstruktur beserta kategorinya, ditinjau lebih dulu sebelum disimpan.",
            },
            {
              title: "Integrasi Telegram",
              body: "Pencatatan cepat dan permintaan informasi lewat percakapan, tanpa perlu membuka aplikasi saat sedang di jalan.",
            },
            {
              title: "Laporan berbasis AI",
              body: "Ringkasan aktivitas harian, mingguan, dan bulanan disusun dari data yang tercatat, siap ditinjau sebelum dibagikan.",
            },
            {
              title: "HPL finder",
              body: "Pencarian kecocokan kode HPL dari foto material untuk membantu identifikasi finishing di lapangan. Masih dalam tahap pengembangan.",
            },
            {
              title: "Dashboard performa",
              body: "Visualisasi target, tren aktivitas, dan hasil kerja dalam satu tampilan yang bisa dibuka dari ponsel.",
            },
          ],
        },
      ],
    },
    {
      id: "engineering",
      heading: "Catatan teknis dari pembangunannya",
      blocks: [
        {
          kind: "p",
          text: "Bagian tersulit bukan tampilan dashboard, melainkan memastikan data lapangan benar-benar terisi. Karena itu jalur input dibuat sesingkat mungkin: catatan bebas, suara, atau pesan Telegram diterima lebih dulu, baru dirapikan sistem menjadi data terstruktur.",
        },
        {
          kind: "p",
          text: "Keluaran AI selalu berstatus draf. Ringkasan kunjungan dan laporan ditinjau pengguna sebelum tersimpan atau dikirim, sehingga data historis tetap bisa dipercaya untuk analisis.",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Apakah RO MEMORY bisa dipakai di industri lain?",
      a: "Pola sistemnya bisa diterapkan pada tim lapangan mana pun yang mengelola kunjungan, pelanggan, dan target, meski istilah dan struktur datanya perlu disesuaikan.",
    },
    {
      q: "Apakah bisa dibuka dari ponsel?",
      a: "Ya. RO MEMORY berbasis web dan dirancang untuk digunakan dari ponsel saat berada di lapangan.",
    },
  ],
  related: [
    {
      to: "/insight/bagaimana-kerjaku-membangun-ro-memory",
      label: "Build Story: Bagaimana KERJAKU Membangun RO MEMORY",
      note: "Urutan keputusan teknis dari catatan lapangan sampai dashboard.",
    },
    {
      to: "/jasa-dashboard-bisnis",
      label: "Jasa Dashboard Bisnis",
      note: "Membangun visibilitas data operasional untuk tim Anda.",
    },
  ],
  cta,
};

export const qresto: ProductContent = {
  slug: "qresto",
  productName: "QResto",
  applicationCategory: "BusinessApplication",
  status: "LIVE",
  externalUrl: "https://qresto.kerjaku.space/",
  path: "/products/qresto",
  breadcrumb: [
    { name: "Beranda", path: "/" },
    { name: "Produk", path: "/products" },
    { name: "QResto", path: "/products/qresto" },
  ],
  eyebrow: "SMART ORDER MANAGEMENT SYSTEM",
  h1: "QResto — Sistem Pemesanan Restoran Berbasis QR Code",
  title: "QResto — Sistem Pemesanan Restoran Digital Berbasis QR | KERJAKU",
  description:
    "QResto menghubungkan pelanggan, kasir, dan dapur dalam satu alur pesanan: menu QR di meja, pemesanan dari ponsel, dan dashboard transaksi terpusat.",
  answer:
    "QResto adalah sistem pemesanan untuk kafe dan restoran. Pelanggan memindai QR di meja, memilih menu, dan mengirim pesanan dari ponsel, sementara kasir dan dapur menerima pesanan dalam satu alur yang sama.",
  intro:
    "Kesalahan pesanan dan antrean di kasir umumnya berasal dari satu hal: pesanan berpindah tangan beberapa kali sebelum sampai ke dapur.",
  sections: [
    {
      id: "alur",
      heading: "Alur masalah dan solusinya",
      blocks: [
        {
          kind: "cards",
          items: [
            {
              title: "Masalah",
              body: "Pesanan dicatat manual, diteruskan lisan ke dapur, lalu direkap lagi untuk laporan penjualan. Setiap perpindahan menambah peluang salah catat.",
            },
            {
              title: "Solusi",
              body: "Pesanan dibuat langsung oleh pelanggan dari ponselnya dan tercatat satu kali. Kasir dan dapur membaca sumber data yang sama, laporan penjualan terbentuk dari transaksi yang sudah ada.",
            },
          ],
        },
      ],
    },
    {
      id: "kemampuan",
      heading: "Kemampuan utama",
      blocks: [
        {
          kind: "list",
          items: [
            "Menu QR Code untuk setiap meja.",
            "Pemesanan digital langsung dari ponsel pelanggan.",
            "Manajemen pesanan untuk kasir dan dapur.",
            "Dashboard transaksi terpusat.",
            "Laporan penjualan yang mengikuti data transaksi.",
            "Cetak struk pesanan.",
          ],
        },
      ],
    },
  ],
  related: [
    {
      to: "/jasa-pembuatan-aplikasi-custom",
      label: "Jasa Pembuatan Aplikasi Custom",
      note: "Sistem operasional yang mengikuti alur kerja bisnis Anda.",
    },
  ],
  cta,
};

export const dompetGue: ProductContent = {
  slug: "dompet-gue",
  productName: "DOMPET GUE",
  applicationCategory: "FinanceApplication",
  status: "LIVE",
  externalUrl: "https://dompetgue.kerjaku.space",
  path: "/products/dompet-gue",
  breadcrumb: [
    { name: "Beranda", path: "/" },
    { name: "Produk", path: "/products" },
    { name: "DOMPET GUE", path: "/products/dompet-gue" },
  ],
  eyebrow: "PERSONAL FINANCE WORKSPACE",
  h1: "DOMPET GUE — Workspace Keuangan Pribadi",
  title: "DOMPET GUE — Aplikasi Pencatatan Keuangan Pribadi | KERJAKU",
  description:
    "DOMPET GUE merapikan aset, pemasukan, pengeluaran, hutang, dan cicilan dalam satu workspace agar kondisi keuangan terlihat jelas dalam sekali lihat.",
  answer:
    "DOMPET GUE adalah aplikasi pencatatan keuangan pribadi yang menyatukan aset, arus kas, hutang, dan cicilan dalam satu tempat, lalu menampilkan ringkasan bulanan dari data yang tercatat.",
  intro:
    "Pencatatan keuangan pribadi biasanya gagal bukan karena malas, tetapi karena datanya tersebar di catatan, aplikasi, dan spreadsheet yang berbeda.",
  sections: [
    {
      id: "kemampuan",
      heading: "Kemampuan utama",
      blocks: [
        {
          kind: "list",
          items: [
            "Pencatatan dan pemantauan aset.",
            "Pemantauan arus kas masuk dan keluar.",
            "Pelacakan hutang dan cicilan beserta jadwalnya.",
            "Ringkasan bulanan kondisi keuangan.",
          ],
        },
      ],
    },
    {
      id: "prinsip",
      heading: "Prinsip perancangan",
      blocks: [
        {
          kind: "p",
          text: "Fokusnya pada kecepatan input. Semakin sedikit langkah untuk mencatat satu transaksi, semakin besar peluang pencatatan bertahan lebih dari satu bulan, dan hanya data yang konsisten yang membuat ringkasan bulanan berguna.",
        },
      ],
    },
  ],
  related: [
    {
      to: "/products/ro-memory",
      label: "RO MEMORY",
      note: "Sistem aktivitas lapangan dengan dashboard dan laporan otomatis.",
    },
  ],
  cta,
};

export const materialEstimator: ProductContent = {
  slug: "material-estimator",
  productName: "MATERIAL ESTIMATOR",
  applicationCategory: "UtilitiesApplication",
  status: "IN DEVELOPMENT",
  path: "/products/material-estimator",
  breadcrumb: [
    { name: "Beranda", path: "/" },
    { name: "Produk", path: "/products" },
    { name: "MATERIAL ESTIMATOR", path: "/products/material-estimator" },
  ],
  eyebrow: "FURNITURE & INTERIOR MATERIAL PLANNING",
  h1: "MATERIAL ESTIMATOR — Sistem Estimasi Material Furniture & Interior",
  title: "MATERIAL ESTIMATOR — Estimasi Material Furniture & Interior | KERJAKU",
  description:
    "MATERIAL ESTIMATOR mengubah ukuran pekerjaan furniture dan interior menjadi estimasi kebutuhan material yang konsisten dan bisa ditelusuri.",
  answer:
    "MATERIAL ESTIMATOR adalah sistem untuk menghitung kebutuhan material furniture dan interior berdasarkan ukuran pekerjaan, agar perencanaan bahan lebih cepat dan konsisten. Produk ini masih dalam tahap pengembangan.",
  intro:
    "Perhitungan material yang dilakukan manual menghasilkan angka berbeda untuk pekerjaan yang sama, tergantung siapa yang menghitung.",
  sections: [
    {
      id: "kemampuan",
      heading: "Ruang lingkup yang sedang dibangun",
      blocks: [
        {
          kind: "list",
          items: [
            "Perhitungan kebutuhan material dari ukuran pekerjaan.",
            "Perencanaan komponen furniture.",
            "Estimasi kuantitas bahan.",
            "Perencanaan kebutuhan material per proyek.",
          ],
        },
        {
          kind: "p",
          text: "Status saat ini: dalam pengembangan. Belum tersedia demo publik.",
        },
      ],
    },
  ],
  related: [
    {
      to: "/jasa-pembuatan-aplikasi-custom",
      label: "Jasa Pembuatan Aplikasi Custom",
      note: "Membangun sistem perhitungan dan operasional sesuai proses Anda.",
    },
  ],
  cta,
};

export const productDocs: ProductContent[] = [roMemory, qresto, dompetGue, materialEstimator];

export function getProduct(slug: string) {
  return productDocs.find((p) => p.slug === slug);
}
