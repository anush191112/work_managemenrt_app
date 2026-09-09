# Work Management App - Phase 1

Role-based daily task management for admins, managers, and employees. Phase 1 covers recurring task generation, manual work assignment, proof uploads, blockers, availability, deadline alerts, reporting, and audit activity.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set the Supabase project URL, publishable key, service-role key, and a long random `CRON_SECRET`.
3. Link the Supabase CLI to the target project, then apply the migrations with `npx supabase db push`.
4. Start the app with `npm run dev` and open `http://localhost:3000`.

The Supabase Auth signup trigger creates employee profiles for new Auth users. Use the Users screen as an admin to create users, assign managers, and set work days.

## Verification

Run the full local check before deployment:

```bash
npm test
npm run typecheck
npm run build
```

## Vercel deployment

Set these Vercel environment variables for every deployed environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

`vercel.json` schedules the following UTC jobs. Vercel invokes them with `Authorization: Bearer $CRON_SECRET`:

- `18:35` - generate the next IST day's recurring tasks
- `04:30` - morning deadline check (10:00 IST)
- `09:30` - afternoon deadline check (15:00 IST)

## Phase 1 acceptance checks

1. Sign in once as each role: admin, manager, and employee.
2. As admin, create an employee and assign a manager plus valid work days.
3. As manager, create a template and generate tasks; confirm the employee receives an assignment notification.
4. As employee, update status/progress, upload proof, and report a blocker. Confirm a manager can preview proof and see activity.
5. Verify proof-required tasks cannot be marked done without an upload, and counted progress cannot exceed its requirement.
6. Create, approve, reject, and cancel pending off-day requests. Confirm approved days shift incomplete work.
7. Create and remove a holiday. Removing it does not reverse a task shift already applied.
8. Create a task with a near deadline, invoke a deadline cron route with `Authorization: Bearer $CRON_SECRET`, and verify at-risk status plus notifications.

## Operational notes

- Apply all SQL migrations, including `20250908180005_task_progress_guard.sql` and `20250908180006_task_assignment_notifications.sql`, before deploying the corresponding application version.
- Task proof files stay in the private `task-proofs` bucket. Dashboard previews use short-lived signed URLs.
- Cron routes require `CRON_SECRET`; unauthenticated requests return `401`.
