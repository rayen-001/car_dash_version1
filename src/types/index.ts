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
  created_at?: string
}

export interface Client {
  id: string
  owner_id?: string
  full_name: string
  email?: string | null
  phone: string
  license_number?: string | null
  created_at?: string
}

export interface Booking {
  id: string
  owner_id?: string
  client_id?: string | null
  client_name: string
  vehicle_id: string
  start_date: string
  end_date: string
  total_amount: number
  status: string
  payment_status?: string
  
  // Joins
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
  }

  // Contract Details
  fuel_level_pickup?: string
  fuel_level_return?: string
  starting_mileage?: number
  return_mileage?: number
  
  // Legal Snapshots & Times
  client_phone?: string
  client_license_number?: string
  client_cin_passport?: string
  client_address?: string
  pickup_time?: string
  return_time?: string
  
  // Deposit
  deposit_amount?: number
  deposit_type?: string
  deposit_status?: string
  
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
  created_at?: string
}
