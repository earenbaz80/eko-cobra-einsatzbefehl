import type { EkoE2EHook, TacticalEngineCore } from './TacticalEngineCore';
import { paseDeArteCargado, precargarPaseDeArte } from './artProofLoader';

declare global {
  interface Window {
    /** Instantánea de solo lectura del motor; solo para E2E. */
    readonly __eko?: EkoE2EHook;
  }
}

/**
 * Camina al punto dentro de la página.
 *
 * El humo no puede cerrar el lazo desde Node: con el contenedor cargado cada ida y vuelta
 * del protocolo tarda más de lo que el cuerpo recorre en ese tiempo, y el operador
 * oscilaba ±50 px alrededor del punto. Acá se lee la posición en cada frame, se retiene el
 * rumbo hasta entrar en la holgura y se suelta en ese mismo frame, así el paso no depende
 * de la latencia externa.
 */
function caminarEnPagina(
  engine: TacticalEngineCore,
  destino: { x: number; y: number },
  holgura: number,
  topeSim: number,
  topeMs: number
): Promise<{ ok: boolean; x: number; y: number; sim: number; ms: number }> {
  return new Promise((resolver) => {
    const inicioMs = performance.now();
    const teclas = engine.snapshotE2E().caminar;
    const inicioSim = engine.posicionYReloj()?.tiempo ?? 0;
    let retenidas: string[] = [];
    let ultima = engine.posicionYReloj() ?? { x: 0, y: 0, tiempo: inicioSim };
    let quieto = 0;
    const soltar = () => {
      for (const tecla of retenidas) engine.handleKeyUp(tecla);
      retenidas = [];
      engine.clearHeldKeys();
    };
    const paso = () => {
      const pos = engine.posicionYReloj();
      if (!pos) {
        soltar();
        resolver({ ok: false, x: 0, y: 0, sim: 0, ms: performance.now() - inicioMs });
        return;
      }
      const sim = Math.max(0, pos.tiempo - inicioSim);
      const llego = Math.hypot(destino.x - pos.x, destino.y - pos.y) <= holgura;
      if (llego || sim >= topeSim || performance.now() - inicioMs >= topeMs) {
        soltar();
        resolver({ ok: llego, x: pos.x, y: pos.y, sim, ms: performance.now() - inicioMs });
        return;
      }
      // Si el motor perdió las teclas (un blur de la ventana las limpia), el rumbo se
      // vuelve a pulsar: sin esto la caminata se queda quieta con las teclas creídas.
      if (Math.hypot(pos.x - ultima.x, pos.y - ultima.y) > 0.3) {
        ultima = pos;
        quieto = 0;
      } else if (quieto++ > 12) {
        retenidas = [];
        engine.clearHeldKeys();
        quieto = 0;
      }
      const dx = destino.x - pos.x;
      const dy = destino.y - pos.y;
      const rumbo: string[] = [];
      if (Math.hypot(dx, dy) <= 40) {
        // Cerca del punto se alinea el eje corto y recién después se avanza por el largo:
        // entrar en diagonal a un vano engancha el cuerpo en el jamb y lo deja a 15 px.
        if (Math.abs(dx) >= Math.abs(dy)) {
          if (Math.abs(dy) > 1.5) rumbo.push(dy > 0 ? teclas.atras : teclas.adelante);
          else if (Math.abs(dx) > 1) rumbo.push(dx > 0 ? teclas.derecha : teclas.izquierda);
        } else {
          if (Math.abs(dx) > 1.5) rumbo.push(dx > 0 ? teclas.derecha : teclas.izquierda);
          else if (Math.abs(dy) > 1) rumbo.push(dy > 0 ? teclas.atras : teclas.adelante);
        }
      } else {
        if (Math.abs(dx) > 1) rumbo.push(dx > 0 ? teclas.derecha : teclas.izquierda);
        if (Math.abs(dy) > 1) rumbo.push(dy > 0 ? teclas.atras : teclas.adelante);
      }
      for (const tecla of retenidas) if (!rumbo.includes(tecla)) engine.handleKeyUp(tecla);
      for (const tecla of rumbo) if (!retenidas.includes(tecla)) engine.handleKeyDown(tecla);
      retenidas = rumbo;
      requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  });
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
    get heldKeys() {
      return engine.snapshotE2E().heldKeys;
    },
    get caminar() {
      return engine.snapshotE2E().caminar;
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
    caminarHacia: (
      destino: { x: number; y: number },
      holgura: number,
      topeSim: number,
      topeMs: number
    ) => caminarEnPagina(engine, destino, holgura, topeSim, topeMs),
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
