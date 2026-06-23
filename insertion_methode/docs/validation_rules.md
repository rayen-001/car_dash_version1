# Owner Data Validation Rules

This document outlines the rules for merging duplicates and validating data consistency before importing it into Supabase.

---

## 1. CRM Unique Clients merging Logic

To avoid importing duplicate clients from Excel rows, we run a multi-stage merging pipeline in pandas. 

### Merge Stages
1.  **Stage A (Group by Name)**: Merge all rows with the exact same name (case-insensitive, trimmed). Aggregations take the last non-null value (`agg(lambda x: x.dropna().iloc[-1] if x.dropna().size > 0 else np.nan)`).
2.  **Stage B (Group by Permit)**: Separate rows into `has_permis` and `no_permis`. Group `has_permis` by the Permit Number, then concatenate back with `no_permis`.
3.  **Stage C (Group by CIN)**: Separate rows into `has_cin` and `no_cin`. Group `has_cin` by the CIN Number, then concatenate back with `no_cin`.
4.  **Stage D (Group by Name)**: Perform a final grouping by Name to clean up indexes and ensure structure stability.

### ⚠ Critical Warning: Empty Values must NOT group!
Any empty phone, CIN, or permit number must return `np.nan` (or `None`). If they return an empty string `''`, pandas will treat it as a valid value and **merge all clients with empty values into a single client record**. Always ensure empty values are `np.nan` during the grouping steps.

---

## 2. Pre-Import Sanity Checks

Before executing the Node.js database insertion scripts, run the following verification checks:

### Date Formats Check
*   All dates in the CSV must follow the `YYYY-MM-DD` format (e.g. `2024-03-09`).
*   Check that start dates are less than or equal to end dates.

### Numeric Fields Check
*   Ensure `acompte_clean`, `reste_clean`, and `total_clean` are positive float numbers.
*   Validate that `total_clean = acompte_clean + reste_clean`.

### Client Linking Check
*   Verify that client names in the booking CSV match the corresponding names in the client CSV.
*   If a client has a booking but is not in the client CSV, the booking import script will auto-create them, but it is best to resolve them in the clients list beforehand.

### License Plate Validation
*   All license plates must be standardized (e.g. `224TU2310` instead of `224 tu 2310` or `224 ty 2310`).
