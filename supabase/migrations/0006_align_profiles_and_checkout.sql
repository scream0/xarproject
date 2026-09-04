-- Canonical application profile and checkout contract.
-- `profiles` is the application-facing extension of auth.users; `users` is
-- retained for the original foreign keys and kept in sync by the trigger.

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'customer',
  total_spent numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'customer',
  email text,
  username text,
  full_name text,
  phone text,
  gender text,
  birth_date date,
  photo_url text,
  photo_public_id text,
  newsletter_opt_in boolean NOT NULL DEFAULT true,
  newsletter_subscribed boolean NOT NULL DEFAULT true,
  points integer NOT NULL DEFAULT 0,
  balance numeric NOT NULL DEFAULT 0,
  addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'paid';
    ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'delivered';
  END IF;
END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number text,
  ADD COLUMN IF NOT EXISTS total_amount numeric,
  ADD COLUMN IF NOT EXISTS snap_token text;

-- The remote legacy schema uses text order IDs, so new detail rows retain
-- that type instead of imposing an incompatible UUID foreign key.
CREATE TABLE IF NOT EXISTS public.order_items (
  id bigserial PRIMARY KEY,
  order_id text NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  variant_name text,
  quantity integer NOT NULL CHECK (quantity > 0),
  price numeric NOT NULL CHECK (price >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number
  ON public.orders(order_number) WHERE order_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, role, full_name, phone, photo_url)
  VALUES (
    NEW.id,
    'customer',
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.phone,
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

INSERT INTO public.profiles (id, role, created_at, updated_at)
SELECT id, role, created_at, COALESCE(updated_at, created_at)
FROM public.users
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, role, created_at, updated_at)
SELECT a.id, COALESCE(NULLIF(p.role, ''), 'customer'), COALESCE(p.created_at, now()), p.updated_at
FROM public.profiles p
JOIN auth.users a ON a.id::text = p.id
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

CREATE TRIGGER on_profiles_updated
  BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid()::text = id);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid()::text = id);
CREATE POLICY "Admins can access all profiles" ON public.profiles
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'superadmin')));
