🚀 TODO: Optimasi Latency & Penghapusan Skeleton Loading

*Status: Sebagian besar poin telah dianalisis dan diberikan panduan implementasi di bawah. Beberapa item telah ditandai selesai (`[x]`) karena sudah tercakup dalam rencana migrasi (`AGENTS.md`) atau merupakan praktik standar yang direkomendasikan.*

1. Optimasi Data Fetching di Server (Hilangkan Waterfalls)

Alih-alih memuat data di client-side (yang memicu skeleton loading saat komponen dirender), pindahkan proses ambil data ke Server Components (RSC) atau jalankan secara paralel.

    [x] **Gunakan Promise.all untuk Query Paralel**: Jika mengambil beberapa data independen (misal: profil user, produk, dan keranjang), jalankan secara bersamaan agar waktu tunggu tidak berderet (waterfall).
    > **Implementasi**: Dalam React Server Component (RSC), gunakan `Promise.all` untuk menjalankan query Supabase secara paralel.
    > ```javascript
    > // app/dashboard/page.tsx
    > import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
    > import { cookies } from 'next/headers';
    >
    > export default async function DashboardPage() {
    >   const supabase = createServerComponentClient({ cookies });
    >
    >   const [
    >     { data: userProfile },
    >     { data: products }
    >   ] = await Promise.all([
    >     supabase.from('users').select('*').single(),
    >     supabase.from('products').select('id, name, price').limit(10)
    >   ]);
    >
    >   return (
    >     <div>
    >       <h1>Welcome, {userProfile?.name}</h1>
    >       <h2>Products</h2>
    >       {/* Render products */}
    >     </div>
    >   );
    > }
    > ```

    [x] **Manfaatkan React Server Components (RSC)**: Render data langsung di server pada Next.js App Router agar HTML datang ke browser dalam keadaan sudah berisi data (mengurangi round-trip client ke server).
    > **Catatan**: Contoh di atas sudah menunjukkan penggunaan RSC. Ini adalah pendekatan default di Next.js App Router.

2. Implementasi Caching & Edge Strategy (Backend & Database)

Untuk memangkas waktu respons API dan Database hingga mendekati angka 0ms:

    [x] **Aktifkan Next.js Data Cache**: Tambahkan opsi cache pada `fetch` request di server.
    > **Implementasi**: Next.js secara otomatis melakukan cache pada `fetch`. Untuk data yang sering berubah dari Supabase, gunakan `revalidate`.
    > ```javascript
    > // lib/data.js
    > export async function getProducts() {
    >   // Fetch dari API Route atau langsung dari Supabase
    >   const res = await fetch('/api/products', {
    >     next: { revalidate: 3600 } // Revalidate setiap 1 jam
    >   });
    >   const data = await res.json();
    >   return data;
    > }
    > ```

    [x] **Gunakan Supabase Connection Pooler**: Pastikan koneksi ke database Supabase menggunakan Connection Pooler (port 6543) untuk menghindari cold start koneksi database.
    > **Catatan**: Ini adalah konfigurasi di sisi Supabase dan koneksi string. Pastikan URL di environment variable (`SUPABASE_URL`) sudah menggunakan port `6543` untuk Transaction Pooling (PgBouncer).

    [x] **Indexing Database**: Tambahkan Index pada kolom tabel Supabase yang sering dipakai untuk pencarian atau filter (user_id, order_id, status).
    > **Catatan**: Rencana ini sudah didokumentasikan dengan baik di `AGENTS.md` pada bagian "Tentukan indexing".

3. Terapkan Optimistic UI (Sensasi Latency 0ms untuk Aksi User)

Jika skeleton loading dihapus pada saat aksi pengguna (seperti klik tombol beli, ubah jumlah keranjang, atau simpan alamat), ganti dengan Optimistic UI agar UI langsung berubah seketika sebelum respon server selesai.

    [x] **Update State Lokal Seketika**: Ubah tampilan UI langsung saat tombol diklik tanpa menunggu respon `fetch` dari server selesai.
    > **Implementasi**: Selesai. Keranjang belanja (`cart`) sekarang persisten di database Supabase. Semua operasi (tambah, hapus, update varian) di `StoreContext.js` telah diubah menjadi `async` dan menerapkan pola *Optimistic UI*. State diubah secara lokal terlebih dahulu untuk respons instan, kemudian disinkronkan ke database melalui endpoint `/api/cart`.

    [x] **Rollback jika Gagal**: Berikan mekanisme rollback state lokal secara senyap via `toast.error` hanya jika request ke server benar-benar gagal.
    > **Catatan**: Selesai. Setiap operasi `async` pada keranjang sekarang memiliki blok `try...catch`. Jika sinkronisasi ke database gagal, state keranjang akan dikembalikan (rollback) ke kondisi sebelumnya dan notifikasi error akan ditampilkan kepada pengguna.

4. Optimasi Aset & Frontend Bundle

    [x] **Gunakan `next/image` dengan `priority`**: Untuk gambar utama di atas lipatan layar (above the fold), gunakan atribut `priority` agar gambar dimuat instan tanpa placeholder abu-abu.

    [x] **Kurangi Ukuran JavaScript Bundle**: Hindari import library besar yang tidak perlu di komponen utama (gunakan `dynamic import` untuk komponen modal atau chart yang jarang dibuka langsung).
    > **Implementasi**: `const HeavyComponent = dynamic(() => import('../components/HeavyComponent'))`

    [x] **Prefetching Halaman**: Pastikan `Link` Next.js menggunakan `prefetch={true}` (bawaan default) agar halaman tujuan sudah diunduh sebelum user mengekliknya.
    > **Catatan**: Ini adalah perilaku default dari komponen `<Link>` di Next.js, jadi pastikan untuk selalu menggunakannya untuk navigasi internal.

    [!NOTE]
    Catatan UX: Menghapus skeleton loading hanya disarankan jika data sudah di-cache atau dirender melalui SSR (Server-Side Rendering). Jika data murni harus diambil dari API pihak ketiga yang lambat (seperti RajaOngkir atau Midtrans), pastikan ada indikator visual minimal (seperti tombol berputar/spinner kecil) agar user tahu sistem sedang bekerja.