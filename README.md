# Coffee POS System (React + SQLite)

This project now runs with:
- `React + Vite` for UI
- `Express + SQLite` for workflow/data API

SQLite database file:
- `server/pos.sqlite` (auto-created and auto-seeded on first server run)

## Run In WebStorm

1. Install dependencies:
```bash
npm install
```

2. Start frontend + backend together:
```bash
npm run dev:all
```

3. Open:
- Frontend: `http://localhost:5173`
- API health: `http://localhost:4000/api/health`

## Available Scripts

- `npm run dev` - frontend only
- `npm run server` - SQLite API only
- `npm run dev:all` - frontend + API together
- `npm run lint` - lint all frontend/server code
- `npm run build` - production build

## Implemented Workflows

- POS category/product loading from SQLite
- Place Order writes to SQLite (`POST /api/orders`)
- Activity/Billing/Tracking/History reads from SQLite (`GET /api/bootstrap`)
- Report tables/favorites read from SQLite (`GET /api/bootstrap`)

## Main API Endpoints

- `GET /api/health`
- `GET /api/bootstrap`
- `POST /api/orders`
