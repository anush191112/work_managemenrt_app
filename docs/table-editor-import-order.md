# Table Editor Import Order

The generated files live in `prepared-imports/`. Import them in this exact order from Supabase Table Editor using its CSV upload action.

1. Select `architects` and upload every `architects_*.csv` file in numeric order.
2. Select `birthday_contacts` and upload `birthday_contacts.csv`.
3. Import campaign CSVs through the prepared Node script, which correctly sends missing metrics as SQL `NULL` values. The Supabase Table Editor CSV importer treats those blanks as invalid empty strings for integer fields.
   ```bash
   node scripts/import-prepared-campaigns.mjs --file prepared-imports/campaigns_whatsapp.csv
   node scripts/import-prepared-campaigns.mjs --file prepared-imports/campaigns_email.csv
   ```
4. Select `leads` and upload `leads.csv`.
5. Select `lead_interactions` and upload `lead_interactions.csv`.

Do not upload `rejected_rows.csv`; it is a review report, not database input. The import files intentionally include only the columns accepted by each destination table. Empty CSV cells represent nullable database fields.

The `leads` import must finish before `lead_interactions`, because every interaction references the generated UUID of its shared lead contact. The campaign and lead CSVs already carry the internal historical-import owner reference required by the database.

Before importing historical email campaigns, run `20261015213500_nullable_email_campaign_leads.sql`. It preserves source rows where the reported Email `Total Leads` value is unknown as `NULL` rather than converting it to zero.
