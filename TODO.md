🚀 TODO: Implement Auto-Generated & Editable Username
⚙️ 1. Backend & Logika Pembuatan Otomatis (Auto-Generate)

    [ ] 1.1 Buat Fungsi Helper Pembuat Username Otomatis

        Goal: Buat fungsi utilitas di backend (atau saat inisialisasi akun di Firestore/Supabase) untuk menghasilkan username unik secara otomatis.

        Cara Kerja: Ambil awalan email atau nama lengkap pengguna (misal: bos xar -> bosxar atau user_9f8c), lalu kombinasikan dengan string acak pendek atau angka agar unik (misal: bosxar_7821).

    [ ] 1.2 Validasi Keunikan Username di Database

        Goal: Pastikan saat auto-generate atau saat user mengedit username, sistem mengecek ke database apakah username tersebut sudah digunakan oleh orang lain.

🎨 2. Frontend — Halaman Profil Pengguna (UserProfil.jsx)

    [ ] 2.1 Tambahkan Field Username di Form Edit Profil

        Goal: Tampilkan input username di halaman pengaturan profil pengguna.

        Aturan Input: Berikan catatan kecil di bawah input, contoh: "Username unik Anda untuk identitas akun. Dapat diubah kapan saja."

    [ ] 2.2 Validasi Format Username (Karakter & Spasi)

        Goal: Batasi input agar hanya menerima huruf kecil, angka, underscore (_), atau titik (.), serta tidak boleh menggunakan spasi (standar username profesional).

    [ ] 2.3 Tombol Simpan & Indikator Ketersediaan

        Goal: Saat user mengetik username baru dan menekan tombol Simpan, jalankan validasi real-time ke API untuk memeriksa apakah username tersebut sudah diambil pengguna lain. Berikan pesan toast sukses atau error yang jelas.