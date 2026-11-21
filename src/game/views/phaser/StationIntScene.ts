/**
 * StationIntScene -- the bullpen: your desk (the case files), the captain's
 * office, Sergeant Hollis, and the flavour that makes the precinct a place.
 * Everything hot is data from world.json interior.
 */

import { StationSceneBase } from './StationSceneBase';
import type { StationSceneData } from '../../data/types';

export class StationIntScene extends StationSceneBase {
  constructor() {
    super('station-int');
  }

  protected sceneData(): StationSceneData {
    return this.ctx.vm.world.world.interior;
  }

  protected artKey(): string {
    return 'station-int';
  }

  protected hasRain(): boolean {
    return false;
  }
}
