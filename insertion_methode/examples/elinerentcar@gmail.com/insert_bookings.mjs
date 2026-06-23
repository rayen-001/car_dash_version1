import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'
const uuidv4 = () => crypto.randomUUID()

// 1. Load environment variables from .env.local
const envFile = fs.readFileSync('.env.local', 'utf-8')
const env = {}
for (const line of envFile.split('\n')) {
  const parts = line.split('=')
  if (parts.length >= 2) {
    const key = parts[0].trim()
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '')
    env[key] = val
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env.local")
  process.exit(1)
}

const sb = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const OWNER_ID = 'ffce4379-9630-4c82-8a21-e9445c1f977d' // elinerentcar@gmail.com
const TODAY_STR = '2026-06-18'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const csvPath = path.join(__dirname, '..', '..', '..', 'reservations_cleaned_to_import (4).csv')

// Enable dry run by default unless explicitly confirmed
const DRY_RUN = process.env.CONFIRM_REAL_INSERT !== 'true'

// Trust score calculation logic aligned with trustScore.ts
function getDaysDiff(d1Str, d2Str) {
  if (!d1Str || !d2Str) return 0;
  try {
    const parts1 = d1Str.split('T')[0].split('-');
    const parts2 = d2Str.split('T')[0].split('-');
    if (parts1.length < 3 || parts2.length < 3) return 0;
    
    const d1 = new Date(Number(parts1[0]), Number(parts1[1]) - 1, Number(parts1[2]));
    const d2 = new Date(Number(parts2[0]), Number(parts2[1]) - 1, Number(parts2[2]));
    
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
    const diffTime = d2.getTime() - d1.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

function calculateTrustScore(bookings, todayStr) {
  const activeScoringBookings = bookings.filter(b => b.status !== 'cancelled');

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
    };
  }

  let returnHygiene = 100;
  let totalContractValue = 0;
  let totalOverdueUnpaid = 0;
  let hasCriminalOverride = false;
  let behaviorPenalty = 0;

  const completedBookingsCount = activeScoringBookings.filter(b => b.status === 'completed').length;
  const loyaltyBonus = Math.min(20, completedBookingsCount * 2.5);

  activeScoringBookings.forEach((b) => {
    const isCompleted = b.status === 'completed';
    const scheduledEnd = b.end_date;
    const totalAmt = Number(b.total_amount) || 0;
    const paidAmt = Number(b.acompte_paid) || 0;
    const balance = totalAmt - paidAmt;
    const installments = b.installments || [];
    const hasInstallments = Array.isArray(installments) && installments.length > 0;

    if (b.status === 'pending') {
      return;
    }

    totalContractValue += totalAmt;

    if (hasInstallments) {
      installments.forEach((inst) => {
        const amt = Number(inst.amount) || 0;
        if (inst.status === 'unpaid') {
          if (getDaysDiff(inst.due_date, todayStr) > 0) {
            totalOverdueUnpaid += amt;
          }
        }
      });
    } else {
      const isConfirmed = b.status === 'confirmed';
      const isOverdue = isConfirmed && (getDaysDiff(scheduledEnd, todayStr) > 0);
      if ((isCompleted || isOverdue) && balance > 0) {
        totalOverdueUnpaid += balance;
      }
    }

    if (isCompleted) {
      const actualEnd = b.actual_return_date || scheduledEnd;
      const lateDays = getDaysDiff(scheduledEnd, actualEnd);
      if (lateDays > 0) {
        returnHygiene -= Math.min(75, 4 * Math.pow(lateDays, 1.3));
      }
    } else if (b.status === 'confirmed') {
      const overdueDays = getDaysDiff(scheduledEnd, todayStr);
      if (overdueDays > 0) {
        let hasUnpaidDebt = false;
        if (hasInstallments) {
          hasUnpaidDebt = installments.some(
            (inst) => inst.status === 'unpaid' && getDaysDiff(inst.due_date, todayStr) > 0
          );
        } else {
          hasUnpaidDebt = balance > 0;
        }

        if (overdueDays >= 5 && hasUnpaidDebt) {
          hasCriminalOverride = true;
        } else {
          returnHygiene -= overdueDays * 8;
        }
      }
    }

    if (b.client_behavior_status && typeof b.client_behavior_status === 'string') {
      const infractions = b.client_behavior_status.split(',').map((s) => s.trim()).filter(Boolean);
      
      infractions.forEach((infraction) => {
        let baseInfraction = 0;
        let isPermanent = false;

        if (infraction === 'dirty_return') {
          baseInfraction = 5;
        } else if (infraction === 'speeding') {
          baseInfraction = 15;
        } else if (infraction === 'minor_damage') {
          baseInfraction = 25;
        } else if (infraction === 'major_damage') {
          baseInfraction = 100;
          isPermanent = true;
          hasCriminalOverride = true;
        }

        if (baseInfraction > 0) {
          if (isPermanent) {
            behaviorPenalty += baseInfraction;
          } else {
            const infractionDate = b.actual_return_date || b.end_date || todayStr;
            const daysSince = Math.max(0, getDaysDiff(infractionDate, todayStr));
            const decayFactor = Math.max(0, 1 - daysSince / 90);
            behaviorPenalty += baseInfraction * decayFactor;
          }
        }
      });
    }
  });

  returnHygiene = Math.max(0, Math.min(100, returnHygiene));

  const overdueDebtRatio = totalContractValue > 0 ? (totalOverdueUnpaid / totalContractValue) : 0;
  const paymentHygiene = 100 - Math.min(100, overdueDebtRatio * 120);

  let trustScore = (0.40 * returnHygiene) + (0.40 * paymentHygiene) - behaviorPenalty + loyaltyBonus;

  if (hasCriminalOverride) {
    trustScore = 0;
  }

  trustScore = Math.max(0, Math.min(99.9, Math.round(trustScore * 10) / 10));

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
  };
}

function normPlate(p) {
  if (!p) return '';
  return String(p).toUpperCase().replace(/[\s\-]/g, '');
}

function normCIN(c) {
  if (!c) return '';
  let cleaned = String(c).trim().replace(/\s/g, '');
  if (cleaned.toLowerCase() === 'nan') return '';
  if (cleaned.includes('.')) {
    cleaned = cleaned.split('.')[0];
  }
  if (/^\d{7}$/.test(cleaned)) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

function normPermis(p) {
  if (!p) return '';
  let cleaned = String(p).trim().toUpperCase().replace(/\s/g, '');
  if (cleaned.toLowerCase() === 'nan') return '';
  if (cleaned.startsWith('>')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.includes('.')) {
    cleaned = cleaned.split('.')[0];
  }
  return cleaned;
}

function normPhone(p) {
  if (!p) return '';
  let cleaned = String(p).trim().replace(/\s+/g, '');
  if (!cleaned || cleaned.toLowerCase() === 'nan') return '';
  if (/^\d{8}$/.test(cleaned)) {
    return '+216 ' + cleaned;
  }
  return cleaned;
}

function parseDateToYMD(dStr) {
  if (!dStr) return null;
  const cleaned = dStr.trim();
  if (!cleaned || cleaned.toLowerCase() === 'nan') return null;
  
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    return cleaned.slice(0, 10);
  }
  // DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(cleaned)) {
    const parts = cleaned.split('/');
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2].slice(0, 4);
    return `${y}-${m}-${d}`;
  }
  // DD-MM-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{4}/.test(cleaned)) {
    const parts = cleaned.split('-');
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2].slice(0, 4);
    return `${y}-${m}-${d}`;
  }
  return null;
}

function mapFuel(fStr) {
  if (!fStr) return 'Full'
  const clean = fStr.toUpperCase()
  if (clean.includes('RBO3') || clean.includes('1/4') || clean.includes('RBO')) return '1/4'
  if (clean.includes('CHTAR') || clean.includes('1/2') || clean.includes('NOS') || clean.includes('HALF')) return '1/2'
  if (clean.includes('3/4') || clean.includes('3 BARS') || clean.includes('4 BARS')) return '3/4'
  if (clean.includes('FULL') || clean.includes('PLEIN')) return 'Full'
  if (clean.includes('EMPTY') || clean.includes('VIDE')) return 'Empty'
  return 'Full'
}

function mapFuelToNumber(fuelStr) {
  switch (fuelStr) {
    case 'Empty': return 0
    case '1/4': return 2
    case '1/2': return 4
    case '3/4': return 6
    case 'Full': return 8
    default: return 8
  }
}

function mapLavage(lStr) {
  if (!lStr) return 'clean_wash'
  const clean = lStr.toUpperCase()
  if (clean.includes('NDHIFA') || clean.includes('CLEAN')) return 'clean_wash'
  if (clean.includes('MAS5A') || clean.includes('DIRTY') || clean.includes('MAS')) return 'dirty'
  return 'clean_wash'
}

async function run() {
  console.log('==================================================');
  if (DRY_RUN) {
    console.log('🧪 RUNNING IN SIMULATION MODE (DRY-RUN)');
    console.log('No writes or deletions will be committed to Supabase.');
    console.log('To perform real insertion, run with: CONFIRM_REAL_INSERT=true node insert_bookings.mjs');
  } else {
    console.log('⚠️ RUNNING IN REAL INSERTION MODE');
    console.log('Data will be written to Supabase! No wipe will be done.');
  }
  console.log('==================================================\n');

  console.log('Fetching active vehicles from DB...')
  const { data: activeVehicles, error: vErr } = await sb
    .from('vehicles')
    .select('id, license_plate')
    .eq('owner_id', OWNER_ID)
  
  if (vErr) throw vErr
  const vehicleCache = {}
  activeVehicles.forEach(v => {
    vehicleCache[normPlate(v.license_plate)] = v.id
  })
  console.log(`Cached ${activeVehicles.length} active vehicles.`)

  console.log('Fetching existing clients from DB...')
  let clientsList = []
  let fromIndex = 0
  let toIndex = 999
  let finished = false
  while (!finished) {
    const { data: chunk, error: cErr } = await sb
      .from('clients')
      .select('id, cin, permis_numero, phone, full_name')
      .eq('owner_id', OWNER_ID)
      .range(fromIndex, toIndex)

    if (cErr) throw cErr
    if (chunk.length === 0) {
      finished = true
    } else {
      clientsList = clientsList.concat(chunk)
      fromIndex += 1000
      toIndex += 1000
      if (chunk.length < 1000) finished = true
    }
  }

  const clientCache = {
    byCin: {},
    byPermis: {},
    byPhone: {},
    byName: {}
  }
  clientsList.forEach(c => {
    if (c.cin) clientCache.byCin[normCIN(c.cin)] = c.id
    if (c.permis_numero) clientCache.byPermis[normPermis(c.permis_numero)] = c.id
    if (c.phone && c.phone !== 'N/A') clientCache.byPhone[normPhone(c.phone)] = c.id
    if (c.full_name) clientCache.byName[c.full_name.trim().toLowerCase()] = c.id
  })
  console.log(`Cached ${clientsList.length} clients.`)

  console.log(`Reading ${csvPath}...`)
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Error: CSV file not found at ${csvPath}`);
    process.exit(1);
  }
  const content = fs.readFileSync(csvPath, 'utf8')
  const cleanContent = content.replace(/^\uFEFF/, '')
  const lines = cleanContent.split(/\r?\n/)
  console.log(`Total rows in CSV: ${lines.length}`)

  // Parse Headers
  const headers = lines[0].split(';').map(h => h.trim())
  console.log('Detected headers:', headers)

  const getCol = (parts, headerName) => {
    const idx = headers.indexOf(headerName)
    if (idx === -1) return ''
    return (parts[idx] || '').trim()
  }

  const bookingsToInsert = []
  const installmentsToInsert = []
  const handoversToInsert = []
  const clientIdsToRecalculate = new Set()
  
  // Track details of skipped rows
  const needsReviewRows = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const parts = line.split(';')
    if (parts.length < headers.length) {
      needsReviewRows.push({
        LINE_NUMBER: i + 1,
        CLIENT_NAME: 'N/A',
        LICENSE_PLATE: 'N/A',
        REASON: `Column count mismatch: expected ${headers.length}, got ${parts.length}`
      })
      continue
    }

    const contract_number = getCol(parts, 'contract_number')
    const phone_raw = getCol(parts, 'client_phone')
    const name_raw = getCol(parts, 'client_name')
    const brand_raw = getCol(parts, 'brand')
    const plate_raw = getCol(parts, 'license_plate')
    const start_date_raw = getCol(parts, 'start_date')
    const pickup_time_raw = getCol(parts, 'pickup_time')
    const end_date_raw = getCol(parts, 'end_date')
    const return_time_raw = getCol(parts, 'return_time')
    const days_raw = getCol(parts, 'rental_days_text')
    const birthday_raw = getCol(parts, 'birthday')
    const cin_raw = getCol(parts, 'cin')
    const cin_deliv_raw = getCol(parts, 'cin_delivre_le')
    const permis_raw = getCol(parts, 'license_number')
    const permis_deliv_raw = getCol(parts, 'license_delivre_le')
    const acompte_raw = getCol(parts, 'acompte_raw')
    const reste_raw = getCol(parts, 'reste_raw')
    const acompte_clean_raw = getCol(parts, 'acompte_clean')
    const reste_clean_raw = getCol(parts, 'reste_clean')
    const total_amount_raw = getCol(parts, 'total_clean')
    const lavage_raw = getCol(parts, 'lavage_pickup')
    const fuel_raw = getCol(parts, 'fuel_level_pickup')
    const km_raw = getCol(parts, 'starting_km')
    const address_raw = getCol(parts, 'address')
    const damage_notes = getCol(parts, 'damage_notes')

    let fullName = name_raw.trim() || 'Unknown'
    if (fullName === '*') fullName = 'Unknown'

    // 1. Validate dates (NEVER fallback to dummy 2020-01-01)
    const start_date = parseDateToYMD(start_date_raw)
    const end_date = parseDateToYMD(end_date_raw) || start_date

    if (!start_date) {
      needsReviewRows.push({
        LINE_NUMBER: i + 1,
        CLIENT_NAME: fullName,
        LICENSE_PLATE: plate_raw,
        REASON: `Invalid or missing start_date: "${start_date_raw}"`
      })
      continue
    }

    // 2. Resolve vehicle (NEVER auto-create dummy vehicle)
    const normalizedPlate = normPlate(plate_raw)
    let vehicleId = vehicleCache[normalizedPlate]
    if (!vehicleId && normalizedPlate) {
      needsReviewRows.push({
        LINE_NUMBER: i + 1,
        CLIENT_NAME: fullName,
        LICENSE_PLATE: plate_raw,
        REASON: `Vehicle not found in database: "${plate_raw}"`
      })
      continue
    }

    // 3. Resolve client
    const cin = normCIN(cin_raw)
    const permis = normPermis(permis_raw)
    const phone = normPhone(phone_raw)

    let clientId = null
    let matchType = null

    if (cin && clientCache.byCin[cin]) {
      clientId = clientCache.byCin[cin]
      matchType = 'cin'
    } else if (permis && clientCache.byPermis[permis]) {
      clientId = clientCache.byPermis[permis]
      matchType = 'permis'
    } else if (phone && phone !== 'N/A' && clientCache.byPhone[phone]) {
      clientId = clientCache.byPhone[phone]
      matchType = 'phone'
    } else if (clientCache.byName[fullName.toLowerCase()]) {
      // Uncertainty check: match by name only is forbidden
      needsReviewRows.push({
        LINE_NUMBER: i + 1,
        CLIENT_NAME: fullName,
        LICENSE_PLATE: plate_raw,
        REASON: `Uncertain client match by name only: "${fullName}"`
      })
      continue
    }

    if (!clientId) {
      needsReviewRows.push({
        LINE_NUMBER: i + 1,
        CLIENT_NAME: fullName,
        LICENSE_PLATE: plate_raw,
        REASON: `Client not found in database (Name: "${fullName}", CIN: "${cin_raw}", Permis: "${permis_raw}")`
      })
      continue
    }

    clientIdsToRecalculate.add(clientId)

    // 4. Odometer and notes
    let starting_km = 0
    if (km_raw) {
      const kmVal = parseInt(km_raw, 10)
      if (!isNaN(kmVal)) starting_km = kmVal
    }

    const status = end_date < TODAY_STR ? 'completed' : 'confirmed'
    let total_amount = parseFloat(total_amount_raw) || 0
    let acompte_paid = parseFloat(acompte_clean_raw) || 0
    let reste_clean = parseFloat(reste_clean_raw) || 0

    const owner_remarks_parts = []
    if (acompte_raw && isNaN(parseFloat(acompte_raw))) {
      owner_remarks_parts.push(`[Acompte Asli: ${acompte_raw}]`)
    }
    if (reste_raw && isNaN(parseFloat(reste_raw))) {
      owner_remarks_parts.push(`[Reste Asli: ${reste_raw}]`)
    }
    
    // Safety check for impossible amounts
    if (total_amount > 1000000) {
      owner_remarks_parts.push(`[Corrupted Total: ${total_amount_raw}]`)
      total_amount = 0
    }
    if (acompte_paid > 1000000) {
      owner_remarks_parts.push(`[Corrupted Acompte: ${acompte_clean_raw}]`)
      acompte_paid = 0
    }
    if (reste_clean > 1000000) {
      owner_remarks_parts.push(`[Corrupted Reste: ${reste_clean_raw}]`)
      reste_clean = 0
    }

    owner_remarks_parts.push(`[Contract: ${contract_number}]`)
    const owner_remarks = owner_remarks_parts.join(' | ')

    const payment_status = acompte_paid >= total_amount ? 'paid' : 'unpaid'

    const bookingId = uuidv4()
    const pickup_fuel_str = mapFuel(fuel_raw)
    const pickup_lavage_str = mapLavage(lavage_raw)

    bookingsToInsert.push({
      id: bookingId,
      owner_id: OWNER_ID,
      vehicle_id: vehicleId,
      client_id: clientId,
      client_name: fullName,
      client_phone: phone,
      client_license_number: permis,
      client_cin_passport: cin,
      client_address: address_raw ? address_raw.trim() : null,
      start_date,
      end_date,
      pickup_time: pickup_time_raw || '12:00',
      return_time: return_time_raw || '12:00',
      rental_days_text: days_raw || '1',
      total_amount,
      acompte_paid,
      acompte_paid_date: start_date,
      status,
      payment_status,
      starting_km,
      starting_mileage: starting_km,
      lavage_pickup: pickup_lavage_str,
      fuel_level_pickup: pickup_fuel_str,
      damage_notes: damage_notes || null,
      owner_remarks,
      import_raw_data: {
        contract_number,
        raw_acompte: acompte_raw,
        raw_reste: reste_raw,
        csv_line: i + 1
      }
    })

    // Handover record
    if (vehicleId) {
      handoversToInsert.push({
        booking_id: bookingId,
        vehicle_id: vehicleId,
        pickup_km: starting_km,
        pickup_fuel: mapFuelToNumber(pickup_fuel_str),
        pickup_cleanliness: pickup_lavage_str === 'dirty' ? 'Dirty' : 'Clean'
      })
    }

    // Installment record if remaining amount > 0
    if (reste_clean > 0) {
      installmentsToInsert.push({
        id: uuidv4(),
        booking_id: bookingId,
        amount: reste_clean,
        due_date: end_date,
        status: 'unpaid'
      })
    }
  }

  console.log(`Parsed ${bookingsToInsert.length} successful bookings.`)
  console.log(`Skipped/Needs-review rows: ${needsReviewRows.length}`)

  // 5. Write needs_review csv
  if (needsReviewRows.length > 0) {
    const skippedPath = path.join(__dirname, 'bookings_import_needs_review.csv')
    const skippedHeaders = ['LINE_NUMBER', 'CLIENT_NAME', 'LICENSE_PLATE', 'REASON']
    const csvRows = [skippedHeaders.join(';')]
    needsReviewRows.forEach(r => {
      csvRows.push([r.LINE_NUMBER, `"${r.CLIENT_NAME}"`, `"${r.LICENSE_PLATE}"`, `"${r.REASON}"`].join(';'))
    })
    fs.writeFileSync(skippedPath, csvRows.join('\n'), 'utf8')
    console.log(`⚠️ Warning: ${needsReviewRows.length} rows were skipped due to validation issues.`)
    console.log(`📁 Details exported to: ${skippedPath}`)
  }

  if (DRY_RUN) {
    console.log('\n==================================================');
    console.log(`🧪 Booking simulation (Dry-Run) complete!`);
    console.log(`Would have inserted: ${bookingsToInsert.length} bookings`);
    console.log(`Would have created: ${handoversToInsert.length} handovers`);
    console.log(`Would have created: ${installmentsToInsert.length} installments`);
    console.log('==================================================\n');
    return
  }

  // 6. Real Run Insertions
  console.log('Creating import batch header...')
  const { data: batchData, error: batchError } = await sb
    .from('import_batches')
    .insert({
      owner_id: OWNER_ID,
      imported_by: OWNER_ID,
      batch_name: 'Historical Import reservations_cleaned_to_import (4).csv'
    })
    .select('id')
    .single()

  if (batchError) throw batchError
  const batchId = batchData.id
  console.log(`Batch created: ${batchId}`)

  // Associate batchId to bookings
  bookingsToInsert.forEach(b => {
    b.import_batch_id = batchId
  })

  // Insert in batches of 100
  const chunkSize = 100
  console.log('Inserting bookings in chunks of 100...')
  for (let i = 0; i < bookingsToInsert.length; i += chunkSize) {
    const chunk = bookingsToInsert.slice(i, i + chunkSize)
    const { error: insErr } = await sb.from('bookings').insert(chunk)
    if (insErr) {
      console.error(`Failed to insert bookings chunk starting at index ${i}:`, insErr.message)
      throw insErr
    }
    console.log(`  Inserted bookings chunk ${i / chunkSize + 1} (${chunk.length} rows)`)
  }

  console.log('Inserting handovers in chunks of 100...')
  for (let i = 0; i < handoversToInsert.length; i += chunkSize) {
    const chunk = handoversToInsert.slice(i, i + chunkSize)
    const { error: insErr } = await sb.from('vehicle_handovers').insert(chunk)
    if (insErr) {
      console.error(`Failed to insert handovers chunk starting at index ${i}:`, insErr.message)
      throw insErr
    }
    console.log(`  Inserted handovers chunk ${i / chunkSize + 1} (${chunk.length} rows)`)
  }

  console.log('Inserting installments in chunks of 100...')
  for (let i = 0; i < installmentsToInsert.length; i += chunkSize) {
    const chunk = installmentsToInsert.slice(i, i + chunkSize)
    const { error: insErr } = await sb.from('booking_installments').insert(chunk)
    if (insErr) {
      console.error(`Failed to insert installments chunk starting at index ${i}:`, insErr.message)
      throw insErr
    }
    console.log(`  Inserted installments chunk ${i / chunkSize + 1} (${chunk.length} rows)`)
  }

  if (clientIdsToRecalculate.size > 0) {
    console.log(`\n==================================================`);
    console.log(`Recalculating trust scores for ${clientIdsToRecalculate.size} affected clients...`);
    console.log(`==================================================`);
    
    const clientIdsArray = Array.from(clientIdsToRecalculate);
    const clientChunkSize = 200;
    
    for (let i = 0; i < clientIdsArray.length; i += clientChunkSize) {
      const chunkIds = clientIdsArray.slice(i, i + clientChunkSize);
      
      let bookingsList = [];
      let from = 0;
      while (true) {
        const { data: bChunk, error: bErr } = await sb
          .from('bookings')
          .select('id, client_id, secondary_client_id, status, start_date, end_date, actual_return_date, total_amount, acompte_paid, client_behavior_status, installments:booking_installments(id, amount, due_date, status, paid_date)')
          .or(`client_id.in.(${chunkIds.join(',')}),secondary_client_id.in.(${chunkIds.join(',')})`)
          .neq('status', 'cancelled')
          .range(from, from + 999);
          
        if (bErr) throw bErr;
        bookingsList = bookingsList.concat(bChunk);
        if (bChunk.length < 1000) break;
        from += 1000;
      }
      
      const clientBookingsMap = {};
      chunkIds.forEach(id => {
        clientBookingsMap[id] = [];
      });
      
      bookingsList.forEach(booking => {
        if (booking.client_id && clientBookingsMap[booking.client_id]) {
          clientBookingsMap[booking.client_id].push(booking);
        }
        if (booking.secondary_client_id && clientBookingsMap[booking.secondary_client_id]) {
          clientBookingsMap[booking.secondary_client_id].push(booking);
        }
      });
      
      for (const cid of chunkIds) {
        const bookings = clientBookingsMap[cid] || [];
        if (bookings.length === 0) {
          const { error: updErr } = await sb
            .from('clients')
            .update({ trust_score: null })
            .eq('id', cid);
          if (updErr) console.error(`Error resetting trust score for ${cid}:`, updErr.message);
        } else {
          const { trustScore } = calculateTrustScore(bookings, TODAY_STR);
          const { error: updErr } = await sb
            .from('clients')
            .update({ trust_score: trustScore })
            .eq('id', cid);
          if (updErr) console.error(`Error updating trust score for ${cid}:`, updErr.message);
        }
      }
      console.log(`  Processed trust scores for client chunk ${Math.floor(i / clientChunkSize) + 1} of ${Math.ceil(clientIdsArray.length / clientChunkSize)}`);
    }
    console.log(`Finished recalculating client trust scores!`);
  }

  console.log('IMPORT SUCCESSFUL!')
}

run().catch(err => {
  console.error('Fatal Import Failure:', err)
  process.exit(1)
})
