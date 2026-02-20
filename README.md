# EP44 Warehouse Intelligence Platform

**Schneider Electric** — Warehouse operations tracker with SAP integration, chat command channel, and CORTEX agent orchestration.

## Features

- **Item Tracker** — CRUD table for kitting items with inline editing, priority/status selectors, hashtag filtering
- **Command Channel** — Chat interface with `/slash` commands and `#hashtag` support, auto-routed to agents (RACHEL, CADENCE, CORTEX)
- **SAP Sync** — Stub integration endpoint for PO/SO/stock synchronization
- **Symmetry Access Logs** — Stub endpoint for access event logging
- **Reference Panel** — Quick reference for all commands, hashtags, and integrations

## Tech Stack

| Layer     | Technology                    |
|-----------|-------------------------------|
| Frontend  | React 18 + Vite               |
| Backend   | Node.js + Express             |
| Database  | SQLite (better-sqlite3)       |
| Deploy    | Docker / Vercel               |

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+

### Setup

```bash
# Clone the repository
git clone https://github.com/while-basic/warehouse-demo.git
cd warehouse-demo

# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Start development (frontend + backend concurrently)
npm run dev
```

The frontend runs at `http://localhost:5173` and the API at `http://localhost:3001`.

### Environment Variables

| Variable             | Description                          | Default                              |
|----------------------|--------------------------------------|--------------------------------------|
| `PORT`               | Express server port                  | `3001`                               |
| `NODE_ENV`           | Environment mode                     | `development`                        |
| `SAP_ENDPOINT`       | SAP integration endpoint (stub)      | `https://sap.example.com/api/v1`     |
| `SYMMETRY_ENDPOINT`  | Symmetry access management (stub)    | `https://symmetry.example.com/api/v1`|
| `CORTEX_WEBHOOK`     | CORTEX agent webhook URL             | `https://cortex.example.com/webhook` |

## API Endpoints

### Items — `/api/items`
| Method   | Path             | Description           |
|----------|------------------|-----------------------|
| `GET`    | `/api/items`     | List all items        |
| `POST`   | `/api/items`     | Create a new item     |
| `PUT`    | `/api/items/:id` | Update an item        |
| `DELETE` | `/api/items/:id` | Delete an item        |

### Chat — `/api/chat`
| Method | Path        | Description             |
|--------|-------------|-------------------------|
| `GET`  | `/api/chat` | Get all chat messages   |
| `POST` | `/api/chat` | Send a new message      |

### SAP Sync — `/api/sap-sync`
| Method | Path            | Description                 |
|--------|-----------------|-----------------------------|
| `GET`  | `/api/sap-sync` | Get sync log                |
| `POST` | `/api/sap-sync` | Trigger SAP sync (stub)     |

### Symmetry — `/api/symmetry`
| Method | Path             | Description                    |
|--------|------------------|--------------------------------|
| `GET`  | `/api/symmetry`  | Get access logs                |
| `POST` | `/api/symmetry`  | Log access event (stub)        |

## Production Build

```bash
npm run build
npm start
```

## Docker

```bash
# Build
docker build -t ep44-warehouse .

# Run
docker run -p 3000:3000 ep44-warehouse
```

Access at `http://localhost:3000`.

## Deploy to Vercel

```bash
npm i -g vercel
vercel --prod
```

> **Note:** SQLite storage on Vercel is ephemeral (resets on cold start). The app seeds default data automatically. For persistent storage in production, configure an external database.

## Branding

- Primary Green: `#3DCD58`
- Dark Green: `#009530`
- Backgrounds: White / `#FAFAFA`
- Font: Segoe UI

---

Schneider Electric EP44 · Built by Celaya Solutions
