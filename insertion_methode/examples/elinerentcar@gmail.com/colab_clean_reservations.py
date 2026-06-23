import pandas as pd
import numpy as np
import re
from google.colab import files

# ==========================================
# 📥 1. CONFIGURATION
# ==========================================
file_path = '/content/eline 2024-2025.xlsx'
df = pd.read_excel(file_path, sheet_name='tous')

print(f"📊 Fichier fih: {len(df)} lignes en total.")

# ==========================================
# ⚙️ 2. DYNAMIC COLUMN MATCHING (ACCENT & TYPO IMMUNE)
# ==========================================
cols = list(df.columns)

def find_col(search_terms, exclude_terms=[]):
    for col in cols:
        col_lower = str(col).lower()
        if any(term in col_lower for term in search_terms):
            if not any(ex in col_lower for ex in exclude_terms):
                return col
    return None

# Resolve column names dynamically
c_contrat = find_col(['contrat'])
c_phone = find_col(['tlf', 'tel', 'phone'])
c_name = find_col(['nom'])
c_marque = find_col(['marque', 'brand'])
c_plate = find_col(['immat', 'plate', 'matricule'])

# Match 'part' to capture 'dpart' / 'départ' / 'dpart'
c_start_date = find_col(['part', 'depart', 'dep'], exclude_terms=['heure', 'km', 'kilometrage', 'kilomtrage'])
c_pickup_time = find_col(['heure'], exclude_terms=['retour']) # Heure de départ

c_end_date = find_col(['retour'], exclude_terms=['heure'])
c_return_time = find_col(['heure'], exclude_terms=['depart', 'dpart', 'de part', 'part']) # Heure de retour

c_days = find_col(['jour'])
c_birthday = find_col(['naissance'])
c_cin = find_col(['cin'])
c_permis = find_col(['permis'])
c_acompte = find_col(['acompte'])
c_reste = find_col(['reste'])
c_lavage = find_col(['lavage'])
c_fuel = find_col(['essence', 'fuel'])
c_km = find_col(['km', 'kilometrage', 'kilomtrage'])
c_address = find_col(['adresse'])
c_remarque = find_col(['remarque'])
c_note = find_col(['note'])

# Match 'liv' to capture 'dlivr le' / 'délivré le' / 'Délivé' / 'dlivr'
c_cin_deliv = None
if c_cin in cols:
    cin_idx = cols.index(c_cin)
    for c in cols[cin_idx+1:]:
        if any(term in str(c).lower() for term in ['liv', 'deliv', 'dliv']):
            c_cin_deliv = c
            break

c_permis_deliv = None
if c_permis in cols:
    permis_idx = cols.index(c_permis)
    for c in cols[permis_idx+1:]:
        if any(term in str(c).lower() for term in ['liv', 'deliv', 'dliv']):
            c_permis_deliv = c
            break

print("🔍 Column Mapping Results:")
print(f"  - Contract: {c_contrat}")
print(f"  - Name: {c_name}")
print(f"  - Phone: {c_phone}")
print(f"  - Plate: {c_plate}")
print(f"  - Start Date: {c_start_date}")
print(f"  - End Date: {c_end_date}")
print(f"  - CIN: {c_cin}")
print(f"  - CIN Deliv: {c_cin_deliv}")
print(f"  - Permis: {c_permis}")
print(f"  - Permis Deliv: {c_permis_deliv}")

if not c_name:
    raise ValueError("Could not find the client name column (Nom et prénom) in the Excel sheet!")

# ==========================================
# ⚙️ 3. CLEANING & DATE FUNCTIONS
# ==========================================

def parse_date_robust(val):
    if pd.isna(val):
        return None
    formats = ['%Y-%m-%d', '%d-%m-%Y', '%m/%d/%Y', '%d/%m/%Y', '%Y/%m/%d']
    for fmt in formats:
        try:
            return pd.to_datetime(val, format=fmt, errors='raise')
        except:
            continue
    try:
        dt = pd.to_datetime(val, dayfirst=True, errors='coerce')
        if not pd.isna(dt):
            return dt
    except:
        pass
    return None

def parse_days_sum(days_str):
    if pd.isna(days_str):
        return 0
    cleaned = str(days_str).strip().lower()
    if '+' in cleaned:
        parts = cleaned.split('+')
        total = 0
        for p in parts:
            p_digits = ''.join(filter(str.isdigit, p))
            if p_digits:
                total += int(p_digits)
        return total
    else:
        p_digits = ''.join(filter(str.isdigit, cleaned))
        if p_digits:
            return int(p_digits)
    return 0

def process_booking_dates(row):
    start_val = row.get(c_start_date) if c_start_date else None
    end_val = row.get(c_end_date) if c_end_date else None
    days_val = row.get(c_days) if c_days else None
    
    start_dt = parse_date_robust(start_val)
    end_dt = parse_date_robust(end_val)
    total_days = parse_days_sum(days_val)
    
    if start_dt is None and end_dt is None:
        return "", "", ""
        
    if start_dt and end_dt:
        if total_days == 0:
            diff = (end_dt - start_dt).days
            total_days = max(1, diff)
            days_str = str(total_days)
        else:
            days_str = str(days_val).strip()
    elif start_dt and not end_dt:
        days_to_add = total_days if total_days > 0 else 1
        end_dt = start_dt + pd.Timedelta(days=days_to_add)
        days_str = str(days_val).strip() if total_days > 0 else "1"
    elif end_dt and not start_dt:
        days_to_sub = total_days if total_days > 0 else 1
        start_dt = end_dt - pd.Timedelta(days=days_to_sub)
        days_str = str(days_val).strip() if total_days > 0 else "1"
        
    return start_dt.strftime('%Y-%m-%d'), end_dt.strftime('%Y-%m-%d'), days_str

def clean_cin(val):
    if pd.isna(val):
        return np.nan
    s = str(val).strip().replace('<', '').replace('>', '').replace(' ', '')
    if not s: 
        return np.nan
    if s.isdigit() and len(s) in [6, 7]:
        return s.zfill(8)
    return s

def clean_permis(val):
    if pd.isna(val):
        return np.nan
    s = str(val).strip().replace('<', '').replace('>', '').replace(' ', '')
    return s if s else np.nan

def clean_phone(val):
    if pd.isna(val):
        return np.nan
    s = str(val).strip().replace(' ', '').replace('-', '').replace('.', '')
    return s if s else np.nan

def clean_name(val):
    if pd.isna(val):
        return "Unknown"
    s = str(val).strip().upper().replace('>', '').replace('<', '')
    s = re.sub(r'\s+', ' ', s)
    return s if s else "Unknown"

def clean_plate(val):
    if pd.isna(val): 
        return ""
    p = str(val).upper().strip().replace(" ", "")
    p = p.replace("TY", "TU").replace("YU", "TU")
    return p

def clean_time(t):
    if pd.isna(t): 
        return "12:00"
    t = str(t).lower().strip()
    if ":" in t:
        parts = t.split(":")
        try:
            return f"{int(parts[0]):02d}:{int(parts[1]):02d}"
        except:
            return "12:00"
    match = re.search(r"(\d+)\s*h\s*(\d*)", t)
    if match:
        h = int(match.group(1))
        m = int(match.group(2)) if match.group(2) else 0
        return f"{h:02d}:{m:02d}"
    return "12:00"

def clean_numeric(val):
    if pd.isna(val): 
        return 0.0
    val_str = str(val).strip().replace(" ", "").replace(",", ".")
    match = re.search(r"[\d\.]+", val_str)
    if match:
        try:
            return float(match.group(0))
        except:
            return 0.0
    return 0.0

# ==========================================
# 🚀 4. DATA PROCESSING
# ==========================================

cleaned_bookings = []
skipped_rows = []

for idx, row in df.iterrows():
    # Check for missing client name
    name_raw = row.get(c_name) if c_name else None
    if pd.isna(name_raw) or str(name_raw).strip() in ['', '*', '...']:
        row_dict = row.to_dict()
        row_dict['SKIP_REASON'] = "Missing Client Name"
        row_dict['EXCEL_ROW_NUMBER'] = idx + 2 # 1-indexed + header row
        skipped_rows.append(row_dict)
        continue

    s_d, e_d, days_str = process_booking_dates(row)
    
    if not s_d:
        row_dict = row.to_dict()
        row_dict['SKIP_REASON'] = "Missing or Unparseable Dates (Start/End date not found)"
        row_dict['EXCEL_ROW_NUMBER'] = idx + 2
        skipped_rows.append(row_dict)
        continue
        
    acompte_clean = clean_numeric(row.get(c_acompte)) if c_acompte else 0.0
    reste_clean = clean_numeric(row.get(c_reste)) if c_reste else 0.0
    total_clean = acompte_clean + reste_clean
    
    remarque = str(row.get(c_remarque, '')).strip() if c_remarque else ""
    note = str(row.get(c_note, '')).strip() if c_note else ""
    comments = []
    if remarque and remarque.lower() != 'nan':
        comments.append(remarque)
    if note and note.lower() != 'nan':
        comments.append(note)
        
    damage_notes = f"[GRAY] {' | '.join(comments)}" if comments else ""
    
    plate = clean_plate(row.get(c_plate)) if c_plate else ""
    name = clean_name(row.get(c_name))
    phone = clean_phone(row.get(c_phone)) if c_phone else ""
    cin = clean_cin(row.get(c_cin)) if c_cin else ""
    
    cin_deliv = parse_date_robust(row.get(c_cin_deliv)) if c_cin_deliv else None
    permis = clean_permis(row.get(c_permis)) if c_permis else ""
    permis_deliv = parse_date_robust(row.get(c_permis_deliv)) if c_permis_deliv else None
    
    bday_val = parse_date_robust(row.get(c_birthday)) if c_birthday else None
    
    cleaned_bookings.append({
        'contract_number': str(row.get(c_contrat, '')).split('.')[0].strip() if c_contrat else "",
        'client_phone': phone if pd.notna(phone) else '',
        'client_name': name,
        'brand': str(row.get(c_marque, '')).strip() if c_marque else "",
        'license_plate': plate,
        'start_date': s_d,
        'pickup_time': clean_time(row.get(c_pickup_time)) if c_pickup_time else '12:00',
        'end_date': e_d,
        'return_time': clean_time(row.get(c_return_time)) if c_return_time else '12:00',
        'rental_days_text': days_str,
        'birthday': bday_val.strftime('%Y-%m-%d') if bday_val else '',
        'cin': cin if pd.notna(cin) else '',
        'cin_delivre_le': cin_deliv.strftime('%Y-%m-%d') if cin_deliv else '',
        'license_number': permis if pd.notna(permis) else '',
        'license_delivre_le': permis_deliv.strftime('%Y-%m-%d') if permis_deliv else '',
        'acompte_raw': str(row.get(c_acompte, '')).strip() if c_acompte else "",
        'reste_raw': str(row.get(c_reste, '')).strip() if c_reste else "",
        'acompte_clean': acompte_clean,
        'reste_clean': reste_clean,
        'total_clean': total_clean,
        'lavage_pickup': str(row.get(c_lavage, '')).strip() if c_lavage else "",
        'fuel_level_pickup': str(row.get(c_fuel, '')).strip() if c_fuel else "",
        'starting_km': str(row.get(c_km, '')).strip() if c_km else "",
        'address': str(row.get(c_address, '')).strip() if c_address else "",
        'damage_notes': damage_notes
    })

df_final = pd.DataFrame(cleaned_bookings)

# ==========================================
# 💾 5. EXPORT TO CSV
# ==========================================
output_csv = "reservations_cleaned_to_import.csv"
df_final.to_csv(output_csv, index=False, sep=";")

print("="*50)
print(f"🎉 Done! Clean CSV created: {output_csv}")
print(f"📊 Total bookings processed: {len(df_final)}")

if len(skipped_rows) > 0:
    df_skipped = pd.DataFrame(skipped_rows)
    skipped_csv = "reservations_needs_review.csv"
    df_skipped.to_csv(skipped_csv, index=False, sep=";")
    print(f"⚠️ Warning: {len(skipped_rows)} rows were skipped because of missing names or invalid dates.")
    print(f"📁 Details written to: {skipped_csv}")
    try:
        files.download(skipped_csv)
    except Exception as e:
        print(f"Could not trigger browser download for {skipped_csv}: {e}")
else:
    print("✅ No rows were skipped. Perfect data quality!")

print("="*50)

# Download the file
try:
    files.download(output_csv)
except Exception as e:
    print(f"Could not trigger browser download for {output_csv}: {e}")