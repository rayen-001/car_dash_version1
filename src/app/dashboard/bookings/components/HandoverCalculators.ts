export function formatFuelFraction(fuelLevel: number | null | undefined): string {
  if (fuelLevel === null || fuelLevel === undefined) return 'N/A'
  if (fuelLevel === 0) return 'Empty'
  if (fuelLevel === 2) return '1/4 Tank'
  if (fuelLevel === 4) return '1/2 Tank'
  if (fuelLevel === 6) return '3/4 Tank'
  if (fuelLevel === 8) return 'Full'
  return `${fuelLevel}/8 Tank`
}

export function calculateFuelDelta(pickupFuel: number | null | undefined, returnFuel: number | null | undefined): { delta: number, text: string, color: string } | null {
  if (pickupFuel === null || pickupFuel === undefined || returnFuel === null || returnFuel === undefined) return null

  const delta = returnFuel - pickupFuel
  if (delta === 0) return { delta: 0, text: 'No Change', color: '#94A3B8' }
  
  // Format as e.g. "-1/4 Tank" or "+1/2 Tank"
  let formattedDelta = ''
  const absDelta = Math.abs(delta)
  
  if (absDelta === 8) formattedDelta = 'Full Tank'
  else if (absDelta === 6) formattedDelta = '3/4 Tank'
  else if (absDelta === 4) formattedDelta = '1/2 Tank'
  else if (absDelta === 2) formattedDelta = '1/4 Tank'
  else formattedDelta = `${absDelta}/8 Tank`

  if (delta > 0) {
    return { delta, text: `+${formattedDelta}`, color: '#10B981' } // Emerald green
  } else {
    return { delta, text: `-${formattedDelta}`, color: '#ef4444' } // Crimson red
  }
}

export function calculateDrivenMileage(pickupKm: number | null | undefined, returnKm: number | null | undefined): number | null {
  if (pickupKm === null || pickupKm === undefined || returnKm === null || returnKm === undefined) return null
  return Math.max(0, returnKm - pickupKm)
}
