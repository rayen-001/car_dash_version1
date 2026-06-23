# RentCar Owner Data Insertion Method

This folder organizes and documents the standardized method for cleaning, validating, and importing RentCar owner data (vehicles, clients, bookings, installments, handovers) into the existing CRM system.

---

## Folder Structure

```text
insertion_methode/
├── README.md                  # This introduction and workflow overview
├── docs/
│   ├── system_overview.md     # CRM database layout, RLS policies, and multitenancy
│   ├── data_prerequisites.md  # Information required from the owner before starting
│   ├── cleaning_guidelines.md # Step-by-step cleaning rules (accents, formats, dates)
│   ├── validation_rules.md    # Data consistency and sanity check guidelines
│   └── execution_steps.md     # How to safely dry-run and insert data
├── dangerous/
│   └── dangerous_wipe_owner.mjs # Isolated script to wipe owner database records (requires flags)
└── examples/
    └── elinerentcar@gmail.com/
        ├── colab_clean_clients.py      # Google Colab client extraction script
        ├── colab_clean_reservations.py # Google Colab reservation extraction script
        ├── insert_clients.mjs          # Supabase client import script (dry-run by default)
        └── insert_bookings.mjs         # Supabase reservation/booking import script (dry-run by default)
```

---

## Workflow Checklist

1.  **Collect Raw Data**: Obtain the raw Excel workbook from the owner.
2.  **Run Client Extraction**: Run the Python client cleaning script in Google Colab to generate `client_new.csv`.
3.  **Run Reservation Extraction**: Run the Python reservation cleaning script in Google Colab to generate `reservations_cleaned_to_import.csv`. Inspect `reservations_needs_review.csv` if generated.
4.  **Simulation Check (Dry-Run)**: Execute the client and booking scripts in dry-run mode to check counts and validation errors without writing to the database.
5.  **Insert Clients**: Execute the client insertion script with `CONFIRM_REAL_INSERT=true` to load CRM profiles.
6.  **Insert Bookings**: Execute the booking insertion script with `CONFIRM_REAL_INSERT=true` to link bookings, handovers, and installments.
7.  **Verify**: Log into the owner's dashboard and check that all stats and calendars load correctly.
