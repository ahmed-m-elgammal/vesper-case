/**
 * StationUpScene -- the upper floor: canteen, archive, records room. Miss
 * Quill and Dr. Cray live up here, plus the flavour that makes the top floor
 * a place. Every hotspot comes from world.json upper.
 */

import { StationSceneBase } from './StationSceneBase';
import type { StationSceneData } from '../../data/types';

export class StationUpScene extends StationSceneBase {
  constructor() {
    super('station-up');
  }

  protected sceneData(): StationSceneData {
    return this.ctx.vm.world.world.upper ?? this.ctx.vm.world.world.interior;
  }

  protected artKey(): string {
    return 'station-up';
  }

  protected hasRain(): boolean {
    return false;
  }
}
