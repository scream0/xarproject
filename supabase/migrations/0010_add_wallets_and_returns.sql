-- 1. Tambahkan kolom Rekening Bank ke tabel Profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS bank_name text,
ADD COLUMN IF NOT EXISTS bank_account_number text,
ADD COLUMN IF NOT EXISTS bank_account_name text;

-- 2. Buat tabel Wallets
CREATE TABLE IF NOT EXISTS public.wallets (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger untuk updated_at pada wallets
CREATE TRIGGER trg_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

-- 3. Buat tabel Wallet Transactions
CREATE TYPE public.wallet_transaction_type AS ENUM ('refund', 'withdrawal');
CREATE TYPE public.wallet_transaction_status AS ENUM ('pending', 'completed', 'failed', 'rejected');

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(user_id) ON DELETE CASCADE,
  type public.wallet_transaction_type NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  status public.wallet_transaction_status NOT NULL DEFAULT 'pending',
  reference_id text, -- ID Order (untuk refund)
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallet_transactions_wallet_id ON public.wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_transactions_status ON public.wallet_transactions(status);

-- Trigger untuk updated_at pada wallet_transactions
CREATE TRIGGER trg_wallet_transactions_updated_at
  BEFORE UPDATE ON public.wallet_transactions
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

-- 4. Set up Row Level Security (RLS)
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Policies untuk Wallets
CREATE POLICY "Users can view their own wallet" ON public.wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can access all wallets" ON public.wallets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()::text AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- Policies untuk Wallet Transactions
CREATE POLICY "Users can view their own wallet transactions" ON public.wallet_transactions
  FOR SELECT USING (auth.uid() = wallet_id);

CREATE POLICY "Users can create withdrawal requests" ON public.wallet_transactions
  FOR INSERT WITH CHECK (
    auth.uid() = wallet_id AND type = 'withdrawal'
  );

CREATE POLICY "Admins can manage all wallet transactions" ON public.wallet_transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()::text AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- Function untuk Auto-create Wallet saat User Baru terdaftar
CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_wallet
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_wallet();

-- Backfill: Buat wallet untuk user yang sudah ada
INSERT INTO public.wallets (user_id, balance)
SELECT id, 0 FROM public.users
ON CONFLICT (user_id) DO NOTHING;
