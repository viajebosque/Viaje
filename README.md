# Viaje

Monorepo de "Un Viaje por el Bosque".

```
backend/    Node + Express (ESM)      → deploy en Railway
frontend/   Vite + React + TypeScript → deploy en Vercel
```

Cada carpeta es un proyecto npm independiente (su propio `package.json` y
`package-lock.json`). No se usan npm workspaces.

## Desarrollo local

```bash
cd backend  && npm install && npm run dev   # http://localhost:3000
cd frontend && npm install && npm run dev   # http://localhost:5173
```

Las variables de entorno no están en el repo. Copiar el `.env.example` de cada
carpeta a `.env` y llenar con los valores del ambiente Dev.

## Branches y ambientes

| Branch | Supabase   | Railway (backend) | Vercel (frontend) |
|--------|------------|-------------------|-------------------|
| `dev`  | Viaje_Dev  | Viaje_Dev         | Preview           |
| `main` | Viaje_Prod | Viaje_Prod        | Production        |

Push a `dev` despliega Dev. Push a `main` despliega Producción.

## Deploy

- **Railway** — Root Directory `backend`. Config en `backend/railway.json`
  (Nixpacks, start `npm start`, healthcheck `/health`).
- **Vercel** — Root Directory `frontend`. Config en `frontend/vercel.json`
  (Vite, output `dist`, rewrites SPA).
