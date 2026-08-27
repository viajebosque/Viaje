// Enlace para obtener el acceso completo (el que abre las Misiones 3 a 9).
//
// Vive en una variable de entorno y NO en el código a propósito: puede ser
// distinto en Dev y en Prod (un checkout de prueba contra el real), y así se
// cambia desde Vercel sin tocar el repo. Ver frontend/.env.example.
//
// Vite hornea las VITE_* en el build: si se cambia en Vercel hay que
// redeployar para que tenga efecto.
//
// Si no está configurada, el aviso de pago se muestra igual pero sin botón: es
// preferible a un botón que no lleva a ningún lado.
const raw = import.meta.env.VITE_PAYMENT_URL;

export const paymentUrl: string | null =
  typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
