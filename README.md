# Northstar Transaction Ledger

A client-side finance ledger and policy-rule demo built with standalone Angular components. All transaction and rule data stays in browser `localStorage`; no backend or API is used.

## Run locally

```bash
npm install
npm start
```

Open the local URL printed by Angular CLI (usually `http://localhost:4200`).

Run the unit tests with:

```bash
ng test --watch=false
```

Create a production build with `npm run build`.

## Features

- 40 seeded transactions, local CSV import, and a reset-to-demo action.
- Merchant search is debounced; category, status, and amount filters are reflected in URL query parameters.
- Click a transaction to open its routed detail drawer, edit its status or notes, and undo a save for five seconds.
- Create, edit, enable, disable, and delete rules. Rules support ALL/ANY logic, Warning/Blocker severity, and Amount, Merchant, Category, or Weekend Transaction conditions.
- Rule violations update on the ledger as transaction data or rules change.
- Browser storage errors are shown in the app rather than silently ignored.

CSV files need `merchant`, `category`, and `amount` headers. Optional headers are `date`, `status`, and `notes`. Imported statuses not matching Approved, Flagged, or Pending default to Pending.

Use **Sample CSV** on the ledger page to download an Excel-compatible example file, then choose **Import CSV** to append its rows. **Reset demo data** replaces the current transaction list (including imported transactions and transaction edits) with the original 40 demo transactions. It does not change policy rules or active filters.

## Structure and decisions

- App-level files (`app.ts`, `app.config.ts`, `app.routes.ts`, and app shell styles/template) are kept directly in `src/app/`.
- Global and component styles use SCSS; new Angular components default to SCSS.
- `src/app/services/ledger.service.ts` owns local storage, CSV parsing, filtering, validation, and rule evaluation.
- `src/app/models/models.ts` contains the small set of data types and demo records.
- `src/app/components/ledger/` implements filtering and the ledger table; the transaction editor is a child route rendered as a slide-over drawer.
- `src/app/components/rules/` uses a reactive `FormArray` for editable rule conditions and a route guard for unsaved changes.
- Routes lazy-load the ledger, transaction drawer, and rules page. Components use `OnPush`; synchronous derived views use signals and search uses RxJS.
- `src/app/services/ledger.service.spec.ts` covers AND/OR evaluation, cross-field validation, and debounced search.

The demo data is generated in `models.ts` and is intended for assessment use, not as real financial data.
