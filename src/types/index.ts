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
  withdrawn_at?: string | null
  insurance_start_date?: string | null
  archived_at?: string | null
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
  /** Owner-only internal note. Never shown in contracts/invoices/PDFs. */
  internal_note?: string | null
  /**
   * Numeric offset applied on top of trust_score for display.
   * effective_score = clamp(trust_score + manual_score_adjustment, 0, 100)
   * NULL means no adjustment; system trust_score is used as-is.
   */
  manual_score_adjustment?: number | null
  date_naissance?: string
  lieu_naissance?: string | null
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

  // Optional off-site Handover / Delivery (Airport, Hotel, …)
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

  business_name_ar?: string | null
  siege_social_fr_1?: string | null
  siege_social_fr_2?: string | null
  siege_social_ar_1?: string | null
  siege_social_ar_2?: string | null
  phone_secondary?: string | null
  franchise_amount?: number | null
  late_fee_per_hour?: number | null
  km_per_day?: number | null
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

// ---------------------------------------------------------------------------
// Phase 18 — To-Do Hub
// ---------------------------------------------------------------------------

export interface Todo {
  id: string
  owner_id?: string
  title: string
  notes?: string | null
  due_date?: string | null            // YYYY-MM-DD
  priority: 'high' | 'normal' | 'low'
  is_completed: boolean
  completed_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface VehicleLegalDoc {
  id: string
  owner_id?: string
  vehicle_id: string
  doc_type: 'assurance' | 'visite_technique' | 'laissez_passer' | string
  expiry_date: string                  // YYYY-MM-DD
  created_at?: string
}
