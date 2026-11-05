# AutoSheets

Offline accounting for fleet, rental, parking, and taxi operators. The published app keeps the books in the browser: income, expenses, deposits, receivables, and printable statements.

**Live app:** [https://tajoor621.github.io/Autosheets/](https://tajoor621.github.io/Autosheets/)

<p align="center">
  <img src="./assets/icon-512x512.png" alt="AutoSheets logo: a gold car, rising bars, and a check mark" width="160">
</p>

<p align="center">
  <img src="./assets/screenshot-desktop.png" alt="AutoSheets dashboard with revenue, today's activity, receivables, deposits, and shortcuts for rental, parking, taxi, and expenses" width="720">
</p>

The cash figure on the balance sheet is a running total of entries in this browser. AutoSheets does not connect to a bank.

## What you can do

- Sign in with email and password, or unlock the same browser with a 4–6 digit PIN.
- Work as Fleet Owner, Rental Desk, Parking Attendant, Dispatcher, or Accountant. Every role can use the full set of books.
- Post rental agreements, parking tickets, taxi fares, expenses, customer receipts, and vendor payments.
- Keep customers, opening balances, and a fleet list with plate, status, book value, odometer, and service due.
- Switch the book currency among USD, EUR, AED, GBP, SAR, and PKR. Symbols change. Amounts are not converted.
- Read a ledger with debit and credit, profit and loss, a balance sheet, customer statements, a monthly summary, and receivables aging.
- Print or share a voucher, a day sheet, profit and loss, the balance sheet, and a customer statement.
- Export a JSON backup or a CSV ledger, and import a JSON backup without changing the password or PIN.

Rental agreements can hold a security deposit, an odometer-out reading, and a return date. An overdue return and a due service show under Needs attention. Marking the vehicle returned sets that asset back to Available. A fuel or service expense can update the odometer when the reading is higher.

Taxi commission is the driver share of the fare. The full fare is still taxi income. The driver and owner amounts are stored on the entry.

## Demo sign-in

The sign-in on the public page is a **demo only**. It is not a company account.

| Field | Value |
| --- | --- |
| Email | `owner@autosheets.com` |
| Password | `demo1234` |

A new email is saved in this browser when the password is at least 4 characters. Use a password you do not use anywhere else. Passwords and the PIN stay in `localStorage` on this device. They are not sent to a server.

## Your books stay on this device

Nothing is uploaded when you add a customer, a vehicle, or an entry. Clearing the site data for this browser deletes the books, so export a backup first.

The JSON backup includes the signed-in email and role. It does not include the password or PIN. Importing a file replaces customers, fleet, entries, rates, and the company name, and leaves sign-in and the PIN alone.

The app also installs as a standalone page and can open again from the cache when the network is down. While you are online, the page itself is loaded fresh.

## Using the pages

| Place | What it is |
| --- | --- |
| Home | Revenue, today, receivables, cash, deposits, fleet use, overdue rentals, and shortcuts |
| Clients | Customers and what each one owes |
| Ledger | Every entry, with search and a debit / credit total |
| Reports | Profit and loss, balance sheet, customer statement, month, and aging |
| Settings | Company name, PIN, default rates, role, export, import, and clear entries |

These addresses open the matching page after sign-in:

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

Open [http://127.0.0.1:8765/](http://127.0.0.1:8765/). GitHub Pages publishes the same files from `main`. `.nojekyll` keeps the asset paths as they are.

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
├── manifest.json       # Installable app metadata
├── sw.js               # Offline cache
├── assets/             # Icon and screenshots
├── App.js              # Optional Expo shell
└── src/                # Expo screens, navigation, and sample data
```

## Rights

This repository does not include a license file. All rights remain with the copyright holder.
