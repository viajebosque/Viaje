# frontend

Frontend de **Un Viaje por el Bosque** 🌲

La web que ve el usuario: iniciar sesión, recorrer el mapa de misiones y responder las preguntas de cada una.

Hecho con React + Vite + TypeScript. Usa Supabase para login y datos, y se publica en
Vercel (Root Directory `frontend`).

```bash
npm install
cp .env.example .env   # llenar con los valores del ambiente Dev
npm run dev            # http://localhost:5173
npm run build          # salida en dist/
```

| Ruta | Página | Protegida |
|---|---|---|
| `/` | Login / Crear cuenta | no |
| `/forest` | Mapa del Bosque | sí |
| `/mission/:numero` | Pantalla de Misión | sí |

Variables de entorno: ver `.env.example`. En Vercel se configuran por Environment
(Production = `main`, Preview = `dev`). Solo la **anon** key, nunca `service_role`.
