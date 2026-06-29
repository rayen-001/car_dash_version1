-- =========================================================================
-- MIGRATION: Maintenance & Syncing
-- Run this in: Supabase Dashboard → SQL Editor
-- =========================================================================

-- 1. Add maintenance_id column to expenses table if it does not exist
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS maintenance_id UUID REFERENCES public.maintenance(id) ON DELETE CASCADE;

-- 2. Add unique index on maintenance_id (ignoring NULLs) if it does not exist
CREATE UNIQUE INDEX IF NOT EXISTS unique_maintenance_expense 
ON public.expenses (maintenance_id) 
WHERE maintenance_id IS NOT NULL;
