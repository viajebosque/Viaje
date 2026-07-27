import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { supabase } from './supabase.js';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS: lista de orígenes permitidos separada por comas (CORS_ORIGINS).
// Ej: https://viaje-prod.vercel.app,https://viaje-dev.vercel.app
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
  })
);
app.use(express.json());

// Health check para Railway.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'development' });
});

app.get('/', (req, res) => {
  res.json({ service: 'Viaje_BackEnd', message: 'API viva' });
});

// Ejemplo: verifica conexión a Supabase.
app.get('/api/ping-db', async (req, res) => {
  const { error } = await supabase.auth.getSession();
  if (error) return res.status(500).json({ ok: false, error: error.message });
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`API escuchando en puerto ${PORT}`);
});
