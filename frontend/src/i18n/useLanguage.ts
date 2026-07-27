import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { getProfileLang, setProfileLang } from '../lib/profile';
import { currentLang, isLang, setLang, DEFAULT_LANG, type Lang } from './index';

// Idioma activo + cómo cambiarlo.
//
// Dos capas de persistencia:
//   localStorage   -> mismo navegador, funciona sin sesión
//   profiles.lang  -> cualquier dispositivo del usuario
// Al iniciar sesión, profiles.lang manda (si existe).
export function useLanguage() {
  // useTranslation suscribe el componente: al cambiar idioma, re-renderiza.
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const lang: Lang = isLang(i18n.resolvedLanguage)
    ? i18n.resolvedLanguage
    : DEFAULT_LANG;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getProfileLang(user.id).then((saved) => {
      if (!cancelled && saved && saved !== currentLang()) void setLang(saved);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const change = useCallback(
    async (next: Lang) => {
      await setLang(next);
      if (user) void setProfileLang(user.id, next);
    },
    [user]
  );

  return { lang, change };
}
