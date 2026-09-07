// Traduce los errores de Supabase Auth a claves i18n.
//
// POR QUÉ EXISTE: Supabase responde SIEMPRE en inglés ("Email address ... is
// invalid", "Invalid login credentials"). Si ese texto se muestra tal cual,
// alguien en español ve la pantalla en su idioma y el error en otro. Acá se
// traduce el error a una CLAVE (`authError.*`), y la pantalla la pasa por
// `t()`: así el mensaje también cambia si se mueve el switch ES/EN.
//
// Se mapea por `code` (lo que trae `AuthApiError` en supabase-js v2) y, como
// respaldo, por el texto del mensaje: los errores viejos o los de la capa de
// red no traen código. Lo que no se reconoce cae en `authError.unknown` y el
// error crudo se manda a la consola, que es donde sirve.

const CODE_KEYS: Record<string, string> = {
  invalid_credentials: 'authError.invalidCredentials',
  email_address_invalid: 'authError.emailInvalid',
  email_address_not_authorized: 'authError.emailInvalid',
  validation_failed: 'authError.emailInvalid',
  email_not_confirmed: 'authError.emailNotConfirmed',
  user_already_exists: 'authError.userAlreadyExists',
  email_exists: 'authError.userAlreadyExists',
  weak_password: 'authError.weakPassword',
  same_password: 'authError.samePassword',
  user_not_found: 'authError.userNotFound',
  signup_disabled: 'authError.signupDisabled',
  email_provider_disabled: 'authError.signupDisabled',
  over_email_send_rate_limit: 'authError.emailRateLimit',
  over_request_rate_limit: 'authError.rateLimit',
  otp_expired: 'authError.linkExpired',
  bad_jwt: 'authError.linkExpired',
  session_expired: 'authError.linkExpired',
  flow_state_expired: 'authError.linkExpired',
  flow_state_not_found: 'authError.linkExpired',
};

// Respaldo por texto, para lo que llega sin `code`. En minúsculas.
const MESSAGE_KEYS: ReadonlyArray<readonly [string, string]> = [
  ['invalid login credentials', 'authError.invalidCredentials'],
  ['is invalid', 'authError.emailInvalid'],
  ['unable to validate email', 'authError.emailInvalid'],
  ['email not confirmed', 'authError.emailNotConfirmed'],
  ['already registered', 'authError.userAlreadyExists'],
  ['already exists', 'authError.userAlreadyExists'],
  ['password should be at least', 'authError.weakPassword'],
  ['password is too weak', 'authError.weakPassword'],
  ['should be different from the old password', 'authError.samePassword'],
  ['user not found', 'authError.userNotFound'],
  ['signups not allowed', 'authError.signupDisabled'],
  ['email rate limit', 'authError.emailRateLimit'],
  ['rate limit', 'authError.rateLimit'],
  ['too many requests', 'authError.rateLimit'],
  ['expired', 'authError.linkExpired'],
  ['failed to fetch', 'authError.network'],
  ['network', 'authError.network'],
  ['load failed', 'authError.network'],
];

/**
 * Devuelve la clave i18n del error. Nunca devuelve texto ya traducido: la
 * pantalla la guarda como clave y la resuelve al renderizar.
 */
export function authErrorKey(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code ?? '')
      : '';
  if (code && CODE_KEYS[code]) return CODE_KEYS[code];

  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const haystack = message.toLowerCase();
  for (const [needle, key] of MESSAGE_KEYS) {
    if (haystack.includes(needle)) return key;
  }

  // No reconocido: mensaje genérico en pantalla, detalle crudo en consola.
  if (message) console.error('[auth]', code || '(sin código)', message);
  return 'authError.unknown';
}
