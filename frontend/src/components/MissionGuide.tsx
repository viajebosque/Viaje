import { useTranslation } from 'react-i18next';
import luzImage from '../assets/auth/forest-guide.webp';

// Qué trae cada misión. Se muestra en dos lugares: como paso de la
// introducción (antes del login) y desde el botón del mapa. El título lo pone
// quien lo usa, porque cada contenedor tiene su propio encabezado.
const ITEMS = [
  'initial',
  'description',
  'miniAction',
  'reflection',
  'token',
  'consequence',
  'quote',
] as const;

export default function MissionGuide() {
  const { t } = useTranslation();

  return (
    <div className="mission-guide-info">
      <p className="mission-guide-intro">{t('missionGuide.intro')}</p>
      <p className="mission-guide-luz">
        <img src={luzImage} alt={t('missionGuide.luzAlt')} />
        <span>{t('missionGuide.luz')}</span>
      </p>

      <table className="mission-guide-table">
        <thead>
          <tr>
            <th scope="col">{t('missionGuide.colComponent')}</th>
            <th scope="col">{t('missionGuide.colWhat')}</th>
          </tr>
        </thead>
        <tbody>
          {ITEMS.map((item) => (
            <tr key={item}>
              <th scope="row">{t(`missionGuide.items.${item}.name`)}</th>
              <td>{t(`missionGuide.items.${item}.body`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
