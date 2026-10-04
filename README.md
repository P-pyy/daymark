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
├── public/                 Static icons and brand assets
├── src/
│   ├── App.tsx             Application screens and task workflows
│   ├── AccountDialog.tsx   Google profile, sign-in, and sync status
│   ├── SettingsDialog.tsx  Appearance and profile settings
│   ├── TaskComposer.tsx    New-task form
│   ├── TaskDetailsDialog.tsx Task details, notes, and checklist
│   ├── TaskItem.tsx        Task row and inline editing
│   ├── taskStorage.ts      Browser task persistence
│   ├── taskSync.ts         Cloud sync and offline deletion queue
│   ├── taskTypes.ts        Task and category types
│   ├── taskUtils.ts        Date and sorting helpers
│   └── TodoReference.css   Application styles
├── supabase/
│   ├── functions/          Server-side sign-in email function
│   └── migrations/         Account-owned task schema and policies
├── package.json            Dependencies and commands
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

## Data and privacy

Tasks are stored locally in your browser under `daymark.tasks.v1`; account sync is optional. Cloud task records are private to their owner under Supabase Row Level Security. Clearing browser storage removes the local copy, but does not delete the cloud account's tasks. The app does not request Gmail inbox access.
