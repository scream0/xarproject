# TODO: Migrasi Backend Firebase → Supabase

Cakupan data: `users`, `store_settings`, `products`, `review`, `returns`, `orders`, `notifications`

---
## Catatan Status Migrasi (Per 4 Agustus 2026)
*   **Status**: Migrasi **Parsial**.
*   **Frontend**: Sudah mulai menggunakan Supabase (`@supabase/supabase-js`). File `src/lib/firebaseClient.js` sudah dinonaktifkan.
*   **Backend/API**: Masih aktif menggunakan Firebase Admin SDK untuk akses Firestore (`src/lib/firebaseAdmin.js`).
*   **Supabase URL**: Terdeteksi dari `firebase.json` dan `src/lib/supabaseClient.js` sebagai `gwdvcfuzwchnfrhnhaek.supabase.co` (diambil dari env var `NEXT_PUBLIC_SUPABASE_URL`).
*   **Tugas Berikutnya**: Melanjutkan audit, mendesain skema, dan memulai migrasi data backend.

---

## 0. Persiapan
- [x] Install Supabase CLI & SDK (`@supabase/supabase-js`)
- [ ] Konfirmasi kredensial Supabase:
  - [x] `NEXT_PUBLIC_SUPABASE_URL`: `https://gwdvcfuzwchnfrhnhaek.supabase.co` (Terkonfirmasi dari kode)
  - [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY`: (Terkonfirmasi ada di `env`, tidak perlu diekspos)
  - [x] `SUPABASE_SERVICE_ROLE_KEY`: **Dibutuhkan** untuk migrasi data backend.
- [x] Audit struktur data existing di Firestore:
    - [x] `users`: **On Firestore**. Top-level collection. Has `addresses` subcollection.
    - [x] `store_settings`: **On Firestore**. Stored in a single document: `store_config/main`.
    - [x] `products`: **✅ Migrated to Supabase**.
    - [x] `review`: **On Firestore**. Collection name is `reviews`. Linked to `orders` and `users`.
    - [x] `returns`: **On Firestore**. Collection name is `return_requests`. Linked to `orders` and `users`.
    - [x] `orders`: **Hybrid**. Order records are on Firestore, but stock logic (reservation & decrement) uses the Supabase `products` table.
    - [x] `notifications`: **On Firestore**. Standard notification system.
- [x] Audit Firebase Auth (provider yang dipakai: email/password, Google, dll). Kode lama (`firebaseClient.js`) mengindikasikan `getAuth` digunakan. **Hasil**: Provider yang digunakan adalah Email/Password, Google, dan Phone (OTP).
- [x] Audit Firebase Storage. Kode lama (`firebaseClient.js`) mengindikasikan `getStorage` digunakan untuk file/gambar. **Hasil**: Tidak ditemukan penggunaan Firebase Storage aktif di kode. Migrasi storage belum dimulai.
- [ ] Backup penuh data Firebase (export JSON per koleksi) sebelum mulai.

---

## 1. Desain Skema Database (Postgres)
- [x] `users` — mapping field Firestore → kolom Postgres, tentukan primary key (uuid, samakan dengan `auth.users.id` jika pakai Supabase Auth). **Hasil (dari `0001_initial_schema.sql`):**
  - `id`: `uuid` (Primary Key, Foreign Key to `auth.users.id`)
  - `role`: `text`, default 'customer'
  - `total_spent`: `numeric`, default 0
  - `created_at`: `timestamptz`
  - `updated_at`: `timestamptz`
- [x] `addresses` (sub-collection) direlasikan sebagai tabel terpisah:
  - `id`: `bigserial` (Primary Key)
  - `user_id`: `uuid` (Foreign Key to `public.users.id`)
  - `is_primary`: `boolean`, default false
  - `label`: `text`
  - `recipient_name`: `text`
  - `recipient_phone`: `text`
  - `street`: `text`
  - `city`: `text`
  - `city_id`: `text`
  - `province`: `text`
  - `postal_code`: `text`
- [x] `store_settings` — tentukan relasi ke `users`/store (1-1 atau 1-many). **Hasil (dari `0001_initial_schema.sql` & `api/automation`):**
  - Tabel `store_config` (singleton, 1 baris untuk semua setting global).
  - `singleton_id`: `boolean` (Primary Key, always true)
  - `store_name`: `text`
  - `store_email`: `text`
  - `currency`: `text`
  - `admin_locale`: `text`
  - `low_stock_threshold`: `integer`
  - `store_city_id`: `text`
  - `store_city_name`: `text`
  - `hero`: `jsonb`
  - `about`: `jsonb`
  - `product`: `jsonb`
  - `contact`: `jsonb`
  - `footer`: `jsonb`
  - `promo_banner_enabled`: `boolean`
  - `promo_banner_text`: `text`
  - `promo_discount_type`: `text`
  - `promo_discount_value`: `numeric`
  - `promo_start_date`: `timestamptz`
  - `promo_end_date`: `timestamptz`
  - `promo_code`: `text`
  - `promo_destination`: `text`
  - `automation_rules`: `jsonb` (untuk menggantikan `store_config/automation`)
  - `created_at`: `timestamptz`
  - `updated_at`: `timestamptz`
- [x] `products` — tentukan tipe kolom (harga, stok, kategori, gambar sebagai url/array). **Hasil (dari `api/products`):**
  - `id`: `uuid` (Primary Key)
  - `name`: `text`, NOT NULL
  - `category`: `text`, default 'Parfum'
  - `description`: `text`
  - `image_url`: `text`
  - `image_public_id`: `text` (untuk Cloudinary)
  - `variants`: `jsonb`. Array of objects, e.g., `[{ "size": "50ml", "price": 250000, "stock": 100 }]`
  - `weight`: `numeric`, default 250
  - `length`: `numeric`
  - `width`: `numeric`
  - `height`: `numeric`
  - `status`: `text`, default 'published'
  - `province`: `text`
  - `city`: `text`
  - `cityId`: `text`
  - `stockLocation`: `text`
  - `created_at`: `timestamptz`
- [x] `review` — relasi ke `products` dan `users` (foreign key), rating, komentar. **Hasil (dari `0001_initial_schema.sql` & `api/reviews`):**
  - `id`: `bigserial` (Primary Key)
  - `user_id`: `uuid` (Foreign Key to `public.users.id`)
  - `order_id`: `uuid` (Foreign Key to `public.orders.id`)
  - `product_id`: `uuid` (Foreign Key to `public.products.id`)
  - `user_name`: `text` (Denormalized)
  - `product_name`: `text` (Denormalized)
  - `rating`: `smallint` (1-5)
  - `comment`: `text`
  - `approved`: `boolean`, default true
  - `created_at`: `timestamptz`
  - `updated_at`: `timestamptz`
- [x] `returns` — relasi ke `orders`, status enum (pending/approved/rejected/completed). **Hasil (dari `0001_initial_schema.sql` & `api/returns`):**
  - Enum `return_status`: `('requested', 'approved', 'rejected', 'refunded')`
  - Tabel `return_requests`:
    - `id`: `bigserial` (Primary Key)
    - `user_id`: `uuid` (Foreign Key to `public.users.id`)
    - `order_id`: `uuid` (Foreign Key to `public.orders.id`)
    - `reason`: `text`
    - `notes`: `text`
    - `status`: `public.return_status`, default 'requested'
    - `admin_note`: `text`
    - `resolved_by`: `uuid` (Foreign Key to `public.users.id`)
    - `created_at`: `timestamptz`
    - `updated_at`: `timestamptz`
- [x] `orders` — relasi ke `users`, `products` (order_items sebagai tabel terpisah), status enum. **Hasil (dari `0001_initial_schema.sql` & `api/orders`):**
  - Enum `order_status`: `('pending', 'processing', 'completed', 'cancelled', 'settlement', 'success')`
  - Tabel `orders`:
    - `id`: `uuid` (Primary Key)
    - `user_id`: `uuid` (Foreign Key to `public.users.id`, nullable)
    - `status`: `public.order_status`, default 'pending'
    - `amount`: `numeric`
    - `shipping_cost`: `numeric`
    - `discount_amount`: `numeric`
    - `tax_amount`: `numeric`
    - `payment_type`: `text`
    - `customer_name`: `text`
    - `customer_email`: `text`
    - `customer_phone`: `text`
    - `shipping_address`: `jsonb`
    - `shipping_detail`: `jsonb`
    - `shipping_receipt_number`: `text`
    - `notes`: `text`
    - `status_history`: `jsonb`
    - `stock_reserved_at`: `timestamptz`
    - `created_at`: `timestamptz`
    - `updated_at`: `timestamptz`
  - Tabel `order_items`:
    - `id`: `bigserial` (Primary Key)
    - `order_id`: `uuid` (Foreign Key to `public.orders.id`)
    - `product_id`: `uuid` (Foreign Key to `public.products.id`)
    - `product_name`: `text`
    - `variant_name`: `text`
    - `quantity`: `integer`
    - `price`: `numeric`
- [x] `notifications` — relasi ke `users`, tipe notifikasi, status read/unread. **Hasil (dari `0001_initial_schema.sql` & `api/notifications`):**
  - Enum `notification_type`: `('info', 'promo', 'order', 'payment', 'system')`
  - Tabel `notifications`:
    - `id`: `bigserial` (Primary Key)
    - `user_id`: `uuid` (Foreign Key to `public.users.id`)
    - `audience`: `text`, default 'user' -- ('user', 'admin', 'all')
    - `title`: `text`
    - `message`: `text`
    - `link`: `text`
    - `type`: `public.notification_type`, default 'info'
    - `is_read`: `boolean`, default false
    - `read_at`: `timestamptz`
    - `created_at`: `timestamptz`
    - `updated_at`: `timestamptz`
- [x] Tentukan enum types (order status, return status, notification type, dll). **Hasil:**
  - `public.order_status`: `('pending', 'processing', 'completed', 'cancelled', 'settlement', 'success')`
  - `public.return_status`: `('requested', 'approved', 'rejected', 'refunded')`
  - `public.notification_type`: `('info', 'promo', 'order', 'payment', 'system')`
- [x] Tentukan indexing (foreign key, kolom yang sering di-query/filter). **Hasil (dari `0001_initial_schema.sql` & analisa query):**
  - Foreign Keys (automatis di-index oleh Postgres): `addresses(user_id)`, `orders(user_id)`, `order_items(order_id, product_id)`, `reviews(user_id, order_id, product_id)`, `return_requests(user_id, order_id, resolved_by)`, `notifications(user_id)`.
  - Index Manual Tambahan:
    - `reviews(product_id)`
    - `notifications(audience)` (untuk query admin)
    - `orders(status)` dan `products(status)` jika sering ada filter berdasarkan status.
- [x] Review skema akhir (ERD) sebelum eksekusi migrasi. **Hasil**: Skema yang didokumentasikan di atas sudah cukup komprehensif untuk memulai fase implementasi migrasi.

---

## 2. Setup Supabase
- [x] Buat tabel-tabel sesuai skema (migration SQL, gunakan `supabase migration new`). **Hasil**: Skema lengkap dibuat di file `supabase/migrations/0002_full_schema.sql`.
- [x] Setup relasi & foreign key constraints. **Hasil**: Ditangani oleh `0002_full_schema.sql`.
- [x] Setup Row Level Security (RLS) per tabel. **Hasil**: Ditangani oleh `0002_full_schema.sql`.
- [x] Setup Supabase Auth (aktifkan provider yang sesuai dengan Firebase Auth). **Hasil**: Instruksi untuk mengaktifkan provider Email, Google, dan Phone (OTP) telah diberikan.
- [x] Setup Supabase Storage bucket (pengganti Firebase Storage) untuk gambar produk/review. **Hasil**: Instruksi untuk membuat bucket `assets` telah diberikan.
- [x] Setup trigger/function jika perlu (misal: auto update `updated_at`, hitung rating rata-rata produk). **Hasil**: Trigger `handle_updated_at` ditangani oleh `0002_full_schema.sql`.

---

## 3. Migrasi Data
- [x] Tulis script export data dari Firestore (per koleksi → JSON/CSV). **Catatan**: Untuk auth, ini adalah langkah manual: `firebase auth:export users.json`. Untuk data lain, script akan membaca langsung dari Firestore.
- [x] Tulis script transform data (mapping field, format tanggal Firestore Timestamp → Postgres `timestamptz`, dsb). **Hasil**: Dibuat file `scripts/migrateData.js` sebagai pusat logic migrasi.
- [x] Migrasi `users` (termasuk buat akun di Supabase Auth, mapping UID lama → UUID baru jika perlu). **Strategi**:
  1. Ekspor Auth `users.json` dari Firebase secara manual.
  2. Jalankan fungsi `migrateAuthUsers` di `scripts/migrateData.js`.
  3. Script akan membaca `users.json` dan membuat user di Supabase Auth menggunakan `password_hash` dengan algoritma `scrypt`.
  4. Setelah auth user dibuat, script akan memigrasikan data profil dari Firestore `users` ke tabel `public.users` di Supabase.
- [x] Migrasi `store_settings`. **Hasil**: Fungsi `migrateStoreSettings` di `scripts/migrateData.js` siap dijalankan.
- [x] Migrasi `products` (termasuk migrasi gambar dari Firebase Storage ke Supabase Storage). **Hasil**: Fungsi `migrateProducts` di `scripts/migrateData.js` siap dijalankan. Migrasi gambar akan ditangani terpisah.
- [x] Migrasi `review`. **Hasil**: Fungsi `migrateReviews` di `scripts/migrateData.js` siap dijalankan.
- [x] Migrasi `orders`. **Hasil**: Fungsi `migrateOrdersAndItems` di `scripts/migrateData.js` siap dijalankan.
- [x] Migrasi `returns`. **Hasil**: Fungsi `migrateReturns` di `scripts/migrateData.js` siap dijalankan.
- [x] Migrasi `notifications`. **Hasil**: Fungsi `migrateNotifications` di `scripts/migrateData.js` siap dijalankan.
- [x] Migrasi `addresses`. **Hasil**: Fungsi `migrateAddresses` di `scripts/migrateData.js` siap dijalankan.
- [ ] Validasi jumlah data & sample data tiap tabel (bandingkan count & spot-check dengan sumber)
- [ ] Cek integritas relasi (tidak ada foreign key yang orphan/null tak sengaja)

---

## 4. Update Aplikasi (Backend/Frontend)
- [ ] Ganti inisialisasi Firebase SDK → Supabase client
- [ ] Refactor semua query Firestore → query Supabase (select/insert/update/delete)
  - [x] `src/app/api/settings/route.js`
  - [x] `src/app/api/admin/orders/[id]/shipping/route.js`
  - [x] `src/app/api/admin/orders/[id]/status/route.js`
  - [x] `src/app/api/admin/orders/route.js`
  - [x] `src/app/api/automation/route.js`
  - [x] `src/app/api/midtrans/route.js`
  - [x] `src/app/api/notifications/route.js`
  - [x] `src/app/api/orders/cancel/route.js`
  - [x] `src/app/api/orders/update-status/route.js`
  - [ ] `src/app/api/procurement/route.js` (membutuhkan migrasi schema baru)
  - [x] `src/app/api/orders/route.js` (GET/PUT handler only)
- [ ] Refactor Firebase Auth flow → Supabase Auth (login, register, reset password, session handling)
- [ ] Refactor upload/download file → Supabase Storage
- [ ] Refactor real-time listener (Firestore `onSnapshot`) → Supabase Realtime channel (jika dipakai, misal notifikasi/order status)
- [ ] Update Cloud Functions (jika ada) → Supabase Edge Functions
- [ ] Update environment variables/config di semua environment (dev/staging/prod)

---

## 5. Testing
- [ ] Unit test query & RLS policy tiap tabel
- [ ] Test alur autentikasi end-to-end
- [ ] Test alur order lengkap (buat order → notifikasi → review → return)
- [ ] Test upload/download gambar
- [ ] Test performa query dengan data volume besar
- [ ] User Acceptance Testing (UAT) dengan tim/beta user

---

## 6. Go-Live & Cleanup
- [ ] Freeze write ke Firebase (mode maintenance sementara)
- [ ] Jalankan migrasi data final (sinkronisasi delta terakhir)
- [ ] Switch aplikasi production ke Supabase
- [ ] Monitor error/log pasca migrasi (24–48 jam pertama)
- [ ] Backup Supabase (aktifkan point-in-time recovery/backup schedule)
- [ ] Nonaktifkan/matikan Firebase project setelah masa observasi aman
- [ ] Dokumentasikan skema & arsitektur baru untuk tim

---

## Catatan Tambahan
- Urutan migrasi data disarankan: `users` → `store_settings` → `products` → `orders` → `review` → `returns` → `notifications` (mengikuti dependency foreign key).
- Simpan mapping ID lama (Firestore doc ID) ↔ ID baru (Supabase UUID) selama proses migrasi untuk keperluan rollback/debug.
