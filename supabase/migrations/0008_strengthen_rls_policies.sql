-- ============================================================
-- MIGRATION: 0008_strengthen_rls_policies.sql
-- Target: PostgreSQL / Supabase
-- Author: Gemini
-- ============================================================
-- This migration strengthens the Row Level Security (RLS)
-- policies for the `orders` table to provide more granular
-- control for user actions.
--
-- Changes:
--   1. Add a policy to allow users to create orders for themselves.
--   2. Add a policy to allow users to update (cancel) their
--      own orders, but only if the order is in a cancellable
--      status ('pending' or 'paid').
-- ============================================================

-- Allow users to create orders for themselves.
CREATE POLICY "Users can create their own orders."
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Allow users to update their own orders to cancel them,
-- but only if the status is 'pending' or 'paid'.
CREATE POLICY "Users can cancel their own pending orders."
  ON public.orders FOR UPDATE
  USING (
    auth.uid()::text = user_id AND status IN ('pending', 'paid')
  )
  WITH CHECK (
    auth.uid()::text = user_id AND status = 'cancelled'
  );

-- We also need to modify the existing admin policy to allow admins to
-- do everything, and not be restricted by the new user-specific policies.
-- The existing policy is "Admins can access all orders".
-- Let's drop it and re-create it with a more permissive definition.

DROP POLICY IF EXISTS "Admins can access all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can access all orders." ON public.orders;

CREATE POLICY "Admins can manage all orders"
  ON public.orders FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));
