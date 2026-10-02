// Canales de contacto de Andrea. Los usa ContactOptions, que se muestra en el
// muro de pago (mapa y /mission/N) y en el cierre del viaje.
//
// Están acá y no en variables de entorno a propósito: son los mismos en Dev y
// en Prod, y no son secretos (van en la URL, a la vista).
const WHATSAPP_NUMBER = '15712745547'; // +1 (571) 274-5547
export const INSTAGRAM_URL = 'https://www.instagram.com/andrearobles_coach/';
export const LINKEDIN_URL = 'https://www.linkedin.com/in/roblesandrea';
// Vacío = todavía no hay correo: el botón se muestra pero no hace nada.
export const CONTACT_EMAIL = '';

// El texto del mensaje NO se arma acá: llega desde i18n
// (forest.paywallMessage, forest.journeyEnd.contactMessage), así que sale en el
// idioma que la persona tenga puesto en ese momento. Ver la regla de idiomas en CLAUDE.md 1.3.
// Instagram y LinkedIn no permiten precargar un mensaje; WhatsApp y el correo sí.
export function whatsappUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function emailUrl(message: string): string | null {
  if (!CONTACT_EMAIL) return null;
  return `mailto:${CONTACT_EMAIL}?body=${encodeURIComponent(message)}`;
}
