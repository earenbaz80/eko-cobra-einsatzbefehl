# Arquitectura — EKO Cobra: Einsatzbefehl

Simulador táctico top-down 2D en React + TypeScript + Canvas 2D, empaquetado con Vite.
Sin backend: todo el estado vive en el navegador (`localStorage` para progresión y partida).

## Capas

```
src/main.tsx            arranque de React
src/App.tsx             shell de UI: menús, modales, HUD y bucle de render
src/components/         modales y controles (cargados con React.lazy)
src/game/               simulación, mapas, audio y persistencia (sin React)
```

`App.tsx` es el único punto que habla con `TacticalEngine`; los módulos de `src/game/`
no importan React salvo los tipos.

## Módulos de simulación (`src/game/`)

| Módulo | Responsabilidad |
| --- | --- |
| `TacticalEngineCore.ts` | Núcleo del motor: estado de la partida, bucle de actualización, entrada, IA, audio, cámara y snapshots del HUD. |
| `TacticalEngine.ts` | Capa de render sobre `TacticalEngineCore`: dibujo del canvas, efectos y texturas. Es la fachada que consume `App.tsx`. |
| `simulation.ts` | Núcleo determinista de la simulación (RNG `mulberry32`, `PASO_MAXIMO`, `colisiona`, `deslizarConColision`, `distanciaASegmento`) que el motor reutiliza en lugar de duplicar la física; los tests lo ejecutan sobre los layouts reales de Graz y Station. |
| `gameState.ts` | Reductor de estados (`TITLE`, `PLAYING`, `PAUSED`, `VICTORY`, `DEFEAT`) y transiciones válidas. |
| `replay.ts` | Reproducción determinista de entradas para comparar trayectorias y hashes dorados. |
| `ballistics.ts` | Dispersión, penetración y daño por zona anatómica. |
| `roe.ts` | Reglas de enfrentamiento: cuándo un disparo es legítimo. |
| `suspectAi.ts` | Percepción y estados de sospechosos. |
| `squadAi.ts` | Comportamiento del binomio (compañero). |
| `hudMetrics.ts` | Métricas puras del HUD (velocidad, precisión, pulso, visión). |
| `types.ts` | Tipos compartidos y `computePlayerMissionRank`. |
| `save.ts` | Serialización, validación por versión de esquema y E/S de la partida en curso. |
| `keybinds.ts` | Teclas por defecto, validación de la configuración guardada y detección de conflictos. |
| `soundEngine.ts` | Síntesis de audio (Web Audio), buses, paneo y atenuación por distancia. |
| `pixelSprites.ts` | Sprites procedurales en canvas. |
| `asphaltTexture.ts` | Texturas procedurales de asfalto. |
| `battlemapAssets.ts` | Catálogo de assets de escenario. |
| `artDirection.ts` | Lenguaje visual compartido: tokens RGB semánticos (aliado, amenaza, advertencia) que se componen con `rgba()`/`rgb()` sin duplicar hex. |
| `artProof.ts` | Render alternativo experimental (`?art=proof`): el mismo estado del motor a 480×270 con tileset de píxeles y presentación nearest-neighbor a la escala de la ventana. No toca la simulación. |

## Mapas

Cada escenario tiene su layout en un módulo propio: `grazMap.ts`, `stationMap.ts`
(también usado por la Misión 6 del Metro U3), `linzMap.ts`, `tirolMap.ts` y
`viennaAirportMap.ts`.

## Persistencia

- Progresión de carrera (XP/rango): `localStorage['eko_cobra_career_xp']`.
- Partida en curso: `localStorage['eko_cobra_partida_en_curso']` con `version` de esquema.
  `App.tsx` la guarda cada 5 s y en `pagehide`, `beforeunload` y `visibilitychange`;
  al reanudar, `App.tsx` restaura marcador, tiempo y tick y `TacticalEngine.restaurarSimulacion()`
  reconstruye la simulación (posición, paredes, puertas y muebles) sobre el escenario;
  `restaurarC4()` recupera además el inventario, las cargas armadas y el plantado en curso.
- Ajustes (subtítulos, daltonismo, teclas): claves propias de `localStorage`; las teclas
  se leen de `eko_cobra_keybinds` y pasan por `sanitizeKeybinds()`.
- `save.ts` acepta un `StorageLike` inyectable: los tests usan `createMemoryStorage()`.

## Rendimiento

- Modales con `React.lazy` + `Suspense` (chunks separados).
- Modo de baja calidad automático cuando el frame supera ~33 ms.
- El canvas mide el coste del render y lo comunica al motor.
- Presupuestos vigilados por la prueba de humo: JS de entrada < 490 KiB, `dist/` < 1700 KiB.

## Accesibilidad y seguridad

- Los modales usan `useModalA11y` (`src/hooks/useModalA11y.ts`): `role="dialog"`,
  `aria-modal`, foco inicial, trampa de `Tab` y devolución del foco al cerrar.
- El canvas expone `role="application"` y un `aria-label` con los controles básicos.
- `index.html` incluye `<noscript>` para explicar que el juego necesita JavaScript.
- La CSP (`vite.config.ts`, solo en build) limita scripts y conexiones al propio origen,
  permite las fuentes de Google y los `data:`/`blob:` que genera el canvas.

## Verificación

| Comando | Qué comprueba |
| --- | --- |
| `npm run lint` | Tipos (`tsc --noEmit`). |
| `npm run test` | Unidad (Vitest). |
| `npm run build` | Build de producción. |
| `npm run smoke` | Build servido como en Pages: cobertura completa (misiones, móvil, persistencia, pesos y frame time). |
| `npm run smoke:quick` | Perfil rápido de PR: canvas, Misión 1 y transiciones de estado. |
| `npm run verify` | Las cuatro anteriores en orden; usa el smoke completo. |

La prueba de humo sale del CI con `VITE_BASE_PATH=/eko-cobra-einsatzbefehl/`; en local
sirve `dist/` en la raíz y reintenta las rutas absolutas de metadatos sin el base.
Todos los contextos de Playwright reciben una semilla fija de `mulberry32` antes de
cargar la app (`SMOKE_SEED`, por defecto `0xE2E0`) para que el mobiliario, las
partículas y la IA no dependan de `Math.random`.

## Deuda técnica conocida

1. `TacticalEngineCore.ts` sigue concentrando estado, IA, audio y entrada: extraer los
   sistemas de simulación a módulos con estado explícito.
2. `App.tsx` (~3k líneas) mezcla shell, menús y bucle de render: separar por pantallas.
3. Faltan pruebas de integración con escenarios jugados de punta a punta; hoy la
   simulación se valida por módulos y con el humo del navegador.
4. El modo de baja calidad solo se dispara por tiempo de frame; falta control manual y
   detección de hardware.
