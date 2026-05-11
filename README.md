# Budget

A minimal personal budgeting PWA. Mobile-first, installable to home screen, works as a desktop web app too. All data stored locally in your browser (no backend, no accounts).

## Features

- Track income and expenses for any month
- Auto-log salary on a configurable pay day (default: 10th of the month)
- Set currency (any ISO code, e.g. USD, EUR, GBP)
- Export / import / reset your data (JSON)
- Installable as a PWA on iOS / Android / desktop

## Stack

- Next.js 15 (App Router) + React 19
- Tailwind CSS
- localStorage for persistence
- Deploys to Vercel with zero config

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy

Push to GitHub and import into Vercel — it's auto-detected as a Next.js app.

## Data

All transactions and settings are stored in `localStorage` under:

- `budget.txns.v1`
- `budget.settings.v1`

Clearing your browser's site data wipes everything. Use **Settings → Export data** to back up.
