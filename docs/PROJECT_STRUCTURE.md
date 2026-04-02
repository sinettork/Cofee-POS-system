# Project Structure

This project keeps frontend and backend in one repository while separating concerns by folder.

```text
.
|-- public/                     # Static public assets served by Vite
|-- src/                        # Frontend application (React)
|   |-- api/                    # API client layer
|   |-- assets/                 # Images/icons
|   |-- components/             # Reusable UI components
|   |-- constants/              # Static UI datasets/constants
|   |   `-- uiData.js
|   |-- screens/                # Route/page-level screens
|   `-- utils/                  # Frontend utilities
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

- Keep UI constants in `src/constants/` instead of the `src/` root.
- Keep DB/seed logic inside `server/database/`.
- Prefer adding new backend route handlers in `server/routes/`.
- Keep runtime artifacts (`*.sqlite`, `dist`, `node_modules`) out of git.
