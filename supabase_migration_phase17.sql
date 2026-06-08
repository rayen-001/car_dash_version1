-- =========================================================================
-- PHASE 17 MIGRATION: Vehicle Soft-Withdrawal & Insurance Start Date
-- Run this in: Supabase Dashboard → SQL Editor
-- =========================================================================

-- Add insurance start date and soft-withdrawal timestamp to vehicles table.
-- withdrawn_at IS NULL  → active vehicle (appears in active fleet)
-- withdrawn_at IS NOT NULL → retired vehicle (hidden from active fleet, all data preserved)
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS insurance_start_date DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS withdrawn_at DATE DEFAULT NULL;
