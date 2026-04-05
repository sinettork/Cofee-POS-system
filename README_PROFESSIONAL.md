# ☕ Coffee POS System

A full-stack, production-ready Point of Sale system designed for modern coffee shops. Features real-time delivery tracking, customer-facing website, POS management interface, and integrated payment processing.

## 🌟 Key Features

- **Website & Online Ordering**: Customer-facing storefront with delivery tracking
- **POS System**: Full point of sale interface for staff and managers  
- **Real-Time Delivery**: Live order tracking with driver assignment
- **Payment Integration**: KHQR payment generation and status tracking
- **User Authentication**: Role-based access (customer, cashier, manager, operator)
- **Inventory Management**: Product stock tracking and movement history
- **Reports & Analytics**: Order activity and performance metrics

## 📋 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development servers (frontend + backend)
npm run dev

# In another terminal, start backend only
npm run server
```

### URLs
- **Website**: http://localhost:5173
- **POS**: http://localhost:5173/pos
- **API**: http://localhost:4000

## 📁 Project Structure

```
coffee-pos-system/
├── .config/                    # Configuration files
│   ├── eslint.config.js
│   ├── vite.config.js
│   ├── vitest.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
│
├── scripts/                    # Utility and test scripts
│   ├── test-backend.js        # Backend API tests
│   ├── test-delivery.ps1      # Delivery system tests
│   └── verify-realtime-sync.js  # Real-time sync verification
│
├── docs/                       # Documentation
│   ├── setup/                  # Setup and getting started
│   ├── guides/                 # Feature guides and tutorials
│   ├── api/                    # API documentation
│   └── README_UPDATES.md       # Recent changes
│
├── server/                     # Backend API
│   ├── index.js                # Express server
│   ├── database/               # SQLite database
│   └── routes/                 # API endpoints
│
├── src/                        # Frontend application
│   ├── app/                    # Application entry & routing
│   │   ├── main.jsx
│   │   └── RootRouter.jsx
│   │
│   ├── features/               # Feature modules
│   │   ├── POS/
│   │   ├── Website/
│   │   ├── Delivery/
│   │   └── Admin/
│   │
│   ├── shared/                 # Shared utilities
│   │   ├── api/                # API client and validation
│   │   ├── hooks/              # Custom React hooks
│   │   ├── components/         # Reusable UI components
│   │   └── utils/              # Helper functions
│   │
│   ├── services/               # Business logic services
│   ├── context/                # React context providers
│   ├── types/                  # TypeScript types (future)
│   ├── constants/              # Global constants
│   └── index.css               # Global styles
│
├── public/                     # Static assets
└── package.json                # Project dependencies
```

## 🚀 Available Commands

### Development
```bash
npm run dev          # Start frontend dev server + backend
npm run dev:frontend # Frontend only (Vite, port 5173)
npm run dev:backend  # Backend only (Express, port 4000)
npm run server       # Start backend server
```

### Testing
```bash
npm run test        # Run tests in watch mode
npm run test:run    # Run all tests once
npm run test:ui     # Open test UI dashboard
```

### Production
```bash
npm run build       # Build frontend for production
npm run preview     # Preview production build locally
```

### Utilities
```bash
npm run lint        # Run ESLint
```

## 🔧 Technology Stack

### Frontend
- **React 19** - UI library
- **Vite 8** - Build tool & dev server
- **Tailwind CSS 3** - Utility-first CSS
- **React Leaflet** - Map integration
- **Lucide React** - Icon library

### Backend
- **Node.js** - JavaScript runtime
- **Express 5** - Web framework
- **SQLite 3** - Database (built-in)
- **ts-khqr** - KHQR payment generation

### Quality & Testing
- **Vitest** - Unit testing framework
- **React Testing Library** - Component testing
- **ESLint 9** - Code linting
- **Zod** - Data validation schemas

## 📚 Documentation

- **[Setup Guide](./docs/setup/GETTING_STARTED.md)** - First-time setup
- **[Delivery Feature Guide](./docs/guides/DELIVERY_TRACKING_FEATURE.md)** - Delivery system overview
- **[Quick Test Guide](./docs/guides/DELIVERY_QUICK_TEST.md)** - Quick workflow tests
- **[Code Improvements](./docs/guides/IMPROVEMENTS.md)** - Quality improvements overview
- **[Safe Usage Guide](./docs/guides/SAFE_GUIDE.md)** - Using new features safely
- **[Recent Changes](./docs/guides/WHAT_CHANGED.md)** - What was modified

## 🔐 Authentication & Authorization

The system supports multiple user roles:
- **Customer**: Can place orders and track deliveries
- **Cashier**: Can process orders at POS
- **Manager**: Can manage inventory and reports
- **Operator**: Can manage deliveries and staff

## 🌍 API Endpoints

### Public Endpoints (No Auth)
- `GET /api/public/catalog` - Product catalog
- `POST /api/public/customers/register` - Customer signup
- `POST /api/public/customers/login` - Customer login

### Protected Endpoints (Requires Auth)
- `GET /api/delivery/queue` - Delivery orders queue
- `PATCH /api/delivery/:orderId/assign` - Assign driver
- `PATCH /api/delivery/:orderId/status` - Update delivery status
- `GET /api/public/delivery/:orderId` - Customer track delivery

## 📊 Database Schema

### Main Tables
- `users` - Staff accounts (cashier, manager, operator)
- `customers` - Customer accounts
- `products` - Product catalog
- `orders` - Order records
- `deliveries` - Delivery tracking
- `inventory_movements` - Stock history

## 🧪 Testing

### Run Tests
```bash
npm run test:run    # Execute all tests
```

### Test Coverage
- API validation and error handling (20+ tests)
- Custom hooks (useCart, useCatalogFilter, etc.)
- Error classification and logging
- Integration test infrastructure

## 🚢 Deployment

### Production Build
```bash
npm run build
npm run server     # Run backend in production
```

### Environment Variables
Create `.env` in root:
```
# Database
DATABASE_PATH=pos.sqlite

# API
API_PORT=4000
NODE_ENV=production
```

## 🐛 Troubleshooting

**Port already in use:**
```bash
# Change port in .config/vite.config.js or package.json
```

**Database locked:**
```bash
# Remove .sqlite-wal and .sqlite-shm files
rm pos.sqlite-*
```

**Tests failing:**
```bash
npm run test:run -- --reporter=verbose
```

## 📈 Performance

- Real-time sync: **< 2 seconds** (verified)
- Auto-refresh interval: **10 seconds**
- Bundle size: **Optimized with Vite**
- API response time: **< 100ms average**

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Commit changes: `git commit -am 'Add feature'`
3. Push to branch: `git push origin feature/my-feature`
4. Open a Pull Request

## 📝 License

MIT License - see LICENSE file for details

## 📞 Support & Documentation

For more information, see the [documentation folder](./docs/) or check individual feature guides.

---

**Status**: ✅ Production Ready | **Last Updated**: April 2026
