-- ============================================================
-- MIGRATION: 0009_atomic_stock_decrement.sql
-- Target: PostgreSQL / Supabase
-- Author: Gemini
-- ============================================================
-- This migration creates a stored procedure (RPC) to handle
-- stock decrements atomically. This fixes a race condition where
-- two concurrent requests could both read the same stock level
-- and decrement it, leading to overselling.
--
-- The function `decrement_stock` takes an array of order items
-- and updates the `stock` field within the `variants` JSONB
-- column of the `products` table for each item.
-- ============================================================

CREATE OR REPLACE FUNCTION public.decrement_stock(items_to_decrement jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    item_record RECORD;
    product_variants jsonb;
    updated_variants jsonb;
    variant_record jsonb;
    found_variant boolean;
BEGIN
    -- Loop through each item in the input JSON array
    FOR item_record IN SELECT * FROM jsonb_to_recordset(items_to_decrement) AS x(product_id uuid, variant_name text, quantity int)
    LOOP
        -- Lock the product row for the duration of this transaction
        -- to ensure the read-modify-write operation is atomic.
        SELECT variants INTO product_variants FROM public.products WHERE id = item_record.product_id FOR UPDATE;

        IF NOT FOUND THEN
            -- If product not found, just skip it.
            CONTINUE;
        END IF;

        updated_variants := '[]'::jsonb;
        found_variant := false;

        -- Loop through the variants of the locked product
        FOR variant_record IN SELECT * FROM jsonb_array_elements(product_variants)
        LOOP
            -- If this is the variant we need to update
            IF variant_record->>'size' = item_record.variant_name THEN
                found_variant := true;
                -- Decrement the stock, ensuring it doesn't go below zero.
                variant_record := jsonb_set(
                    variant_record,
                    '{stock}',
                    to_jsonb(GREATEST(0, (variant_record->>'stock')::int - item_record.quantity))
                );
            END IF;
            -- Add the (potentially modified) variant to our new array
            updated_variants := updated_variants || variant_record;
        END LOOP;

        -- If the specific variant was found and updated, update the product row
        IF found_variant THEN
            UPDATE public.products
            SET variants = updated_variants
            WHERE id = item_record.product_id;
        END IF;

    END LOOP;
END;
$$;
