# ZeroStatic EV Bay Management

## Connect Supabase

Supabase email/password authentication and the initial protected facility schema
are implemented. Vehicle sessions, bay/config reads, session creation/departure,
charging progress, and realtime facility updates use Supabase.

1. In Supabase, open **Project Settings → API** and copy the **Project URL** and
   **publishable key**. Do not use or expose the `service_role` key in this browser app.
2. Copy `.env.example` to `.env` and fill in those values:

   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
   ```

3. Open **SQL Editor** in the Supabase dashboard, paste and run
   [`supabase/migrations/20261025134000_initial_schema.sql`](./supabase/migrations/20261025134000_initial_schema.sql).
   It creates profiles, a demo facility, two bays, facility settings, EV sessions,
   a profile-creation trigger, and Row Level Security policies.
   Then run [`supabase/migrations/20261025142000_facility_app_operations.sql`](./supabase/migrations/20261025142000_facility_app_operations.sql)
   to add secure session operations and enable Realtime.
4. In **Authentication → Providers**, make sure Email is enabled. Configure the
   site URL and redirect URL for local development (`http://localhost:5173`).
   Email confirmation may be enabled; if so, new users need to confirm their email
   before signing in.
5. Restart the Vite development server after editing `.env`, then sign up through
   the app. New accounts receive the `driver` role.
6. To promote your own account to facility admin, find its user ID under
   **Authentication → Users**, then run this in SQL Editor:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = 'YOUR_AUTH_USER_ID';
   ```

   Sign out and sign back in for the app to reload the role. Do not allow users to
   choose their role during signup.

The `.env` file is ignored by Git. The publishable key is intended for frontend
use; database access is protected by the migration's RLS policies. Never place a
service-role/secret key in frontend code or commit it.

Authenticated users can see the facility's active session details (driver name,
vehicle model, license plate, charging state) because those are shown in shared
bay/queue screens. The `facility_ev_sessions` view does not expose user IDs.
Users can create and depart only their own sessions; database functions handle
bay assignment and queue promotion atomically. Admin-only RLS policies protect
facility settings and bay management. Charging progress is synchronized only by
the session owner.

The browser's accelerated charging clock is a prototype simulation, not charger
telemetry. It advances while an owner's app is open and syncs progress periodically.
For production charging, move scheduling and charge-state authority to a trusted
backend or hardware integration rather than treating browser-generated progress as
real equipment data.

## Development

Run `npm run dev` to start the app, `npm run build` for the production build and
TypeScript check, `npm test` for tests, and `npm run lint` for linting.
