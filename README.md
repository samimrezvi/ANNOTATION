# BioAnnot — Collaborative Biomedical Annotation Platform

## Quick Start

### Terminal 1 — Backend (Node.js 22+, zero npm dependencies)
```bash
cd server
node --experimental-sqlite src/index.js
# API at http://localhost:4000
```

### Terminal 2 — Frontend
```bash
npm install
npm run dev
# App at http://localhost:5173
```

## Demo Login Credentials

| Role      | Email             | Password    |
|-----------|-------------------|-------------|
| Admin     | sharma@medlab.in  | admin123    |
| Annotator | riya@medlab.in    | annotate1   |
| Reviewer  | arun@medlab.in    | review99    |

## What the Backend Does

| Feature           | Detail                                              |
|-------------------|-----------------------------------------------------|
| Authentication    | JWT tokens, 7-day expiry                            |
| Password security | PBKDF2-SHA512, 100k iterations (no plaintext ever)  |
| Database          | SQLite (file: server/bioannot.db, auto-created)     |
| Audit log         | Every login, change, delete is recorded             |
| Roles             | Annotator · Reviewer · Admin with enforced rules    |
| Zero npm deps     | Uses only Node.js 22 built-in modules               |

## API Reference

### Auth
| Method | Path                      | Who       |
|--------|---------------------------|-----------|
| POST   | /api/auth/login           | Anyone    |
| GET    | /api/auth/me              | Auth      |
| POST   | /api/auth/logout          | Auth      |
| POST   | /api/auth/register        | Admin     |
| GET    | /api/auth/users           | Admin     |
| PATCH  | /api/auth/users/:id       | Admin     |
| DELETE | /api/auth/users/:id       | Admin     |
| POST   | /api/auth/change-password | Auth      |

### Annotations
| Method | Path                      | Who          |
|--------|---------------------------|--------------|
| GET    | /api/annotations          | Auth         |
| POST   | /api/annotations          | Annotator+   |
| POST   | /api/annotations/bulk     | Annotator+   |
| PATCH  | /api/annotations/:id      | Owner/Review |
| DELETE | /api/annotations/:id      | Owner/Admin  |
| GET    | /api/annotations/audit    | Admin        |

## Adding New Users (two ways)

**Via API:** Log in as Admin then POST /api/auth/register  
**Via re-seed:** Edit seed array in `server/src/db.js`, delete `server/bioannot.db`, restart server

## Changing Names / Credentials

Open `server/src/db.js` — edit the `seeds` array near the bottom of the file:
```js
const seeds = [
  { name:'Your Name', email:'you@yourlab.in', password:'yourpass', role:'admin' },
  ...
];
```
Delete `server/bioannot.db` and restart — new users will be created.

## Project Structure
```
Annotation-tool-final/
├── src/                        ← React + TypeScript frontend
│   ├── components/
│   │   ├── auth/LoginPage.tsx  ← Login UI
│   │   ├── annotation/         ← Toolbar + list
│   │   ├── signal-viewer/      ← ECG/ABR chart
│   │   └── image-viewer/       ← Konva canvas
│   ├── hooks/useAnnotations.ts ← API-backed state
│   ├── utils/api.ts            ← All fetch() calls
│   └── types/                  ← TypeScript interfaces
├── server/                     ← Node.js backend
│   ├── src/
│   │   ├── index.js            ← HTTP server + all routes
│   │   ├── db.js               ← SQLite schema + seed
│   │   └── crypto.js           ← PBKDF2 + JWT (zero deps)
│   └── bioannot.db             ← Created automatically
└── public/sample-data/         ← ECG CSV + annotation JSON
```
