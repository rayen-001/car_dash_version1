# Owner Data Cleaning Guidelines

This document details the exact cleaning and preparation rules applied to raw columns to format them for Supabase.

---

## 1. Client Identity Normalization

### Full Name (`Nom et prénom`)
*   **Action**: Convert to uppercase, strip leading/trailing spaces, collapse multiple spaces into one, and strip surrounding braces `>` or `<`.
*   **Rule**: If the name is blank, empty, `*`, or `...`, replace it with `'Unknown'`.

### Phone Number (`Num Tlf`)
*   **Action**: Strip all spaces, hyphens, and dots.
*   **Rule**: If the value is missing, return `np.nan` (or `NULL`). If it is a valid 8-digit Tunisian number, format it as `+216 XXXXXXXX`.

### CIN (`Num CIN`)
*   **Action**: Strip all spaces and braces `< >`.
*   **Rule**: If it is a 7-digit number, prefix it with `0` to make it a standard 8-digit Tunisian CIN. If empty, return `np.nan`.

### License Number (`Num Permis`)
*   **Action**: Trim spaces and remove surrounding braces `< >` or leading `>`.
*   **Rule**: If empty, return `np.nan`.

---

## 2. Robust Date Processing

All date columns (`start_date`, `end_date`, `birthday`, `cin_delivre_le`, `license_delivre_le`) must be parsed and saved in the standard SQL `YYYY-MM-DD` format.

### Date Parsing Formats
The parser must sequentially try to match:
1.  `%Y-%m-%d` (e.g. `2024-03-09`)
2.  `%d-%m-%Y` (e.g. `09-03-2024`)
3.  `%m/%d/%Y` (e.g. `03/09/2024`)
4.  `%d/%m/%Y` (e.g. `09/03/2024`)
5.  `%Y/%m/%d` (e.g. `2024/03/09`)
*   If none match, try automatic pandas parsing with `dayfirst=True`. Return `np.nan` if unparseable.

### Booking Duration & Missing Dates Calculation
1.  **Parse Duration**: `nbr de jour` represents the number of days. If it contains additions (e.g. `3+2` or `5+1`), sum them up (e.g. `3+2 = 5` days) for calculations, but **preserve the original string** (`3+2`) in the CSV so it can be saved in the database text field.
2.  **Missing Return Date**: If `Date de retour` is missing but `Date de départ` is valid:
    *   Calculate `Date de retour` = `Date de départ` + `duration` (default to `1` day if duration is missing).
3.  **Missing Start Date**: If `Date de départ` is missing but `Date de retour` is valid:
    *   Calculate `Date de départ` = `Date de retour` - `duration` (default to `1` day if duration is missing).
4.  **Both Dates Exist**: Keep both. If duration is missing, calculate it as `(Date de retour - Date de départ)`.

---

## 3. Financial Columns Cleaning

*   **Deposits & Balances**: Read `ACOMPTE` and `RESTE`.
*   **Numeric Parsing**: Strip spaces, replace commas `,` with dots `.`, and extract the first floating-point number.
*   **Typos Safety Limit**: If a value is greater than `1,000,000` (e.g. scientific notation typos like `1,5E+100` being read as \(1.5 \times 10^{100}\)), set the value to `0.0` and append a warning to the `owner_remarks` (e.g., `[Corrupted Acompte: ...]`).

---

## 4. Vehicle handovers Mapping

### Fuel Level
Map the raw text to one of the database options:
*   `RBO3`, `1/4` $\rightarrow$ `'1/4'`
*   `CHTAR`, `1/2`, `NOS`, `HALF` $\rightarrow$ `'1/2'`
*   `3/4`, `3 BARS` $\rightarrow$ `'3/4'`
*   `FULL`, `PLEIN` $\rightarrow$ `'Full'`
*   `EMPTY`, `VIDE` $\rightarrow$ `'Empty'`
*   *Default*: `'Full'`.

### Cleanliness (Lavage)
Map raw text to:
*   `NDHIFA`, `CLEAN` $\rightarrow$ `'Clean'` (DB column: `'clean_wash'`)
*   `MAS5A`, `DIRTY` $\rightarrow$ `'Dirty'` (DB column: `'dirty'`)
*   *Default*: `'Clean'`.

---

## 5. Combined damage notes

*   Combine `Remarque` and `NOTE` columns.
*   If either contains text, merge them with ` | ` and prefix the final string with `[GRAY] ` (e.g. `[GRAY] THARBET EL KARHBA | prolongation`). This instructs the dashboard UI to render them inside the grey comments box.
