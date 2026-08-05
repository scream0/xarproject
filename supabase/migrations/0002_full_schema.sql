-- Full Schema for XAR Project Migration from Firebase to Supabase
-- Version 2: Combines initial schema with inferred schemas and corrections.

-- ----------------------------------------------------------------
-- 0. SETUP & EXTENSIONS
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------
-- 1. ENUM TYPES
-- ----------------------------------------------------------------
CREATE TYPE public.order_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'cancelled',
  'settlement',
  'success'
);

CREATE TYPE public.return_status AS ENUM (
  'requested',
  'approved',
  'rejected',
  'refunded'
);

CREATE TYPE public.notification_type AS ENUM (
  'info',
  'promo',
  'order',
  'payment',
  'system'
);

-- ----------------------------------------------------------------
-- 2. USERS & ADDRESSES
-- ----------------------------------------------------------------
CREATE TABLE public.users (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'customer'::text,
  total_spent numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

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

-- ----------------------------------------------------------------
-- 3. PRODUCTS
-- ----------------------------------------------------------------
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text DEFAULT 'Parfum',
  description text,
  image_url text,
  image_public_id text,
  variants jsonb,
  weight numeric DEFAULT 250,
  length numeric,
  width numeric,
  height numeric,
  status text DEFAULT 'published',
  province text,
  city text,
  cityId text,
  stockLocation text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

-- ----------------------------------------------------------------
-- 4. STORE_CONFIG
-- ----------------------------------------------------------------
CREATE TABLE public.store_config (
  singleton_id boolean PRIMARY KEY DEFAULT true,
  store_name text NOT NULL DEFAULT 'XAR Perfume',
  store_email text,
  currency text NOT NULL DEFAULT 'IDR',
  admin_locale text NOT NULL DEFAULT 'id',
  low_stock_threshold integer DEFAULT 10,
  store_city_id text,
  store_city_name text,
  hero jsonb,
  about jsonb,
  product jsonb,
  contact jsonb,
  footer jsonb,
  promo_banner_enabled boolean DEFAULT false,
  promo_banner_text text,
  promo_discount_type text DEFAULT 'percentage',
  promo_discount_value numeric DEFAULT 0,
  promo_start_date timestamptz,
  promo_end_date timestamptz,
  promo_code text,
  promo_destination text,
  automation_rules jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  CONSTRAINT singleton_row CHECK (singleton_id = true)
);

-- ----------------------------------------------------------------
-- 5. ORDERS & ORDER_ITEMS
-- ----------------------------------------------------------------
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status public.order_status NOT NULL DEFAULT 'pending',
  amount numeric NOT NULL,
  shipping_cost numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  payment_type text,
  customer_name text,
  customer_email text,
  customer_phone text,
  shipping_address jsonb,
  shipping_detail jsonb,
  shipping_receipt_number text,
  notes text,
  status_history jsonb,
  stock_reserved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE public.order_items (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  variant_name text,
  quantity integer NOT NULL,
  price numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------
-- 6. REVIEWS
-- ----------------------------------------------------------------
CREATE TABLE public.reviews (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_name text,
  product_name text,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  approved boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

-- ----------------------------------------------------------------
-- 7. RETURN_REQUESTS
-- ----------------------------------------------------------------
CREATE TABLE public.return_requests (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  reason text NOT NULL,
  notes text,
  status public.return_status DEFAULT 'requested',
  admin_note text,
  resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

-- ----------------------------------------------------------------
-- 8. NOTIFICATIONS
-- ----------------------------------------------------------------
CREATE TABLE public.notifications (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  audience text DEFAULT 'user'::text,
  title text NOT NULL,
  message text NOT NULL,
  link text,
  type public.notification_type DEFAULT 'info'::text,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

-- ----------------------------------------------------------------
-- 9. TRIGGERS & INDEXES
-- ----------------------------------------------------------------
-- Auto-update `updated_at` function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Assign trigger to all tables
CREATE TRIGGER on_users_updated BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER on_addresses_updated BEFORE UPDATE ON public.addresses FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER on_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER on_store_config_updated BEFORE UPDATE ON public.store_config FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER on_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER on_reviews_updated BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER on_return_requests_updated BEFORE UPDATE ON public.return_requests FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER on_notifications_updated BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Indexes for frequently queried columns
CREATE INDEX idx_addresses_user_id ON public.addresses(user_id);
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX idx_reviews_product_id ON public.reviews(product_id);
CREATE INDEX idx_reviews_user_id ON public.reviews(user_id);
CREATE INDEX idx_return_requests_user_id ON public.return_requests(user_id);
CREATE INDEX idx_return_requests_order_id ON public.return_requests(order_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_audience ON public.notifications(audience);
CREATE INDEX idx_products_status ON public.products(status);

-- ----------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------
-- Enable RLS for all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies for `users` & `addresses`
CREATE POLICY "Users can view their own profile." ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile." ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can view their own addresses." ON public.addresses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own addresses." ON public.addresses FOR ALL USING (auth.uid() = user_id);

-- Policies for `products`
CREATE POLICY "Public can view published products." ON public.products FOR SELECT USING (status = 'published');
CREATE POLICY "Admins can manage all products." ON public.products FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

-- Policies for `store_config`
CREATE POLICY "Allow public read access to store config." ON public.store_config FOR SELECT USING (true);
CREATE POLICY "Allow admin to update store config." ON public.store_config FOR UPDATE USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

-- Policies for `orders` & `order_items`
CREATE POLICY "Users can view their own orders." ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view items in their own orders." ON public.order_items FOR SELECT USING ((SELECT user_id FROM public.orders WHERE id = order_id) = auth.uid());
CREATE POLICY "Admins can access all orders." ON public.orders FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));
CREATE POLICY "Admins can access all order items." ON public.order_items FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

-- Policies for `reviews`
CREATE POLICY "Public can view approved reviews." ON public.reviews FOR SELECT USING (approved = true);
CREATE POLICY "Users can create reviews for their orders." ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id AND (SELECT user_id FROM public.orders WHERE id = order_id) = auth.uid());
CREATE POLICY "Admins can manage all reviews." ON public.reviews FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

-- Policies for `return_requests`
CREATE POLICY "Users can view their own return requests." ON public.return_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create return requests for their orders." ON public.return_requests FOR INSERT WITH CHECK (auth.uid() = user_id AND (SELECT user_id FROM public.orders WHERE id = order_id) = auth.uid());
CREATE POLICY "Admins can manage all return requests." ON public.return_requests FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

-- Policies for `notifications`
CREATE POLICY "Users can view their own notifications." ON public.notifications FOR SELECT USING (user_id = auth.uid() OR audience = 'all');
CREATE POLICY "Users can update their own notifications." ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admins can manage all notifications." ON public.notifications FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

-- ----------------------------------------------------------------
-- 11. DEFAULT DATA
-- ----------------------------------------------------------------
-- Insert default store config if it doesn't exist
INSERT INTO public.store_config (singleton_id) VALUES (true) ON CONFLICT (singleton_id) DO NOTHING;
