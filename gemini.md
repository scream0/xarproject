🚀 TODO: Optimasi Latency & Penghapusan Skeleton Loading
1. Optimasi Data Fetching di Server (Hilangkan Waterfalls)

Alih-alih memuat data di client-side (yang memicu skeleton loading saat komponen dirender), pindahkan proses ambil data ke Server Components (RSC) atau jalankan secara paralel.

    [ ] Gunakan Promise.all untuk Query Paralel: Jika mengambil beberapa data independen (misal: profil user, produk, dan keranjang), jalankan secara bersamaan agar waktu tunggu tidak berderet (waterfall).

    [ ] Manfaatkan React Server Components (RSC): Render data langsung di server pada Next.js App Router agar HTML datang ke browser dalam keadaan sudah berisi data (mengurangi round-trip client ke server).

2. Implementasi Caching & Edge Strategy (Backend & Database)

Untuk memangkas waktu respons API dan Database hingga mendekati angka 0ms:

    [ ] Aktifkan Next.js Data Cache: Tambahkan opsi cache pada fetch request di server:
    JavaScript

    // Contoh cache statis/dinamis dengan revalidate
    fetch('/api/products', { next: { revalidate: 60 } });

    [ ] Gunakan Supabase Connection Pooler: Pastikan koneksi ke database Supabase menggunakan Connection Pooler (port 6543) untuk menghindari cold start koneksi database.

    [ ] Indexing Database: Tambahkan Index pada kolom tabel Supabase yang sering dipakai untuk pencarian atau filter (user_id, order_id, status).

3. Terapkan Optimistic UI (Sensasi Latency 0ms untuk Aksi User)

Jika skeleton loading dihapus pada saat aksi pengguna (seperti klik tombol beli, ubah jumlah keranjang, atau simpan alamat), ganti dengan Optimistic UI agar UI langsung berubah seketika sebelum respon server selesai.

    [ ] Update State Lokal Seketika: Ubah tampilan UI langsung saat tombol diklik tanpa menunggu respon fetch dari server selesai.

    [ ] Rollback jika Gagal: Berikan mekanisme rollback state lokal secara senyap via toast.error hanya jika request ke server benar-benar gagal.

4. Optimasi Aset & Frontend Bundle

    [ ] Gunakan next/image dengan priority: Untuk gambar utama di atas lipatan layar (above the fold), gunakan atribut priority agar gambar dimuat instan tanpa placeholder abu-abu.

    [ ] Kurangi Ukuran JavaScript Bundle: Hindari import library besar yang tidak perlu di komponen utama (gunakan dynamic import untuk komponen modal atau chart yang jarang dibuka langsung).

    [ ] Prefetching Halaman: Pastikan Link Next.js menggunakan prefetch={true} (bawaan default) agar halaman tujuan sudah diunduh sebelum user mengekliknya.

    [!NOTE]
    Catatan UX: Menghapus skeleton loading hanya disarankan jika data sudah di-cache atau dirender melalui SSR (Server-Side Rendering). Jika data murni harus diambil dari API pihak ketiga yang lambat (seperti RajaOngkir atau Midtrans), pastikan ada indikator visual minimal (seperti tombol berputar/spinner kecil) agar user tahu sistem sedang bekerja.