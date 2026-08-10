# Todo: Kecilin Latency Website

Berdasarkan review `next.config.js`, `Shop.js`, `supabaseAdmin.js`, `tsconfig.json`.

---

## 🔴 High Impact (kerjain duluan)

- [x] **Hapus `images: { unoptimized: true }` di `next.config.js`**
  Ini mematikan resize/compress/lazy-load otomatis dari `next/image`. Kalau alasannya karena pakai Cloudinary (`res.cloudinary.com` udah ada di CSP), ganti jadi:
  ```js
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  ```

- [x] **Ganti semua `<img>` di `Shop.js` jadi `next/image`**
  Ada di 3 tempat: gambar produk di card, gambar di modal detail, foto review. Setelah `unoptimized` dihapus, ini otomatis dapet lazy-loading + resize + format modern (webp/avif).

- [x] **Paralelkan fetch di `fetchShopData()` (`Shop.js`)**
  Sekarang `/api/products`, `/api/orders`, `/api/reviews` di-`await` satu-satu di dalam function yang sama (meski di try/catch terpisah, tetap jalan berurutan karena `await` blocking). Ganti jadi:
  ```js
  await Promise.allSettled([
    fetchProducts(),
    fetchOrders(),
    fetchReviews(),
  ]);
  ```
  Pecah masing-masing jadi function sendiri, biar bisa jalan bareng.

- [x] **Pindahkan fetch produk awal ke Server Component**
  Sekarang `Shop.js` full `"use client"` — user selalu lihat skeleton dulu baru data muncul (fetch di `useEffect`). Bikin wrapper Server Component yang fetch produk pertama kali di server, terus pass sebagai `initialProducts` props ke `Shop.js`. Data awal langsung ada di HTML pertama = lebih cepat keliatan.

## 🟡 Medium Impact

- [x] **Cache endpoint `/api/products`**
  Sekarang `cache: "no-store"` dipakai buat semua fetch, termasuk katalog produk yang harusnya gak berubah tiap detik. Kalau produk gak sering update, pertimbangkan `revalidate` (ISR) di route handler, atau minimal ganti ke `cache: "default"` / pakai SWR di client dengan interval refresh.

- [x] **Review `useEffect` dependency `[contextProducts]` di `Shop.js`**
  Ini bikin `fetchShopData()` re-run tiap `contextProducts` berubah dari context lain. Pastikan ini gak nge-trigger fetch ulang tanpa perlu (misal kalau context sering update karena alasan lain yang gak terkait produk).

- [x] **Pindahkan filter/sort/pagination produk ke server (API)**
  Backend `/api/products` sekarang menerima parameter `search`, `sortBy`, `sortOrder`, `page`, dan `limit`. Client-side (`Shop.js`) sudah diadaptasi untuk mengirim parameter ini, menghapus logika filter/sort/slice lokal, dan mengelola pagination.

- [x] **Hapus `setTimeout(fetchShopData, 0)` di `useEffect`**
  Wrapping `setTimeout` dengan delay 0 gak ngasih benefit performa, cuma nambah 1 tick event loop tanpa alasan jelas. Panggil langsung aja `fetchShopData()`. (Sudah tidak ditemukan di `Shop.js`, kemungkinan sudah di-refactor atau tidak pernah ada di versi terakhir.)

- [x] **Cek ukuran `/api/orders` response**
  Route ini di-fetch tiap kali shop dibuka cuma buat hitung `total_sold` per produk. Kalau data order banyak, ini berat. Endpoint khusus `/api/products/sales` sudah dibuat untuk mengembalikan hasil agregat (`SELECT product_id, SUM(qty)`) dari database, dan `Shop.js` sudah diupdate untuk menggunakan endpoint baru ini.

## 🟢 Quick Wins

- [x] **Tambah `loading="lazy"` di `<img>` review foto (kalau belum pindah ke `next/image`)**
  Review foto sudah menggunakan komponen `next/image` yang otomatis menerapkan lazy loading.
- [x] **Cek apakah `shopConfig.json` (import statis) ukurannya besar — kalau iya, split per section biar gak ke-bundle semua di initial load**
  Ukuran file `shopConfig.json` hanya sekitar 1.5 KB. Tidak perlu di-split karena sudah sangat kecil.
- [x] **`wishlist` dari `localStorage` udah oke (client-only, gak masalah)**

## 🔵 Butuh File Tambahan (biar bisa lebih spesifik lagi)

- [x] **`src/app/api/products/route.js` — cek query Supabase-nya, apakah `select('*')` atau udah spesifik kolom, ada index gak**
  Query sudah diubah dari `select('*')` menjadi `select('id, name, description, category, image_url, variants, price, total_sold, created_at')` untuk mengurangi payload.
- [x] **`src/app/api/orders/route.js` dan `src/app/api/reviews/route.js` — sama, cek query-nya**
  - Query untuk `/api/orders/route.js` sudah dipindahkan ke endpoint agregat `/api/products/sales` yang lebih efisien.
  - Query untuk `/api/reviews/route.js` sudah diubah dari `select('*')` menjadi `select` yang lebih spesifik untuk mengurangi payload.
- [x] **`src/context/StoreContext.js` — cek isi `contextProducts` dan kenapa dia jadi dependency `useEffect` di Shop.js**
  Dependency `contextProducts` pada `useEffect` di `Shop.js` sudah dihapus untuk menghindari re-fetch yang tidak perlu.
- [x] **Screenshot skema tabel `products`, `orders`, `reviews` di Supabase — buat cek index**
  Skema tabel sudah direview dari file migrasi.
  **Temuan:**
  - Tabel `products` tidak memiliki index pada kolom `name`, `description`, `created_at`, dan `variants`.
  **Rekomendasi:**
  - Tambahkan index B-tree pada `products(name)` dan `products(created_at)` untuk mempercepat pencarian dan pengurutan.
  - Pertimbangkan index GIN pada `products(variants)` jika sering melakukan filter/sort berdasarkan harga di dalam JSONB.
  - Pertimbangkan index trigram pada `products(name, description)` untuk mempercepat pencarian `ilike`.

## 📊 Monitoring (setelah semua di atas dikerjain)

- [ ] Run Lighthouse sebelum & sesudah perubahan, bandingin skor LCP/TTFB
- [ ] Cek Network tab: apakah fetch produk/orders/reviews udah jalan paralel (waterfall harusnya hilang)