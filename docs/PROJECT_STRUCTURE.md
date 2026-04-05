# Project Structure Guide

A comprehensive guide to the Coffee POS System's professional project layout.

## 📂 High-Level Directory Layout

```
coffee-pos-system/
├── .config/                    # Build & development configuration
├── scripts/                    # Utility scripts and testing
├── docs/                       # Project documentation
├── server/                     # Backend API application
├── src/                        # Frontend React application
├── public/                     # Static assets
├── package.json                # Dependencies & scripts
├── .env                        # Environment variables (gitignored)
├── .gitignore                  # Git ignore rules
└── README.md                   # Main project documentation
```

## 📁 Detailed Directory Structure

### Configuration (`.config/`)

All tool configurations centralized:

```
.config/
├── eslint.config.js           # ESLint rules
├── vite.config.js             # Vite bundler
├── vitest.config.js           # Test runner
├── vitest.setup.js            # Test setup
├── tailwind.config.js         # Tailwind CSS
└── postcss.config.js          # PostCSS
```

### Scripts (`scripts/`)

Testing and utility scripts:

```
scripts/
├── verify-realtime-sync.js    # Real-time verification (16/16 tests ✅)
├── test-backend.js            # Backend API tests
├── test-backend.ps1           # PowerShell backend tests
├── test-delivery.ps1          # Delivery system tests
└── test-simple.ps1            # Quick tests
```

### Documentation (`docs/`)

Comprehensive guides and references:

```
docs/
├── PROJECT_STRUCTURE.md       # This file
├── README_UPDATES.md          # Recent changes
├── setup/
│   └── GETTING_STARTED.md    # Setup guide
├── guides/
│   ├── DELIVERY_TRACKING_FEATURE.md
│   ├── DELIVERY_QUICK_TEST.md
│   ├── PHASE_1_DELIVERY_GUIDE.md
│   ├── IMPROVEMENTS.md
│   ├── QUICK_REFERENCE.md
│   ├── SAFE_GUIDE.md
│   └── WHAT_CHANGED.md
└── api/                       # API documentation
```

### Backend Application (`server/`)

Express API server:

```
server/
├── index.js                   # Express server entry
├── database/
│   ├── db.js                  # Database connection & queries
│   └── seeds.js               # Initial data
└── routes/
    ├── auth.js                # Authentication
    ├── orders.js              # Order management
    ├── delivery.js            # Delivery tracking
    └── catalog.js             # Products
```

### Frontend Application (`src/`)

React application organized by features:

```
src/
├── app/
│   ├── main.jsx               # React entry point
│   └── RootRouter.jsx         # Application routing
│
├── features/                  # Feature modules
│   ├── POS/
│   │   ├── PosApp.jsx
│   │   ├── screens/
│   │   ├── components/
│   │   └── constants/
│   │
│   ├── Website/
│   │   ├── screens/
│   │   ├── sections/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── utils/
│   │
│   └── Delivery/
│       └── DeliveryScreen.jsx
│
├── shared/                    # Shared utilities
│   ├── api/                   # API client & validation
│   │   ├── client.js
│   │   ├── errors.js
│   │   ├── schemas.js
│   │   ├── index.js
│   │   └── __tests__/
│   │
│   ├── hooks/                 # Custom React hooks
│   │   ├── useApiError.js
│   │   ├── useFetchJson.js
│   │   ├── useCart.js
│   │   ├── useCatalogFilter.js
│   │   ├── index.js
│   │   └── __tests__/
│   │
│   ├── components/            # Reusable UI
│   │   ├── common.jsx
│   │   ├── KHQRCard.jsx
│   │   ├── LeafletAddressPicker.jsx
│   │   └── layout/
│   │
│   └── utils/                 # Helper functions
│       ├── format.js
│       ├── publicCart.js
│       └── validation/
│
├── services/                  # Business logic (future)
├── context/                   # React Context (future)
├── types/                     # TypeScript types (future)
├── constants/                 # Global constants
├── assets/                    # Images, icons
└── index.css                  # Global styles
```

## 🏗️ Architectural Principles

### 1. Feature-Based Organization
- Features (POS, Website) are mostly self-contained
- Share only truly common code in `shared/`
- Easier to scale and maintain

### 2. Clear Separation of Concerns
- **Frontend**: React UI in `src/`
- **Backend**: Express API in `server/`
- **Config**: Build tools in `.config/`
- **Scripts**: Utilities in `scripts/`
- **Docs**: Documentation in `docs/`

### 3. Shared Code Minimalism
- `shared/` only for code used by multiple features
- Feature-specific code stays in feature folders
- Common patterns: hooks, components, utilities

### 4. Tests Near Source
- Test files in `__tests__/` folders
- Easy to find and maintain
- Clear test organization by feature

### 5. Configuration Centralization
- All build configs in `.config/`
- Environment vars in `.env`
- Constants in `src/constants/`

## 📦 Technology Stack

### Frontend
- React 19
- Vite 8
- Tailwind CSS 3
- React Leaflet
- Lucide React

### Backend
- Express 5
- Node.js (ESM)
- SQLite 3
- ts-khqr

### Quality
- Vitest
- ESLint 9
- React Testing Library
- Zod

## 🔄 Development Workflow

### Creating a New Feature

```
1. Create folder in src/features/
2. Add screens/ and components/ subdirectories
3. Add hooks/ if needed (feature-specific)
4. Add __tests__/ for tests
5. Create index.js to export components
6. Import in RootRouter if needed
```

### Adding Shared Code

```
1. Is it used by 2+ features? → shared/
2. Otherwise → in feature folder
3. Add to src/shared/[type]/index.js
4. Export cleanly for easy imports
```

### Adding Tests

```
1. Create __tests__/ folder in same directory
2. Name test file: ComponentName.test.js
3. Use Vitest + React Testing Library
4. Test behavior, not implementation
```

## ✅ Best Practices

✅ **Do**
- Keep features independent
- Share only common code
- Organize by feature, not layer
- Test near source files
- Use consistent naming
- Document public APIs

❌ **Don't**
- Put everything in shared/
- Mix frontend and backend code
- Scatter tests everywhere
- Add temp files to git
- Create deep nesting
- Use vague folder names

## 📊 Project Statistics

- **Frontend Screens**: 10+
- **Backend Routes**: 20+
- **Custom Hooks**: 4
- **Shared Components**: 5+
- **Test Coverage**: 20+ test suites
- **Documentation Pages**: 10+

## 🔗 Related Documentation

- [Setup Guide](./setup/GETTING_STARTED.md) - First-time setup
- [Delivery Feature](./guides/DELIVERY_TRACKING_FEATURE.md) - Delivery system
- [Code Quality](./guides/IMPROVEMENTS.md) - Improvements overview
- [Main README](../README_PROFESSIONAL.md) - Project overview

---

**Last Updated**: April 2026 | **Version**: 1.1
