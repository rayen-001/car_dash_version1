# Safe Owner Data Insertion Steps

This document outlines the step-by-step procedure to safely simulate, verify, and import owner datasets.

---

## 1. Setup & Credentials
Ensure your local `.env.local` in the project root contains the `NEXT_PUBLIC_SUPABASE_URL` and the admin **`SUPABASE_SERVICE_ROLE_KEY`**. 
*   **Security Note**: Never hardcode credentials in script files or commit them to version control.
*   **Prerequisite**: Run `npm install` in the project root so the import scripts can resolve dependencies.

---

## 2. Targeted Data Wipe (Dangerous)
To clean up existing records during testing or rebuilds:
1.  Use the isolated script: `insertion_methode/dangerous/dangerous_wipe_owner.mjs`.
2.  You must explicitly provide the owner's ID, confirmation flag, and email matching what is stored in the database:
    ```bash
    OWNER_ID="ffce4379-9630-4c82-8a21-e9445c1f977d" CONFIRM_WIPE=true CONFIRM_OWNER_EMAIL="elinerentcar@gmail.com" node insertion_methode/dangerous/dangerous_wipe_owner.mjs
    ```
    *This script performs owner profile email validation against Supabase before proceeding, deletes bookings, handovers, and installments, and prints a success summary.*

---

## 3. Step 1: Insert Clean Clients
1.  Place the cleaned client CSV (e.g. `client_new.csv`) in the project root directory.
2.  **Dry-Run (Simulation)**: Execute the client import script. By default, it runs in dry-run mode and will not modify the database:
    ```bash
    node insertion_methode/examples/elinerentcar@gmail.com/insert_clients.mjs
    ```
3.  **Real Import**: If the counts and logs look correct, execute the script with the confirmation flag:
    ```bash
    CONFIRM_REAL_INSERT=true node insertion_methode/examples/elinerentcar@gmail.com/insert_clients.mjs
    ```

---

## 4. Step 2: Insert Clean Bookings
1.  Place the cleaned reservations CSV (e.g. `reservations_cleaned_to_import (4).csv`) in the project root directory.
2.  **Dry-Run (Simulation)**: Execute the bookings import script. It runs in dry-run mode, checks validations, and exports any invalid lines to `bookings_import_needs_review.csv`:
    ```bash
    node insertion_methode/examples/elinerentcar@gmail.com/insert_bookings.mjs
    ```
3.  **Real Import**: If no issues remain (or you have resolved them in the CSV), execute the script with the confirmation flag:
    ```bash
    CONFIRM_REAL_INSERT=true node insertion_methode/examples/elinerentcar@gmail.com/insert_bookings.mjs
    ```
    *Note: The script does not auto-create dummy vehicles, fallback dates, or merge uncertain client names. Any row with these issues is skipped and logged in the needs-review report.*

---

## 5. Verification Checks
After the scripts finish successfully, verify the database counts using the dashboard:
*   Verify that the counts match your cleaned CSV totals.
*   Log into the dashboard as the owner and check the **Calendar**, **Reservations list**, and **Clients CRM** to ensure they load properly.
