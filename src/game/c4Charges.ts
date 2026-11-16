import type { ActiveC4Charge } from './types';

export interface C4PlantingState {
  targetName: string;
  x: number;
  y: number;
  doorId?: string;
  windowId?: string;
  isWindow: boolean;
  progress: number;
  maxProgress: number;
}

export class C4ChargeSystem {
  count = 2;
  charges: ActiveC4Charge[] = [];
  planting?: C4PlantingState;
}