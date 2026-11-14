# AutoSheets

An installable car rental desk and accounting app for fleet operators. The published app stores its books in the browser and also supports parking and taxi entries.

**Live app:** [https://tajoor621.github.io/Autosheets/](https://tajoor621.github.io/Autosheets/)

<p align="center">
  <img src="./assets/icon-512x512.png" alt="AutoSheets logo: a gold car, rising bars, and a check mark" width="160">
</p>

<p align="center">
  <img src="./assets/screenshot-desktop.png" alt="AutoSheets dashboard with revenue, today's activity, receivables, deposits, and shortcuts for rental, parking, taxi, and expenses" width="720">
</p>

The cash figure on the balance sheet is a running total of entries in this browser. AutoSheets does not connect to a bank.

## What you can do

- Configure an encrypted workspace, or open a temporary one to try the interface.
- Post rental agreements, parking tickets, taxi fares, expenses, customer receipts, vendor payments, and multi-line journals.
- Review trial balance, account-by-account general ledger, profit and loss, balance sheet, cash movements, receivables aging, and vehicle contribution.
- Reconcile cash, bank, and card clearing against a statement balance, with outstanding items carried forward. Reconciliation is manual.
- Close a posting period and track changes in the workspace activity log. Correct posted journals with a reversing journal.
- Choose USD, EUR, AED, GBP, SAR, or PKR before entering posted or opening balances. The app uses a single book currency.
- Print vouchers and statements, download CSV reports, and restore encrypted or legacy JSON backups.

## Car rental workflow

1. Set the book currency, company invoice address, tax registration number and default rental tax rate in Settings. The default tax rate is zero and each booking can override it. Configure rates to match your business.
2. Add vehicles and customers. Fleet records track service, registration and insurance expiry. Customer records can track driving licence expiry and a tax registration reference.
3. Open **Rentals** to check vehicle availability and reserve a pickup and return window. Use daily, weekly or monthly units, a negotiated rate, discount, included kilometres and pickup or return instructions. A reservation stays off the books until checkout.
4. At checkout, record the odometer, fuel, condition, security deposit and any first payment. AutoSheets issues the rental invoice. Print the agreement or invoice from its record.
5. Extend an open rental if the vehicle is available. At return, record the odometer, fuel and condition. Excess distance charges use the included distance and rate on the agreement. Add late, fuel, Salik, parking, traffic fine or damage charges as appropriate.
6. Record partial or full invoice payments. Refund or apply a security deposit to the amount due. Issue a credit note against an invoice and record a payment refund if it creates a customer credit.

Issued invoices and their transactions post to the journal. Rental reports include a date-filtered invoice and tax register, vehicle contribution from recorded revenue and expenses, rental cash movements and current agreement balances. Export the reports as CSV or print them. Existing rentals still open in their original entry editor. The reports treat customer receipts as collections against receivables and unassigned receipts as other income.

Taxi commission is the driver share of the fare. The full fare posts as taxi income. Record the driver payout separately if it applies.

## Workspace security

The existing site's books migrate in place once you create a new vault passphrase. AutoSheets writes the encrypted vault before removing its legacy plaintext keys, including the old password and PIN records. The public demo login is replaced by a temporary workspace when the browser has no books.

- AutoSheets encrypts the local snapshot and backups with Web Crypto AES-256-GCM. The vault derives its key from your passphrase using PBKDF2-HMAC-SHA-256 with a random salt and 600,000 iterations.
- The passphrase stays in memory while unlocking or changing it. The derived key stays in the unlocked tab. Reloading or locking the tab clears the live workspace, and inactivity locks it after 10 minutes.
- Keep an encrypted backup and your passphrase safe. Backups use the passphrase from the time of export. There is no server that can recover it. CSV exports and printouts contain readable business data.
- Work modes are local labels. The activity log is part of the encrypted workspace and is not an independent or immutable audit trail. Browser extensions, a compromised device, or compromised deployed code can expose an unlocked workspace.
- The installed web app caches its application files for offline use. The books live in this browser's storage. AutoSheets has no shared staff accounts, live bank feeds, payment processing or government tax submission.

## Using the pages

| Place | What it is |
| --- | --- |
| Home | Revenue, today, receivables, cash, deposits, fleet use, overdue rentals, and shortcuts |
| Rentals | Availability, reservations, inspection, documents, invoicing, payments and deposits |
| Clients | Customers and what each one owes |
| Ledger | Every entry, with search and a debit / credit total |
| Reports | Profit and loss, balance sheet, customer statement, month, aging, and rental accounting reports |
| Settings | Company details, vault passphrase, default rates, work mode, encrypted backup, and restore |

These addresses open the matching page after vault unlock:

- [Home](https://tajoor621.github.io/Autosheets/#dashboard)
- [Rental](https://tajoor621.github.io/Autosheets/#rental)
- [Parking](https://tajoor621.github.io/Autosheets/#parking)
- [Taxi](https://tajoor621.github.io/Autosheets/#taxi)
- [Reports](https://tajoor621.github.io/Autosheets/#reports)

## Run the website locally

The site is static. From this folder:

```bash
python3 -m http.server 8765
```

Open [http://127.0.0.1:8765/](http://127.0.0.1:8765/). GitHub Pages publishes the same files from `main`. Run `node --test tests/*.test.cjs` to check rental accounting, closing, reconciliation, and the vault. `.nojekyll` keeps the asset paths as they are.

## Optional Expo app

`App.js` and `src/` are a separate React Native / Expo shell with its own sample fleet. It does not read or write the books from the website. Sign-in there is also a demo: the sample email and password are filled in so the screens can be opened. Biometric unlock is attempted on a device that has it, and otherwise the demo sign-in continues.

```bash
npm install
npx expo start
```

Node.js 18 or newer is enough for that shell. The published website does not need Node.

## Layout

```
AutoSheets/
├── index.html          # Published accounting app
├── web-app.js          # Web workspace and business workflows
├── vault.js            # Authenticated encryption
├── accounting*.js      # Accounting engine and report UI
├── manifest.json       # Installable app metadata
├── sw.js               # Offline cache
├── assets/             # Icon and screenshots
├── App.js              # Optional Expo shell
└── src/                # Expo screens, navigation, and sample data
```

## Rights

This repository does not include a license file. All rights remain with the copyright holder.
