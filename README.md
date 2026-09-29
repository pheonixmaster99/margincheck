# MarginCheck

MarginCheck is a local-first MVP for small contractors to compare estimated job costs with actual labour and expenses.

## Current scope

- Create jobs with an estimate and per-job currency.
- Track labour and expenses against each job.
- Calculate profit, margin, variances, and profit per labour hour.
- Review job activity and attach receipt images or PDFs.
- View deterministic dashboard summaries and jobs that need attention.

Firebase, authentication, AI/OCR, accounting integrations, and cloud receipt backup are not part of this baseline.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard).

Useful checks:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Routes

- `/dashboard` — jobs overview and deterministic performance summaries
- `/jobs/new` — new job form
- `/jobs/[id]` — job profitability and activity detail
- `/` — redirects to the dashboard

## Local persistence

- Jobs: `margincheck_jobs` in `localStorage`
- Labour: `margincheck_labour_entries` in `localStorage`
- Expenses and receipt metadata: `margincheck_expense_entries` in `localStorage`
- Receipt files: `margincheck_receipts` in IndexedDB

This data stays in the current browser profile and is not backed up or synchronized.
