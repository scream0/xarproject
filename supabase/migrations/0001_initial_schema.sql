-- Initial Schema for XAR Project Migration from Firebase to Supabase

-- ----------------------------------------------------------------
-- 1. USERS
-- Keterangan: Tabel ini akan menyimpan data publik dari user yang
-- sebelumnya ada di Firestore collection 'users'.
-- Relasi: 1-to-1 dengan `auth.users` via `id`.
-- ----------------------------------------------------------------
CREATE TABLE public.users (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'customer'::text,
  total_spent numeric DEFAULT 0,
  -- Kolom profil lain bisa ditambahkan di sini sesuai kebutuhan
  -- contoh: full_name, avatar_url, dll.
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

-- Trigger untuk auto-update `updated_at`
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_users_updated
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

-- ----------------------------------------------------------------
-- 2. ADDRESSES
-- Keterangan: Tabel ini menggantikan subcollection 'addresses' yang
-- ada di bawah tiap dokumen 'users' di Firestore.
-- Relasi: Many-to-1 ke `users`.
-- ----------------------------------------------------------------
CREATE TABLE public.addresses (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_primary boolean DEFAULT false,
  label text,
  recipient_name text,
  recipient_phone text,
  street text,
  city text,
  city_id text,
  province text,
  postal_code text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX idx_addresses_user_id ON public.addresses(user_id);

CREATE TRIGGER on_addresses_updated
  BEFORE UPDATE ON public.addresses
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

-- Kebijakan RLS (Row Level Security) untuk Users & Addresses
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

-- User bisa melihat profilnya sendiri.
CREATE POLICY "Users can view their own profile."
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- User bisa mengupdate profilnya sendiri.
CREATE POLICY "Users can update their own profile."
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- User bisa melihat alamatnya sendiri.
CREATE POLICY "Users can view their own addresses."
  ON public.addresses FOR SELECT
  USING (auth.uid() = user_id);

-- User bisa menambah, mengupdate, dan menghapus alamatnya sendiri.
CREATE POLICY "Users can manage their own addresses."
  ON public.addresses FOR ALL
  USING (auth.uid() = user_id);

-- Admin bisa melakukan apa saja (bypass RLS).
-- NOTE: Ini hanya contoh. Kebijakan admin yang lebih baik adalah
-- membuat fungsi `is_admin()` dan menggunakannya di sini.
-- Untuk saat ini, asumsikan service_role_key dipakai untuk operasi admin.

-- ----------------------------------------------------------------
-- 3. STORE_CONFIG
-- Keterangan: Tabel ini menggantikan dokumen tunggal `store_config/main`
-- di Firestore. Didesain sebagai "singleton table" yang hanya boleh
-- punya satu baris data untuk menampung semua konfigurasi toko dan
-- landing page.
-- ----------------------------------------------------------------
CREATE TABLE public.store_config (
  -- Kunci untuk memastikan hanya ada satu baris
  singleton_id boolean PRIMARY KEY DEFAULT true,
  
  -- Info Toko Dasar
  store_name text NOT NULL DEFAULT 'XAR Perfume',
  store_email text,
  currency text NOT NULL DEFAULT 'IDR',
  admin_locale text NOT NULL DEFAULT 'id',
  low_stock_threshold integer DEFAULT 10,
  store_city_id text,
  store_city_name text,
  
  -- Landing Page Sections (disimpan sebagai JSONB)
  hero jsonb,
  about jsonb,
  product jsonb,
  contact jsonb,
  footer jsonb,

  -- Konfigurasi Promo Banner
  promo_banner_enabled boolean DEFAULT false,
  promo_banner_text text,
  promo_discount_type text DEFAULT 'percentage', -- "percentage" | "fixed"
  promo_discount_value numeric DEFAULT 0,
  promo_start_date timestamptz,
  promo_end_date timestamptz,
  promo_code text,
  promo_destination text,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,

  -- Constraint untuk memastikan hanya ada satu baris
  CONSTRAINT singleton_row CHECK (singleton_id = true)
);

-- NOTE: Kunci sensitif seperti `midtransServerKey` dan `midtransClientKey`
-- TIDAK disimpan di sini. Sesuai implementasi yang ada, mereka harus
-- tetap berada di environment variables (.env.local) dan dikelola
-  secara aman.

CREATE TRIGGER on_store_config_updated
  BEFORE UPDATE ON public.store_config
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();
  
-- Kebijakan RLS untuk Store Config
ALTER TABLE public.store_config ENABLE ROW LEVEL SECURITY;

-- Siapa saja boleh membaca konfigurasi ini (untuk landing page).
-- API di backend akan bertanggung jawab untuk menyaring data sensitif.
CREATE POLICY "Allow public read access to store config"
  ON public.store_config FOR SELECT
  USING (true);

-- Hanya admin yang boleh mengupdate.
-- (Membutuhkan fungsi `is_admin()` atau diakses via service_role_key)
CREATE POLICY "Allow admin to update store config"
  ON public.store_config FOR UPDATE
  USING (
    -- Di sini idealnya ada cek `get_my_claim('role') = 'admin'`
    -- atau fungsi `is_admin()`
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Insert data default jika tabel kosong
INSERT INTO public.store_config (singleton_id) VALUES (true);

-- ----------------------------------------------------------------
-- 4. ORDERS & ORDER_ITEMS
-- Keterangan: Menggantikan collection 'orders' di Firestore.
-- Strukturnya dipecah menjadi dua tabel: `orders` untuk data utama
-- pesanan, dan `order_items` untuk detail item yang dibeli.
-- ----------------------------------------------------------------

-- Aktifkan ekstensi untuk generate UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabel utama untuk pesanan
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL, -- Bisa null jika pesanan guest
  
  -- Status & Keuangan
  status text NOT NULL DEFAULT 'pending',
  amount numeric NOT NULL,
  shipping_cost numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  payment_type text,
  
  -- Info Pelanggan & Pengiriman (Denormalized)
  customer_name text,
  customer_email text,
  customer_phone text,
  shipping_address jsonb, -- Menyimpan objek alamat lengkap
  shipping_detail jsonb, -- Menyimpan info kurir, layanan, dll.
  shipping_receipt_number text,

  -- Lain-lain
  notes text,
  status_history jsonb, -- Menyimpan array histori perubahan status
  stock_reserved_at timestamptz,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

-- Tabel untuk item dalam pesanan
CREATE TABLE public.order_items (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  -- products.id di Supabase kemungkinan besar adalah UUID, perlu disesuaikan
  product_id uuid NOT NULL, -- Asumsi `products.id` adalah UUID
  
  -- Detail Item (Denormalized dari produk)
  product_name text NOT NULL,
  variant_name text, -- e.g., "50ml"
  quantity integer NOT NULL,
  price numeric NOT NULL, -- Harga per item saat checkout

  created_at timestamptz DEFAULT now()
);

-- NOTE PENTING: LOGIC HYBRID & TRANSAKSIONAL
-- Implementasi di `api/orders/route.js` mengandung logic kompleks untuk
-- reservasi dan pengurangan stok yang melibatkan tabel `products` di Supabase
-- dan `orders` di Firestore. Saat migrasi, logic ini HARUS dipindahkan
-- ke dalam **Supabase Edge Function** atau **Stored Procedure (RPC)**
-- untuk memastikan atomicity (semua berhasil atau semua gagal).
--
-- Contoh alur di Edge Function:
-- 1. Terima request checkout.
-- 2. Mulai transaksi database.
-- 3. Reservasi/kurangi stok di tabel `products`.
-- 4. Buat record di tabel `orders` dan `order_items`.
-- 5. Commit transaksi. Jika ada error, rollback.

CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_product_id ON public.order_items(product_id);

CREATE TRIGGER on_orders_updated
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

-- Kebijakan RLS untuk Orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- User bisa melihat pesanannya sendiri.
CREATE POLICY "Users can view their own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

-- User bisa melihat item dalam pesanannya sendiri.
CREATE POLICY "Users can view items in their own orders"
  ON public.order_items FOR SELECT
  USING (
    (SELECT user_id FROM public.orders WHERE id = order_id) = auth.uid()
  );
  
-- Admin bisa mengakses semua pesanan.
CREATE POLICY "Admins can access all orders"
  ON public.orders FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Admin bisa mengakses semua item pesanan.
CREATE POLICY "Admins can access all order items"
  ON public.order_items FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- ----------------------------------------------------------------
-- 5. REVIEWS
-- Keterangan: Menggantikan collection 'reviews'.
-- ----------------------------------------------------------------
CREATE TABLE public.reviews (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL, -- Asumsi `products.id` adalah UUID
  
  -- Denormalized data
  user_name text,
  product_name text,

  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  
  approved boolean DEFAULT true,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX idx_reviews_product_id ON public.reviews(product_id);
CREATE INDEX idx_reviews_user_id ON public.reviews(user_id);

CREATE TRIGGER on_reviews_updated
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

-- ----------------------------------------------------------------
-- 6. RETURN_REQUESTS
-- Keterangan: Menggantikan collection 'return_requests'.
-- ----------------------------------------------------------------
CREATE TYPE public.return_status AS ENUM (
  'requested',
  'approved',
  'rejected',
  'refunded'
);

CREATE TABLE public.return_requests (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  
  reason text NOT NULL,
  notes text,
  status public.return_status DEFAULT 'requested',
  
  admin_note text,
  resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL, -- Admin who resolved it

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX idx_return_requests_user_id ON public.return_requests(user_id);
CREATE INDEX idx_return_requests_order_id ON public.return_requests(order_id);

CREATE TRIGGER on_return_requests_updated
  BEFORE UPDATE ON public.return_requests
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

-- ----------------------------------------------------------------
-- 7. NOTIFICATIONS
-- Keterangan: Menggantikan collection 'notifications'.
-- ----------------------------------------------------------------
CREATE TABLE public.notifications (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  audience text DEFAULT 'user'::text, -- 'user', 'admin', 'all'
  
  title text NOT NULL,
  message text NOT NULL,
  link text,
  type text DEFAULT 'info'::text, -- 'info', 'promo', 'order', etc.

  is_read boolean DEFAULT false,
  read_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);

CREATE TRIGGER on_notifications_updated
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();


-- Kebijakan RLS untuk Reviews, Returns, & Notifications
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Publik bisa melihat review yang sudah di-approve.
CREATE POLICY "Public can view approved reviews"
  ON public.reviews FOR SELECT
  USING (approved = true);
  
-- User bisa membuat review untuk pesanannya.
CREATE POLICY "Users can create reviews for their orders"
  ON public.reviews FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    (SELECT user_id FROM public.orders WHERE id = order_id) = auth.uid()
  );

-- User bisa melihat return request miliknya.
CREATE POLICY "Users can view their own return requests"
  ON public.return_requests FOR SELECT
  USING (auth.uid() = user_id);
  
-- User bisa membuat return request untuk pesanannya.
CREATE POLICY "Users can create return requests for their orders"
  ON public.return_requests FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    (SELECT user_id FROM public.orders WHERE id = order_id) = auth.uid()
  );

-- User bisa melihat notifikasi miliknya.
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (
    user_id = auth.uid() OR
    audience = 'all'
  );
  
-- User bisa mengupdate (menandai 'read') notifikasi miliknya.
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());


-- Admin bisa mengelola semua review, return request, dan notifikasi.
CREATE POLICY "Admins can manage all reviews"
  ON public.reviews FOR ALL
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

CREATE POLICY "Admins can manage all return requests"
  ON public.return_requests FOR ALL
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

CREATE POLICY "Admins can manage all notifications"
  ON public.notifications FOR ALL
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));
