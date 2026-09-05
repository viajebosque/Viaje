import type { Lang } from '../i18n';

const MISSION_ACTIVITY_VIDEO_IDS: Readonly<
  Record<number, Readonly<Record<Lang, string>>>
> = {
  1: {
    es: 'b0-4whrjbLg',
    en: 'FJdl-tH1jJw',
  },
  2: {
    es: 'GK7c8DdDETw',
    en: 'oXhV2X3i1nE',
  },
  3: {
    es: 'mKAO1ckGJ2g',
    en: 'C-a-tcm8mB4',
  },
  4: {
    es: 'd17_KCSM1f0',
    en: 'EhOyx7iwu7Q',
  },
  5: {
    es: 'whZRzFRKhyw',
    en: 'kXS_FcDTgg0',
  },
  6: {
    es: '7nANKF0FJGg',
    en: 'fpT7KwKsU6A',
  },
  7: {
    es: 'E3x6PuMyd5g',
    en: 'XMifRlXlqoM',
  },
  8: {
    es: 'bOoKwg0Onwc',
    en: 'McPIdCftWiU',
  },
  9: {
    es: 'qQjP3WedEPI',
    en: '979q0WJ9CUs',
  },
};

export function getMissionActivityVideoId(
  missionNumber: number,
  lang: Lang
): string | undefined {
  return MISSION_ACTIVITY_VIDEO_IDS[missionNumber]?.[lang];
}
