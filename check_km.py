import asyncio
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv(r"c:\Users\asus\Desktop\projet\car-dash\.env.local")
supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not supabase_key:
    supabase_key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase = create_client(supabase_url, supabase_key)

res = supabase.table("vehicles").select("id, current_km, license_plate").execute()
for v in res.data:
    b_res = supabase.table("bookings").select("starting_km, return_km").eq("vehicle_id", v["id"]).execute()
    h_res = supabase.table("vehicle_handovers").select("pickup_km, return_km").eq("vehicle_id", v["id"]).execute()
    
    max_km = 0
    for b in b_res.data:
        if b.get("starting_km") and b["starting_km"] > max_km: max_km = b["starting_km"]
        if b.get("return_km") and b["return_km"] > max_km: max_km = b["return_km"]
    for h in h_res.data:
        if h.get("pickup_km") and h["pickup_km"] > max_km: max_km = h["pickup_km"]
        if h.get("return_km") and h["return_km"] > max_km: max_km = h["return_km"]
        
    print(f"Vehicle {v['license_plate']} Max KM: {max_km} (Current DB: {v['current_km']})")
    
    if max_km > (v["current_km"] or 0):
        print(f"-> Fixing {v['license_plate']} to {max_km}")
        supabase.table("vehicles").update({"current_km": max_km, "current_mileage": max_km}).eq("id", v["id"]).execute()
