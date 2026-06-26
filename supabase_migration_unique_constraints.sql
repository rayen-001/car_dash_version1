-- Migration: Safe Database-level Unique Constraints
-- This migration creates uniqueness constraints on:
-- 1. Vehicles: (owner_id, license_plate) where license_plate is normalized
-- 2. Clients: (owner_id, cin) ignoring empty, null, and dummy values like 'N/A', 'NA', 'UNKNOWN', '0', '*', '-'
-- 3. Clients: (owner_id, permis_numero) ignoring empty, null, and dummy values

-- 1. Enforce unique vehicle plate per owner
ALTER TABLE vehicles ADD CONSTRAINT unique_owner_vehicle_plate UNIQUE (owner_id, license_plate);

-- 2. Enforce unique client CIN per owner, ignoring empty/dummy entries
CREATE UNIQUE INDEX unique_owner_client_cin 
ON clients (owner_id, cin) 
WHERE cin IS NOT NULL 
  AND cin <> '' 
  AND upper(trim(cin)) NOT IN ('N/A', 'NA', 'UNKNOWN', '0', '*', '-');

-- 3. Enforce unique client permit number per owner, ignoring empty/dummy entries
CREATE UNIQUE INDEX unique_owner_client_permis 
ON clients (owner_id, permis_numero) 
WHERE permis_numero IS NOT NULL 
  AND permis_numero <> '' 
  AND upper(trim(permis_numero)) NOT IN ('N/A', 'NA', 'UNKNOWN', '0', '*', '-');
