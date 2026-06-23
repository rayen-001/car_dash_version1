import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local dynamically
const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envFile.split('\n')) {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env.local");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const OWNER_ID = 'ffce4379-9630-4c82-8a21-e9445c1f977d'; // elinerentcar@gmail.com
const DRY_RUN = process.env.CONFIRM_REAL_INSERT !== 'true';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.join(__dirname, '..', '..', '..', 'client_new.csv'); // Resolves to project root client_new.csv

function parseDate(dStr) {
  if (!dStr) return null;
  const cleaned = dStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }
  return null;
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

async function run() {
  console.log('==================================================');
  if (DRY_RUN) {
    console.log('🧪 RUNNING IN SIMULATION MODE (DRY-RUN)');
    console.log('No writes will be committed to Supabase.');
    console.log('To perform real insertion, run with: CONFIRM_REAL_INSERT=true node insert_clients.mjs');
  } else {
    console.log('⚠️ RUNNING IN REAL INSERTION MODE');
    console.log('Data will be written to Supabase!');
  }
  console.log('==================================================\n');

  console.log('Reading client_new.csv...');
  const content = fs.readFileSync(csvPath, 'utf8');
  const cleanContent = content.replace(/^\uFEFF/, '');
  const lines = cleanContent.split(/\r?\n/);
  
  console.log(`Total lines read: ${lines.length}`);
  if (lines.length < 2) {
    console.error('CSV file has no data lines.');
    process.exit(1);
  }
  
  // Parse headers dynamically to prevent column mismatch
  const headers = lines[0].split(';').map(h => h.trim());
  console.log('Detected headers:', headers);
  
  const phoneIdx = headers.indexOf('Num Tlf');
  const nameIdx = headers.indexOf('Nom et prénom');
  const birthdayIdx = headers.indexOf('Date de naissance');
  const cinIdx = headers.indexOf('Num CIN');
  const cinDelivIdx = headers.indexOf('Date Delivrance CIN');
  const permisIdx = headers.indexOf('Num Permis');
  const permisDelivIdx = headers.indexOf('Date Delivrance Permis');
  const addressIdx = headers.indexOf('ADRESSE');
  
  if (nameIdx === -1) {
    console.error('❌ Error: "Nom et prénom" column not found in CSV.');
    process.exit(1);
  }
  
  const records = [];
  let unknownNameCount = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines
    
    const parts = line.split(';');
    const rawPhone = phoneIdx !== -1 ? (parts[phoneIdx] || '') : '';
    const rawName = nameIdx !== -1 ? (parts[nameIdx] || '') : '';
    const rawBirthday = birthdayIdx !== -1 ? (parts[birthdayIdx] || '') : '';
    const rawCin = cinIdx !== -1 ? (parts[cinIdx] || '') : '';
    const rawCinDeliv = cinDelivIdx !== -1 ? (parts[cinDelivIdx] || '') : '';
    const rawPermis = permisIdx !== -1 ? (parts[permisIdx] || '') : '';
    const rawPermisDeliv = permisDelivIdx !== -1 ? (parts[permisDelivIdx] || '') : '';
    const rawAddress = addressIdx !== -1 ? (parts[addressIdx] || '') : '';
    
    let name = rawName.trim();
    // Strip any leading > or trailing < from the name
    name = name.replace(/^>|<$/g, '').trim();
    
    if (!name || name === '*' || name.replace(/[\s\.\-]+/g, '') === '') {
      name = 'Unknown';
      unknownNameCount++;
    }
    
    const phone = normPhone(rawPhone);
    const cin = normCIN(rawCin);
    const birthday = parseDate(rawBirthday);
    const cinDelivDate = parseDate(rawCinDeliv);
    const permis = normPermis(rawPermis);
    const permisDelivDate = parseDate(rawPermisDeliv);
    const address = rawAddress.trim() || null;
    
    records.push({
      csvLineNumber: i + 1,
      data: {
        owner_id: OWNER_ID,
        full_name: name,
        email: null,
        phone: phone || 'N/A',
        license_number: permis || 'N/A',
        cin: cin || null,
        date_naissance: birthday,
        cin_delivre_le: cinDelivDate,
        permis_numero: permis || null,
        permis_delivre_le: permisDelivDate,
        address,
        lieu_naissance: null,
        trust_score: null
      }
    });
  }
  
  console.log(`Mapped ${records.length} records. ` + (DRY_RUN ? "Simulation only:" : "Inserting in batches of 100..."));
  
  if (DRY_RUN) {
    console.log(`🧪 [Simulation] Would have inserted ${records.length} clients.`);
    console.log('\n==================================================');
    console.log(`🎉 Client simulation completed!`);
    console.log(`Would have inserted: ${records.length} clients`);
    console.log(`Unknown names: ${unknownNameCount}`);
    console.log('==================================================\n');
    return;
  }

  const reportPath = path.join(__dirname, 'duplicate_import_report.csv');
  fs.writeFileSync(reportPath, 'CSV Row;Client Name;CIN;Permit Number;Error Reason\n', 'utf-8');
  console.log(`Initialized duplicates report: ${reportPath}`);
  
  const batchSize = 100;
  let successCount = 0;
  let skippedCount = 0;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    console.log(`Inserting batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(records.length / batchSize)} (${batch.length} clients)...`);
    
    const insertData = batch.map(r => r.data);
    const { error } = await sb.from('clients').insert(insertData);
    if (error) {
      console.error(`❌ Error inserting batch:`, error.message);
      for (const item of batch) {
        const { error: singleError } = await sb.from('clients').insert(item.data);
        if (singleError) {
          if (singleError.message.includes('unique') || singleError.code === '23505' || singleError.message.includes('already exists')) {
            skippedCount++;
            console.warn(`  ⚠️ Duplicate skipped: client "${item.data.full_name}" (Row ${item.csvLineNumber}): ${singleError.message}`);
            // Log to report CSV
            const reportLine = `Row ${item.csvLineNumber};"${item.data.full_name}";"${item.data.cin || ''}";"${item.data.permis_numero || ''}";"${singleError.message.replace(/"/g, '""')}"\n`;
            fs.appendFileSync(reportPath, reportLine);
          } else {
            console.error(`  ❌ Failed to insert client "${item.data.full_name}" (Row ${item.csvLineNumber}):`, singleError.message);
          }
        } else {
          successCount++;
        }
      }
    } else {
      successCount += batch.length;
    }
  }
  
  console.log('\n==================================================');
  console.log(`🎉 Client insertion completed!`);
  console.log(`Successfully inserted: ${successCount} / ${records.length} clients`);
  console.log(`Skipped (duplicates): ${skippedCount} clients`);
  console.log(`Unknown names: ${unknownNameCount}`);
  if (skippedCount > 0) {
    console.log(`Duplicates report generated at: ${reportPath}`);
  }
  console.log('==================================================\n');
}

run().catch(console.error);
