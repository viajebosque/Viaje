import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './es.json';
import en from './en.json';

export const LANGS = ['es', 'en'] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = 'es';
const STORAGE_KEY = 'lang';

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as readonly string[]).includes(v);
}

// Idioma inicial: el guardado en este navegador, si no el default.
function initialLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY);
  return isLang(saved) ? saved : DEFAULT_LANG;
}

i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: initialLang(),
  fallbackLng: DEFAULT_LANG,
  supportedLngs: LANGS,
  interpolation: { escapeValue: false },
});

// Idioma activo, siempre 'es' | 'en' (nunca undefined ni 'es-EC').
export function currentLang(): Lang {
  const l = i18n.resolvedLanguage ?? i18n.language;
  return isLang(l) ? l : DEFAULT_LANG;
}

// Cambia el idioma y lo persiste en este navegador.
// La persistencia en profiles.lang la hace useLanguage().
export async function setLang(lang: Lang): Promise<void> {
  localStorage.setItem(STORAGE_KEY, lang);
  await i18n.changeLanguage(lang);
}

export default i18n;
