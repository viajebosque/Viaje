import mission01 from '../assets/forest/mission-one-panel.png';
import mission02 from '../assets/forest/mission-panels/mission-02-roots.png';
import mission03 from '../assets/forest/mission-panels/mission-03-mist.png';
import mission04 from '../assets/forest/mission-panels/mission-04-river.png';
import mission05 from '../assets/forest/mission-panels/mission-05-clearing.png';
import mission06 from '../assets/forest/mission-panels/mission-06-storm.png';
import mission07 from '../assets/forest/mission-panels/mission-07-cave.png';
import mission08 from '../assets/forest/mission-panels/mission-08-treetop.png';
import mission09 from '../assets/forest/mission-panels/mission-09-raft.png';

const PANELS_BY_MISSION: Record<number, string> = {
  1: mission01,
  2: mission02,
  3: mission03,
  4: mission04,
  5: mission05,
  6: mission06,
  7: mission07,
  8: mission08,
  9: mission09,
};

export function getMissionPanelImage(missionNumber: number): string | undefined {
  return PANELS_BY_MISSION[missionNumber];
}
