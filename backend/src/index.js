import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { supabase } from './supabase.js';
import { adminRouter } from './routes/admin.js';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS: lista de orígenes permitidos separada por comas (CORS_ORIGINS).
// Ej: https://viaje-prod.vercel.app,https://dev-viajebosque.vercel.app
//
// Se normaliza cada valor (sin barra final, minúsculas) porque el header Origin
// que manda el navegador nunca lleva barra: con "https://sitio.com/" en la
// variable, la comparación fallaba y el navegador bloqueaba todo con error CORS.
//
// Se acepta `*` como comodín en el subdominio, para las URLs por deploy de
// Vercel. Ej: https://*.vercel.app
function normalizeOrigin(value) {
  return value.trim().replace(/\/+$/, '').toLowerCase();
}

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);

function isAllowedOrigin(origin) {
  const clean = normalizeOrigin(origin);
  return allowedOrigins.some((allowed) => {
    if (!allowed.includes('*')) return allowed === clean;
    const pattern = new RegExp(
      `^${allowed.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]+')}$`
    );
    return pattern.test(clean);
  });
}

console.log(
  '[cors] orígenes permitidos:',
  allowedOrigins.length ? allowedOrigins.join(', ') : '(todos)'
);

app.use(
  cors({
    origin(origin, callback) {
      // Sin Origin: curl, health checks de Railway, server a server.
      if (!origin) return callback(null, true);
      // Sin lista configurada: se permite todo (solo pasa en desarrollo local).
      if (!allowedOrigins.length) return callback(null, true);
      if (isAllowedOrigin(origin)) return callback(null, true);
      // No se lanza error: se responde sin los headers de CORS y el navegador
      // bloquea. Queda el log para poder diagnosticarlo.
      console.warn(`[cors] origen rechazado: ${origin}`);
      callback(null, false);
    },
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

// Panel de administración (exige role='admin', ver middleware/requireAdmin.js).
app.use('/api/admin', adminRouter);

// Ejemplo: verifica conexión a Supabase.
app.get('/api/ping-db', async (req, res) => {
  const { error } = await supabase.auth.getSession();
  if (error) return res.status(500).json({ ok: false, error: error.message });
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`API escuchando en puerto ${PORT}`);
});
