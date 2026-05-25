export interface ScoringBooking {
  id: string
  status: string | null
  start_date: string | null
  end_date: string | null
  actual_return_date?: string | null
  total_amount: number | string | null
  acompte_paid: number | string | null
  client_behavior_status?: string | null
  installments?: Array<{
    id: string
    amount: number | string | null
    due_date: string | null
    status: string | null
    paid_date?: string | null
  }> | null
}

export interface TrustScoreResult {
  trustScore: number | null
  returnHygiene: number
  paymentHygiene: number
  behaviorPenalty: number
  loyaltyBonus: number
  hasCriminalOverride: boolean
  completedBookingsCount: number
  totalContractValue: number
  totalOverdueUnpaid: number
}

// Helper to get day difference between two YYYY-MM-DD strings safely
export function getDaysDiff(d1Str: string | null | undefined, d2Str: string | null | undefined): number {
  if (!d1Str || !d2Str) return 0
  try {
    const parts1 = d1Str.split('T')[0].split('-')
    const parts2 = d2Str.split('T')[0].split('-')
    if (parts1.length < 3 || parts2.length < 3) return 0
    
    const d1 = new Date(Number(parts1[0]), Number(parts1[1]) - 1, Number(parts1[2]))
    const d2 = new Date(Number(parts2[0]), Number(parts2[1]) - 1, Number(parts2[2]))
    
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0
    const diffTime = d2.getTime() - d1.getTime()
    return Math.round(diffTime / (1000 * 60 * 60 * 24))
  } catch {
    return 0
  }
}

/**
 * Single canonical implementation of the Client Trust Score Engine
 */
export function calculateTrustScore(bookings: ScoringBooking[], todayStr: string): TrustScoreResult {
  // Filter out cancelled bookings
  const activeScoringBookings = bookings.filter(b => b.status !== 'cancelled')

  if (activeScoringBookings.length === 0) {
    return {
      trustScore: null,
      returnHygiene: 100,
      paymentHygiene: 100,
      behaviorPenalty: 0,
      loyaltyBonus: 0,
      hasCriminalOverride: false,
      completedBookingsCount: 0,
      totalContractValue: 0,
      totalOverdueUnpaid: 0
    }
  }

  let returnHygiene = 100
  let totalContractValue = 0
  let totalOverdueUnpaid = 0
  let hasCriminalOverride = false
  let behaviorPenalty = 0

  // Count completed bookings for loyalty bonus calculation
  const completedBookingsCount = activeScoringBookings.filter(b => b.status === 'completed').length
  const loyaltyBonus = Math.min(20, completedBookingsCount * 2.5)

  activeScoringBookings.forEach((b) => {
    const isCompleted = b.status === 'completed'
    const scheduledEnd = b.end_date
    const totalAmt = Number(b.total_amount) || 0
    const paidAmt = Number(b.acompte_paid) || 0
    const balance = totalAmt - paidAmt
    const installments = b.installments || []
    const hasInstallments = Array.isArray(installments) && installments.length > 0

    // Exclude pending bookings completely from score calculations
    if (b.status === 'pending') {
      return
    }

    // Accumulate total contract values
    totalContractValue += totalAmt

    // Calculate overdue unpaid amount for this booking
    if (hasInstallments) {
      installments.forEach((inst: any) => {
        const amt = Number(inst.amount) || 0
        if (inst.status === 'unpaid') {
          if (getDaysDiff(inst.due_date, todayStr) > 0) {
            // Overdue unpaid installment
            totalOverdueUnpaid += amt
          }
        }
      })
    } else {
      // Legacy bookings: overdue if confirmed and todayStr > scheduledEnd, or if completed
      const isConfirmed = b.status === 'confirmed'
      const isOverdue = isConfirmed && (getDaysDiff(scheduledEnd, todayStr) > 0)
      if ((isCompleted || isOverdue) && balance > 0) {
        totalOverdueUnpaid += balance
      }
    }

    // Evaluate return hygiene and overrides
    if (isCompleted) {
      const actualEnd = b.actual_return_date || scheduledEnd
      const lateDays = getDaysDiff(scheduledEnd, actualEnd)
      if (lateDays > 0) {
        returnHygiene -= Math.min(75, 4 * Math.pow(lateDays, 1.3))
      }
    } else if (b.status === 'confirmed') {
      // Ongoing Overdue booking (since todayStr > scheduledEnd)
      const overdueDays = getDaysDiff(scheduledEnd, todayStr)
      if (overdueDays > 0) {
        let hasUnpaidDebt = false
        if (hasInstallments) {
          hasUnpaidDebt = installments.some(
            (inst: any) => inst.status === 'unpaid' && getDaysDiff(inst.due_date, todayStr) > 0
          )
        } else {
          hasUnpaidDebt = balance > 0
        }

        if (overdueDays >= 5 && hasUnpaidDebt) {
          hasCriminalOverride = true
        } else {
          returnHygiene -= overdueDays * 8
        }
      }
    }

    // Apply Client Behavior Status penalties with linear time-decay (90-day window)
    if (b.client_behavior_status && typeof b.client_behavior_status === 'string') {
      const infractions = b.client_behavior_status.split(',').map((s: string) => s.trim()).filter(Boolean);
      
      infractions.forEach((infraction: string) => {
        let baseInfraction = 0
        let isPermanent = false

        if (infraction === 'dirty_return') {
          baseInfraction = 5
        } else if (infraction === 'speeding') {
          baseInfraction = 15
        } else if (infraction === 'minor_damage') {
          baseInfraction = 25
        } else if (infraction === 'major_damage') {
          baseInfraction = 100
          isPermanent = true
          hasCriminalOverride = true
        }

        if (baseInfraction > 0) {
          if (isPermanent) {
            behaviorPenalty += baseInfraction
          } else {
            const infractionDate = b.actual_return_date || b.end_date || todayStr
            const daysSince = Math.max(0, getDaysDiff(infractionDate, todayStr))
            const decayFactor = Math.max(0, 1 - daysSince / 90)
            behaviorPenalty += baseInfraction * decayFactor
          }
        }
      });
    }
  })

  // Clamp returnHygiene
  returnHygiene = Math.max(0, Math.min(100, returnHygiene))

  // Payment hygiene calculation
  const overdueDebtRatio = totalContractValue > 0 ? (totalOverdueUnpaid / totalContractValue) : 0
  const paymentHygiene = 100 - Math.min(100, overdueDebtRatio * 120)

  // Combine scores with new dynamic weights (40% return, 40% payment, plus loyalty)
  let trustScore = (0.40 * returnHygiene) + (0.40 * paymentHygiene) - behaviorPenalty + loyaltyBonus

  // Apply criminal override
  if (hasCriminalOverride) {
    trustScore = 0
  }

  // Round to 1 decimal place and clamp between 0 and 100
  trustScore = Math.max(0, Math.min(100, Math.round(trustScore * 10) / 10))

  return {
    trustScore,
    returnHygiene,
    paymentHygiene,
    behaviorPenalty,
    loyaltyBonus,
    hasCriminalOverride,
    completedBookingsCount,
    totalContractValue,
    totalOverdueUnpaid
  }
}
