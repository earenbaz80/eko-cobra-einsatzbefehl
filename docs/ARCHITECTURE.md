# Arquitectura — EKO Cobra: Einsatzbefehl

## Estado actual
- `src/game/TacticalEngine.ts` (~430 KB) concentra estado, simulación, IA, audio y renderizado.
- Se ha iniciado la extracción de lógica pura a módulos testeables:
  - `src/game/hudMetrics.ts` — métricas de HUD (velocidad, precisión, pulso, visión).
  - `src/game/types.ts` — tipos y `computePlayerMissionRank`.

## Módulos propuestos
1. **core/** — estado global, bucle de actualización, gestión de entidades.
2. **simulation/** — balística, ruido, sigilo, IA de sospechosos y compañero.
3. **rendering/** — canvas, partículas, iluminación, post-procesado.
4. **hud/** — snapshots, métricas y sincronización con React.
5. **audio/** — `soundEngine` (ya aislado).
6. **maps/** — layouts por escenario (ya separados en `*Map.ts`).

## Próximos pasos
- Extraer `emitHudSnapshot` por dominios (jugador, binomio, sigilo, misión).
- Mover renderizado a `TacticalRenderer` que reciba el estado inmutable.
- Añadir tests para balística, ROE y IA.
- Mantener `TacticalEngine` como fachada pública para `App.tsx`.