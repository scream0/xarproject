-- Migration: Create chats table for user-admin messaging

CREATE TABLE IF NOT EXISTS public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message text NOT NULL DEFAULT '',
  image_url text,
  sender_role text NOT NULL DEFAULT 'user' CHECK (sender_role IN ('user', 'admin')),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast queries per user
CREATE INDEX IF NOT EXISTS chats_user_id_idx ON public.chats (user_id);
CREATE INDEX IF NOT EXISTS chats_created_at_idx ON public.chats (created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- Users can read their own messages
CREATE POLICY "Users can read own chats"
  ON public.chats FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own messages (sender_role must be 'user')
CREATE POLICY "Users can send messages"
  ON public.chats FOR INSERT
  WITH CHECK (auth.uid() = user_id AND sender_role = 'user');

-- Service role (Go backend) can do anything - bypass RLS via service key
-- The Go API uses the service role key, which bypasses RLS automatically

-- Enable Realtime for the chats table (run this if not already enabled)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
