# Daymark

Daymark is a calm, local-first task manager for organizing everyday work. Create and manage personal tasks, keep track of due dates, and focus on what is due today.

## Features

- Create, edit, complete, restore, delete, and undo task deletion
- Organize tasks by Work, Personal, Home, and Learning
- View tasks due today or browse all tasks
- Search, filter, and sort tasks by status, due date, or priority
- Add plain-text notes and one-level checklists to tasks
- Choose light, dark, or system theme
- Save tasks in browser storage; no account or server required

## Stack

- React 19 and TypeScript
- Vite
- Phosphor Icons
- Vitest and Testing Library

## Project structure

```text
daymark/
├── public/                 Static icons and brand assets
├── src/
│   ├── App.tsx             Application screens and task workflows
│   ├── TaskComposer.tsx    New-task form
│   ├── TaskDetailsDialog.tsx Task details, notes, and checklist
│   ├── TaskItem.tsx        Task row and inline editing
│   ├── taskStorage.ts      Browser task persistence
│   ├── taskTypes.ts        Task and category types
│   ├── taskUtils.ts        Date and sorting helpers
│   └── TodoReference.css   Application styles
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

## Commands

```sh
npm run dev       # Start the development server
npm run build     # Type-check and create a production build
npm run preview   # Preview the production build
npm run lint      # Run ESLint
npm run test:run  # Run the test suite once
```

## Data and privacy

Tasks are stored locally in your browser under `daymark.tasks.v1`. Clearing browser storage removes saved tasks. Daymark currently has no cloud account or synchronization.
