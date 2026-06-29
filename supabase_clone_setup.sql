-- ==========================================
-- COMPLETE SUPABASE SCHEMA CLONE SCRIPT
-- Copy and run this in your new Supabase SQL Editor
-- ==========================================

-- 0. ENABLE REQUIRED EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. CREATE CUSTOM TYPES
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'owner');
  END IF;
END $$;

-- ==========================================
-- TABLE: profiles
-- ==========================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  role user_role DEFAULT 'owner' NULL,
  full_name TEXT NULL,
  email TEXT NOT NULL,
  phone TEXT NULL,
  company_name TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- TABLE: import_batches
-- ==========================================
CREATE TABLE IF NOT EXISTS public.import_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  imported_by UUID NOT NULL,
  batch_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- TABLE: vehicles
-- ==========================================
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  price_per_day DECIMAL(10,2) NOT NULL,
  availability BOOLEAN DEFAULT true NULL,
  images TEXT[] NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  license_plate TEXT DEFAULT  NULL,
  color TEXT DEFAULT  NULL,
  current_km INTEGER NULL,
  oil_change_due_km INTEGER NULL,
  brake_pad_state TEXT NULL,
  last_vidange_km INTEGER NULL,
  last_pads_km INTEGER NULL,
  next_vidange_km INTEGER NULL,
  next_pads_km INTEGER NULL,
  insurance_start_date DATE NULL,
  withdrawn_at DATE NULL,
  archived_at DATE NULL
);

-- ==========================================
-- TABLE: clients
-- ==========================================
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NULL,
  phone TEXT NOT NULL,
  license_number TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  date_naissance DATE NULL,
  cin_delivre_le DATE NULL,
  permis_delivre_le DATE NULL,
  permis_numero TEXT NULL,
  trust_score DECIMAL(10,2) NULL,
  cin TEXT NULL,
  address TEXT NULL,
  lieu_naissance TEXT NULL,
  archived_at TIMESTAMPTZ NULL
);

-- ==========================================
-- TABLE: bookings
-- ==========================================
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  vehicle_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'pending' NULL,
  payment_status TEXT DEFAULT 'unpaid' NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  fuel_level_pickup TEXT DEFAULT 'Full' NULL,
  fuel_level_return TEXT DEFAULT 'Full' NULL,
  starting_mileage INTEGER DEFAULT 0 NULL,
  return_mileage INTEGER DEFAULT 0 NULL,
  client_id UUID NULL,
  deposit_amount DECIMAL(10,2) DEFAULT 0 NOT NULL,
  deposit_type TEXT DEFAULT 'Cash' NOT NULL,
  deposit_status TEXT DEFAULT 'Held' NOT NULL,
  client_phone TEXT DEFAULT  NULL,
  client_license_number TEXT DEFAULT  NULL,
  client_cin_passport TEXT DEFAULT  NULL,
  client_address TEXT DEFAULT  NULL,
  pickup_time TEXT DEFAULT '10:00' NULL,
  return_time TEXT DEFAULT '10:00' NULL,
  amount_paid DECIMAL(10,2) DEFAULT 0 NULL,
  accident_reported BOOLEAN DEFAULT false NULL,
  owner_remarks TEXT NULL,
  lavage_status TEXT NULL,
  damage_notes TEXT NULL,
  acompte_paid DECIMAL(10,2) DEFAULT 0 NULL,
  rental_days_text TEXT NULL,
  starting_km INTEGER NULL,
  return_km INTEGER NULL,
  departure_time TEXT DEFAULT '10:00' NULL,
  lavage_pickup TEXT NULL,
  lavage_return TEXT NULL,
  client_behavior_status TEXT NULL,
  actual_return_date DATE NULL,
  secondary_client_id UUID NULL,
  acompte_paid_date TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NULL,
  handover_location TEXT NULL,
  handover_datetime TIMESTAMPTZ NULL,
  contract_number TEXT NULL,
  import_batch_id UUID NULL,
  import_raw_data TEXT NULL
);

-- ==========================================
-- TABLE: booking_installments
-- ==========================================
CREATE TABLE IF NOT EXISTS public.booking_installments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'unpaid' NULL,
  paid_date DATE NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- TABLE: expenses
-- ==========================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  vehicle_id UUID NULL,
  amount DECIMAL(10,2) NOT NULL,
  category TEXT NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- TABLE: maintenance
-- ==========================================
CREATE TABLE IF NOT EXISTS public.maintenance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  vehicle_id UUID NOT NULL,
  cost DECIMAL(10,2) NOT NULL,
  service_date DATE NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  mechanic_name TEXT NULL,
  mechanic_notes TEXT NULL,
  km_at_service INTEGER NULL,
  service_type TEXT NULL
);

-- ==========================================
-- TABLE: vehicle_legal_docs
-- ==========================================
CREATE TABLE IF NOT EXISTS public.vehicle_legal_docs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  vehicle_id UUID NOT NULL,
  doc_type TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NULL,
  UNIQUE (vehicle_id, doc_type)
);

-- ==========================================
-- TABLE: vehicle_handovers
-- ==========================================
CREATE TABLE IF NOT EXISTS public.vehicle_handovers (
  booking_id UUID PRIMARY KEY,
  vehicle_id UUID NOT NULL,
  pickup_km INTEGER DEFAULT 0 NULL,
  return_km INTEGER NULL,
  pickup_fuel INTEGER NULL,
  return_fuel INTEGER NULL,
  pickup_cleanliness TEXT NULL,
  return_cleanliness TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- TABLE: business_settings
-- ==========================================
CREATE TABLE IF NOT EXISTS public.business_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  business_name TEXT DEFAULT  NULL,
  logo_url TEXT DEFAULT  NULL,
  phone TEXT DEFAULT  NULL,
  address TEXT DEFAULT  NULL,
  currency TEXT DEFAULT 'DT' NULL,
  rental_terms TEXT DEFAULT  NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  matricule_fiscal TEXT NULL,
  rne_number TEXT NULL,
  owner_full_name TEXT NULL,
  email TEXT NULL,
  city TEXT NULL,
  contract_language TEXT DEFAULT 'fr' NULL,
  tva_number TEXT NULL,
  tva_rate DECIMAL(10,2) DEFAULT 0 NULL,
  business_name_ar TEXT NULL,
  siege_social_fr_1 TEXT NULL,
  siege_social_fr_2 TEXT NULL,
  siege_social_ar_1 TEXT NULL,
  siege_social_ar_2 TEXT NULL,
  phone_secondary TEXT NULL,
  franchise_amount DECIMAL(10,2) DEFAULT 1000 NULL,
  late_fee_per_hour DECIMAL(10,2) DEFAULT 10 NULL,
  km_per_day INTEGER DEFAULT 250 NULL
);

-- ==========================================
-- TABLE: todos
-- ==========================================
CREATE TABLE IF NOT EXISTS public.todos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  title TEXT NOT NULL,
  notes TEXT NULL,
  due_date DATE NULL,
  priority TEXT DEFAULT 'normal' NOT NULL,
  is_completed BOOLEAN DEFAULT false NOT NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 2. ESTABLISH FOREIGN KEY RELATIONSHIPS
-- ==========================================
ALTER TABLE public.import_batches
  DROP CONSTRAINT IF EXISTS fk_import_batches_owner_id,
  ADD CONSTRAINT fk_import_batches_owner_id FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.import_batches
  DROP CONSTRAINT IF EXISTS fk_import_batches_imported_by,
  ADD CONSTRAINT fk_import_batches_imported_by FOREIGN KEY (imported_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.vehicles
  DROP CONSTRAINT IF EXISTS fk_vehicles_owner_id,
  ADD CONSTRAINT fk_vehicles_owner_id FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS fk_clients_owner_id,
  ADD CONSTRAINT fk_clients_owner_id FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS fk_bookings_owner_id,
  ADD CONSTRAINT fk_bookings_owner_id FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS fk_bookings_vehicle_id,
  ADD CONSTRAINT fk_bookings_vehicle_id FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS fk_bookings_client_id,
  ADD CONSTRAINT fk_bookings_client_id FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS fk_bookings_secondary_client_id,
  ADD CONSTRAINT fk_bookings_secondary_client_id FOREIGN KEY (secondary_client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS fk_bookings_import_batch_id,
  ADD CONSTRAINT fk_bookings_import_batch_id FOREIGN KEY (import_batch_id) REFERENCES public.import_batches(id) ON DELETE CASCADE;

ALTER TABLE public.booking_installments
  DROP CONSTRAINT IF EXISTS fk_booking_installments_booking_id,
  ADD CONSTRAINT fk_booking_installments_booking_id FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;

ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS fk_expenses_owner_id,
  ADD CONSTRAINT fk_expenses_owner_id FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS fk_expenses_vehicle_id,
  ADD CONSTRAINT fk_expenses_vehicle_id FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;

ALTER TABLE public.maintenance
  DROP CONSTRAINT IF EXISTS fk_maintenance_owner_id,
  ADD CONSTRAINT fk_maintenance_owner_id FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.maintenance
  DROP CONSTRAINT IF EXISTS fk_maintenance_vehicle_id,
  ADD CONSTRAINT fk_maintenance_vehicle_id FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;

ALTER TABLE public.vehicle_legal_docs
  DROP CONSTRAINT IF EXISTS fk_vehicle_legal_docs_owner_id,
  ADD CONSTRAINT fk_vehicle_legal_docs_owner_id FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.vehicle_legal_docs
  DROP CONSTRAINT IF EXISTS fk_vehicle_legal_docs_vehicle_id,
  ADD CONSTRAINT fk_vehicle_legal_docs_vehicle_id FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;

ALTER TABLE public.vehicle_handovers
  DROP CONSTRAINT IF EXISTS fk_vehicle_handovers_booking_id,
  ADD CONSTRAINT fk_vehicle_handovers_booking_id FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;

ALTER TABLE public.vehicle_handovers
  DROP CONSTRAINT IF EXISTS fk_vehicle_handovers_vehicle_id,
  ADD CONSTRAINT fk_vehicle_handovers_vehicle_id FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;

ALTER TABLE public.business_settings
  DROP CONSTRAINT IF EXISTS fk_business_settings_owner_id,
  ADD CONSTRAINT fk_business_settings_owner_id FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ==========================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS)
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_legal_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 4. HELPER FUNCTIONS & TRIGGERS
-- ==========================================

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle new user registration and create profile automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(CAST(new.raw_user_meta_data->>'role' AS public.user_role), 'owner'::public.user_role)
  );
  RETURN new;
END;
$$;

-- Trigger to automatically create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==========================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Profiles Policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Vehicles Policies
DROP POLICY IF EXISTS "Owners can manage their own vehicles" ON public.vehicles;
CREATE POLICY "Owners can manage their own vehicles" ON public.vehicles FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Clients Policies
DROP POLICY IF EXISTS "Owners can manage their own clients" ON public.clients;
CREATE POLICY "Owners can manage their own clients" ON public.clients FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Bookings Policies
DROP POLICY IF EXISTS "Owners can manage their own bookings" ON public.bookings;
CREATE POLICY "Owners can manage their own bookings" ON public.bookings FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Expenses Policies
DROP POLICY IF EXISTS "Owners can manage their own expenses" ON public.expenses;
CREATE POLICY "Owners can manage their own expenses" ON public.expenses FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Maintenance Policies
DROP POLICY IF EXISTS "Owners can manage their own maintenance" ON public.maintenance;
CREATE POLICY "Owners can manage their own maintenance" ON public.maintenance FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Booking Installments Policies
DROP POLICY IF EXISTS "Owners can manage their own installments" ON public.booking_installments;
CREATE POLICY "Owners can manage their own installments" ON public.booking_installments FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_id AND b.owner_id = auth.uid()
  )
);

-- Vehicle Legal Docs Policies
DROP POLICY IF EXISTS "Owners can manage their own legal docs" ON public.vehicle_legal_docs;
CREATE POLICY "Owners can manage their own legal docs" ON public.vehicle_legal_docs FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Vehicle Handovers Policies
DROP POLICY IF EXISTS "Owners can manage their own handovers" ON public.vehicle_handovers;
CREATE POLICY "Owners can manage their own handovers" ON public.vehicle_handovers FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_id AND b.owner_id = auth.uid()
  )
);

-- Business Settings Policies
DROP POLICY IF EXISTS "Owners can manage their own business settings" ON public.business_settings;
CREATE POLICY "Owners can manage their own business settings" ON public.business_settings FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Import Batches Policies
DROP POLICY IF EXISTS "Owners can manage their own import batches" ON public.import_batches;
CREATE POLICY "Owners can manage their own import batches" ON public.import_batches FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Todos Policies
DROP POLICY IF EXISTS "Owners can manage their own todos" ON public.todos;
CREATE POLICY "Owners can manage their own todos" ON public.todos FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- ==========================================
-- 6. UNIQUE & INDEX CONSTRAINTS
-- ==========================================

-- Enforce unique vehicle plate per owner
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS unique_owner_vehicle_plate;
ALTER TABLE public.vehicles ADD CONSTRAINT unique_owner_vehicle_plate UNIQUE (owner_id, license_plate);

-- Enforce unique client CIN per owner, ignoring empty/dummy entries
DROP INDEX IF EXISTS public.unique_owner_client_cin;
CREATE UNIQUE INDEX unique_owner_client_cin 
ON public.clients (owner_id, cin) 
WHERE cin IS NOT NULL 
  AND cin <> '' 
  AND upper(trim(cin)) NOT IN ('N/A', 'NA', 'UNKNOWN', '0', '*', '-');

-- Enforce unique client permit number per owner, ignoring empty/dummy entries
DROP INDEX IF EXISTS public.unique_owner_client_permis;
CREATE UNIQUE INDEX unique_owner_client_permis 
ON public.clients (owner_id, permis_numero) 
WHERE permis_numero IS NOT NULL 
  AND permis_numero <> '' 
  AND upper(trim(permis_numero)) NOT IN ('N/A', 'NA', 'UNKNOWN', '0', '*', '-');
