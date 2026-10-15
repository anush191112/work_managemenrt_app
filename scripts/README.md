# Data import scripts

`import-architects.mjs` accepts a CSV with these headers (case/spacing is flexible): `State`, `Serial No`, `Name`, `Phone`, `Email`, `Address`, `Birthdate` (or `DOB`).

```bash
node scripts/import-architects.mjs --mode strict --file /path/to/master.csv
node scripts/import-architects.mjs --mode clean --file /path/to/new-records.csv
```

Both modes reject the entire file when a `(state, serial_no)` is duplicated in the file or already exists in the database. `strict` rejects invalid phone/contact rows. `clean` normalizes Indian phones (removes `+91`/leading zero), nulls duplicate or invalid phones, and skips only rows left with neither a valid phone nor an email. It reports skipped line numbers.

The script reads `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env.local` or the shell. Never use the browser publishable key for imports.

Historic campaign/backlog data has deliberately not been seeded: it requires the campaign source data and an explicit owner ID for each owner stream, as agreed. Once supplied, it can be imported without reshaping the live task model.
