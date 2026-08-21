# Perbaikan Chatbot Gagal Saat Nomor WhatsApp Pertama

## Diagnosis terkonfirmasi

- Pada alur publik, tool `qualify_conversation` menunggu seluruh `qualifyConversation(...)` selesai sebelum stream AI dapat dilanjutkan.
- Saat lead baru dibuat, `qualifyConversation(...)` juga menunggu pengiriman email dan Telegram melalui `notifyLeadFromCrm(...)`. Efek samping eksternal ini hanya dijalankan untuk lead baru.
- Data produksi menunjukkan lead dan nomor WhatsApp sudah tersimpan pada percobaan pertama. Ketika nomor dikirim ulang, percakapan memakai lead yang sama sehingga cabang notifikasi lead baru dilewati dan Order Brief berhasil tampil. Ini sesuai persis dengan pola bug pada kedua foto.
- UI saat ini mengubah semua kegagalan stream menjadi pesan umum “Koneksi AI bermasalah”, sehingga kegagalan proses lanjutan terlihat seperti koneksi model gagal.
- Gateway 5-key ikut berada dalam jalur tool dan kelanjutan stream, tetapi pengujian saat ini baru mencakup rotasi pool; belum ada regression test untuk satu request yang memanggil tool, menyimpan lead, lalu melanjutkan respons Order Brief.

## Perubahan yang akan dibuat

### 1. Jadikan kualifikasi inti transaksional dan aman diulang

- Pisahkan hasil inti yang wajib berhasil: validasi session, simpan/update percakapan, upsert satu lead, sinkronkan score/status, dan simpan Requirement V1.
- Kembalikan hasil sukses hanya jika lead dan requirement inti sudah tersimpan.
- Cegah nomor yang dikirim ulang membuat lead atau Requirement Version duplikat untuk payload kualifikasi yang sama.
- Jika persistence inti gagal, kembalikan error terstruktur yang benar; jangan melanjutkan seolah kualifikasi berhasil.

### 2. Putus ketergantungan stream dari notifikasi

- Jadikan email dan Telegram benar-benar best-effort setelah lead tersimpan.
- Bungkus seluruh jalur notifikasi—termasuk import, baca CRM, format payload, dan panggilan provider—agar kegagalannya dicatat tetapi tidak melempar error ke tool AI.
- Pastikan notifikasi tetap hanya satu kali untuk lead baru dan retry chat tidak mengirim notifikasi ganda.
- Order Brief tetap dikirim ke client walaupun email atau Telegram sedang gagal.

### 3. Stabilkan tool loop dan fallback Order Brief

- Simpan hasil tool kualifikasi yang sudah tervalidasi sebelum proses sampingan.
- Pastikan kelanjutan setelah tool selalu menghasilkan satu respons final: teks model bila tersedia, atau fallback Order Brief dari data kualifikasi yang sama.
- Hindari konsumsi/penutupan stream ganda serta pastikan error pada penyimpanan draft setelah respons tidak menghapus jawaban yang sudah berhasil.
- Pertahankan rotasi 5 key dan Lovable AI fallback, tetapi kegagalan non-model tidak boleh diklasifikasikan sebagai masalah koneksi AI.

### 4. Perjelas penanganan error di chatbot

- Tampilkan pesan koneksi AI hanya untuk kegagalan model/gateway yang nyata.
- Untuk kegagalan persistence inti, tampilkan pesan aman yang meminta pengguna mencoba lagi tanpa kehilangan isi percakapan.
- Hapus toast generik ganda sehingga pengguna tidak menerima dua notifikasi untuk satu kegagalan.

## Pengujian

- Tambahkan regression test untuk satu kali pengiriman nomor WhatsApp: tool dipanggil, satu lead dibuat, satu Requirement V1 dibuat, dan Order Brief langsung tampil tanpa retry.
- Simulasikan email gagal dan Telegram gagal: stream tetap sukses dan Order Brief tampil.
- Kirim nomor yang sama dua kali: tidak ada lead, requirement, atau notifikasi ganda.
- Simulasikan Gemini `429`, `5xx`, dan key auth failure pada langkah awal serta langkah setelah tool; verifikasi rotasi/fallback tetap melanjutkan satu respons tanpa duplikasi tool.
- Jalankan flow nyata dari awal pada viewport mobile, cek tidak ada banner merah, lalu verifikasi hasil CRM, score, source, requirement, dan Order Brief.
- Uji chatbot publik, AI Business Assistant admin, serta fitur AI lain yang memakai Central AI Gateway untuk memastikan streaming tetap normal.

## Batasan

- Tidak mengubah isi konsultasi, logika rekomendasi, scoring, atau desain chatbot di luar pesan error.
- Tidak publish otomatis.
