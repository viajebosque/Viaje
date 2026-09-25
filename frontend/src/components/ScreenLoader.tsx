import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import forestMap from '../assets/forest/forest-map.png';
import loginBackground from '../assets/auth/forest-login-v5.png';
import branchTop from '../assets/auth/branch-top.webp';
import branchBottom from '../assets/auth/branch-bottom.webp';

type Props = {
  // Con número: "Misión N" y "Cargando misión…". Sin número: textos generales.
  numero?: number;
  // Fondo difuminado. 'login' en las pantallas públicas: usa el fondo del
  // login (que esa pantalla baja igual) y no obliga a bajar el mapa antes de
  // iniciar sesión.
  background?: 'forest' | 'login';
};

// Si la carga dura menos que esto, la tarjeta no llega a aparecer: solo se ve
// el fondo. Evita el parpadeo de una escena que aparece y se va enseguida.
const SHOW_AFTER_MS = 300;

// Única pantalla de carga de pantalla completa (arranque de la app, rutas
// protegidas, misión, perfil). Lo que carga DENTRO de una pantalla ya visible
// (tabla de admin, amuletos del perfil) usa un "Cargando…" chico en su lugar.
export default function ScreenLoader({ numero, background = 'forest' }: Props) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const hasMission = typeof numero === 'number' && Number.isInteger(numero) && numero >= 1 && numero <= 9;
  const backgroundImage = background === 'login' ? loginBackground : forestMap;

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main
      className={`mission-loading${visible ? '' : ' mission-loading--waiting'}`}
      style={{ '--loading-forest': `url(${backgroundImage})` } as CSSProperties}
    >
      {visible && (
        <section className="mission-loading-card" aria-labelledby="mission-loading-title">
          <img className="mission-loading-branch mission-loading-branch--top" src={branchTop} alt="" aria-hidden="true" />
          <img className="mission-loading-branch mission-loading-branch--bottom" src={branchBottom} alt="" aria-hidden="true" />
          <p className="mission-loading-eyebrow">
            {hasMission ? t('forest.modalTitle', { numero }) : t('mission.loadingScene.eyebrow')}
          </p>
          <div className="mission-loading-emblem" aria-hidden="true">
            <span className="mission-loading-orbit" />
            <svg viewBox="0 0 80 80" fill="none">
              <path className="mission-loading-leaf" d="M41 43C39 26 48 15 65 15c1 17-8 28-24 28Z" />
              <path className="mission-loading-leaf mission-loading-leaf--small" d="M39 49C23 50 15 40 15 28c15-1 25 7 24 21Z" />
              <path className="mission-loading-stem" d="M40 65V44L56 25M40 52 24 36M28 66h24" />
            </svg>
            <span className="mission-loading-spark mission-loading-spark--one" />
            <span className="mission-loading-spark mission-loading-spark--two" />
          </div>
          <h1 id="mission-loading-title">{t('mission.loadingScene.title')}</h1>
          <p className="mission-loading-message">
            {t(hasMission ? 'mission.loadingScene.message' : 'mission.loadingScene.messageGeneric')}
          </p>
          <div className="mission-loading-track" aria-hidden="true"><span /></div>
          <p className="mission-loading-status" role="status" aria-live="polite">
            {t(hasMission ? 'mission.loading' : 'common.loading')}
          </p>
        </section>
      )}
    </main>
  );
}
