-- =============================================================================
-- Migration: Client Internal Notes & Manual Score Adjustment
-- Safe to re-run (uses ADD COLUMN IF NOT EXISTS).
-- Execute this in your Supabase SQL Editor before deploying the code changes.
-- =============================================================================

-- 1. Internal owner-only note (never appears in contracts/invoices/PDFs)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS internal_note TEXT NULL;

-- 2. Manual score adjustment — a numeric offset applied on top of trust_score.
--    Stored as: target_displayed_score - current_trust_score
--    The effective displayed score = clamp(trust_score + manual_score_adjustment, 0, 100)
--    NULL means no adjustment; system trust_score is used directly.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS manual_score_adjustment NUMERIC NULL;
