# MarginCheck

MarginCheck helps small contractors compare estimated job costs with actual labour and expenses. This version uses Firebase Authentication, Cloud Firestore, and Firebase Storage while keeping financial calculations in the browser.

## Current scope

- Email/password signup, login, logout, and protected job routes.
- User-scoped jobs, labour entries, and expenses in Cloud Firestore.
- Receipt images and PDFs in Firebase Storage.
- Per-job currency, deterministic profitability calculations, dashboard summaries, and job-risk indicators.
- An explicit, retry-safe import for legacy localStorage and IndexedDB data.

AI/OCR, accounting integrations, and currency conversion are not included.

## Setup

Install dependencies and create the local environment file:

```bash
npm install
Copy-Item .env.example .env.local
```

Populate these values in `.env.local` using the Firebase web app configuration from Firebase Console:

```text
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Private routes redirect unauthenticated users to `/login`.

## Routes

- `/login` — email/password login
- `/signup` — email/password account creation
- `/dashboard` — jobs overview and deterministic performance summaries
- `/jobs/new` — new job form
- `/jobs/[id]` — job profitability and activity detail
- `/` — redirects to the dashboard

## Firebase data model

```text
users/{userId}/jobs/{jobId}
users/{userId}/jobs/{jobId}/labourEntries/{entryId}
users/{userId}/jobs/{jobId}/expenses/{expenseId}
users/{userId}/migrations/local-v1
```

Receipts use this Storage path:

```text
users/{userId}/jobs/{jobId}/receipts/{receiptId}/{filename}
```

Firestore stores source data only. Estimated totals, actual totals, profit, margin, variances, risk status, insights, and profit per labour hour continue to be derived by the TypeScript utilities in `lib/calculations.ts`.

## Security rules

`firestore.rules` and `storage.rules` restrict access to an authenticated user's own `users/{userId}` paths. Storage additionally limits receipts to JPEG, PNG, or PDF files up to 10 MB.

To select the Firebase project and deploy only the rules:

```bash
npx firebase-tools login
npx firebase-tools use --add
npx firebase-tools deploy --only firestore:rules,storage
```

Rules are not deployed by application startup or by the test commands.

## Legacy browser-data import

After signing in, the Dashboard detects jobs in the legacy `margincheck_jobs`, `margincheck_labour_entries`, and `margincheck_expense_entries` localStorage keys. It offers an explicit import and attempts to upload referenced receipt blobs from the legacy `margincheck_receipts` IndexedDB database.

The import preserves record IDs, skips records already present, and writes a per-user completion marker only after all writes finish. It never deletes the local data. If a receipt reference exists but its IndexedDB blob is unavailable, the expense metadata is preserved and the missing file is reported when viewed.

## Verification

```bash
npx next typegen
npx tsc --noEmit
npm run lint
npm test
npm run test:rules
npm run build
git diff --check
```

`npm run test:rules` starts temporary Authentication, Firestore, and Storage emulators through `npx firebase-tools`; Java is required.
