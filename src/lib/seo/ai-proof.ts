/** Flagship proof page: how KERJAKU actually uses AI in its own operations. */
import type { DocPageContent } from "./types";

export const aiProofDoc: DocPageContent = {
  path: "/cara-kerjaku-menggunakan-ai",
  breadcrumb: [
    { name: "Beranda", path: "/" },
    { name: "Bagaimana KERJAKU Menggunakan AI", path: "/cara-kerjaku-menggunakan-ai" },
  ],
  eyebrow: "CARA KAMI BEKERJA",
  h1: "Bagaimana KERJAKU Menggunakan AI dalam Operasional Bisnis",
  title: "Bagaimana KERJAKU Menggunakan AI dalam Operasional Bisnis | KERJAKU",
  description:
    "Alur kerja AI internal KERJAKU: dari konsultasi pelanggan, penggalian kebutuhan, CRM, order brief, proposal, invoice, sampai asisten harian — dengan kendali manusia di setiap keputusan.",
  answer:
    "KERJAKU memakai AI pada rantai kerjanya sendiri: percakapan awal dengan calon pelanggan, penggalian kebutuhan, kualifikasi prospek, pencatatan ke CRM, analisis kebutuhan bisnis, penyusunan order brief, penyiapan proposal dan invoice, serta ringkasan harian untuk operasional. Setiap keluaran yang menyentuh pelanggan ditinjau manusia sebelum dikirim.",
  intro:
    "Halaman ini menjelaskan penerapan yang benar-benar berjalan, bukan gambaran ideal. Rangkaian yang sama menjadi dasar ketika KERJAKU merancang automation untuk klien.",
  sections: [
    {
      id: "alur",
      heading: "Rantai kerja dari percakapan sampai proyek berjalan",
      blocks: [
        {
          kind: "steps",
          items: [
            {
              title: "Percakapan awal",
              body: "Pengunjung berbicara dengan AI Consultant di situs. Percakapan berlangsung satu pertanyaan pada satu waktu, mengikuti konteks jawaban sebelumnya.",
            },
            {
              title: "Penggalian kebutuhan",
              body: "Kebutuhan digali secara terstruktur: jenis bisnis, alur kerja, pengguna sistem, masalah utama, fitur yang diharapkan, dan rentang waktu.",
            },
            {
              title: "Kualifikasi prospek",
              body: "Kelengkapan kebutuhan dan kesiapan calon pelanggan dinilai, lalu prospek diberi tingkat prioritas untuk tindak lanjut.",
            },
            {
              title: "Pencatatan ke CRM",
              body: "Data prospek beserta ringkasan percakapan tersimpan sebagai satu catatan pelanggan, sehingga tidak ada konteks yang hilang saat ditindaklanjuti.",
            },
            {
              title: "Analisis kebutuhan bisnis",
              body: "Masalah yang disampaikan dipetakan ke solusi yang relevan, dipisahkan antara kebutuhan inti dan peluang pengembangan lanjutan.",
            },
            {
              title: "Order brief",
              body: "Hasil analisis disusun menjadi dokumen brief berisi kondisi bisnis, masalah, tujuan, dan rekomendasi ruang lingkup, untuk ditinjau bersama pelanggan.",
            },
            {
              title: "Proposal & invoice",
              body: "Proposal disusun mengikuti brief yang sudah disepakati, dan invoice mengikuti angka pada proposal, sehingga isinya konsisten satu sama lain.",
            },
            {
              title: "Proyek & asisten harian",
              body: "Selama proyek berjalan, ringkasan harian dan pengingat tindak lanjut dikirim otomatis ke kanal internal agar tidak ada pekerjaan yang tertinggal.",
            },
          ],
        },
      ],
    },
    {
      id: "kendali",
      heading: "Kendali manusia",
      blocks: [
        {
          kind: "p",
          text: "AI menyiapkan, manusia memutuskan. Tidak ada dokumen, harga, atau komitmen kerja yang terkirim ke pelanggan tanpa peninjauan.",
        },
        {
          kind: "list",
          items: [
            "Order brief, proposal, dan invoice berstatus draf sampai disetujui.",
            "Angka dan ruang lingkup pekerjaan ditetapkan manusia, bukan oleh AI.",
            "Akses data internal dibatasi sesuai peran pengguna.",
            "Setiap pengiriman dokumen tercatat sehingga bisa ditelusuri.",
          ],
        },
      ],
    },
    {
      id: "mengapa",
      heading: "Kenapa ini penting bagi klien",
      blocks: [
        {
          kind: "p",
          text: "Karena rangkaian ini dipakai sendiri setiap hari, rekomendasi automation untuk klien berangkat dari pengalaman menjalankannya, termasuk mengetahui bagian mana yang justru sebaiknya tidak diotomatiskan.",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Apakah percakapan dengan AI Consultant langsung menjadi penawaran harga?",
      a: "Tidak. Percakapan menghasilkan pemahaman kebutuhan dan order brief. Penawaran harga disusun setelah ruang lingkup ditinjau manusia.",
    },
    {
      q: "Apakah data percakapan disimpan?",
      a: "Ya, sebagai catatan prospek agar tindak lanjut tidak dimulai dari nol. Penanganannya mengikuti kebijakan privasi KERJAKU.",
    },
  ],
  related: [
    {
      to: "/jasa-ai-automation-bisnis",
      label: "Jasa AI Automation Bisnis",
      note: "Menerapkan pola kerja serupa pada operasional bisnis Anda.",
    },
    {
      to: "/insight/ai-assistant-vs-chatbot",
      label: "AI Assistant vs Chatbot",
    },
    {
      to: "/insight/contoh-ai-automation-untuk-bisnis",
      label: "Contoh AI Automation yang Berguna",
    },
  ],
  cta: {
    title: "Ingin alur kerja seperti ini di bisnis Anda?",
    body: "Mulai dari percakapan. AI Consultant akan menggali kebutuhan Anda, dan hasilnya ditinjau langsung oleh tim KERJAKU.",
    button: "Coba AI Consultant",
  },
};
