# Coffee POS System

Coffee POS is a full-stack monorepo that contains:
- Official customer-facing website
- Public online ordering flow
- Staff POS system (cashier + manager roles)
- Express API with SQLite persistence
- KHQR payment generation/status integration

## 1) Frameworks And Core Stack

Frontend:
- React 19 (`react`, `react-dom`)
- Vite 8 (`vite`, `@vitejs/plugin-react`)
- Tailwind CSS 3 (`tailwindcss`, `postcss`, `autoprefixer`)
- Leaflet mapping (`leaflet`, `react-leaflet`)
- QR rendering (`qrcode.react`)
- Icon system (`lucide-react`)

Backend:
- Node.js ESM (`"type": "module"`)
- Express 5 (`express`)
- Built-in SQLite driver (`node:sqlite`, `DatabaseSync`)
- KHQR generation (`ts-khqr`)

Tooling:
- ESLint 9
- Concurrent dev runner (`concurrently`)

## 2) High-Level Architecture

The app is split into two frontend domains that share one backend:
- `src/Website`: public website, customer auth/profile, online checkout
- `src/POS`: internal POS system for store staff
- `src/shared`: shared API client, common UI, and utilities
- `server`: API routes, business rules, SQLite database access

Both Website and POS call `/api/*` endpoints on the same backend.

## 3) Repository Structure

```text
.
|-- public/                     # Static assets served by Vite
|-- src/
|   |-- app/                    # Entrypoint and route switcher
|   |-- Website/                # Website + online order experience
|   |-- POS/                    # Staff POS UI and flows
|   |-- shared/                 # Shared API/helpers/components
|   `-- assets/                 # Images/icons
|-- server/
|   |-- index.js                # Express server + route wiring
|   |-- database/
|   |   |-- db.js               # Schema, migrations, data operations
|   |   `-- seeds.js            # Initial category/product/table/order seed
|   `-- routes/
|       `-- khqr.js             # Isolated KHQR helper module
|-- docs/
|   `-- PROJECT_STRUCTURE.md
|-- package.json
`-- README.md
```

## 4) Frontend Routing

Route behavior from `src/app/RootRouter.jsx`:
- `/` -> Official website
- `/order`, `/online` -> Online ordering page
- `/pos`, `/admin` -> POS app
- `/account`, `/customer-login` -> Customer auth screen
- `/cart`, `/checkout` -> Website checkout mode (inside website screen)

## 5) Features

Website + customer features:
- Public product catalog from backend
- Public payment config endpoint (cash label + optional KHQR info)
- Customer register/login/logout
- Customer profile read/update
- Online order placement linked to POS order pipeline

POS features:
- Role-based login (`manager`, `cashier`)
- Order creation with payment/currency handling
- Order status updates with transition rules
- Table management (status/guest/pax/time + create table)
- Product/category management
- User management (manager-only)
- Settings management (manager-only write)
- Report summary endpoint

Inventory and audit:
- Stock deduction on order creation
- Stock restoration when order is canceled
- Movement ledger (`opening`, `sale`, `adjustment`)
- Delete product guard for audited products (history-protected)

Payments:
- Cash, Card, KHQR payment methods
- KHQR generation and status polling
- USD/KHR support with conversion helpers

## 6) Prerequisites

- Node.js `>= 22` (project currently runs on Node `v24.x`)
- npm `>= 10` recommended

Why Node 22+:
- Backend uses `node:sqlite` (built-in SQLite module).

## 7) Quick Start

1. Install dependencies:

```bash
npm install
```

2. Start backend + frontend:

```bash
npm run dev:all
```

3. Open:
- Website: `http://localhost:5173`
- Online order: `http://localhost:5173/order`
- POS: `http://localhost:5173/pos`
- API health: `http://localhost:4000/api/health`

## 8) Available Scripts

- `npm run dev`: start Vite frontend
- `npm run server`: start backend with Node watch mode
- `npm run server:once`: start backend once (no watch)
- `npm run dev:all`: run frontend and backend together
- `npm run build`: build frontend for production (`dist/`)
- `npm run preview`: preview built frontend
- `npm run lint`: run ESLint

## 9) Environment Variables

The backend reads `.env` at startup and before KHQR operations.

Core:
- `PORT` (optional, default `4000`)
- `POS_AUTH_PEPPER` (optional auth hash pepper)

KHQR/Bakong:
- `BAKONG_ACCOUNT_ID` (or `BAKONG_ACCOUNTID` / `accountID` / `accountId`)
- `BAKONG_MERCHANT_NAME`
- `BAKONG_MERCHANT_CITY`
- `BAKONG_MERCHANT_TAG` (`INDIVIDUAL` or `MERCHANT`)
- `BAKONG_STORE_LABEL`
- `BAKONG_TOKEN`
- `BAKONG_CHECK_BY_MD5_ENDPOINT` (optional override)

Static website KHQR fallback (optional):
- `PUBLIC_KHQR_QR`
- `WEBSITE_KHQR_QR`

Example `.env`:

```bash
PORT=4000
POS_AUTH_PEPPER=your-long-random-secret

BAKONG_ACCOUNT_ID=yourname@yourbank
BAKONG_MERCHANT_NAME=Bakehouse POS
BAKONG_MERCHANT_CITY=Phnom Penh
BAKONG_MERCHANT_TAG=INDIVIDUAL
BAKONG_STORE_LABEL=Bakehouse
BAKONG_TOKEN=your-bakong-bearer-token
# Optional:
# BAKONG_CHECK_BY_MD5_ENDPOINT=https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5
```

## 10) Authentication Model

Staff auth:
- Login via `POST /api/auth/login`
- Send token in `Authorization: Bearer <token>`
- Session is in-memory with 12-hour TTL

Public customer auth:
- Register/login via `/api/public/customers/*`
- Send token in `X-Customer-Session: <token>`
- Session is in-memory with 14-day TTL

Client storage keys:
- Staff token: `tenant-pos-auth-token`
- Public customer token: `tenant-public-customer-token`

## 11) Roles And Permissions

Roles:
- `manager`
- `cashier`

Access levels:
- Operator routes: `manager`, `cashier`
- Catalog/settings/user management routes: `manager` only

## 12) API Reference

Public (no staff auth):
- `GET /api/health`
- `GET /api/public/catalog`
- `GET /api/public/payment-config`
- `POST /api/public/khqr/generate`
- `GET /api/public/khqr/status/:md5`
- `POST /api/public/customers/register`
- `POST /api/public/customers/login`

Public customer session required:
- `GET /api/public/customers/me`
- `PATCH /api/public/customers/me`
- `POST /api/public/customers/logout`
- `POST /api/public/orders`

Staff authentication:
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Operator (`manager` + `cashier`):
- `GET /api/bootstrap`
- `GET /api/products`
- `POST /api/orders`
- `GET /api/orders/:orderNumber`
- `PATCH /api/orders/:orderNumber/status`
- `POST /api/khqr/generate`
- `GET /api/khqr/status/:md5`
- `PATCH /api/tables/:tableId`
- `POST /api/tables`
- `GET /api/settings`
- `GET /api/reports/summary`

Manager only:
- `POST /api/categories`
- `GET /api/inventory/movements`
- `POST /api/products`
- `POST /api/products/bulk`
- `PATCH /api/products/:productId`
- `DELETE /api/products/:productId`
- `PATCH /api/settings`
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:userId`

Quick API examples:

```bash
# 1) Staff login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"manager","password":"manager123"}'
```

```bash
# 2) Create POS order (replace <TOKEN>)
curl -X POST http://localhost:4000/api/orders \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "customerName":"Walk-in",
    "tableName":"Table 01",
    "orderType":"Dine In",
    "paymentMethod":"Cash",
    "paymentStatus":"Paid",
    "currency":"USD",
    "paymentCurrency":"USD",
    "amountReceived":5.50,
    "subtotal":5.00,
    "tax":0.50,
    "discount":0,
    "total":5.50,
    "items":[
      {
        "productId":"m11",
        "productName":"Espresso Shot",
        "quantity":1,
        "itemPrice":5.00,
        "totalPrice":5.00
      }
    ]
  }'
```

```bash
# 3) Register public customer
curl -X POST http://localhost:4000/api/public/customers/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName":"Alex",
    "email":"alex@example.com",
    "phone":"012345678",
    "address":"Phnom Penh",
    "password":"secret123"
  }'
```

```bash
# 4) Create online order (replace <CUSTOMER_TOKEN>)
curl -X POST http://localhost:4000/api/public/orders \
  -H "X-Customer-Session: <CUSTOMER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "customerName":"Alex",
    "phone":"012345678",
    "address":"Phnom Penh",
    "paymentMethod":"Cash",
    "items":[{"productId":"m11","quantity":1}]
  }'
```

## 13) SQLite Database

Database file:
- `server/pos.sqlite` (with WAL files `-wal` and `-shm`)

Tables auto-created on startup:
- `categories`
- `products`
- `dining_tables`
- `orders`
- `order_items`
- `inventory_movements`
- `users`
- `customer_accounts`
- `settings`
- `khqr_transactions`

Startup behavior:
- Schema setup/migrations run automatically
- Default data is seeded when empty
- Default users are created when user table is empty
- Default settings are inserted when settings table is empty

## 14) Business Rules

Order domain:
- Order types: `Dine In`, `Take Away`
- Order statuses: `Active`, `Closed`, `Done`, `Canceled`
- Payment statuses: `Paid`, `Unpaid`
- Payment methods: `Cash`, `KHQR`, `Card`

Order status transitions:
- `Active` -> `Active | Closed | Done | Canceled`
- `Closed` -> `Closed | Done | Canceled`
- `Done` -> `Done`
- `Canceled` -> `Canceled`

Payment guardrails:
- `Closed` or `Done` requires payment status `Paid`

Inventory rules:
- Creating an order deducts stock
- Canceling an order restores stock
- All stock changes create movement records
- Product deletion is blocked when product has movement history

Currency rules:
- Supported currencies: `USD`, `KHR`
- Exchange rate used in backend: `1 USD = 4100 KHR`

## 15) Demo Accounts

- `manager / manager123`
- `cashier / cashier123`

Change these credentials for real deployments.

## 16) Development Notes

Vite aliases (`vite.config.js`):
- `@` -> `/src`
- `@app` -> `/src/app`
- `@POS` -> `/src/POS`
- `@Website` -> `/src/Website`
- `@shared` -> `/src/shared`
- `@assets` -> `/src/assets`

Vite dev proxy:
- `/api` -> `http://localhost:4000`

## 17) Production Notes

Before production usage:
- Replace default passwords
- Set a strong `POS_AUTH_PEPPER`
- Use HTTPS and secure token handling
- Move session storage to persistent/shared store
- Add automated tests (currently no formal test suite in repository)
- Add monitoring, logging, and backup strategy for SQLite

## 18) Troubleshooting

`Request failed: 401`:
- Re-login and verify bearer token or `X-Customer-Session` header

KHQR errors:
- Check `BAKONG_ACCOUNT_ID` and `BAKONG_TOKEN`
- Verify outbound network access to Bakong API

Port conflict:
- Set `PORT` in `.env`
- Linux/macOS: `PORT=4100 npm run server:once`
- PowerShell: `$env:PORT=4100; npm run server:once`

Missing database:
- `server/pos.sqlite` is auto-created on first backend start

## 19) Additional Docs

- Project structure details: `docs/PROJECT_STRUCTURE.md`
