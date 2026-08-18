
### Checklist Optimasi Performa Web

* [x] **Ubah halaman utama jadi Server Component**: Pisahkan `page.tsx`. Biarkan bagian statis (Navbar, Hero, About, Footer) tetap Server Component. Fetch data produk awal di server lalu kirim sebagai props ke Shop. Gunakan 'use client' hanya untuk bagian yang butuh interaktivitas (tombol, modal, filter).
* [x] **Hilangkan fetch produk yang dobel**: Pilih satu sumber data. Ambil data awal di server lalu pakai itu, biar `Shop.js` cuma fetch ulang saat user ganti filter/halaman, bukan saat mount pertama.
* [x] **Kompres gambar besar**: Kompres `crush.jpg` (2.8MB) dan background lain ke WebP/AVIF (target < 150-200KB). Gunakan komponen `next/image` untuk otomatisasi resize dan lazy-load.
* [x] **Lazy-load bagian di bawah fold**: Gunakan `next/dynamic` untuk Shop, Contact, dan Modal produk agar JS-nya tidak dimuat di awal.
* [x] **Tunda koneksi Supabase Realtime**: Tunda subscribe channel realtime di `Shop.js` sampai render awal selesai (gunakan `requestIdleCallback` atau delay kecil).
* [ ] **Ukur dengan Lighthouse / DevTools**: Jalankan Lighthouse setelah perubahan untuk melihat peningkatan metrik LCP dan TBT.

