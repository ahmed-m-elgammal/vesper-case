/**
 * StationExtScene -- the precinct street: rain, brick, and a door that starts
 * the night shift. Everything hot is data from world.json exterior.
 */

import { StationSceneBase } from './StationSceneBase';
import type { StationSceneData } from '../../data/types';

export class StationExtScene extends StationSceneBase {
  constructor() {
    super('station-ext');
  }

  protected sceneData(): StationSceneData {
    return this.ctx.vm.world.world.exterior;
  }

  protected artKey(): string {
    return 'station-ext';
  }

  protected hasRain(): boolean {
    return true;
  }
}
