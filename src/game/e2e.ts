import type { EkoE2EHook, TacticalEngineCore } from './TacticalEngineCore';
import { paseDeArteCargado, precargarPaseDeArte } from './artProofLoader';

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
  // El pase de arte vive en su propio chunk; se pide acá porque el humo lo
  // consulta enseguida. Con `?art=classic` esta llamada no descarga nada.
  precargarPaseDeArte();
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
    get actors() {
      return engine.snapshotE2E().actors;
    },
    get tick() {
      return engine.ticks;
    },
    get tiempo() {
      return engine.snapshotE2E().tiempo;
    },
    get pantalla() {
      return engine.snapshotE2E().pantalla;
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
    clearHeldKeys: () => engine.clearHeldKeys(),
    worldToScreen: (x: number, y: number) => engine.worldToScreen(x, y),
    artBufferHash: () => paseDeArteCargado()?.artProofBufferHash() ?? null,
    artBufferSize: () => paseDeArteCargado()?.artBufferSize() ?? null,
    artFrame: () => paseDeArteCargado()?.geometriaPresentada() ?? null,
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
