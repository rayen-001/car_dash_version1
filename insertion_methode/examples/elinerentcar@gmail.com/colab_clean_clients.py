import pandas as pd
import numpy as np
from google.colab import files

# 1. Chargement ta3 l'fichier Excel (men ligne 1 lil e5er)
file_path = '/content/eline 2024-2025.xlsx'
df = pd.read_excel(file_path)

# Strip spaces men asemi el colonnes mel lwel
df.columns = df.columns.str.strip()
print(f"📊 Fichier fih: {len(df)} lignes en total.")

# Replace common empty placeholders in 'Nom et prénom' with NaN before dropping
df['Nom et prénom'] = df['Nom et prénom'].replace(['*', '...'], np.nan)

# Capture lines skipped because of missing names
skipped_clients = df[df['Nom et prénom'].isna()].copy()
if len(skipped_clients) > 0:
    print(f"⚠️ Warning: Found {len(skipped_clients)} rows with missing/empty client names (dropped).")
    for idx, row in skipped_clients.iterrows():
        # Get phone / cin safely
        p_val = row.get('Num Tlf') if 'Num Tlf' in df.columns else 'N/A'
        c_val = row.get('Num CIN') if 'Num CIN' in df.columns else 'N/A'
        print(f"  - Row {idx + 2}: Phone={p_val}, CIN={c_val}")
else:
    print("✅ All rows have a client name.")

# Nna7iw les lignes elli mafihomch 'Nom et prénom'
df_clean_raw = df.dropna(subset=['Nom et prénom']).copy()

# Selectionner les colonnes (Délivé le stripped now)
target_columns = [
    'Num Tlf', 'Nom et prénom', 'Date de naissance',
    'Num CIN', 'délivré le', 'Num Permis', 'Délivé le', 'ADRESSE'
]
existing_cols = [col for col in target_columns if col in df_clean_raw.columns]
df_clean = df_clean_raw[existing_cols].copy()

# Rename columns safely
df_clean = df_clean.rename(columns={
    'délivré le': 'Date Delivrance CIN',
    'Délivé le': 'Date Delivrance Permis'
})

# --- ⚙️ 2. CLEANING FUNCTIONS (UPDATED TO PREVENT ACCIDENTAL MERGES) ---

def clean_cin(val):
    if pd.isna(val):
        return np.nan
    if isinstance(val, float):
        if val.is_integer():
            val = int(val)
        else:
            val = str(val)
    s = str(val).strip().replace('<', '').replace('>', '')
    if not s: 
        return np.nan # Fix: Return np.nan instead of '' to avoid grouping empty CINs together
    if s.isdigit():
        if len(s) in [6, 7]:
            return s.zfill(8)
    return s

def clean_permis(val):
    if pd.isna(val):
        return np.nan
    if isinstance(val, float):
        if val.is_integer():
            val = int(val)
    s = str(val).strip().replace('<', '').replace('>', '')
    return s if s else np.nan # Fix: Return np.nan instead of '' to avoid grouping empty permits together

def clean_phone(val):
    if pd.isna(val):
        return np.nan
    if isinstance(val, float):
        if val.is_integer():
            val = int(val)
    s = str(val).strip().replace(' ', '').replace('-', '').replace('.', '')
    return s if s else np.nan # Fix: Return np.nan instead of '' to avoid grouping empty phones together

def clean_date(val):
    if pd.isna(val):
        return np.nan
    # Try multiple common date formats
    formats = ['%Y-%m-%d', '%d-%m-%Y', '%m/%d/%Y', '%d/%m/%Y', '%Y/%m/%d']
    for fmt in formats:
        try:
            dt = pd.to_datetime(val, format=fmt, errors='raise')
            return dt.strftime('%Y-%m-%d')
        except (ValueError, TypeError):
            continue
    dt = pd.to_datetime(val, dayfirst=True, errors='coerce') 
    if pd.isna(dt):
        return np.nan
    return dt.strftime('%Y-%m-%d')

def clean_address(val):
    if pd.isna(val):
        return np.nan
    s = str(val).strip().replace('<', '').replace('>', '')
    return s if s else np.nan

# Standardize client names (uppercase & remove double spaces) to merge accurately
if 'Nom et prénom' in df_clean.columns:
    df_clean['Nom et prénom'] = df_clean['Nom et prénom'].astype(str).str.strip().str.upper().replace(r'\s+', ' ', regex=True)

# Apply cleaners
if 'Num CIN' in df_clean.columns:
    df_clean['Num CIN'] = df_clean['Num CIN'].apply(clean_cin)

if 'Num Permis' in df_clean.columns:
    df_clean['Num Permis'] = df_clean['Num Permis'].apply(clean_permis)

if 'Num Tlf' in df_clean.columns:
    df_clean['Num Tlf'] = df_clean['Num Tlf'].apply(clean_phone)

if 'ADRESSE' in df_clean.columns:
    df_clean['ADRESSE'] = df_clean['ADRESSE'].apply(clean_address)

colonnes_dates = ['Date de naissance', 'Date Delivrance CIN', 'Date Delivrance Permis']
for col in colonnes_dates:
    if col in df_clean.columns:
        df_clean[col] = df_clean[col].apply(clean_date)

# ---------------------------------------------------------
# 🔥 3. ADVANCED MULTI-STAGE MERGE LOGIC (Permis -> CIN -> Name)
# ---------------------------------------------------------
# Aggregation function: last non-null value wins
agg_func = lambda x: x.dropna().iloc[-1] if x.dropna().size > 0 else np.nan

# Step A: Group by Name to merge identical names first
step1 = df_clean.groupby('Nom et prénom', as_index=False).agg(agg_func)

# Step B: Group by Num Permis (for non-nulls)
has_permis = step1[step1['Num Permis'].notna()]
no_permis = step1[step1['Num Permis'].isna()]

if len(has_permis) > 0:
    has_permis_agg = has_permis.groupby('Num Permis', as_index=False).agg(agg_func)
    step2 = pd.concat([has_permis_agg, no_permis])
else:
    step2 = step1

# Step C: Group by Num CIN (for non-nulls)
has_cin = step2[step2['Num CIN'].notna()]
no_cin = step2[step2['Num CIN'].isna()]

if len(has_cin) > 0:
    has_cin_agg = has_cin.groupby('Num CIN', as_index=False).agg(agg_func)
    df_final = pd.concat([has_cin_agg, no_cin])
else:
    df_final = step2

# Final name group clean up to reset index w ensure stability
df_final = df_final.groupby('Nom et prénom', as_index=False).agg(agg_func)

# Explicitly fill NaN with empty strings for final Excel/CSV formatting
string_cols_to_fill = ['Num CIN', 'Num Permis', 'Num Tlf', 'ADRESSE']
for col in string_cols_to_fill:
    if col in df_final.columns:
        df_final[col] = df_final[col].fillna('')

# 6. Save w Download
output_name = 'Clients_Uniques_Final.xlsx'
df_final.to_excel(output_name, index=False)

print(f"Khedma mrigla! L'fichier tsajjel b'esem: {output_name}")
print(f"Total ta3 les clients uniques après merge: {len(df_final)}")

# Download
files.download(output_name)
