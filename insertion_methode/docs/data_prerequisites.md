# Owner Data Prerequisites

This document lists the information and column structures required from a RentCar owner before starting any data cleaning and import.

---

## 1. Owner Profile Information
Before running any script, you must have the owner's details:
*   **Owner Email**: e.g., `elinerentcar@gmail.com`
*   **Owner UUID**: Resolved from Supabase auth users (e.g., `ffce4379-9630-4c82-8a21-e9445c1f977d`).

---

## 2. Raw Excel Sheet Requirements
The raw Excel file must contain a main sheet (typically named `tous`) representing the master booking ledger.

### Expected Columns (Arabic / French)
The raw sheet must contain the following columns (exact spelling may vary slightly due to encoding or accents):

| Standardized Concept | Excel Column Name (Fuzzy Matcher Key) | Description / Format |
| :--- | :--- | :--- |
| **Contract Number** | `N Contrat` | Unique identifier of the paper contract |
| **Client Phone** | `Num Tlf` | Client telephone (8 digits) |
| **Client Name** | `Nom et prénom` | Full name of the driver/renter |
| **Vehicle Brand** | `Marque` | Car manufacturer and model (e.g., KIA, POLO) |
| **License Plate** | `Immatriculation` | Car registration number (e.g., 224TU2310) |
| **Start Date** | `Date de départ` (often read as `Date de dpart`) | Day of vehicle pickup |
| **Pickup Time** | `Heure de départ` | Time of vehicle pickup (HH:MM or Xh) |
| **Return Date** | `Date de retour` | Day of vehicle return |
| **Return Time** | `Heure de retour` | Time of vehicle return (HH:MM or Xh) |
| **Duration (Days)** | `nbr de jour` | Number of rental days (can be `3`, `3+2`, `5+`) |
| **Client Birthday** | `Date de naissance` | Date of birth of client |
| **Client CIN** | `Num CIN` | ID Card Number (8 digits) |
| **CIN Deliv. Date** | `délivré le` (often read as `dlivr le`) | CIN issuance date |
| **Client Permit** | `Num Permis` | License number |
| **Permit Deliv. Date**| `Délivé le ` (often read as `Dliv le `) | Permit issuance date |
| **Deposit Paid** | `ACOMPTE` | Amount paid at pickup (or explanation text) |
| **Remaining Due** | `RESTE` | Balance remaining to pay |
| **Cleanliness** | `Lavage` | Cleanliness status (e.g., Clean, Dirty, Ndhifa) |
| **Fuel Level** | `Niveau d'essence` | Fuel level at pickup (e.g., Full, 1/2, 1/4) |
| **Starting Mileage** | `kilométrage de départ` (read as `kilomtrage`) | Car odometer mileage at handover |
| **Client Address** | `ADRESSE` | Renter's home address |
| **Remarks** | `Remarque` | Miscellaneous damage or vehicle notes |
| **Additional Note** | `NOTE` | Additional comments |

---

## 3. Typo and Encoding Resilience
Because Excel sheets are often created in French/Arabic, character encodings (UTF-8, Latin-1, CP1252) can corrupt accented characters during parsing. For instance:
*   `Date de départ` becomes `Date de dpart` (missing `é`).
*   `délivré le` becomes `dlivr le`.
*   `Délivé le ` becomes `Dliv le `.

Our Google Colab scripts use **fuzzy substring matchers** (like looking for `'part'` to find `'Date de départ'`) to remain immune to these encoding discrepancies.
