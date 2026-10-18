# Daymark

Daymark is a calm, local-first task manager for organizing everyday work. Create and manage personal tasks, keep track of due dates, and focus on what is due today.

## Features

- Create, edit, complete, restore, delete, and undo task deletion
- Organize tasks by Work, Personal, Home, and Learning
- View tasks due today or browse all tasks
- Search, filter, and sort tasks by status, due date, or priority
- Add plain-text notes and one-level checklists to tasks
- Choose light, dark, or system theme
- Keep tasks on this device and optionally sync them across devices with Google sign-in
- Get an email alert when a new sign-in is detected

## Stack

- React 19 and TypeScript
- Vite
- Supabase Auth, Postgres, and Realtime for optional accounts and task sync
- Resend for server-side sign-in email alerts
- Phosphor Icons
- Vitest and Testing Library

## Project structure

```text
daymark/
├── public/                 App icons, brand assets, and web manifest
├── src/
│   ├── App.tsx             App shell and navigation
│   ├── App.css             Global application styles
│   ├── features/
│   │   ├── tasks/          Task UI, local storage, sync, types, and tests
│   │   ├── calendar/       Calendar screen, date helpers, and tests
│   │   ├── notifications/  Reminder screens, preferences, and tests
│   │   └── profile/        Profile screen, account dialog, and tests
│   ├── shared/             Locale provider and Supabase client
│   ├── assets/             Imported app illustrations
│   └── test/               Shared test setup
├── supabase/
│   ├── functions/          Server-side sign-in email function
│   └── migrations/         Hosted task schema and policies
├── package.json            Dependencies and scripts
├── package-lock.json       Locked npm dependency tree
└── vite.config.ts          Vite configuration
```

## Getting started

Install [Node.js](https://nodejs.org/) and npm, then run:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite in your browser.

## Optional account setup

Tasks work locally without an account. To enable Google sign-in, email alerts, and cross-device sync:

1. Create a Supabase project and configure Google as an Auth provider. Create a Google OAuth web client and add the callback URL shown by Supabase. Add your app origins and redirect URLs to the Supabase Auth URL configuration.
2. Create `.env.local` from `.env.example` and set the project URL and publishable key (or legacy anon key). Set the same `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values in the production host.
3. Install the [Supabase CLI](https://supabase.com/docs/guides/cli), sign in, link this project, and apply the database migrations:

   ```sh
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

   If you already applied the original task-sync migration, apply the follow-up migration too. It changes task IDs from UUID to text so older local tasks with string IDs can sync without being renamed.

4. Create a Resend API key with Sending access. For local testing, use Resend's `onboarding@resend.dev` test sender. For production, verify a sending domain and use an address on that domain. Configure the function secrets and deploy the sign-in email function:

   ```sh
   npx supabase secrets set RESEND_API_KEY=YOUR_RESEND_API_KEY RESEND_FROM_EMAIL=onboarding@resend.dev APP_ORIGIN="http://localhost:5173,https://your-app.example"
   npx supabase functions deploy send-login-notice
   ```

   For production, replace the sender and origin with your verified sender address and deployed app origin. `APP_ORIGIN` accepts a comma-separated list of allowed app origins, without trailing slashes. Supabase supplies its project URL and service keys to deployed Edge Functions. Never put a service-role key or Resend key in a `VITE_` variable or browser code.

The first account sync merges existing local tasks into the account. Changes sync when online; concurrent edits use the most recently edited version. Sign-out is disabled until pending changes sync and clears that account's local task cache from the device. Google sign-in requests identity, email, and profile scopes only. Daymark does not read the Gmail inbox. A notice is sent to the verified account email by the server-side Resend function.

For local development, include the local app origin in `APP_ORIGIN` when testing sign-in email delivery. Until Supabase, Google OAuth, Resend, and the host environment are configured, the profile dialog explains that account setup is unavailable.

## Commands

```sh
npm run dev       # Start the development server
npm run build     # Type-check and create a production build
npm run preview   # Preview the production build
npm run lint      # Run ESLint
npm run test:run  # Run the test suite once
```

## Docker

The production Compose service builds the Vite app from the npm lockfile and serves its static output with unprivileged Nginx on port 8080. The separate development Compose file runs Vite with source hot reload on port 5174. Daymark tasks remain in browser storage; optional authentication, Postgres, Realtime, and the sign-in email Edge Function remain hosted by Supabase. Docker does not deploy or replace those services.

Docker Desktop must be running. To enable optional Supabase features, configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` using `.env.example` as a template. They are public browser settings embedded in the frontend build, not server secrets. Without them, local task features still work and account features remain unavailable. Never place a Supabase service-role key or Resend key in this file or the Docker build.

Run the production container from PowerShell:

```powershell
docker compose --env-file .env.local -f compose.yaml up --build -d
```

If you do not have `.env.local`, start without `--env-file .env.local`; hosted Supabase features will be unconfigured unless the two public settings are otherwise supplied to Compose.

Run the development container with hot reload instead:

```powershell
docker compose --env-file .env.local -f compose.dev.yaml up --build -d
```

Useful Docker Desktop / PowerShell commands:

```powershell
# Open the app
Start-Process http://localhost:8080 # Production
Start-Process http://localhost:5174 # Development

# View status and health, or follow logs
docker compose -f compose.yaml ps
docker compose -f compose.yaml logs -f daymark
docker compose -f compose.dev.yaml ps
docker compose -f compose.dev.yaml logs -f daymark-dev

# Stop either setup; this does not delete browser task data
docker compose -f compose.yaml down
docker compose -f compose.dev.yaml down

# Rebuild after dependency, source, or configuration changes
docker compose -f compose.yaml up --build -d
docker compose -f compose.dev.yaml up --build --renew-anon-volumes -d
```

The production container exposes only `127.0.0.1` on the host by default. Change `DAYMARK_PORT` or `DAYMARK_DEV_PORT` in `.env.local` to use another host port. For Docker-based Google sign-in tests, add `http://localhost:5174` to the Supabase Auth redirect URLs and the hosted Edge Function's `APP_ORIGIN`; configure the production app origin there before deploying. For an empty local task list, use a fresh browser profile or clear this site's storage in browser settings; task data is not stored in a Docker volume. No database migration command is needed for Docker: apply Supabase migrations with the Supabase CLI as described above. `docker compose down` preserves Docker-managed data; this setup defines no database volume, and `down -v` is unnecessary.

## Data and privacy

Tasks are stored locally in your browser under `daymark.tasks.v1`; account sync is optional. Cloud task records are private to their owner under Supabase Row Level Security. Clearing browser storage removes the local copy, but does not delete the cloud account's tasks. The app does not request Gmail inbox access.
