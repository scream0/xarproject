🚀 Professional E-Commerce Checkout UI/UX Roadmap

Panduan tugas terstruktur untuk mengoptimalkan kode halaman CheckoutPage agar setara dengan standar e-commerce profesional di Indonesia (seperti Tokopedia, Shopee, atau Blibli).
🔗 1. State Persistence & LocalStorage Resilience

Mencegah hilangnya data input pilihan kurir atau alamat saat pengguna melakukan refresh halaman secara tidak sengaja.

    [ ] 1.1 Restore Pilihan Alamat dan Kurir dari LocalStorage

        Goal: Saat halaman dimuat ulang, periksa apakah ada data checkout_shipping tersimpan di localStorage untuk langsung mengembalikan state pilihan selectedAddressId dan selectedCourierKey.

        Benefit: Mencegah pengguna harus memilih ulang dari awal jika tidak sengaja merefresh halaman.

    [ ] 1.2 Sinkronisasi Otomatis Data Keranjang & Stok

        Goal: Tambahkan validasi real-time ketersediaan stok produk di dalam keranjang sebelum tombol "Bayar Sekarang" diaktifkan sepenuhnya.

🎨 2. UI/UX, Visual Polish & Micro-Interactions

Meningkatkan kenyamanan visual dan transisi interaksi mikro khas marketplace papan atas.

    [ ] 2.1 Animasi Skeleton untuk Pemuatan Kurir & Alamat

        Goal: Ganti teks statis "Memuat alamat..." atau spinner biasa dengan komponen Skeleton Loader yang menyerupai kartu alamat dan pilihan kurir agar transisi terlihat lebih mulus.

    [ ] 2.2 Desain Visual Metode Pembayaran yang Lebih Transparan

        Goal: Berikan ikon visual kecil untuk pilihan metode pembayaran di tombol utama (misal: logo QRIS, Virtual Account BCA/Mandiri, atau Indomaret/Alfamart) agar pembeli langsung tahu opsi pembayaran yang didukung.

    [ ] 2.3 Indikator Status Langkah (Checkout Step Indicator) yang Interaktif

        Goal: Buat indikator langkah di bagian atas (Alamat → Kurir → Pembayaran) dapat diklik untuk melompat ke bagian terkait jika data sebelumnya sudah valid.

📱 3. Mobile Experience & Accessibility (A11y)

Memastikan proses checkout dari ponsel pintar berjalan tanpa hambatan ergonomis.

    [ ] 3.1 Floating / Sticky Summary Bottom Bar di Mobile

        Goal: Pada layar mobile, buat ringkasan total harga dan tombol "Bayar Sekarang" melayang (sticky bottom) di bagian bawah layar agar pembeli tidak perlu menggulir (scroll) ke bawah untuk menyelesaikan pembayaran.

    [x] 3.2 Penutupan Modal Alamat via Tombol ESC & Backdrop Click

        Goal: Pastikan modal tambah alamat dapat ditutup dengan menekan tombol Escape pada keyboard atau mengeklik area luar kotak modal (backdrop).

⚙️ 4. Clean Code & Modularisasi Komponen

Memecah kode file checkout.page.jsx yang cukup panjang agar lebih mudah dipelihara (maintainable).

    [ ] 4.1 Ekstraksi Komponen Alamat & Kurir

        Goal: Pisahkan bagian pengelolaan daftar alamat ke dalam komponen CheckoutAddressSection.jsx dan daftar kurir ke CheckoutCourierSection.jsx.

        Benefit: Menjaga file utama tetap ramping dan fokus pada alur bisnis checkout secara keseluruhan.

    [ ] 4.2 Pemisahan Logika Kalkulasi Ongkir & Promo

        Goal: Pindahkan fungsi kalkulasi berat, pemanggilan API ongkir, dan validasi kode promo ke dalam custom hook (misal: useCheckoutCalculation).

🛡️ 5. Penanganan Error & Keamanan Transaksi (Resilience)

Mengantisipasi kendala jaringan dan kegagalan integrasi pembayaran.

    [ ] 5.1 Tombol Retry / Muat Ulang untuk API Ongkir yang Gagal

        Goal: Jika pemanggilan API RajaOngkir / kurir gagal akibat gangguan jaringan, tampilkan tombol "Coba Hitung Ulang Ongkir" di dalam kotak kurir.

    [ ] 5.2 Konfirmasi Pembatalan / Keluar Checkout

        Goal: Cegah pengguna keluar dari halaman checkout secara tidak sengaja dengan memunculkan dialog peringatan jika keranjang aktif dan mereka mengeklik tautan kembali ke toko.