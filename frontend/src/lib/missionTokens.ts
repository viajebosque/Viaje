import token01 from '../assets/tokens/token-01-primer-tablon.png';
import token02 from '../assets/tokens/token-02-cuerda-raices.png';
import token03 from '../assets/tokens/token-03-frasco-niebla.png';
import token04 from '../assets/tokens/token-04-piedra-cauce.png';
import token05 from '../assets/tokens/token-05-vela-claro.png';
import token06 from '../assets/tokens/token-06-mastil-tormenta.png';
import token07 from '../assets/tokens/token-07-farol-cueva.png';
import token08 from '../assets/tokens/token-08-rama-guia.png';
import token09 from '../assets/tokens/token-09-balsa.png';

const TOKENS_BY_MISSION: Record<number, string> = {
  1: token01,
  2: token02,
  3: token03,
  4: token04,
  5: token05,
  6: token06,
  7: token07,
  8: token08,
  9: token09,
};

export function getMissionTokenImage(missionNumber: number): string | undefined {
  return TOKENS_BY_MISSION[missionNumber];
}
