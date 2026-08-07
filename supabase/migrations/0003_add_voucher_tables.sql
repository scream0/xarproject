-- ============================================================
-- SCHEMA: VOUCHER SYSTEM (vouchers + user_vouchers)
-- Target: PostgreSQL / Supabase
-- Author: Generated for XAR Project
-- ============================================================
-- Struktur ini mendukung:
--   1. Master data voucher (dibuat admin)
--   2. Klaim voucher oleh user (1x klaim per user per voucher, opsional)
--   3. Tracking status: claimed -&gt; used -&gt; expired / cancelled
--   4. Validasi otomatis via trigger (batas usage, masa berlaku)
--   5. Row Level Security (RLS) untuk Supabase
-- ============================================================


-- ============================================================
-- 1. ENUM TYPES
-- ============================================================

DO $$ BEGIN
  CREATE TYPE voucher_discount_type AS ENUM ('percentage', 'fixed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE claimed_voucher_status AS ENUM ('claimed', 'used', 'expired', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- 2. TABEL: vouchers (master data voucher)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vouchers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  text NOT NULL UNIQUE,
  title                 text NOT NULL,
  description           text,

  discount_type         voucher_discount_type NOT NULL DEFAULT 'percentage',
  discount_value        numeric(12,2) NOT NULL CHECK (discount_value >= 0),
  max_discount_amount   numeric(12,2) CHECK (max_discount_amount IS NULL OR max_discount_amount >= 0),
  min_purchase_amount   numeric(12,2) NOT NULL DEFAULT 0 CHECK (min_purchase_amount >= 0),

  -- Batas kuota total voucher yang bisa diklaim (NULL = unlimited)
  claim_limit           integer CHECK (claim_limit IS NULL OR claim_limit >= 0),
  claim_count            integer NOT NULL DEFAULT 0 CHECK (claim_count >= 0),

  -- Batas klaim per user (default 1x per voucher)
  max_claim_per_user     integer NOT NULL DEFAULT 1 CHECK (max_claim_per_user >= 1),

  valid_from            timestamptz NOT NULL DEFAULT now(),
  valid_until            timestamptz,

  is_active             boolean NOT NULL DEFAULT true,
  publicly_visible      boolean NOT NULL DEFAULT false, -- Added for landing page display

  created_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT valid_period_check CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_vouchers_code ON public.vouchers (code);
CREATE INDEX IF NOT EXISTS idx_vouchers_active_period
  ON public.vouchers (is_active, valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_vouchers_public_visible
  ON public.vouchers (publicly_visible, is_active, valid_until);


-- ============================================================
-- 3. TABEL: user_vouchers (klaim voucher oleh user)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_vouchers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id      uuid NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  status          claimed_voucher_status NOT NULL DEFAULT 'claimed',

  -- Terisi saat voucher benar-benar dipakai di transaksi
  order_id        uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  discount_applied numeric(12,2) CHECK (discount_applied IS NULL OR discount_applied >= 0),

  claimed_at      timestamptz NOT NULL DEFAULT now(),
  used_at         timestamptz,
  expired_at      timestamptz,
  cancelled_at    timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Index penting untuk query dashboard user & admin
CREATE INDEX IF NOT EXISTS idx_user_vouchers_user ON public.user_vouchers (user_id);
CREATE INDEX IF NOT EXISTS idx_user_vouchers_voucher ON public.user_vouchers (voucher_id);
CREATE INDEX IF NOT EXISTS idx_user_vouchers_status ON public.user_vouchers (status);
CREATE INDEX IF NOT EXISTS idx_user_vouchers_user_status
  ON public.user_vouchers (user_id, status);


-- ============================================================
-- 4. TRIGGER: updated_at otomatis
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vouchers_updated_at ON public.vouchers;
CREATE TRIGGER trg_vouchers_updated_at
  BEFORE UPDATE ON public.vouchers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_user_vouchers_updated_at ON public.user_vouchers;
CREATE TRIGGER trg_user_vouchers_updated_at
  BEFORE UPDATE ON public.user_vouchers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 5. FUNCTION: validasi & proses klaim voucher (dipanggil dari API)
-- ============================================================
-- Menjamin atomicity: cek kuota, masa berlaku, & limit per user
-- dalam satu transaksi agar tidak terjadi race condition saat
-- banyak user klaim voucher bersamaan.
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_voucher(
  p_user_id uuid,
  p_voucher_code text
)
RETURNS public.user_vouchers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voucher     public.vouchers%ROWTYPE;
  v_claim_count integer;
  v_result      public.user_vouchers%ROWTYPE;
BEGIN
  -- Lock baris voucher untuk mencegah race condition kuota
  SELECT * INTO v_voucher
  FROM public.vouchers
  WHERE code = p_voucher_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voucher tidak ditemukan.' USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_voucher.is_active THEN
    RAISE EXCEPTION 'Voucher tidak aktif.' USING ERRCODE = 'P0002';
  END IF;

  IF now() < v_voucher.valid_from THEN
    RAISE EXCEPTION 'Voucher belum berlaku.' USING ERRCODE = 'P0003';
  END IF;

  IF v_voucher.valid_until IS NOT NULL AND now() > v_voucher.valid_until THEN
    RAISE EXCEPTION 'Voucher sudah kedaluwarsa.' USING ERRCODE = 'P0004';
  END IF;

  IF v_voucher.claim_limit IS NOT NULL AND v_voucher.claim_count >= v_voucher.claim_limit THEN
    RAISE EXCEPTION 'Kuota voucher sudah habis.' USING ERRCODE = 'P0005';
  END IF;

  SELECT count(*) INTO v_claim_count
  FROM public.user_vouchers
  WHERE voucher_id = v_voucher.id
    AND user_id = p_user_id
    AND status IN ('claimed', 'used');

  IF v_claim_count >= v_voucher.max_claim_per_user THEN
    RAISE EXCEPTION 'Anda sudah mengklaim voucher ini.' USING ERRCODE = 'P0006';
  END IF;

  INSERT INTO public.user_vouchers (voucher_id, user_id, status)
  VALUES (v_voucher.id, p_user_id, 'claimed')
  RETURNING * INTO v_result;

  UPDATE public.vouchers
  SET claim_count = claim_count + 1
  WHERE id = v_voucher.id;

  RETURN v_result;
END;
$$;


-- ============================================================
-- 6. FUNCTION: tandai voucher sebagai "used" saat order berhasil
-- ============================================================

CREATE OR REPLACE FUNCTION public.mark_voucher_used(
  p_claimed_voucher_id uuid,
  p_order_id uuid,
  p_discount_applied numeric
)
RETURNS public.user_vouchers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.user_vouchers%ROWTYPE;
BEGIN
  UPDATE public.user_vouchers
  SET status = 'used',
      order_id = p_order_id,
      discount_applied = p_discount_applied,
      used_at = now()
  WHERE id = p_claimed_voucher_id
    AND status = 'claimed'
  RETURNING * INTO v_result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voucher tidak dapat digunakan (sudah dipakai / tidak valid).' USING ERRCODE = 'P0007';
  END IF;

  RETURN v_result;
END;
$$;


-- ============================================================
-- 7. FUNCTION: auto-expire voucher yang sudah lewat masa berlaku
-- ============================================================
-- Jalankan via Supabase Cron / pg_cron secara berkala, contoh:
--   SELECT cron.schedule('expire-vouchers', '0 * * * *',
--     $$ SELECT public.expire_claimed_vouchers(); $$);
-- ============================================================

CREATE OR REPLACE FUNCTION public.expire_claimed_vouchers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.user_vouchers cv
  SET status = 'expired',
      expired_at = now()
  FROM public.vouchers v
  WHERE cv.voucher_id = v.id
    AND cv.status = 'claimed'
    AND v.valid_until IS NOT NULL
    AND v.valid_until < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ============================================================
-- 8. VIEW: ringkasan voucher untuk dashboard admin
-- ============================================================

CREATE OR REPLACE VIEW public.voucher_stats AS
SELECT
  v.id,
  v.code,
  v.title,
  v.is_active,
  v.claim_limit,
  v.claim_count,
  v.valid_from,
  v.valid_until,
  count(cv.id) FILTER (WHERE cv.status = 'claimed')   AS active_claims,
  count(cv.id) FILTER (WHERE cv.status = 'used')       AS total_used,
  count(cv.id) FILTER (WHERE cv.status = 'expired')     AS total_expired,
  count(cv.id) FILTER (WHERE cv.status = 'cancelled')   AS total_cancelled,
  coalesce(sum(cv.discount_applied) FILTER (WHERE cv.status = 'used'), 0) AS total_discount_given
FROM public.vouchers v
LEFT JOIN public.user_vouchers cv ON cv.voucher_id = v.id
GROUP BY v.id;


-- ============================================================
-- 9. ROW LEVEL SECURITY (RLS) — Supabase
-- ============================================================

ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_vouchers ENABLE ROW LEVEL SECURITY;

-- --- vouchers: semua orang boleh baca voucher aktif (public) ---
DROP POLICY IF EXISTS "vouchers_select_active_public" ON public.vouchers;
CREATE POLICY "vouchers_select_active_public"
  ON public.vouchers
  FOR SELECT
  USING (is_active = true AND publicly_visible = true AND (valid_until IS NULL OR valid_until > now()));

-- --- vouchers: admin full akses (kelola dari dashboard) ---
DROP POLICY IF EXISTS "vouchers_admin_all" ON public.vouchers;
CREATE POLICY "vouchers_admin_all"
  ON public.vouchers
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

-- --- user_vouchers: user hanya bisa lihat klaim miliknya sendiri ---
DROP POLICY IF EXISTS "user_vouchers_select_own" ON public.user_vouchers;
CREATE POLICY "user_vouchers_select_own"
  ON public.user_vouchers
  FOR SELECT
  USING (auth.uid() = user_id);

-- --- user_vouchers: admin bisa lihat & kelola semua klaim ---
DROP POLICY IF EXISTS "user_vouchers_admin_all" ON public.user_vouchers;
CREATE POLICY "user_vouchers_admin_all"
  ON public.user_vouchers
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
  )
);

-- Catatan: INSERT/UPDATE untuk claim & pemakaian voucher SEBAIKNYA
-- tidak lewat RLS langsung dari client, melainkan lewat function
-- claim_voucher() / mark_voucher_used() di atas (SECURITY DEFINER),
-- dipanggil dari API route server-side dengan service role key.
-- Ini mencegah user memanipulasi klaim/kuota langsung dari client.


-- ============================================================
-- 10. CONTOH PENGGUNAAN
-- ============================================================

-- Klaim voucher (dipanggil dari API route dengan service role):
--   SELECT * FROM public.claim_voucher('user-uuid-here', 'DISKON20');

-- Tandai voucher terpakai saat order sukses:
--   SELECT * FROM public.mark_voucher_used('claimed-voucher-uuid', 'order-uuid', 25000);

-- Lihat semua voucher yang diklaim seorang user (dipanggil dari client, aman via RLS):
--   SELECT cv.*, v.code, v.title, v.discount_type, v.discount_value
--   FROM public.user_vouchers cv
--   JOIN public.vouchers v ON v.id = cv.voucher_id
--   WHERE cv.user_id = auth.uid()
--   ORDER BY cv.claimed_at DESC;

-- Dashboard admin — statistik voucher:
--   SELECT * FROM public.voucher_stats ORDER BY claim_count DESC;