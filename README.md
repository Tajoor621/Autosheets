# AutoSheets

**Ultimate Fleet, Rental, Parking & Taxi Business & Accounting Mobile Application**

<p align="center">
  <img src="./assets/logo-gold.jpg" alt="AutoSheets Logo" width="320"/>
</p>

<p align="center">
  <strong>Dark-mode executive mobile app</strong> for car rental businesses, parking operators, taxi fleet managers and private transit entrepreneurs.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Expo-51-blue?logo=expo" alt="Expo"/>
  <img src="https://img.shields.io/badge/React%20Native-0.74-61dafb?logo=react" alt="React Native"/>
  <img src="https://img.shields.io/badge/Platform-iOS%20%7C%20Android%20%7C%20Web-lightgrey" alt="Platform"/>
  <img src="https://img.shields.io/badge/Offline--First-Ready-10B981" alt="Offline"/>
  <img src="https://img.shields.io/badge/Multi--Currency-USD%20EUR%20AED%20GBP%20JPY%20CAD%20SAR-8B5CF6" alt="Currency"/>
</p>

---

## Overview

**AutoSheets** is a production-oriented, offline-first mobile application purpose-built for the transit and automotive services industry. It unifies three core verticals under one executive dashboard:

| Vertical          | Capabilities                                      |
|-------------------|---------------------------------------------------|
| **Car Rentals**   | Agreements, deposits, daily/weekly rates, multi-currency invoices |
| **Parking**       | Hourly & flat tariffs, ticket logging, overstay tracking |
| **Taxi / Fleet**  | Dispatch, fare recording, driver–owner commission splits |

Designed for high-speed commercial environments with glassmorphism UI, neon telemetry indicators, and zero-clutter ergonomics.

---

## Features

### Authentication & Security
- Splash screen with branded logo
- Email / password login
- Biometric unlock (Face ID / Fingerprint) via `expo-local-authentication`
- Role-based workspace switching:
  - Fleet Owner
  - Rental Desk Agent
  - Parking Attendant
  - Dispatcher
  - Accountant

### Executive Dashboard (Command Center)
- Today’s Gross Revenue (Rentals + Parking + Taxis)
- Fleet Utilization %
- Active Rentals & Open Parking Slots
- Live Taxi Queue & Unsettled Fares
- Instant one-tap shortcuts:
  - Quick Rental Agreement
  - Log Parking Ticket
  - Dispatch Taxi Fare
  - Record Expense
- Header currency switcher (instant global toggle)

### Multi-Currency Financial Engine
Supported currencies with offline exchange rates:

| Code | Symbol | Name            |
|------|--------|-----------------|
| USD  | $      | US Dollar       |
| EUR  | €      | Euro            |
| GBP  | £      | British Pound   |
| AED  | د.إ    | UAE Dirham      |
| JPY  | ¥      | Japanese Yen    |
| CAD  | C$     | Canadian Dollar |
| SAR  | ﷼      | Saudi Riyal     |

- Real-time base currency configuration
- Dual-currency invoice preview (local + corporate base)
- Local rate table for fully offline calculation

### Specialized Modules
- **Rental Ledger** – daily rates, deposit holds, client details, agreement generation
- **Parking Management** – hourly / flat tariffs, plate entry, auto ticket
- **Taxi Dispatch** – fare entry + automatic driver/owner commission split
- **Expense Tracker** – Fuel, Maintenance, Tolls, Permits, Insurance
- **Fleet Assets** – live status, fuel, odometer, assignment
- **Financial Reports** – P&L by vertical, net profit, JSON / CSV export

### Offline-First Architecture
- Mock data + local structure ready for SQLite / SecureStore
- No mandatory cloud dependency
- Daily shift closing reports exportable as JSON or CSV

---

## Tech Stack

| Layer            | Technology                          |
|------------------|-------------------------------------|
| Framework        | Expo SDK 51 + React Native 0.74     |
| Navigation       | React Navigation 6 (Stack + Tabs)   |
| UI               | Custom glassmorphism + Ionicons     |
| Auth             | expo-local-authentication           |
| Storage (ready)  | expo-secure-store + SQLite pattern  |
| Styling          | StyleSheet + design tokens          |
| Currency Engine  | Pure JS offline converter           |

---

## Design System

```
Background:      #090D16
Surface:         #111827
Primary:         #3B82F6
Secondary:       #8B5CF6
Accent:          #06B6D4
Success:         #10B981
Warning:         #F59E0B
Danger:          #EF4444
Text Primary:    #F9FAFB
Text Secondary:  #9CA3AF
Gold (brand):    #D4AF37
```

Typography: Inter / SF Pro Display scale  
Radius: 12–16 px cards, full pills  
Glassmorphism cards with subtle borders and elevation

---

## Project Structure

```
AutoSheets/
├── App.js
├── app.json
├── package.json
├── babel.config.js
├── README.md
├── .gitignore
├── assets/
│   ├── logo-gold.jpg          # Primary brand logo
│   └── logo-silver.jpg        # Secondary / dark UI logo
└── src/
    ├── theme/
    │   └── index.js           # Colors, spacing, typography, radius
    ├── data/
    │   └── mockData.js        # Fleet, transactions, rates, roles, shift
    ├── utils/
    │   └── currency.js        # convertCurrency, formatCurrency
    ├── components/
    │   ├── GlassCard.js
    │   ├── MetricCard.js
    │   └── ShortcutButton.js
    ├── screens/
    │   ├── SplashScreen.js
    │   ├── LoginScreen.js
    │   ├── DashboardScreen.js
    │   ├── RentalScreen.js
    │   ├── ParkingScreen.js
    │   ├── TaxiScreen.js
    │   ├── ExpenseScreen.js
    │   ├── FleetScreen.js
    │   └── ReportsScreen.js
    └── navigation/
        └── AppNavigator.js
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo Go app on your phone (optional) or Android/iOS simulator

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/AutoSheets.git
cd AutoSheets

# 2. Install dependencies
npm install

# 3. Start the development server
npx expo start
```

### Run Options

| Key | Action                |
|-----|-----------------------|
| `a` | Open Android emulator |
| `i` | Open iOS simulator    |
| `w` | Open in web browser   |
| QR  | Scan with Expo Go     |

---

## Demo Credentials

| Field    | Value                    |
|----------|--------------------------|
| Email    | `owner@autosheets.com`   |
| Password | `demo1234`               |

Any role can be selected — the app is fully functional with the included mock data.

---

## Screens Overview

1. **Splash** – Branded gold logo + loading indicator  
2. **Login** – Credentials, role selector, biometric button  
3. **Dashboard** – Live metrics, currency switcher, 4 instant actions  
4. **Rental Agreement** – Vehicle select, client, days, deposit, multi-currency summary  
5. **Parking Ticket** – Plate, hourly/flat tariff, auto amount  
6. **Taxi Dispatch** – Select taxi, enter fare, live commission split  
7. **Expense** – Category chips + amount + note  
8. **Fleet** – All assets with status, fuel, assignment  
9. **Reports** – P&L by vertical, recent transactions, JSON/CSV export

---

## Roadmap / Next Steps (Production)

- [ ] Replace mock data with SQLite (WatermelonDB or expo-sqlite)
- [ ] Persist credentials with expo-secure-store
- [ ] Real PDF invoice generation
- [ ] Camera / document scanner for licenses & receipts
- [ ] Push notifications for unsettled fares
- [ ] Multi-user sync (optional cloud backend)
- [ ] Advanced analytics & charts
- [ ] Localization (AR / EN)

---

## Brand Assets

- `assets/logo-gold.jpg` — Primary logo (splash, invoices, marketing)
- `assets/logo-silver.jpg` — Secondary logo (dark surfaces, status bars)

Both logos are already wired into the app and Expo config.

---

## License

Private / Commercial use.  
**AutoSheets 621/24**

---

<p align="center">
  Built for high-speed commercial transit environments.<br/>
  Offline-first • Multi-currency • Executive grade
</p>
