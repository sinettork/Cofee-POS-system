# Project Structure

This project keeps frontend and backend in one repository while separating concerns by folder.

```text
.
|-- public/                     # Static public assets served by Vite
|-- src/                        # Frontend application (React)
|   |-- app/                    # App entry + root router
|   |   |-- main.jsx
|   |   `-- RootRouter.jsx
|   |-- assets/                 # Images/icons
|   |-- Website/                # Public website, auth, online ordering
|   |-- POS/                    # POS domain UI
|   |-- AdminPanel/             # Admin panel domain UI
|   `-- shared/                 # Shared API client, utils, cross-domain UI
|-- server/                     # Backend application (Express)
|   |-- database/               # SQLite access + seed definitions
|   |   |-- db.js
|   |   `-- seeds.js
|   |-- routes/                 # Isolated route helpers/modules
|   |   `-- khqr.js
|   |-- index.js                # API entrypoint
|   `-- pos.sqlite*             # Runtime SQLite files (gitignored)
|-- docs/                       # Project documentation
|   `-- PROJECT_STRUCTURE.md
|-- package.json                # Scripts + dependencies
`-- README.md                   # Setup and usage guide
```

## Conventions

- Keep route wiring inside `src/app/`.
- Keep website-specific logic under `src/Website/`.
- Keep POS logic under `src/POS/`.
- Keep admin-panel logic under `src/AdminPanel/`.
- Keep cross-domain logic in `src/shared/`.
- Keep DB/seed logic inside `server/database/`.
- Prefer adding new backend route handlers in `server/routes/`.
- Keep runtime artifacts (`*.sqlite`, `dist`, `node_modules`) out of git.
