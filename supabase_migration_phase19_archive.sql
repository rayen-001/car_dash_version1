-- =========================================================================
-- PHASE 19 MIGRATION: Vehicle Archive / Vault Status Filter
-- Run this in: Supabase Dashboard → SQL Editor
-- =========================================================================

-- Add archived_at timestamp to vehicles table.
-- archived_at IS NULL      → not archived (can be active or retired)
-- archived_at IS NOT NULL  → archived / vault (hidden from active & retired list, all data preserved)
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS archived_at DATE DEFAULT NULL;
