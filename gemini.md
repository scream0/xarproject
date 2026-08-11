2. API & Backend Development
[x] Perbaiki kueri di /api/reviews/route.js (pastikan hanya memanggil kolom yang valid di database).
[ ] Buat API Endpoint untuk manajemen status pesanan (Admin ⇄ User).
[ ] Buat API Endpoint untuk pengurangan stok otomatis saat check-out berhasil.
[ ] Buat API Endpoint untuk input nomor resi dan pelacakan pengiriman.
3. Sinkronasi Admin & User (Real-time Features)
[ ] Order Flow Sync:
[ ] User melakukan check-out > Pesanan tercatat dengan status pending.
[ ] Admin melihat pesanan baru masuk secara real-time (menggunakan Supabase Realtime).
[ ] Admin mengubah status ke Processing, Completed, atau Cancelled > User langsung melihat perubahan status di halaman riwayat belanja tanpa refresh.
[ ] Inventory Sync:
[ ] Stok produk otomatis terpotong saat transaksi berhasil dibayar.
[ ] Perubahan stok/harga oleh admin langsung terupdate di katalog produk user.
[ ] Tombol beli otomatis berubah menjadi "Stok Habis" jika jumlah stok mencapai 0.
[ ]Reviews & Ratings Sync:
[ ] User dapat memberikan ulasan, rating, dan foto (photo / review_photo) setelah pesanan selesai (completed).
[ ] Ulasan yang masuk langsung tampil di halaman produk dan rata-rata rating produk ter-update otomatis.