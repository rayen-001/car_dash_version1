-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'owner');

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role user_role DEFAULT 'owner',
  full_name TEXT,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  company_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Vehicles table
CREATE TABLE vehicles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  price_per_day DECIMAL(10,2) NOT NULL,
  availability BOOLEAN DEFAULT true,
  images TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bookings table
CREATE TABLE bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
  client_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  total_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Expenses table
CREATE TABLE expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Maintenance table
CREATE TABLE maintenance (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
  cost DECIMAL(10,2) NOT NULL,
  service_date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can insert profiles" ON profiles
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete profiles" ON profiles
  FOR DELETE USING (is_admin(auth.uid()));

-- Vehicles Policies
CREATE POLICY "Owners can view their own vehicles" ON vehicles
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Admins can view all vehicles" ON vehicles
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Owners can insert their own vehicles" ON vehicles
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Admins can insert vehicles" ON vehicles
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Owners can update their own vehicles" ON vehicles
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Admins can update all vehicles" ON vehicles
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Owners can delete their own vehicles" ON vehicles
  FOR DELETE USING (auth.uid() = owner_id);

CREATE POLICY "Admins can delete all vehicles" ON vehicles
  FOR DELETE USING (is_admin(auth.uid()));

-- Bookings Policies (Similar logic)
CREATE POLICY "Owners can view their own bookings" ON bookings
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Admins can view all bookings" ON bookings
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Owners can insert their own bookings" ON bookings
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Admins can insert bookings" ON bookings
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Owners can update their own bookings" ON bookings
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Admins can update all bookings" ON bookings
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Owners can delete their own bookings" ON bookings
  FOR DELETE USING (auth.uid() = owner_id);

CREATE POLICY "Admins can delete all bookings" ON bookings
  FOR DELETE USING (is_admin(auth.uid()));

-- Expenses Policies
CREATE POLICY "Owners can view their own expenses" ON expenses
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Admins can view all expenses" ON expenses
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Owners can insert their own expenses" ON expenses
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Admins can insert expenses" ON expenses
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Owners can update their own expenses" ON expenses
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Admins can update all expenses" ON expenses
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Owners can delete their own expenses" ON expenses
  FOR DELETE USING (auth.uid() = owner_id);

CREATE POLICY "Admins can delete all expenses" ON expenses
  FOR DELETE USING (is_admin(auth.uid()));

-- Maintenance Policies
CREATE POLICY "Owners can view their own maintenance" ON maintenance
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Admins can view all maintenance" ON maintenance
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Owners can insert their own maintenance" ON maintenance
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Admins can insert maintenance" ON maintenance
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Owners can update their own maintenance" ON maintenance
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Admins can update all maintenance" ON maintenance
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Owners can delete their own maintenance" ON maintenance
  FOR DELETE USING (auth.uid() = owner_id);

CREATE POLICY "Admins can delete all maintenance" ON maintenance
  FOR DELETE USING (is_admin(auth.uid()));

-- Function to handle new user registration and create profile
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
    new.raw_user_meta_data->>'full_name',
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


-- Create business_settings table
CREATE TABLE IF NOT EXISTS public.business_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  business_name TEXT DEFAULT '',
  logo_url TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  currency TEXT DEFAULT 'DT',
  rental_terms TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on business_settings
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- business_settings Policies
CREATE POLICY "Owners can view their own business settings" ON public.business_settings
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Owners can insert their own business settings" ON public.business_settings
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their own business settings" ON public.business_settings
  FOR UPDATE USING (auth.uid() = owner_id);

-- Add fuel and mileage tracking to bookings table
ALTER TABLE public.bookings 
  ADD COLUMN IF NOT EXISTS fuel_level_pickup TEXT DEFAULT 'Full' CHECK (fuel_level_pickup IN ('Empty', '1/4', '1/2', '3/4', 'Full')),
  ADD COLUMN IF NOT EXISTS fuel_level_return TEXT DEFAULT 'Full' CHECK (fuel_level_return IN ('Empty', '1/4', '1/2', '3/4', 'Full')),
  ADD COLUMN IF NOT EXISTS starting_mileage INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS return_mileage INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_return_date DATE;

-- Add legal fields and exact times to bookings table for historical audit snapshotting
ALTER TABLE public.bookings 
  ADD COLUMN IF NOT EXISTS client_phone TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_license_number TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_cin_passport TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_address TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS pickup_time TEXT DEFAULT '10:00',
  ADD COLUMN IF NOT EXISTS return_time TEXT DEFAULT '10:00';


-- =========================================================================
-- MULTITENANCY ISOLATION PATCH: CRM CLIENTS & SECURITY POLICIES
-- =========================================================================

-- 1. Create the clients CRM table if it does not already exist
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT DEFAULT 'N/A' NOT NULL,
  license_number TEXT DEFAULT 'N/A',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Establish relationship on the bookings table if not already present
ALTER TABLE public.bookings 
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- 3. Explicitly enable Row-Level Security (RLS) on the clients table
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 4. Create robust RLS Policies for the clients table to isolate tenant data
DROP POLICY IF EXISTS "Owners can view their own clients" ON public.clients;
CREATE POLICY "Owners can view their own clients" ON public.clients
  FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can insert their own clients" ON public.clients;
CREATE POLICY "Owners can insert their own clients" ON public.clients
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can update their own clients" ON public.clients;
CREATE POLICY "Owners can update their own clients" ON public.clients
  FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete their own clients" ON public.clients;
CREATE POLICY "Owners can delete their own clients" ON public.clients
  FOR DELETE USING (auth.uid() = owner_id);

-- 5. Establish a fallback safety policy to enforce RLS is active on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- SYSTEM UPGRADE: BOOKING INSTALLMENTS LEDGER
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.booking_installments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  paid_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row-Level Security
ALTER TABLE public.booking_installments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tenant isolation
DROP POLICY IF EXISTS "Owners can view their own booking installments" ON public.booking_installments;
CREATE POLICY "Owners can view their own booking installments" ON public.booking_installments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.owner_id = auth.uid()
    )
  );
