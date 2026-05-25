# How to Run BioAnnot

## Requirements
- **Node.js v22 or higher** (the server uses the built-in `node:sqlite` module)

## Step 1 — Start the backend server

```bash
cd server
node --experimental-sqlite src/index.js
```

You should see:
```
🟣  BioAnnot API  →  http://localhost:4000/api/health
```

## Step 2 — Start the frontend (in a separate terminal)

```bash
# from the project root
npm install
npm run dev
```

Open the URL shown (usually http://localhost:5173).

## Demo login credentials

| Role       | Email               | Password    |
|------------|---------------------|-------------|
| Admin      | sharma@medlab.in    | admin123    |
| Annotator  | riya@medlab.in      | annotate1   |
| Reviewer   | arun@medlab.in      | review99    |

## Common errors

**"Failed to fetch"** — The backend server is not running, or you're accessing
the frontend from a URL that isn't localhost. Always start the server first
(Step 1) before opening the frontend.

**`Error: listen EADDRINUSE`** — Port 4000 is already in use. Kill the existing
process: `lsof -ti:4000 | xargs kill`
