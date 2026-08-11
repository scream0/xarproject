-- Idempotent production reconciliation for the legacy remote schema.
-- Keeps auth.users, public.profiles and public.users aligned, then normalizes
-- the existing JSON order items without deleting the legacy JSON source.

INSERT INTO public.profiles (id, email, full_name, phone, role, created_at, updated_at)
SELECT
  a.id::text,
  a.email,
  COALESCE(a.raw_user_meta_data ->> 'full_name', a.raw_user_meta_data ->> 'name', split_part(COALESCE(a.email, ''), '@', 1)),
  a.phone,
  'customer',
  COALESCE(a.created_at, now()),
  COALESCE(a.updated_at, now())
FROM auth.users a
ON CONFLICT (id) DO UPDATE
SET email = COALESCE(EXCLUDED.email, public.profiles.email),
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
    phone = COALESCE(NULLIF(public.profiles.phone, ''), EXCLUDED.phone),
    updated_at = now();

INSERT INTO public.users (id, role, created_at, updated_at)
SELECT
  a.id,
  COALESCE(NULLIF(p.role, ''), 'customer'),
  COALESCE(a.created_at, now()),
  COALESCE(a.updated_at, now())
FROM auth.users a
JOIN public.profiles p ON p.id = a.id::text
ON CONFLICT (id) DO UPDATE
SET role = EXCLUDED.role,
    updated_at = now();

INSERT INTO public.order_items (order_id, product_id, product_name, variant_name, quantity, price)
SELECT
  o.id,
  p.id,
  COALESCE(NULLIF(item.value ->> 'name', ''), p.name),
  NULLIF(COALESCE(item.value ->> 'size', item.value ->> 'variantName'), ''),
  GREATEST(1, COALESCE(NULLIF(item.value ->> 'quantity', '')::integer, 1)),
  GREATEST(0, COALESCE(NULLIF(item.value ->> 'price', '')::numeric, 0))
FROM public.orders o
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) AS item(value)
JOIN public.products p ON p.id = COALESCE(item.value ->> 'productId', item.value ->> 'id')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.order_items existing
  WHERE existing.order_id = o.id
    AND existing.product_id = p.id
    AND existing.variant_name IS NOT DISTINCT FROM NULLIF(COALESCE(item.value ->> 'size', item.value ->> 'variantName'), '')
);

CREATE INDEX IF NOT EXISTS idx_orders_user_created_at ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON public.orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created_at ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_products_status_created_at ON public.products(status, created_at DESC);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own user record" ON public.users;
CREATE POLICY "Users can view their own user record" ON public.users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;
CREATE POLICY "Users can view their own order items" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Admins can access all order items" ON public.order_items;
CREATE POLICY "Admins can access all order items" ON public.order_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'superadmin')
    )
  );
