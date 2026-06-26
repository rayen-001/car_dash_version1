-- =========================================================================
-- SYSTEM UPGRADE: VEHICLE HANDOVERS TABLE
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.vehicle_handovers (
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE PRIMARY KEY,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  pickup_km INTEGER DEFAULT 0,
  return_km INTEGER,
  pickup_fuel INTEGER,
  return_fuel INTEGER,
  pickup_cleanliness TEXT CHECK (pickup_cleanliness IN ('Clean', 'Dirty')),
  return_cleanliness TEXT CHECK (return_cleanliness IN ('Clean', 'Dirty')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row-Level Security
ALTER TABLE public.vehicle_handovers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tenant isolation
DROP POLICY IF EXISTS "Owners can manage their own vehicle handovers" ON public.vehicle_handovers;
CREATE POLICY "Owners can manage their own vehicle handovers" ON public.vehicle_handovers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.owner_id = auth.uid()
    )
  );
