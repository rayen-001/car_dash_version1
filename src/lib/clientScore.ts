/**
 * clientScore.ts — Shared helpers for client score display.
 *
 * Rules:
 *  - trust_score is the auto-calculated system score. Never overwritten by these helpers.
 *  - manual_score_adjustment is a numeric offset stored as:
 *      manual_score_adjustment = target_displayed_score - current_trust_score
 *  - effective_score = clamp(trust_score + manual_score_adjustment, 0, 100)
 *  - If manual_score_adjustment is null/undefined, effective_score = trust_score.
 *  - These helpers are used everywhere scores or risk levels are displayed,
 *    so that the same client always shows the same effective score.
 */

export type RiskLevel =
  | 'new_client'
  | 'very_low_risk'
  | 'low_risk'
  | 'medium_risk'
  | 'high_risk'
  | 'very_high_risk'
  | 'criminal'

export interface ClientScoreFields {
  trust_score?: number | null
  manual_score_adjustment?: number | null
}

/**
 * Returns the effective displayed score for a client.
 * - If manual_score_adjustment is set: clamp(trust_score + adjustment, 0, 100)
 * - Otherwise: trust_score (may be null for brand-new unrated clients)
 */
export function getEffectiveClientScore(client: ClientScoreFields): number | null {
  const base = client.trust_score ?? null
  const adj = client.manual_score_adjustment ?? null

  if (base === null && adj === null) return null
  if (adj === null) return base

  // If there is no base score yet but there is an adjustment, treat base as 0
  const safeBase = base ?? 0
  return Math.max(0, Math.min(100, safeBase + adj))
}

/**
 * Returns the risk level category string for a given effective score.
 * Pass the result of getEffectiveClientScore() here.
 */
export function getClientRiskLevelFromScore(score: number | null): RiskLevel {
  if (score === null) return 'new_client'
  if (score < 15) return 'criminal'
  if (score < 45) return 'very_high_risk'
  if (score < 60) return 'high_risk'
  if (score < 80) return 'medium_risk'
  if (score < 92) return 'low_risk'
  return 'very_low_risk'
}

/**
 * Convenience: given a client object, return both effective score and risk level.
 */
export function getClientScoreProfile(
  client: ClientScoreFields
): { score: number | null; riskLevel: RiskLevel } {
  const score = getEffectiveClientScore(client)
  const riskLevel = getClientRiskLevelFromScore(score)
  return { score, riskLevel }
}

/**
 * Given a user-entered target displayed score and the current system trust_score,
 * returns the adjustment value to store in manual_score_adjustment.
 *
 * If target is null/undefined/empty → returns null (clears adjustment).
 */
export function getManualScoreAdjustmentFromTarget(
  targetScore: number | null | undefined,
  currentTrustScore: number | null | undefined
): number | null {
  if (targetScore === null || targetScore === undefined) return null
  const base = currentTrustScore ?? 0
  // Clamp to ensure stored adjustment would produce a valid 0–100 display
  const clampedTarget = Math.max(0, Math.min(100, targetScore))
  return clampedTarget - base
}
