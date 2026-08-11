-- Enables delivery status and optional customer review photo.
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'shipped';
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS review_photo text;
