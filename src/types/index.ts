export interface Vehicle {
  id: string
  owner_id?: string
  brand: string
  model: string
  year?: number
  registration_number?: string
  license_plate?: string
  color?: string
  status?: string
  price_per_day: number
  image_url?: string | null
  last_vidange_km?: number
  next_vidange_km?: number
  last_pads_km?: number
  next_pads_km?: number
  current_km?: number
  created_at?: string
}

export interface Client {
  id: string
  owner_id?: string
  full_name: string
  email?: string | null
  phone: string
  license_number?: string | null
  cin?: string | null
  address?: string | null
  trust_score?: number | null
  date_naissance?: string
  cin_delivre_le?: string
  permis_numero?: string
  permis_delivre_le?: string
  created_at?: string
}

export interface Booking {
  id: string
  owner_id?: string
  client_id?: string | null
  secondary_client_id?: string | null
  client_name: string
  vehicle_id: string
  start_date: string
  end_date: string
  total_amount: number
  status: string
  payment_status?: string
  
  // Joins
  primary_client?: Client
  secondary_client?: Client
  vehicle_handovers?: VehicleHandover[]
  vehicles?: {
    brand: string
    model: string
    price_per_day?: number
    year?: number
    license_plate?: string
  }
  vehicle?: {
    brand: string
    model: string
    year: number
    license_plate?: string
  }

  // Condition checklist & temporal parameters
  lavage_pickup?: string
  lavage_return?: string
  client_behavior_status?: string | null
  damage_notes?: string
  acompte_paid?: number
  rental_days_text?: string
  starting_km?: number | null
  return_km?: number | null

  // Contract Details
  fuel_level_pickup?: string
  fuel_level_return?: string
  starting_mileage?: number | null
  return_mileage?: number | null
  
  // Legal Snapshots & Times
  client_phone?: string
  client_license_number?: string
  client_cin_passport?: string
  client_address?: string
  
  secondary_client_phone?: string
  secondary_client_license_number?: string
  secondary_client_cin_passport?: string
  secondary_client_address?: string
  
  pickup_time?: string
  return_time?: string
  
  // Deposit
  deposit_amount?: number
  deposit_type?: string
  deposit_status?: string
  
  actual_return_date?: string
  installments?: Installment[]
  created_at?: string

  // Optional off-site Handover / Delivery (Airport, Hotel, …). When set, the
  // dashboard cards + bookings table render a gold glassmorphic badge under
  // the rental window. Empty/null → nothing rendered (grid stays compact).
  handover_location?: string | null
  handover_datetime?: string | null
}

export interface Installment {
  id: string
  booking_id: string
  amount: number
  due_date: string
  status: 'unpaid' | 'paid'
  paid_date?: string | null
  created_at?: string
}

export interface BusinessSettings {
  id?: string
  owner_id?: string
  business_name: string
  logo_url: string
  phone: string
  address: string
  currency: string
  rental_terms: string
  matricule_fiscal?: string
  rne_number?: string
  owner_full_name?: string
  email?: string
  city?: string
  contract_language?: string
  tva_number?: string
  tva_rate?: number
  created_at?: string
}

export interface VehicleHandover {
  booking_id: string
  vehicle_id: string
  pickup_km?: number | null
  return_km?: number | null
  pickup_fuel?: number | null
  return_fuel?: number | null
  pickup_cleanliness?: 'Clean' | 'Dirty' | null
  return_cleanliness?: 'Clean' | 'Dirty' | null
  created_at?: string
}

export interface Expense {
  id: string
  owner_id?: string
  vehicle_id?: string | null
  client_id?: string | null
  client_name?: string | null
  amount: number
  date: string
  category: string
  description?: string
  created_at?: string
}
