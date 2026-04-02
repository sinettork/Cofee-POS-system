# Coffee POS System (React + SQLite)

Coffee POS with:
- `React + Vite` frontend
- `Express + SQLite` backend API
- Role-based login (`admin`, `manager`, `cashier`)
- Inventory stock + movement ledger (`opening`, `sale`, `adjustment`)

SQLite database:
- `server/pos.sqlite` (auto-created and auto-seeded on first run)

## Project Structure

Core folders:

- `src/` frontend app
- `src/constants/` shared UI constants/static datasets
- `server/` backend API
- `server/database/` SQLite access + seed data
- `server/routes/` isolated route helper modules
- `docs/` project documentation

Detailed tree and conventions:
- `docs/PROJECT_STRUCTURE.md`

## Run

1. Install dependencies:
```bash
npm install
```

2. Start frontend + backend:
```bash
npm run dev:all
```

3. Open:
- Official website: `http://localhost:5173`
- POS application: `http://localhost:5173/pos`
- API health: `http://localhost:4000/api/health`
- Online ordering page: `http://localhost:5173/order`

Backend port can be overridden if needed:

```bash
PORT=4100 npm run server:once
```

## KHQR Environment Setup

Add these variables in your `.env` (or server environment) before using KHQR payment:

```bash
BAKONG_ACCOUNT_ID=yourname@yourbank
BAKONG_MERCHANT_NAME=Bakehouse POS
BAKONG_MERCHANT_CITY=Phnom Penh
BAKONG_MERCHANT_TAG=INDIVIDUAL
BAKONG_STORE_LABEL=Bakehouse
BAKONG_TOKEN=eyJhbGciOi...
```

Optional override:

```bash
BAKONG_CHECK_BY_MD5_ENDPOINT=https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5
```

## Demo Login Accounts

- `admin / admin123`
- `manager / manager123`
- `cashier / cashier123`

## Available Scripts

- `npm run dev` - frontend only
- `npm run server` - backend only
- `npm run dev:all` - frontend + backend
- `npm run lint` - lint project
- `npm run build` - production build

## Implemented Workflows

- POS ordering flow with separate payment handling for Cash / KHQR / Card
- Order status guardrails and payment-state validation
- Inventory stock deduction on order create with insufficient stock checks
- Inventory movement logging for all stock changes
- Activity, report, and bootstrap screens from SQLite
- Role-based page and API access control
- Public online ordering flow connected to the same POS order pipeline

## Online Ordering (Public)

- Public menu endpoint:
  - `GET /api/public/catalog`
- Public order endpoint:
  - `POST /api/public/orders`

Example payload:

```json
{
  "customerName": "Alex",
  "phone": "012345678",
  "note": "Less sugar please",
  "items": [
    { "productId": "p001", "quantity": 1 },
    { "productId": "p004", "quantity": 2 }
  ]
}
```

## Frontend Routes

- `/` official website (customer-facing)
- `/order` online ordering page
- `/pos` POS system (staff login)
- `/online` alias of `/order`

## Stock Alert UX

- POS header bell icon opens a quick stock-alert popover
- Popover provides a direct link to Inventory
- Inventory page behavior:
  - Full `Stock Alerts` panel only appears when there are alert items
  - When no alerts exist, a compact `All stock healthy` row is shown (reduced empty space)
  - Movement history supports filter/search/export

## Main API Endpoints

- Public:
  - `GET /api/health`
  - `POST /api/auth/login`
- Auth required:
  - `GET /api/auth/me`
  - `POST /api/auth/logout`
  - `GET /api/bootstrap`
  - `GET /api/products`
  - `POST /api/orders`
  - `POST /api/khqr/generate`
  - `GET /api/khqr/status/:md5`
  - `PATCH /api/orders/:orderNumber/status`
  - `GET /api/reports/summary`
- Manager/Admin:
  - `POST /api/products`
  - `PATCH /api/products/:productId`
  - `DELETE /api/products/:productId`
  - `POST /api/products/bulk`
  - `GET /api/inventory/movements`
