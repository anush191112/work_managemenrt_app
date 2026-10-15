# Master Data Import Runbook

This runbook loads the architect, birthday-only, and historical campaign workbooks after the app schema is deployed. Do not start an import until every migration in step 1 succeeds.

## 1. Apply database migrations

Apply migrations in filename order from `supabase/migrations/`:

1. `20250908180000_initial_schema.sql`
2. `20250908180001_rls_and_helpers.sql`
3. `20250908180002_triggers_storage.sql`
4. `20250908180003_backfill_auth_profiles.sql`
5. `20250908180004_grant_api_table_privileges.sql`
6. `20250908180005_task_progress_guard.sql`
7. `20250908180006_task_assignment_notifications.sql`
8. `20260913090000_pool_task_engine.sql`
9. `20260913100000_architects_campaigns_and_leads.sql`
10. `20260927110000_architect_import_storage.sql`
11. `20261014120000_birthday_contacts_shared_campaigns.sql`

Run these against the same Supabase project whose URL is in `.env.local`. Confirm the `architects`, `birthday_contacts`, `campaigns`, `lead_sheet_backlogs`, and `architect_export_logs` tables exist before continuing.

## 2. Prepare source files

Use the `Full Name` column from `All_State_with_bday_Cleaned.xlsx`, not its derived `Name` column. Export each workbook sheet as a UTF-8 CSV before using the Node import scripts.

| Source workbook | CSV columns used | Destination |
| --- | --- | --- |
| `All_State_with_bday_Cleaned.xlsx` | State, Serial Number, Full Name, Mobile Number, Email Address, Address, Birthday | `architects` |
| `Unmatched_Birthday_Contacts.xlsx` | Name, Phone Number, Birthday | `birthday_contacts` |
| `Campaign_Data.xlsx` | Campaign columns | `campaigns` and the shared historical backlog |

`Birthday` values are stored as `2000-MM-DD`; exports ask users for `DD-MM` and match only month/day.

## 3. Import architects

The architect loader normalizes Indian numbers, accepts `Full Name` and `Birthday` header aliases, and preserves distinct names that share a phone. It skips only an exact duplicate `(name, phone)` pair or a record without a valid phone and valid email. It rejects the entire file only for duplicate `(state, serial_no)` values.

```bash
node scripts/import-architects.mjs --mode clean --file /absolute/path/architects.csv
```

For a 190k-row master, use a batched loader or split the CSV into smaller files before invoking the script. Record the inserted and skipped line counts for reconciliation.

## 4. Import birthday-only contacts

The birthday-only source never checks `architects`. It validates/normalizes phone numbers and stores exact source names. Duplicate phones within `birthday_contacts` are skipped with their line numbers.

```bash
node scripts/import-birthday-contacts.mjs --file /absolute/path/unmatched-birthdays.csv
```

## 5. Import historical campaigns and seed the shared backlog

Historical campaigns need a dedicated one-time loader because the workbook has no app user owner and some campaign names do not contain reliable state/serial data. Import them with:

- `created_by` set to the admin account that performs the import.
- `is_shared = true` and no individual `assigned_to`.
- `campaign_completed_on` and `retarget_completed_on` preserved from the workbook.
- `total_leads` recalculated by the database trigger.

Create one `Lead Sheet Backlog` task and one `lead_sheet_backlogs` row with `is_shared = true`. Link each incomplete historical campaign as a `lead_sheet_backlog_items` row. All authenticated employees can then view the shared backlog and see changes immediately.

## 6. Validate the loaded data

1. Compare source rows, inserted rows, and skipped lines for each import.
2. Confirm an architect phone shared by different names appears as separate architect rows.
3. Confirm a birthday phone present in both sources exports only once and uses the `birthday_contacts` name/address/email.
4. Run a birthday export for a `DD-MM` value and confirm the CSV uses the five columns, including `Country Code = 91`.
5. Update one of the five lead metric fields on a campaign and confirm `total_leads` changes automatically.
6. Confirm every employee can see the historical backlog, and an admin can reassign a non-shared campaign from its detail page.
