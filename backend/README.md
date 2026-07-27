# backend

Backend de **Un Viaje por el Bosque** 🌲

El servidor que maneja la lógica de negocio y habla con Supabase con permisos de servidor.

Hecho con Node + Express (ESM). Se publica en Railway (Root Directory `backend`).

```bash
npm install
cp .env.example .env   # llenar con los valores del ambiente Dev
npm run dev            # http://localhost:3000
```

| Endpoint | Para qué |
|---|---|
| `GET /health` | Health check de Railway |
| `GET /api/ping-db` | Verifica que Supabase responde |

Variables de entorno: ver `.env.example`. En Railway se configuran por ambiente;
`PORT` lo inyecta Railway, no hay que setearlo.
