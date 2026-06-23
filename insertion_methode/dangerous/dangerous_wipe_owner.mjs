import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

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

// 2. Validate environment flags for wipe
const ownerId = process.env.OWNER_ID
const confirmWipe = process.env.CONFIRM_WIPE === 'true'
const confirmOwnerEmail = process.env.CONFIRM_OWNER_EMAIL

function printUsage() {
  console.log('\n================================================================================');
  console.log('🔴 CRITICAL WARNING: DESTRUCTIVE ACTION');
  console.log('This script will permanently delete all bookings, handovers, and installments');
  console.log('associated with the specified owner ID.');
  console.log('================================================================================');
  console.log('Usage syntax:');
  console.log('  OWNER_ID="uuid" CONFIRM_WIPE=true CONFIRM_OWNER_EMAIL="email" node insertion_methode/dangerous/dangerous_wipe_owner.mjs');
  console.log('================================================================================\n');
}

async function run() {
  if (!ownerId || !confirmWipe || !confirmOwnerEmail) {
    console.error('❌ Error: Missing safety parameters.');
    printUsage();
    process.exit(1);
  }

  console.log(`Verifying owner with ID: ${ownerId}...`)
  
  // Fetch profile to verify email matches
  const { data: profile, error: pErr } = await sb
    .from('profiles')
    .select('email')
    .eq('id', ownerId)
    .single()

  if (pErr || !profile) {
    console.error('❌ Error: Owner profile not found in database or failed to fetch:', pErr ? pErr.message : 'Not found')
    process.exit(1)
  }

  if (profile.email.toLowerCase().trim() !== confirmOwnerEmail.toLowerCase().trim()) {
    console.error(`❌ Critical Safety Error: Email verification failed!`);
    console.error(`Database email: "${profile.email}"`);
    console.error(`Confirmed email parameter: "${confirmOwnerEmail}"`);
    console.error(`Execution aborted!`);
    process.exit(1)
  }

  console.log(`✅ Owner email verified successfully: "${profile.email}"`)
  console.log(`⚠️ Proceeding to delete all records for owner: ${profile.email} (${ownerId}) in 5 seconds...`)
  await new Promise(resolve => setTimeout(resolve, 5000))

  // Fetch bookings to delete
  console.log('Fetching bookings to wipe...')
  const { data: bookings, error: bErr } = await sb
    .from('bookings')
    .select('id')
    .eq('owner_id', ownerId)

  if (bErr) {
    console.error('❌ Error fetching bookings:', bErr.message)
    process.exit(1)
  }

  if (!bookings || bookings.length === 0) {
    console.log('✅ No bookings found for this owner. Nothing to delete.')
    process.exit(0)
  }

  const bookingIds = bookings.map(b => b.id)
  console.log(`🔥 Wiping ${bookingIds.length} bookings and associated handovers/installments...`)

  const chunkSize = 100
  let deletedBookingsCount = 0
  
  for (let i = 0; i < bookingIds.length; i += chunkSize) {
    const chunk = bookingIds.slice(i, i + chunkSize)
    
    // Delete associated installments
    const { error: instErr } = await sb.from('booking_installments').delete().in('booking_id', chunk)
    if (instErr) console.error(`⚠️ Non-fatal error deleting installments:`, instErr.message)
    
    // Delete associated handovers
    const { error: handErr } = await sb.from('vehicle_handovers').delete().in('booking_id', chunk)
    if (handErr) console.error(`⚠️ Non-fatal error deleting handovers:`, handErr.message)

    // Delete bookings
    const { error: bookErr } = await sb.from('bookings').delete().in('id', chunk)
    if (bookErr) {
      console.error(`❌ Failed to delete bookings batch starting at index ${i}:`, bookErr.message)
      throw bookErr
    }
    
    deletedBookingsCount += chunk.length
    console.log(`  Deleted chunk ${i / chunkSize + 1}: ${chunk.length} bookings.`)
  }

  console.log('\n==================================================');
  console.log(`🎉 Wipe operation completed!`);
  console.log(`Successfully deleted ${deletedBookingsCount} bookings for "${profile.email}".`);
  console.log('==================================================\n');
}

run().catch(err => {
  console.error('Fatal Wipe Failure:', err)
  process.exit(1)
})
