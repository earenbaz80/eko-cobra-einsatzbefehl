import type { EkoE2EHook, TacticalEngineCore } from './TacticalEngineCore';
import { artProofBufferHash } from './artProof';

declare global {
  interface Window {
    /** Instantánea de solo lectura del motor; solo para E2E. */
    readonly __eko?: EkoE2EHook;
  }
}

/**
 * Publica el estado del motor en `window.__eko` sin exponer referencias mutables.
 * La propiedad no es enumerable ni escribible y se retira al desmontar la app.
 */
export function instalarHookE2E(engine: TacticalEngineCore): () => void {
  const hook: EkoE2EHook = Object.freeze({
    get gameState() {
      return engine.gameState;
    },
    get player() {
      return engine.snapshotE2E().player;
    },
    get squad() {
      return engine.snapshotE2E().squad;
    },
    get tick() {
      return engine.ticks;
    },
    get world() {
      return engine.snapshotE2E().world;
    },
    get c4Count() {
      return engine.snapshotE2E().c4Count;
    },
    get squadGear() {
      return engine.snapshotE2E().squadGear;
    },
    get radioFeed() {
      return engine.snapshotE2E().radioFeed;
    },
    snapshot: () => engine.snapshotE2E(),
    worldToScreen: (x: number, y: number) => engine.worldToScreen(x, y),
    artBufferHash: () => artProofBufferHash(),
  });

  Object.defineProperty(window, '__eko', {
    value: hook,
    configurable: true,
    enumerable: false,
    writable: false,
  });

  return () => {
    if (window.__eko === hook) {
      Reflect.deleteProperty(window, '__eko');
    }
  };
}
