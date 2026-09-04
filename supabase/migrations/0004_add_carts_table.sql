-- ============================================================
-- SCHEMA: CARTS
-- Target: PostgreSQL / Supabase
-- Author: Gemini
-- ============================================================
-- This schema adds a table to store user shopping carts.
--
-- Features:
--   1. A single `carts` table with one row per user.
--   2. Cart items are stored in a `jsonb` column for flexibility.
--   3. RLS policies to ensure users can only access their own cart.
-- ============================================================


-- ============================================================
-- 1. TABLE: carts
-- ============================================================

CREATE TABLE IF NOT EXISTS public.carts (
  user_id         uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  items           jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carts_user_id ON public.carts (user_id);


-- ============================================================
-- 2. TRIGGER: updated_at automatically
-- ============================================================
-- We can reuse the existing function `handle_updated_at` if it was created in a prior migration.
-- If not, it should be created as in `0002_full_schema.sql`.

DROP TRIGGER IF EXISTS trg_carts_updated_at ON public.carts;
CREATE TRIGGER trg_carts_updated_at
  BEFORE UPDATE ON public.carts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ============================================================
-- 3. ROW LEVEL SECURITY (RLS) — Supabase
-- ============================================================

ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

-- --- carts: Users can manage their own cart ---
DROP POLICY IF EXISTS "carts_manage_own" ON public.carts;
CREATE POLICY "carts_manage_own"
  ON public.carts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- --- carts: Admins have full access ---
DROP POLICY IF EXISTS "carts_admin_all" ON public.carts;
CREATE POLICY "carts_admin_all"
  ON public.carts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ============================================================
-- 4. USAGE FROM API
-- ============================================================
--
-- -- To get a user's cart (from a client-side Supabase query or server-side API):
--   SELECT items FROM public.carts WHERE user_id = 'the-user-uuid';
--
-- -- To update/insert a user's cart (UPSERT):
--   INSERT INTO public.carts (user_id, items)
--   VALUES ('the-user-uuid', '[{"productId": "abc", "quantity": 2}]'::jsonb)
--   ON CONFLICT (user_id)
--   DO UPDATE SET
--     items = EXCLUDED.items,
--     updated_at = now();
--
-- ============================================================