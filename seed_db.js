const { createClient } = require('@supabase/supabase-js');

const url = 'https://reiccnqyxrkmesedbnxd.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlaWNjbnF5eHJrbWVzZWRibnhkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk2MzExNSwiZXhwIjoyMDk0NTM5MTE1fQ.1XBR4AiQVurgR88m266owNRVPLO1rIFBTCup3kRrg2o';
const supabase = createClient(url, key);
const owner_id = 'ffce4379-9630-4c82-8a21-e9445c1f977d';

async function main() {
  try {
    console.log('Starting DB Wipe for owner_id:', owner_id);

    // 1. Wipe Bookings and Installments (cascade should handle installments, but we delete manually to be safe)
    console.log('Deleting bookings...');
    const { data: bookings } = await supabase.from('bookings').select('id').eq('owner_id', owner_id);
    if (bookings && bookings.length > 0) {
      const bIds = bookings.map(b => b.id);
      await supabase.from('booking_installments').delete().in('booking_id', bIds);
      await supabase.from('bookings').delete().in('id', bIds);
    }

    console.log('Deleting expenses...');
    await supabase.from('expenses').delete().eq('owner_id', owner_id);

    console.log('Deleting vehicles...');
    await supabase.from('vehicles').delete().eq('owner_id', owner_id);

    console.log('Deleting clients...');
    await supabase.from('clients').delete().eq('owner_id', owner_id);

    console.log('All previous data wiped successfully!');

    // 2. Seed Data
    console.log('Seeding Vehicles...');
    const vehiclesData = [
      { brand: 'Kia', model: 'Picanto', year: 2022, license_plate: '230 TU 1234', price_per_day: 80, current_km: 50000, owner_id },
      { brand: 'Renault', model: 'Clio 5', year: 2023, license_plate: '235 TU 5678', price_per_day: 100, current_km: 30000, owner_id },
      { brand: 'Hyundai', model: 'i10', year: 2021, license_plate: '220 TU 9012', price_per_day: 75, current_km: 65000, owner_id },
      { brand: 'Peugeot', model: '208', year: 2024, license_plate: '240 TU 3456', price_per_day: 110, current_km: 15000, owner_id },
      { brand: 'Volkswagen', model: 'Polo', year: 2023, license_plate: '238 TU 7890', price_per_day: 105, current_km: 25000, owner_id },
      { brand: 'Dacia', model: 'Sandero', year: 2022, license_plate: '232 TU 2468', price_per_day: 85, current_km: 45000, owner_id }
    ];
    const { data: insertedVehicles, error: vErr } = await supabase.from('vehicles').insert(vehiclesData).select();
    if (vErr) throw vErr;

    console.log('Seeding Clients...');
    const clientsData = [];
    for (let i = 1; i <= 10; i++) {
      clientsData.push({
        full_name: `Client Test ${i}`,
        phone: `+216 20 000 00${i}`,
        email: `client${i}@example.com`,
        owner_id
      });
    }
    const { data: insertedClients, error: cErr } = await supabase.from('clients').insert(clientsData).select();
    if (cErr) throw cErr;

    console.log('Seeding Bookings...');
    const now = new Date();
    const bookingsToInsert = [];
    
    // Create 20 bookings
    for (let i = 0; i < 20; i++) {
      const v = insertedVehicles[i % 6];
      const c = insertedClients[i % 10];
      
      // Mix of past, active, and upcoming
      let startDate = new Date(now);
      let endDate = new Date(now);
      let status = 'pending';
      
      if (i < 8) { // Past
        startDate.setDate(now.getDate() - (15 + i));
        endDate.setDate(now.getDate() - (10 + i));
        status = 'completed';
      } else if (i < 15) { // Active
        startDate.setDate(now.getDate() - (i - 5));
        endDate.setDate(now.getDate() + (10 - i));
        status = 'confirmed';
      } else { // Upcoming
        startDate.setDate(now.getDate() + (i - 10));
        endDate.setDate(now.getDate() + (i - 5));
        status = 'pending';
      }

      const days = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
      const total_amount = days * v.price_per_day;
      const acompte_paid = status === 'completed' ? total_amount : Math.floor(total_amount / 2);

      bookingsToInsert.push({
        owner_id,
        vehicle_id: v.id,
        client_id: c.id,
        client_name: c.full_name,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        total_amount,
        acompte_paid,
        status,
        payment_status: status === 'completed' ? 'paid' : 'unpaid',
        starting_km: v.current_km - (i * 100),
        return_km: status === 'completed' ? v.current_km - (i * 100) + (days * 100) : null
      });
    }

    const { data: insertedBookings, error: bErr } = await supabase.from('bookings').insert(bookingsToInsert).select();
    if (bErr) throw bErr;

    // Optional: add some expenses
    console.log('Seeding Expenses...');
    const expenses = [
      { owner_id, vehicle_id: insertedVehicles[0].id, type: 'Fuel', amount: 50, date: now.toISOString(), description: 'Full tank' },
      { owner_id, vehicle_id: insertedVehicles[1].id, type: 'Maintenance', amount: 150, date: now.toISOString(), description: 'Vidange' },
      { owner_id, vehicle_id: insertedVehicles[2].id, type: 'Wash', amount: 15, date: now.toISOString(), description: 'Complete wash' },
    ];
    await supabase.from('expenses').insert(expenses);

    console.log('Seed completed successfully!');

  } catch (e) {
    console.error('Error during seed:', e);
  }
}

main();
