// Botón "Obtener el acceso completo": abre un chat de WhatsApp con el mensaje
// ya escrito, para que la persona solo tenga que enviarlo.
//
// El número está acá y no en una variable de entorno a propósito: es uno solo,
// el mismo en Dev y en Prod, y no es un secreto (va en la URL, a la vista).
const WHATSAPP_NUMBER = '15712745547'; // +1 (571) 274-5547

// El texto del mensaje NO se arma acá: llega desde i18n
// (forest.paywallMessage), así que sale en el idioma que la persona tenga
// puesto en ese momento. Ver la regla de idiomas en CLAUDE.md 1.3.
export function whatsappUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
