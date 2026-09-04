-- Migration to add status column to profiles table
-- This allows admins to block or activate users

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
