import {
  EKO_COBRA_ATTACHMENTS,
  EKO_COBRA_GADGETS,
  EKO_COBRA_INSPECTION_DEVICES,
  EKO_COBRA_PROFILES,
  EKO_COBRA_WEAPONS,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from './grazMap';
import {
  renderBattlemapFurnitureItem,
  renderExteriorAnimatedDetails,
  renderExteriorStreetsAndStairwell,
  URBAN_STREET_LAMPS
} from './battlemapAssets';
import {
  fillAsphaltSurface
} from './asphaltTexture';

// Límites del escenario exterior en coordenadas de mundo. Las fachadas norte
// empiezan en y≈-455 y las sur terminan en y=1250; las este, en x=1720.
const STATIC_SCENE_BOUNDS = { x: -450, y: -460, width: 2250, height: 1760 } as const;
import {
  drawPixelArtActor,
  drawPixelArtSonarActor
} from './pixelSprites';
import {
  ActorEntity,
  TacticalMarkerType,
  Vec2,
  WallSconceLight
} from './types';
import { CAMERA_ZOOM, TacticalEngineCore } from './TacticalEngineCore';

/**
 * Capa de dibujo del motor táctico.
 *
 * Vive en una subclase para reutilizar los campos y utilidades de simulación de
 * `TacticalEngineCore` sin duplicar estado: aquí solo se pinta (canvas, HUD
 * diegético, minimapa, post-proceso).
 */
export class TacticalEngine extends TacticalEngineCore {
  private renderGrenadeTrajectoryPreview(ctx: CanvasRenderingContext2D, player: ActorEntity) {
    if (!this.grenadeAimingActive) return;

    const gadgetSpec = EKO_COBRA_GADGETS[this.plan.gadget];
    const maxThrowDist = this.plan.gadget === 'PEPPER_SPRAY' ? 165 : 235;

    const dx = this.mouseWorld.x - player.x;
    const dy = this.mouseWorld.y - player.y;
    const rawDist = Math.hypot(dx, dy);
    const dist = Math.min(maxThrowDist, rawDist);
    const ang = Math.atan2(dy, dx);

    let targetX = player.x + Math.cos(ang) * dist;
    let targetY = player.y + Math.sin(ang) * dist;

    // Obstacle collision check (walls & doors)
    const hit = this.raycastPoint(player.x, player.y, targetX, targetY);
    if (hit) {
      targetX = hit.x - Math.cos(ang) * 10;
      targetY = hit.y - Math.sin(ang) * 10;
    }

    const actualDist = Math.hypot(targetX - player.x, targetY - player.y);

    // Color theme based on gadget type
    let mainColor = '#F59E0B'; // Flashbang / default amber
    let fillColor = 'rgba(245, 158, 11, 0.14)';

    if (this.plan.gadget === 'CS_GAS') {
      mainColor = '#10B981'; // CS Gas emerald
      fillColor = 'rgba(16, 185, 129, 0.14)';
    } else if (this.plan.gadget === 'PEPPER_SPRAY') {
      mainColor = '#F97316'; // Pepper Spray orange
      fillColor = 'rgba(249, 115, 22, 0.14)';
    }

    ctx.save();

    // 1. Ground shadow vector (straight line from player to target)
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();

    // 2. Parabolic Trajectory Arc Curve
    const peakHeight = actualDist * 0.28; // Arc apex height proportional to distance
    const segments = 28;

    ctx.setLineDash([]);
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 2.2;

    ctx.beginPath();
    ctx.moveTo(player.x, player.y);

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const px = player.x + (targetX - player.x) * t;
      const heightOffset = Math.sin(t * Math.PI) * peakHeight;
      const py = player.y + (targetY - player.y) * t - heightOffset;
      ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Trajectory animated flow dots along arc
    const dotPhase = (this.elapsedSeconds * 4) % 1;
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowBlur = 10;
    for (let d = 0; d < 4; d++) {
      const t = (dotPhase + d * 0.25) % 1;
      const px = player.x + (targetX - player.x) * t;
      const heightOffset = Math.sin(t * Math.PI) * peakHeight;
      const py = player.y + (targetY - player.y) * t - heightOffset;
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Landing Target Point & Blast Radius Circle Indicator
    const blastRadius = gadgetSpec.radiusPx || 120;
    const pulseFactor = 1 + Math.sin(this.elapsedSeconds * 6) * 0.04;

    // Blast Radius Fill
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.arc(targetX, targetY, blastRadius * pulseFactor, 0, Math.PI * 2);
    ctx.fill();

    // Outer Blast Radius Ring
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(targetX, targetY, blastRadius * pulseFactor, 0, Math.PI * 2);
    ctx.stroke();

    // Center Crosshair Target Rings
    ctx.setLineDash([]);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(targetX, targetY, 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(targetX, targetY, 18, 0, Math.PI * 2);
    ctx.stroke();

    // Center Crosshairs ticks
    ctx.beginPath();
    ctx.moveTo(targetX - 24, targetY);
    ctx.lineTo(targetX + 24, targetY);
    ctx.moveTo(targetX, targetY - 24);
    ctx.lineTo(targetX, targetY + 24);
    ctx.stroke();

    ctx.restore();

    // 4. Diegetic World Badge Prompt over Target
    ctx.save();
    const screenTarget = this.worldToScreen(targetX, targetY);
    const badgeX = screenTarget.x;
    const badgeY = screenTarget.y - 38;

    const labelHeader = `💣 GRANADA: ${gadgetSpec.nameDe.toUpperCase()} (${Math.round(actualDist / 10)}M)`;
    const labelSub = `[CLIC IZQ / G]: LANZAR  ·  [ESC / CLIC DER]: CANCELAR`;

    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    const w1 = ctx.measureText(labelHeader).width;
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    const w2 = ctx.measureText(labelSub).width;
    const bw = Math.max(w1, w2) + 16;
    const bh = 28;

    ctx.fillStyle = 'rgba(6, 11, 18, 0.92)';
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 8;

    ctx.beginPath();
    ctx.rect(badgeX - bw * 0.5, badgeY - bh * 0.5, bw, bh);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillStyle = mainColor;
    ctx.fillText(labelHeader, badgeX, badgeY - 5);

    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(labelSub, badgeX, badgeY + 6);

    ctx.restore();
  }

  public render() {
    const ctx = this.ctx;
    // Draw in CSS pixels so the backing store can be scaled by devicePixelRatio.
    ctx.setTransform(this.renderScale, 0, 0, this.renderScale, 0, 0);
    const width = this.viewWidth;
    const height = this.viewHeight;

    // Fill canvas background with textured asphalt
    fillAsphaltSurface(ctx, 0, 0, width, height, false);
    ctx.fillStyle = 'rgba(5, 8, 13, 0.45)';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
    const shakeY = (Math.random() - 0.5) * this.shakeIntensity;
    ctx.translate(width * 0.5 + shakeX, height * 0.5 + shakeY);
    ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
    ctx.translate(-this.camX, -this.camY);

    // 1. Exterior tactical grid & wet asphalt surround
    this.renderExteriorGrid(ctx);

    // 2. Render Apartment Floor & Furniture
    this.renderRoomsAndFurniture(ctx);

    const player = this.getPlayer();
    const squad = this.getSquadmate();

    // 3. Render Dynamic Projected Umbra Shadows from Furniture & Actors driven by Weapon Flashlights
    if (player) {
      this.renderProjectedShadows(ctx, player, squad);
    }

    // 4. Render Walls & Doors
    this.renderWallsAndDoors(ctx);

    // 5. Render Composite Darkness & Raycasted Vision/Flashlight Light Map
    this.paint(ctx, player, squad, shakeX, shakeY);

    // 6. Render Inspection Sensor Cone (Thermal FLIR or Optic Snake Cam)
    if (player && (this.mirrorDoorId || this.thermalActive)) {
      this.renderInspectionSensorCone(ctx, player);
    }

    // 7. Render Dropped Evidence
    this.renderEvidence(ctx);

    // 8. Render Actors with Multi-Frame Pixel Art Sprites
    this.renderActors(ctx, player);

    // 9. Render Laser Sight, Bullet Traces, Gadgets, Shout Waves & EKO-PAD Tactical Markers
    if (player && this.gameState === 'PLAYING') {
      this.renderPlayerLaserSight(ctx, player);
      if (this.grenadeAimingActive) {
        this.renderGrenadeTrajectoryPreview(ctx, player);
      }
    }
    this.renderTacticalMarkersOnCanvas(ctx, player, squad);
    this.renderEffects(ctx);

    // 10. Render Graz Rain Drops, Window Rain Streaks & Suspended Ambient/Breach Dust Motes
    this.renderRain(ctx);
    if (!this.lowQualityMode) {
      this.renderAmbientDustAndHaze(ctx, player, squad);
    }

    if (this.missionMode === 'SCHWECHAT') {
      this.renderSchwechatRunwayBeacons(ctx);
    }

    ctx.restore();

    if (player && this.gameState === 'PLAYING' && !this.lowQualityMode) {
      this.renderAnamorphicLensFlares(ctx, player, squad);
    }

    // Subtle ambient vignette to frame the view and reinforce focus on the lit cone.
    if (player && this.gameState === 'PLAYING') {
      ctx.save();
      const ambientVignette = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.32,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.78
      );
      ambientVignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      ambientVignette.addColorStop(1, 'rgba(2, 6, 12, 0.22)');
      ctx.fillStyle = ambientVignette;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    // 11. Render Night Vision (NVG) Post-Processing Filter, Trauma Vignette, Directional Hit Flash, Peripheral Acoustic Edge Indicators & Minimap
    if (player && this.gameState === 'PLAYING') {
      if (this.nvgActive) {
        this.renderNightVisionPostProcess(ctx, width, height);
      }
      this.renderCSGasEffect(ctx, width, height, player);
      this.renderWeatherVisibilityOverlay(ctx, width, height, player);
      this.renderTraumaVisionVignette(ctx, width, height, player);
      this.renderSuppressionEffect(ctx, width, height);
      this.renderC4WarningPulseOverlay(ctx, width, height);
      this.renderDirectionalPlayerHitEffect(ctx, width, height);
      if (!this.lowQualityMode) {
        this.renderTacticalFilmGrainAndGrainOverlay(ctx, width, height, player);
        this.renderPeripheralAcousticIndicators(ctx, width, height, player);
      }
      this.renderSquareMinimap(ctx, width, height, player, squad);
      if (!this.lowQualityMode) {
        this.renderKobra2BodycamPiP(ctx, width, height, squad);
      }
      this.renderSmartDiegeticReticle(ctx, width, height, player);
    }

    if (this.nightMode) {
      ctx.fillStyle = 'rgba(0, 0, 12, 0.45)';
      ctx.fillRect(0, 0, width, height);
    }

    if (this.flashScreenAlpha > 0.01) {
      ctx.fillStyle = `rgba(248, 250, 252, ${this.flashScreenAlpha})`;
      ctx.fillRect(0, 0, width, height);
    }
  }

  private renderDirectionalPlayerHitEffect(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) {
    if (this.playerHitFlashTimer <= 0) return;
    const ratio = Math.min(1, this.playerHitFlashTimer / 0.42);
    ctx.save();

    // Crimson ballistic shock border
    const grad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      Math.min(width, height) * 0.25,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.65
    );
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.7, `rgba(185, 28, 28, ${ratio * 0.28})`);
    grad.addColorStop(1, `rgba(220, 38, 38, ${ratio * 0.68})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Directional incoming fire arc indicator around center of viewport
    ctx.translate(width * 0.5, height * 0.5);
    ctx.rotate(this.playerHitSourceAngle);
    ctx.strokeStyle = `rgba(239, 68, 68, ${ratio * 0.95})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 96, -0.45, 0.45);
    ctx.stroke();

    ctx.restore();
  }

  private renderTacticalFilmGrainAndGrainOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    player: ActorEntity
  ) {
    const isHit = this.playerHitFlashTimer > 0;
    const hitRatio = Math.min(1, this.playerHitFlashTimer / 0.42);
    const isBleeding = player.bodyHealth?.bleeding;
    const isLowHp = player.hp < 40;
    const isDanger = isHit || isBleeding || isLowHp || this.suppressionTimer > 0;

    if (!isDanger) return;

    ctx.save();

    // 1. Deep Crimson Corner Vignette when taking damage or in danger
    const vignetteIntensity = isHit
      ? 0.75 * hitRatio + 0.2
      : isBleeding
        ? 0.48 + 0.18 * Math.sin(this.elapsedSeconds * 6)
        : isLowHp
          ? 0.52 + 0.2 * Math.sin(this.elapsedSeconds * 4)
          : 0.38;

    const grad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      Math.min(width, height) * 0.25,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.72
    );
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.5, `rgba(127, 29, 29, ${(vignetteIntensity * 0.35).toFixed(3)})`);
    grad.addColorStop(1, `rgba(220, 38, 38, ${(vignetteIntensity * 0.88).toFixed(3)})`);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 2. High-Frequency Tactical Camera Grain Noise Specs overlaying the viewport corners
    const noiseCount = isHit ? 240 : 130;
    ctx.fillStyle = isHit ? 'rgba(254, 202, 202, 0.45)' : 'rgba(148, 163, 184, 0.32)';

    for (let i = 0; i < noiseCount; i++) {
      const edgeSide = Math.floor(Math.random() * 4);
      let nx = Math.random() * width;
      let ny = Math.random() * height;

      if (edgeSide === 0) ny = Math.random() * (height * 0.22);
      else if (edgeSide === 1) ny = height - Math.random() * (height * 0.22);
      else if (edgeSide === 2) nx = Math.random() * (width * 0.22);
      else nx = width - Math.random() * (width * 0.22);

      const noiseSize = 1.2 + Math.random() * 2.2;
      ctx.fillRect(nx, ny, noiseSize, noiseSize);
    }

    // 3. Screen Edge Danger Border Line
    if (isHit || isLowHp) {
      ctx.strokeStyle = `rgba(239, 68, 68, ${Math.min(0.92, vignetteIntensity * 1.15).toFixed(2)})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, width, height);
    }

    ctx.restore();
  }

  private renderPeripheralAcousticIndicators(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    player: ActorEntity
  ) {
    if (this.acousticIndicators.length === 0) return;

    const cx = width * 0.5;
    const cy = height * 0.5;
    // Inset from viewport edges so it sits cleanly inside the tactical HUD frame
    const padX = Math.max(46, width * 0.045);
    const padY = Math.max(68, height * 0.085);
    const halfW = cx - padX;
    const halfH = cy - padY;

    ctx.save();
    for (const ind of this.acousticIndicators) {
      const dx = ind.x - player.x;
      const dy = ind.y - player.y;
      const distPx = Math.hypot(dx, dy);
      if (distPx < 20) continue;

      const angle = Math.atan2(dy, dx);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      // Project ray from viewport center to the rounded screen-edge perimeter
      const tx = Math.abs(cos) > 0.0001 ? halfW / Math.abs(cos) : Infinity;
      const ty = Math.abs(sin) > 0.0001 ? halfH / Math.abs(sin) : Infinity;
      const tEdge = Math.min(tx, ty);
      const edgeX = cx + cos * tEdge;
      const edgeY = cy + sin * tEdge;

      const lifeRatio = Math.max(0, Math.min(1, ind.life / ind.maxLife));
      const smoothFade = Math.sin(lifeRatio * Math.PI * 0.5);
      // Keep the indicator subtle and non-intrusive while clearly readable
      const baseAlpha =
        (ind.kind === 'GUNSHOT' ? 0.68 : 0.48) * smoothFade * (0.55 + ind.intensity * 0.45);

      const primaryRgb =
        ind.kind === 'GUNSHOT'
          ? '239, 68, 68' // Crimson for gunshots
          : ind.kind === 'ALERT_VOICE'
            ? '249, 115, 22' // Orange for hostile voice/movement
            : '251, 191, 36'; // Amber for suspicious footsteps

      ctx.save();
      ctx.translate(edgeX, edgeY);
      ctx.rotate(angle);

      // 1. Subtle peripheral ambient glow on the screen border
      const glowGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, ind.kind === 'GUNSHOT' ? 38 : 28);
      glowGrad.addColorStop(0, `rgba(${primaryRgb}, ${baseAlpha * 0.45})`);
      glowGrad.addColorStop(1, `rgba(${primaryRgb}, 0)`);
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, ind.kind === 'GUNSHOT' ? 38 : 28, 0, Math.PI * 2);
      ctx.fill();

      // 2. Concentric acoustic sound-wave arcs curving inward from the border
      const waveOffset = ((1 - lifeRatio) * 12) % 6;
      ctx.strokeStyle = `rgba(${primaryRgb}, ${baseAlpha * 0.85})`;
      ctx.lineWidth = ind.kind === 'GUNSHOT' ? 2.0 : 1.5;
      ctx.lineCap = 'round';

      // Outer curved acoustic arc
      ctx.beginPath();
      ctx.arc(-14, 0, 14 + waveOffset * 0.4, -0.58, 0.58);
      ctx.stroke();

      // Inner secondary acoustic ripple arc
      ctx.strokeStyle = `rgba(${primaryRgb}, ${baseAlpha * 0.52})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(-14, 0, 8 + waveOffset * 0.4, -0.44, 0.44);
      ctx.stroke();

      // 3. Crisp outward-pointing directional chevron tip at the border
      ctx.fillStyle = `rgba(${primaryRgb}, ${Math.min(0.85, baseAlpha * 1.15)})`;
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(-2, -4.5);
      ctx.lineTo(-0.5, 0);
      ctx.lineTo(-2, 4.5);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // 4. Compact upright acoustic telemetry micro-tag (e.g. "DISPARO · 9m" or "PASOS · 6m")
      const distMeters = Math.max(1, Math.round(distPx / 42));
      const shortTag =
        ind.kind === 'GUNSHOT'
          ? `DISPARO · ${distMeters}m`
          : ind.kind === 'ALERT_VOICE'
            ? `RUIDO · ${distMeters}m`
            : `PASOS · ${distMeters}m`;

      const labelX = edgeX - cos * 26;
      const labelY = edgeY - sin * 22;
      ctx.save();
      ctx.font = '600 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(15, 23, 42, ${baseAlpha * 0.72})`;
      const textW = ctx.measureText(shortTag).width;
      ctx.fillRect(labelX - textW * 0.5 - 4, labelY - 6, textW + 8, 12);
      ctx.fillStyle = `rgba(${primaryRgb}, ${Math.min(0.9, baseAlpha * 1.2)})`;
      ctx.fillText(shortTag, labelX, labelY);
      ctx.restore();
    }
    ctx.restore();
  }

  private renderSuppressionEffect(ctx: CanvasRenderingContext2D, width: number, height: number) {
    if (this.suppressionTimer <= 0) return;
    const alpha = Math.min(0.65, this.suppressionTimer * 0.5);
    ctx.save();
    const grad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      Math.min(width, height) * 0.15,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.72
    );
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.6, `rgba(15, 23, 42, ${alpha * 0.5})`);
    grad.addColorStop(1, `rgba(220, 38, 38, ${alpha * 0.9})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Clearer suppression indicator: one pulsing red edge frame on top of the vignette.
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsedSeconds * 9);
    const edgeAlpha = Math.min(0.9, alpha * (0.7 + pulse * 0.3));
    ctx.strokeStyle = `rgba(239, 68, 68, ${edgeAlpha.toFixed(3)})`;
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, width - 12, height - 12);
    ctx.restore();
  }

  private renderC4WarningPulseOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) {
    const unsafeArmedC4 = this.c4.charges.filter(
      (charge) => !this.isBlastAreaClear(charge)
    );
    if (unsafeArmedC4.length === 0) return;

    // The charge has no automatic fuse: warn steadily until the area is clear.
    const pulseFreq = 4.5;
    const pulseSine = 0.5 + 0.5 * Math.sin(this.elapsedSeconds * pulseFreq);
    const alpha = Math.min(0.8, 0.32 + pulseSine * 0.30);

    ctx.save();

    // 1. Full-screen pulsating crimson warning tint overlay
    ctx.fillStyle = `rgba(220, 38, 38, ${(alpha * 0.28).toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);

    // 2. Heavy radial perimeter vignette (dark red edge encroaching inward)
    const innerRadius = Math.min(width, height) * 0.28;
    const outerRadius = Math.max(width, height) * 0.67;
    const grad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      innerRadius,
      width * 0.5,
      height * 0.5,
      outerRadius
    );
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.48, `rgba(220, 38, 38, ${(alpha * 0.45).toFixed(3)})`);
    grad.addColorStop(1, `rgba(185, 28, 28, ${(alpha * 0.95).toFixed(3)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 3. Thick warning border frame on screen edge
    ctx.strokeStyle = `rgba(239, 68, 68, ${(alpha * 0.92).toFixed(3)})`;
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, width, height);

    // 4. Central top armed-charge banner (no countdown: detonation is deliberate)
    const targetName = unsafeArmedC4[0].targetName || 'OBJETIVO';
    const bannerText = `⚠ C4 ARMADA · ${targetName.toUpperCase()} · DESPEJAR ZONA [J] ⚠`;

    ctx.font = '900 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textW = ctx.measureText(bannerText).width;
    const bannerW = textW + 32;
    const bannerH = 26;
    const bannerX = width * 0.5;
    const bannerY = 46;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fillRect(bannerX - bannerW * 0.5, bannerY - bannerH * 0.5, bannerW, bannerH);
    ctx.strokeStyle = pulseSine > 0.4 ? '#EF4444' : '#F59E0B';
    ctx.lineWidth = 2;
    ctx.strokeRect(bannerX - bannerW * 0.5, bannerY - bannerH * 0.5, bannerW, bannerH);

    ctx.fillStyle = pulseSine > 0.3 ? '#FEE2E2' : '#EF4444';
    ctx.fillText(bannerText, bannerX, bannerY + 1);

    ctx.restore();
  }

  private renderTraumaVisionVignette(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    player: ActorEntity
  ) {
    const bh = player.bodyHealth;
    const maxHp = player.maxHp || 100;
    // Percentage of health lost (0.0 at full health -> 1.0 at 0 HP)
    const healthLostRatio = Math.max(0, Math.min(1, (maxHp - player.hp) / maxHp));
    const torsoLossRatio = bh ? Math.max(0, (100 - bh.torso) / 100) : 0;
    const limbLossRatio = bh ? Math.max(0, (200 - bh.arms - bh.legs) / 200) * 0.45 : 0;
    const isBleeding = bh ? bh.bleeding : false;

    // Combine percentage of health lost with anatomical trauma & active bleeding
    const effectiveLoss = Math.min(
      1,
      Math.max(
        healthLostRatio,
        torsoLossRatio * 0.85,
        limbLossRatio + (isBleeding ? 0.28 + (bh?.woundsCount ?? 0) * 0.08 : 0)
      )
    );

    if (effectiveLoss <= 0.01) return;

    // Systolic/diastolic arterial heartbeat rhythm that accelerates as more health is lost
    const heartRate = 2.6 + effectiveLoss * 4.8 + (isBleeding ? 2.2 : 0);
    const phase = this.elapsedSeconds * heartRate;
    const systolicBeat = Math.pow(Math.max(0, Math.sin(phase)), 2) * 0.65 +
      Math.pow(Math.max(0, Math.sin(phase * 2 + 0.6)), 4) * 0.35;
    const pulseFactor = 0.72 + 0.28 * systolicBeat;

    // Vignette opacity and inward encroachment intensify directly with % of health lost
    const peakEdgeAlpha = Math.min(0.88, (0.16 + effectiveLoss * 0.72) * pulseFactor);
    const midAlpha = peakEdgeAlpha * (0.42 + effectiveLoss * 0.22);

    // Clear inner radius shrinks as health is lost (tunnel vision effect)
    const innerClearRadius =
      Math.min(width, height) * Math.max(0.14, 0.44 - effectiveLoss * 0.26 - systolicBeat * 0.03 * effectiveLoss);
    const outerRadius = Math.max(width, height) * (0.72 - effectiveLoss * 0.12);

    ctx.save();
    const grad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      innerClearRadius,
      width * 0.5,
      height * 0.5,
      outerRadius
    );
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.48, `rgba(185, 28, 28, ${midAlpha * 0.55})`);
    grad.addColorStop(0.78, `rgba(153, 27, 27, ${midAlpha})`);
    grad.addColorStop(1, `rgba(69, 10, 10, ${peakEdgeAlpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Peripheral arterial/capillary crimson border frame & corner veins when health lost >= 20%
    if (effectiveLoss >= 0.2) {
      const veinAlpha = Math.min(0.75, (effectiveLoss - 0.15) * 0.85 * pulseFactor);
      ctx.strokeStyle = `rgba(220, 38, 38, ${veinAlpha * 0.55})`;
      ctx.lineWidth = 4 + effectiveLoss * 10;
      ctx.strokeRect(0, 0, width, height);

      // Subtle diagonal capillary streaks in screen corners
      const cornerReach = 45 + effectiveLoss * 95;
      ctx.strokeStyle = `rgba(239, 68, 68, ${veinAlpha * 0.45})`;
      ctx.lineWidth = 1.6;
      const corners = [
        { cx: 0, cy: 0, dx: 1, dy: 1 },
        { cx: width, cy: 0, dx: -1, dy: 1 },
        { cx: 0, cy: height, dx: 1, dy: -1 },
        { cx: width, cy: height, dx: -1, dy: -1 },
      ];
      for (const c of corners) {
        ctx.beginPath();
        ctx.moveTo(c.cx, c.cy);
        ctx.lineTo(c.cx + c.dx * cornerReach * 0.6, c.cy + c.dy * cornerReach * 0.35);
        ctx.moveTo(c.cx, c.cy);
        ctx.lineTo(c.cx + c.dx * cornerReach * 0.35, c.cy + c.dy * cornerReach * 0.6);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private renderExteriorGrid(ctx: CanvasRenderingContext2D) {
    // Fill world exterior canvas with textured asphalt
    fillAsphaltSurface(ctx, -500, -500, WORLD_WIDTH + 1000, WORLD_HEIGHT + 1000, false);
    ctx.fillStyle = 'rgba(5, 8, 13, 0.40)';
    ctx.fillRect(-500, -500, WORLD_WIDTH + 1000, WORLD_HEIGHT + 1000);

    ctx.strokeStyle = 'rgba(30, 41, 59, 0.28)';
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x <= WORLD_WIDTH; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD_WIDTH, y);
      ctx.stroke();
    }
  }

  private renderRoomsAndFurniture(ctx: CanvasRenderingContext2D) {
    for (const room of this.rooms) {
      ctx.fillStyle = room.floorColor;
      ctx.fillRect(room.x, room.y, room.w, room.h);

      // Floor tile / parquet grid texture
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.lineWidth = 1;
      const tileSize = 36;
      for (let tx = room.x; tx < room.x + room.w; tx += tileSize) {
        ctx.beginPath();
        ctx.moveTo(tx, room.y);
        ctx.lineTo(tx, room.y + room.h);
        ctx.stroke();
      }
      for (let ty = room.y; ty < room.y + room.h; ty += tileSize) {
        ctx.beginPath();
        ctx.moveTo(room.x, ty);
        ctx.lineTo(room.x + room.w, ty);
        ctx.stroke();
      }
      ctx.restore();

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(room.x + 2, room.y + 2, room.w - 4, room.h - 4);

      ctx.fillStyle = 'rgba(148, 163, 184, 0.28)';
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillText(room.nameDe, room.x + 14, room.y + 22);

      // Ambient Occlusion / Soft Corner Shadows inside room
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(room.x, room.y, 15, room.h); // Left wall shadow
      ctx.fillRect(room.x + room.w - 15, room.y, 15, room.h); // Right wall shadow
      ctx.fillRect(room.x, room.y, room.w, 15); // Top wall shadow
      ctx.fillRect(room.x, room.y + room.h - 15, room.w, 15); // Bottom wall shadow
      ctx.restore();
    }

    if (this.missionMode === 'TIROL') {
      this.renderSnowFootprints(ctx);
    }

    // Render urban perimeter streets or train station tracks & platform
    if (this.missionMode === 'STATION') {
      this.renderStationTrackAndTrainDetails(ctx);
    } else if (!this.isTrainingMode) {
      ctx.drawImage(this.getStaticScene(), STATIC_SCENE_BOUNDS.x, STATIC_SCENE_BOUNDS.y);
      renderExteriorAnimatedDetails(ctx, this.elapsedSeconds);
    }

    // Render persistent Floor Decals (Blood Splatters, Arterial Pools, Scorch, Rubble & Spent Brass Casings)
    for (const d of this.decals) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.angle);
      ctx.globalAlpha = d.alpha;
      ctx.fillStyle = d.color;
      if (d.type === 'CASING') {
        ctx.fillRect(-2.4, -1.1, 4.8, 2.2);
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(-2.4, -1.1, 1.5, 2.2);
      } else if (d.type === 'DEBRIS') {
        ctx.fillRect(-d.radius, -d.radius * d.aspect, d.radius * 2, d.radius * 2 * d.aspect);
      } else {
        ctx.beginPath();
        ctx.ellipse(0, 0, d.radius, d.radius * d.aspect, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    const player = this.getPlayer();
    const weatherVisMult = player ? this.getWeatherVisibilityMultiplier(player.x, player.y) : 1;
    const maxVisionDist = (this.flashlightOn ? 540 : this.nvgActive ? 470 : 285) * weatherVisMult;

    for (const item of this.furniture) {
      if (player && this.gameState === 'PLAYING') {
        const itemCenterX = item.x + item.w * 0.5;
        const itemCenterY = item.y + item.h * 0.5;
        const distToPlayer = Math.hypot(itemCenterX - player.x, itemCenterY - player.y);
        const itemAngle = Math.atan2(itemCenterY - player.y, itemCenterX - player.x);
        const itemAngleDiff = Math.abs(this.normalizeAngle(itemAngle - player.angle));
        const itemHasLOS = !this.raycastWallsAndDoors(player.x, player.y, itemCenterX, itemCenterY);

        const isVisible =
          distToPlayer < 100 ||
          (itemHasLOS && distToPlayer <= maxVisionDist && (itemAngleDiff < 1.25 || distToPlayer < 130)) ||
          (this.flashlightOn && itemHasLOS && distToPlayer <= 560 && itemAngleDiff <= 0.45);

        if (!isVisible) continue;
      }
      renderBattlemapFurnitureItem(ctx, item);
    }

    // Render persistent bullet impact marks on furniture surfaces
    this.renderSurfaceImpactMarks(ctx, 'FURNITURE');

    // Render tactical acoustic noise ripple waves expanding across the map
    this.renderAcousticNoiseRings(ctx);
  }

  private getStaticScene(): HTMLCanvasElement {
    if (this.staticScene) return this.staticScene;
    const scene = document.createElement('canvas');
    scene.width = STATIC_SCENE_BOUNDS.width;
    scene.height = STATIC_SCENE_BOUNDS.height;
    const sceneCtx = scene.getContext('2d');
    if (sceneCtx) {
      sceneCtx.translate(-STATIC_SCENE_BOUNDS.x, -STATIC_SCENE_BOUNDS.y);
      renderExteriorStreetsAndStairwell(sceneCtx);
    }
    this.staticScene = scene;
    // La primera pasada puede ocurrir antes de que carguen las webfonts. Al
    // terminar, se invalida una vez para que los rótulos usen la tipografía final.
    if (document.fonts && document.fonts.status !== 'loaded') {
      void document.fonts.ready.then(() => {
        if (this.staticScene === scene) this.staticScene = undefined;
      });
    }
    return scene;
  }

  private renderStationTrackAndTrainDetails(ctx: CanvasRenderingContext2D) {
    ctx.save();
    // 1. Ballast bed (Schotterbett) for Gleis 1
    ctx.fillStyle = '#18202A';
    ctx.fillRect(60, 65, 1160, 78);
    // Gravel texture speckles
    ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
    for (let x = 65; x < 1215; x += 14) {
      ctx.fillRect(x, 75 + (x % 7) * 4, 3, 3);
    }

    // 2. Wooden railway sleepers (Holzschwellen)
    for (let x = 68; x < 1215; x += 18) {
      ctx.fillStyle = '#2A1F18';
      ctx.fillRect(x, 68, 8, 70);
      ctx.strokeStyle = '#18120E';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, 68, 8, 70);
    }

    // 3. Steel rails (Stahlschienen) with metallic highlight
    const railY1 = 82;
    const railY2 = 124;
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(60, railY1);
    ctx.lineTo(1220, railY1);
    ctx.moveTo(60, railY2);
    ctx.lineTo(1220, railY2);
    ctx.stroke();

    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(60, railY1 - 0.5);
    ctx.lineTo(1220, railY1 - 0.5);
    ctx.moveTo(60, railY2 - 0.5);
    ctx.lineTo(1220, railY2 - 0.5);
    ctx.stroke();

    // 4. Platform Yellow Tactile Warning Edge (Sicherheitslinie)
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 3.5;
    ctx.setLineDash([14, 8]);
    ctx.beginPath();
    ctx.moveTo(60, 146);
    ctx.lineTo(1220, 146);
    ctx.stroke();
    ctx.setLineDash([]);

    // 5. Passenger Train Carriage (ÖBB CityShuttle / Railjet) on Gleis 1 (x: 320..940, y: 72..138)
    const tx = 320;
    const ty = 72;
    const tw = 620;
    const th = 66;

    // Train Carriage Base Body
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(tx, ty, tw, th);
    // Red Austrian Rail (ÖBB) Livery Bands
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(tx, ty, tw, 6); // Top red band
    ctx.fillRect(tx, ty + th - 8, tw, 8); // Bottom red band

    // Silver roof highlight
    ctx.fillStyle = '#64748B';
    ctx.fillRect(tx, ty + 6, tw, 5);

    // Carriage Passenger Windows (tinted glass)
    ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1;
    for (let wx = tx + 30; wx < tx + tw - 40; wx += 52) {
      if ((wx >= 450 && wx <= 525) || (wx >= 730 && wx <= 805)) continue;
      ctx.fillRect(wx, ty + 18, 38, 22);
      ctx.strokeRect(wx, ty + 18, 38, 22);
    }

    // Train Livery Badge
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillText('ÖBB 2. KLASSE · REX 3', tx + 14, ty + th * 0.5 + 3);

    // 6. Platform Warning Beacons when Station is in Lockdown / Level 4
    if (this.stationAlertScore >= 85) {
      const beaconAlpha = 0.4 + Math.sin(this.elapsedSeconds * 9.0) * 0.35;
      const beaconPositions = [
        { x: 250, y: 152 },
        { x: 600, y: 152 },
        { x: 980, y: 152 },
      ];
      for (const b of beaconPositions) {
        ctx.fillStyle = `rgba(239, 68, 68, ${beaconAlpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 45, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private renderAcousticNoiseRings(ctx: CanvasRenderingContext2D) {
    if (this.noiseEvents.length === 0) return;
    ctx.save();
    for (const ne of this.noiseEvents) {
      const progress = 1 - Math.max(0, ne.timer / ne.maxTimer);
      const currentRadius = 12 + progress * (ne.radius - 12);
      const alpha = (ne.timer / ne.maxTimer) * 0.75;

      ctx.strokeStyle = ne.color || '#38BDF8';
      ctx.lineWidth = ne.dB >= 80 ? 2.5 : 1.5;
      ctx.globalAlpha = alpha;
      ctx.setLineDash(ne.dB >= 80 ? [8, 4] : [4, 4]);

      ctx.beginPath();
      ctx.arc(ne.x, ne.y, currentRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Small decibel indicator badge
      if (progress < 0.6) {
        ctx.fillStyle = ne.color || '#38BDF8';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(`${ne.dB} dB`, ne.x + 8, ne.y - 6);
      }
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1.0;
    ctx.restore();
  }

  private renderProjectedShadows(
    ctx: CanvasRenderingContext2D,
    player: ActorEntity,
    squad: ActorEntity | undefined
  ) {
    const lightSources: { x: number; y: number; angle: number; maxDist: number; halfFov: number }[] =
      [];

    if (this.flashlightOn) {
      lightSources.push({
        x: player.x + Math.cos(player.angle) * 14,
        y: player.y + Math.sin(player.angle) * 14,
        angle: player.angle,
        maxDist: 520,
        halfFov: 0.52,
      });
    }
    if (squad && squad.state !== 'DEAD') {
      lightSources.push({
        x: squad.x + Math.cos(squad.angle) * 14,
        y: squad.y + Math.sin(squad.angle) * 14,
        angle: squad.angle,
        maxDist: 420,
        halfFov: 0.45,
      });
    }

    if (lightSources.length === 0) return;

    ctx.save();
    for (const src of lightSources) {
      // 1. Cast shadows from furniture boxes
      for (const f of this.furniture) {
        if (f.zLayer === 'FLOOR' || (!f.blocksMovement && !f.blocksSight)) continue;
        const cx = f.x + f.w * 0.5;
        const cy = f.y + f.h * 0.5;
        if (Math.hypot(cx - this.camX, cy - this.camY) > 750) continue;
        const dist = Math.hypot(cx - src.x, cy - src.y);
        if (dist > src.maxDist || dist < 12) continue;

        const angToFurn = Math.atan2(cy - src.y, cx - src.x);
        if (Math.abs(this.normalizeAngle(angToFurn - src.angle)) > src.halfFov + 0.38) continue;

        // Find extreme corners of the furniture rectangle relative to light source
        const corners = [
          { x: f.x, y: f.y },
          { x: f.x + f.w, y: f.y },
          { x: f.x + f.w, y: f.y + f.h },
          { x: f.x, y: f.y + f.h },
        ];

        let minAng = Infinity;
        let maxAng = -Infinity;
        let cMin = corners[0];
        let cMax = corners[0];

        for (const c of corners) {
          const a = this.normalizeAngle(Math.atan2(c.y - src.y, c.x - src.x) - angToFurn);
          if (a < minAng) {
            minAng = a;
            cMin = c;
          }
          if (a > maxAng) {
            maxAng = a;
            cMax = c;
          }
        }

        const shadowLen = f.blocksSight ? 260 : 95;
        const dirMinX = cMin.x - src.x;
        const dirMinY = cMin.y - src.y;
        const lenMin = Math.hypot(dirMinX, dirMinY) || 1;
        const dirMaxX = cMax.x - src.x;
        const dirMaxY = cMax.y - src.y;
        const lenMax = Math.hypot(dirMaxX, dirMaxY) || 1;

        ctx.fillStyle = f.blocksSight ? 'rgba(3, 6, 11, 0.72)' : 'rgba(3, 6, 11, 0.48)';
        ctx.beginPath();
        ctx.moveTo(cMin.x, cMin.y);
        ctx.lineTo(cMax.x, cMax.y);
        ctx.lineTo(
          cMax.x + (dirMaxX / lenMax) * shadowLen,
          cMax.y + (dirMaxY / lenMax) * shadowLen
        );
        ctx.lineTo(
          cMin.x + (dirMinX / lenMin) * shadowLen,
          cMin.y + (dirMinY / lenMin) * shadowLen
        );
        ctx.closePath();
        ctx.fill();
      }

      // 2. Cast elongated tactical shadows behind visible actors illuminated by the beam
      for (const actor of this.actors) {
        if (actor.state === 'DEAD') continue;
        const d = Math.hypot(actor.x - src.x, actor.y - src.y);
        if (d < 22 || d > src.maxDist * 0.85) continue;

        const ang = Math.atan2(actor.y - src.y, actor.x - src.x);
        if (Math.abs(this.normalizeAngle(ang - src.angle)) > src.halfFov) continue;
        if (this.raycastWallsAndDoors(src.x, src.y, actor.x, actor.y)) continue;

        const perpX = -Math.sin(ang) * (actor.radius * 0.85);
        const perpY = Math.cos(ang) * (actor.radius * 0.85);
        const shadowProj = 68;

        ctx.fillStyle = 'rgba(2, 5, 10, 0.55)';
        ctx.beginPath();
        ctx.moveTo(actor.x + perpX, actor.y + perpY);
        ctx.lineTo(actor.x - perpX, actor.y - perpY);
        ctx.lineTo(
          actor.x - perpX * 1.45 + Math.cos(ang) * shadowProj,
          actor.y - perpY * 1.45 + Math.sin(ang) * shadowProj
        );
        ctx.lineTo(
          actor.x + perpX * 1.45 + Math.cos(ang) * shadowProj,
          actor.y + perpY * 1.45 + Math.sin(ang) * shadowProj
        );
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private paint(
    ctx: CanvasRenderingContext2D,
    player: ActorEntity | undefined,
    squad: ActorEntity | undefined,
    shakeX: number,
    shakeY: number
  ) {
    const width = this.viewWidth;
    const height = this.viewHeight;
    const lCtx = this.lc;

    // 1. Base nocturnal darkness over the entire visible viewport
    // When Night Vision (NVG) is active, residual light amplification drastically reduces shadow opacity in dark rooms
    lCtx.globalCompositeOperation = 'copy';
    lCtx.fillStyle =
      this.gameState === 'TITLE'
        ? 'rgba(5, 9, 15, 0.62)'
        : this.nvgActive
          ? 'rgba(2, 16, 9, 0.44)'
          : 'rgba(4, 7, 13, 0.86)';
    // El rectángulo es mayor que el canvas: el recorte lo limita y evita un clearRect extra.
    lCtx.fillRect(0, 0, 1e4, 1e4);

    // 2. Carve out ambient emergency stairwell light & exterior balcony moonlight
    lCtx.globalCompositeOperation = 'destination-out';
    // La luz se calcula en coordenadas de mundo, pero solo se rasteriza el viewport
    // visible a media resolución; así no hay que limpiar ni componer 1280×820 por frame.
    lCtx.setTransform(0.4, 0, 0, 0.4, 0, 0);
    lCtx.translate(width * 0.5 + shakeX, height * 0.5 + shakeY);
    lCtx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
    lCtx.translate(-this.camX, -this.camY);

    const stairGrad = lCtx.createRadialGradient(170, 410, 20, 170, 410, 290);
    stairGrad.addColorStop(0, this.nvgActive ? 'rgba(255, 255, 255, 0.82)' : 'rgba(255, 255, 255, 0.55)');
    stairGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    lCtx.fillStyle = stairGrad;
    lCtx.fillRect(80, 90, 180, 640);

    const balconyGrad = lCtx.createRadialGradient(1055, 540, 20, 1055, 540, 250);
    balconyGrad.addColorStop(0, this.nvgActive ? 'rgba(255, 255, 255, 0.78)' : 'rgba(255, 255, 255, 0.45)');
    balconyGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    lCtx.fillStyle = balconyGrad;
    lCtx.fillRect(960, 350, 200, 380);

    // 2B. Carve ambient illumination from urban streetlamps along the perimeter streets
    for (const lamp of URBAN_STREET_LAMPS) {
      if (lamp.x < -80 || lamp.x > WORLD_WIDTH + 80 || lamp.y < -80 || lamp.y > WORLD_HEIGHT + 80) continue;
      const lampGrad = lCtx.createRadialGradient(lamp.x, lamp.y, 4, lamp.x, lamp.y, lamp.radius);
      lampGrad.addColorStop(0, this.nvgActive ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.65)');
      lampGrad.addColorStop(0.55, this.nvgActive ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.28)');
      lampGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      lCtx.fillStyle = lampGrad;
      lCtx.beginPath();
      lCtx.arc(lamp.x, lamp.y, lamp.radius, 0, Math.PI * 2);
      lCtx.fill();
    }

    // 2C. Carve & Render Wall Sconce Lamps (Wandlampen) along corridors and hallways
    for (const sconce of this.wallSconces) {
      if (sconce.isDestroyed || sconce.isOn === false) continue;
      const flicker =
        sconce.flickerSpeed && sconce.flickerSpeed > 0
          ? 0.88 + 0.12 * Math.sin(this.elapsedSeconds * sconce.flickerSpeed + sconce.x)
          : 1.0;

      // Origin slightly offset from the wall surface along normalAngle so raycast doesn't self-hit the mounting wall
      const ox = sconce.x + Math.cos(sconce.normalAngle) * 5;
      const oy = sconce.y + Math.sin(sconce.normalAngle) * 5;
      const sconcePoly = this.computeVisibilityPolygon(
        ox,
        oy,
        sconce.normalAngle,
        sconce.radius,
        1.28,
        28
      );
      this.carveLightPolygon(
        lCtx,
        ox,
        oy,
        sconcePoly,
        sconce.radius,
        (this.nvgActive ? 0.92 : 0.68) * flicker
      );

      // Warm or cool volumetric wall-wash glow on the floor and adjacent wall
      this.renderVolumetricBeamGlow(
        ctx,
        ox,
        oy,
        sconcePoly,
        sconce.radius * 0.92,
        sconce.color,
        'rgba(15, 23, 42, 0)'
      );
    }

    if (player) {
      const fovBoost = EKO_COBRA_INSPECTION_DEVICES[this.plan.inspectionDevice].fovBoost;
      const weatherVisMult = this.getWeatherVisibilityMultiplier(player.x, player.y);

      // A. Carve Player Close 360° Tactical Awareness Circle (amplified when NVG is active)
      const closeRange = Math.round(
        (this.nvgActive ? 175 : 115) * (0.92 + weatherVisMult * 0.08)
      );
      const closePoly = this.computeVisibilityPolygon(
        player.x,
        player.y,
        player.angle,
        closeRange,
        Math.PI,
        36
      );
      this.carveLightPolygon(
        lCtx,
        player.x,
        player.y,
        closePoly,
        closeRange,
        (this.nvgActive ? 0.92 : 0.72) * weatherVisMult
      );

      // B. Carve Player Peripheral Vision Cone & Passive IR Illuminator when NVG is active
      const periphRange = Math.round(
        (this.nvgActive ? 480 : this.flashlightOn ? 330 : 250) * weatherVisMult
      );
      const periphPoly = this.computeVisibilityPolygon(
        player.x,
        player.y,
        player.angle,
        periphRange,
        (this.nvgActive ? 1.42 : 1.22) + fovBoost,
        64
      );
      this.carveLightPolygon(
        lCtx,
        player.x,
        player.y,
        periphPoly,
        periphRange,
        (this.nvgActive ? 0.92 : this.flashlightOn ? 0.42 : 0.58) * weatherVisMult
      );

      if (this.nvgActive) {
        // Helmet-mounted IR Flood Illuminator cone (invisible to naked eye, boosts contrast under NVG)
        this.renderVolumetricBeamGlow(
          ctx,
          player.x,
          player.y,
          periphPoly,
          periphRange,
          'rgba(74, 222, 128, 0.24)',
          'rgba(16, 185, 129, 0.10)'
        );
      }

      // C. Carve Player Weapon-Mounted Tactical Flashlight Beam (1000 Lumens)
      if (this.flashlightOn) {
        const muzzleX = player.x + Math.cos(player.angle) * 14;
        const muzzleY = player.y + Math.sin(player.angle) * 14;
        const beamRange = Math.round(560 * weatherVisMult);
        const beamPoly = this.computeVisibilityPolygon(
          muzzleX,
          muzzleY,
          player.angle,
          beamRange,
          0.38,
          72
        );
        this.carveLightPolygon(lCtx, muzzleX, muzzleY, beamPoly, beamRange, 0.98 * weatherVisMult);

        // Render additive volumetric flashlight beam glow onto main canvas (enhanced Tyndall haze when dust is dense)
        const dustScatterBoost = 1 + (1 - weatherVisMult) * 0.95;
        this.renderVolumetricBeamGlow(
          ctx,
          muzzleX,
          muzzleY,
          beamPoly,
          beamRange,
          `rgba(254, 252, 232, ${(0.32 * dustScatterBoost).toFixed(3)})`,
          `rgba(56, 189, 248, ${(0.14 * dustScatterBoost).toFixed(3)})`
        );

        // Crisp central high-intensity beam rays (truncated at wall/obstacle hit)
        let beamEndX = muzzleX + Math.cos(player.angle) * beamRange;
        let beamEndY = muzzleY + Math.sin(player.angle) * beamRange;
        const beamHit = this.raycastPoint(muzzleX, muzzleY, beamEndX, beamEndY);
        if (beamHit) {
          beamEndX = beamHit.x;
          beamEndY = beamHit.y;
        }

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(muzzleX, muzzleY);
        ctx.lineTo(beamEndX, beamEndY);
        ctx.stroke();
        ctx.restore();
      }
    }

    // D. Carve Squadmate (Kobra-2) Weapon-Mounted Flashlight Beam
    if (squad && squad.state !== 'DEAD') {
      const squadVisMult = this.getWeatherVisibilityMultiplier(squad.x, squad.y);
      const sMuzzleX = squad.x + Math.cos(squad.angle) * 14;
      const sMuzzleY = squad.y + Math.sin(squad.angle) * 14;
      const squadBeamRange = Math.round(430 * squadVisMult);
      const squadBeamPoly = this.computeVisibilityPolygon(
        sMuzzleX,
        sMuzzleY,
        squad.angle,
        squadBeamRange,
        0.33,
        48
      );
      this.carveLightPolygon(lCtx, sMuzzleX, sMuzzleY, squadBeamPoly, squadBeamRange, 0.85 * squadVisMult);

      this.renderVolumetricBeamGlow(
        ctx,
        sMuzzleX,
        sMuzzleY,
        squadBeamPoly,
        squadBeamRange,
        'rgba(226, 232, 240, 0.14)',
        'rgba(56, 189, 248, 0.05)'
      );
    }

    // E. Carve Dynamic Point Lights (Muzzle Flashes & Detonations)
    for (const pl of this.pointLights) {
      const ratio = Math.max(0, pl.life / pl.maxLife);
      const flashPoly = this.computeVisibilityPolygon(pl.x, pl.y, 0, pl.radius, Math.PI, 48);
      this.carveLightPolygon(lCtx, pl.x, pl.y, flashPoly, pl.radius, 0.95 * ratio);

      // Additive warm flash on main canvas
      this.renderVolumetricBeamGlow(
        ctx,
        pl.x,
        pl.y,
        flashPoly,
        pl.radius,
        pl.color,
        'rgba(251, 191, 36, 0)'
      );
    }

    // 3. Stamp the screen-aligned light layer without going through the camera transform
    ctx.save();
    ctx.setTransform(this.renderScale, 0, 0, this.renderScale, 0, 0);
    ctx.drawImage(this.l, 0, 0, width, height);
    ctx.restore();
  }

  private renderVolumetricBeamGlow(
    ctx: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    poly: Vec2[],
    radius: number,
    innerColor: string,
    midColor: string
  ) {
    if (poly.length === 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    for (const pt of poly) {
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();

    const grad = ctx.createRadialGradient(ox, oy, 4, ox, oy, radius);
    grad.addColorStop(0, innerColor);
    grad.addColorStop(0.5, midColor);
    grad.addColorStop(1, 'rgba(8, 12, 17, 0)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  private renderInspectionSensorCone(ctx: CanvasRenderingContext2D, player: ActorEntity) {
    const profileMult = EKO_COBRA_PROFILES[this.plan.profile].sensorRangeMultiplier;
    const inspSpec = EKO_COBRA_INSPECTION_DEVICES[this.plan.inspectionDevice];
    const effectiveRange = inspSpec.rangePx * profileMult;

    if (this.thermalActive && this.plan.inspectionDevice === 'THERMAL_CAM') {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      ctx.arc(player.x, player.y, effectiveRange, player.angle - 0.72, player.angle + 0.72);
      ctx.closePath();

      const grad = ctx.createRadialGradient(
        player.x,
        player.y,
        8,
        player.x,
        player.y,
        effectiveRange
      );

      if (this.thermalPaletteMode === 'WHITE_HOT') {
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.38)');
        grad.addColorStop(0.6, 'rgba(148, 163, 184, 0.20)');
        grad.addColorStop(1, 'rgba(15, 23, 42, 0.02)');
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      } else if (this.thermalPaletteMode === 'BLACK_HOT') {
        grad.addColorStop(0, 'rgba(15, 23, 42, 0.58)');
        grad.addColorStop(0.6, 'rgba(51, 65, 85, 0.32)');
        grad.addColorStop(1, 'rgba(248, 250, 252, 0.02)');
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.85)';
      } else {
        grad.addColorStop(0, 'rgba(249, 115, 22, 0.42)');
        grad.addColorStop(0.6, 'rgba(236, 72, 153, 0.22)');
        grad.addColorStop(1, 'rgba(147, 51, 234, 0.02)');
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.75)';
      }

      ctx.fillStyle = grad;
      ctx.fill();

      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.restore();
      return;
    }

    const door = this.doors.find((d) => d.id === this.mirrorDoorId);
    if (!door) return;

    const mx = (door.x1 + door.x2) * 0.5;
    const my = (door.y1 + door.y2) * 0.5;
    const isVerticalDoor = Math.abs(door.x1 - door.x2) < 5;
    const dirAngle = isVerticalDoor
      ? player.x < mx
        ? 0
        : Math.PI
      : player.y < my
        ? Math.PI / 2
        : -Math.PI / 2;

    const originX = mx + Math.cos(dirAngle) * 8;
    const originY = my + Math.sin(dirAngle) * 8;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.arc(originX, originY, effectiveRange, dirAngle - 0.78, dirAngle + 0.78);
    ctx.closePath();

    const grad = ctx.createRadialGradient(
      originX,
      originY,
      5,
      originX,
      originY,
      effectiveRange
    );
    grad.addColorStop(0, 'rgba(16, 185, 129, 0.36)');
    grad.addColorStop(1, 'rgba(16, 185, 129, 0.02)');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(16, 185, 129, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  private renderWallsAndDoors(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 8;
    ctx.lineCap = 'square';
    for (const w of this.walls) {
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();
    }

    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 4;
    for (const w of this.walls) {
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();
    }

    for (const d of this.doors) {
      const len = Math.hypot(d.x2 - d.x1, d.y2 - d.y1);
      const leafX = d.hingeX + Math.cos(d.currentAngle) * len;
      const leafY = d.hingeY + Math.sin(d.currentAngle) * len;

      if (d.isDestroyed) {
        ctx.save();
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(d.x1, d.y1);
        ctx.lineTo(d.x1 + (d.x2 - d.x1) * 0.35, d.y1 + (d.y2 - d.y1) * 0.35);
        ctx.stroke();

        ctx.fillStyle = 'rgba(217, 119, 6, 0.55)';
        ctx.fillRect((d.x1 + d.x2) * 0.5 - 6, (d.y1 + d.y2) * 0.5 - 6, 12, 12);
        ctx.restore();
        continue;
      }

      ctx.strokeStyle = 'rgba(217, 119, 6, 0.22)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(
        d.hingeX,
        d.hingeY,
        len,
        Math.min(d.closedAngle, d.openAngle),
        Math.max(d.closedAngle, d.openAngle)
      );
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = d.isBreached ? '#F59E0B' : d.isLocked ? '#D97706' : '#CBD5E1';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(d.hingeX, d.hingeY);
      ctx.lineTo(leafX, leafY);
      ctx.stroke();

      // Render a readable recessed lever handle / agarradera de palanca.
      // The plate and lever rotate with the leaf so the hardware keeps its
      // orientation while the door opens, closes or is breached.
      const handleX = d.hingeX + Math.cos(d.currentAngle) * len * 0.82;
      const handleY = d.hingeY + Math.sin(d.currentAngle) * len * 0.82;
      ctx.save();
      ctx.translate(handleX, handleY);
      ctx.rotate(d.currentAngle);

      // Drop shadow under the lever.
      ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
      ctx.fillRect(-3, 2.5, 15, 3.5);

      // Steel backplate with a brass rim.
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-6.5, -6, 13, 12);
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 1;
      ctx.strokeRect(-6.5, -6, 13, 12);
      ctx.fillStyle = '#B45309';
      ctx.fillRect(-5.5, -5, 11, 10);

      // Lever bar pointing toward the hinge, with a bright top highlight.
      ctx.fillStyle = '#92400E';
      ctx.fillRect(-5, -2.6, 15, 5.2);
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(-4.8, -1.8, 14, 2.1);
      ctx.fillStyle = '#FDE68A';
      ctx.fillRect(-4.5, -1.2, 12.5, 0.8);

      // Pivot boss and lock-state pin.
      ctx.fillStyle = '#FDE68A';
      ctx.beginPath();
      ctx.arc(-4.5, 0, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.fillStyle = d.isLocked ? '#EF4444' : '#34D399';
      ctx.beginPath();
      ctx.arc(6, 0, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Architectural Exterior Windows (with rain streaks, condensation, or shattered wall breach gap)
    this.renderExteriorWindows(ctx);

    // Progreso diegético de la colocación de C4 sobre el objetivo.
    if (this.c4.planting) {
      const ratio = Math.min(1, this.c4.planting.progress / this.c4.planting.maxProgress);
      ctx.save();
      ctx.translate(this.c4.planting.x, this.c4.planting.y);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(0, 0, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
      ctx.stroke();
      ctx.fillStyle = '#FCA5A5';
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`C4 ${Math.round(ratio * 100)}%`, 0, -19);
      ctx.restore();
    }

    // Render Active Placed C4 Charges on doors/windows with flashing LED & countdown badge
    for (const charge of this.c4.charges) {
      ctx.save();
      ctx.translate(charge.x, charge.y);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-14, -8, 28, 16);
      ctx.fillStyle = '#EAB308';
      ctx.fillRect(-12, -6, 24, 12);
      // Flashing LED
      const ledOn = Math.floor(Date.now() / 200) % 2 === 0;
      ctx.fillStyle = ledOn ? '#EF4444' : '#7F1D1D';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      // Armed state: no automatic countdown, the operator must clear the area.
      const areaClear = this.isBlastAreaClear(charge);
      ctx.fillStyle = areaClear ? '#34D399' : '#FCA5A5';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(areaClear ? 'DETONAR' : 'C4 ARMADA', 0, -12);
      ctx.restore();
    }

    // Render persistent bullet craters, radial stress cracks & wood splinters on Walls and Doors
    this.renderSurfaceImpactMarks(ctx, 'WALL');
    this.renderSurfaceImpactMarks(ctx, 'DOOR');

    // Render Wall-Mounted Sconce Lamp Fixtures (Wandlampen) along corridors
    this.renderWallSconceFixtures(ctx);
    this.renderLightSwitches(ctx);
  }

  private renderExteriorWindows(ctx: CanvasRenderingContext2D) {
    for (const win of this.exteriorWindows) {
      const mx = (win.x1 + win.x2) * 0.5;
      const my = (win.y1 + win.y2) * 0.5;
      const len = Math.hypot(win.x2 - win.x1, win.y2 - win.y1);
      const wallAngle = Math.atan2(win.y2 - win.y1, win.x2 - win.x1);
      const nx = Math.cos(win.normalAngle);
      const ny = Math.sin(win.normalAngle);

      ctx.save();
      if (!win.isBreached) {
        // 1. Subtle cool nocturnal rainwater refraction wash on the interior floor just inside the window
        const washGrad = ctx.createRadialGradient(
          mx + nx * 8,
          my + ny * 8,
          4,
          mx + nx * 32,
          my + ny * 32,
          56
        );
        washGrad.addColorStop(0, 'rgba(56, 189, 248, 0.14)');
        washGrad.addColorStop(0.55, 'rgba(148, 163, 184, 0.06)');
        washGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = washGrad;
        ctx.beginPath();
        ctx.arc(mx + nx * 24, my + ny * 24, 54, 0, Math.PI * 2);
        ctx.fill();

        // 2. Window sill frame & double-glazed glass pane embedded in the exterior wall
        ctx.translate(mx, my);
        ctx.rotate(wallAngle);

        // Dark aluminum window casing
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-len * 0.5, -5.5, len, 11);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(-len * 0.5, -5.5, len, 11);

        // Frosted / rain-slicked double glass pane
        ctx.fillStyle = 'rgba(56, 189, 248, 0.24)';
        ctx.fillRect(-len * 0.5 + 3, -2.5, len - 6, 5);
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.75)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-len * 0.5 + 3, 0);
        ctx.lineTo(len * 0.5 - 3, 0);
        ctx.stroke();

        // Center window mullion bar
        ctx.fillStyle = '#334155';
        ctx.fillRect(-2, -5.5, 4, 11);

        // 3. Animated rain rivulets & condensation droplets trickling across the window glass
        const dropletCount = Math.max(4, Math.floor(len / 16));
        for (let i = 0; i < dropletCount; i++) {
          const seed = i * 19.37 + win.x1 * 0.13;
          const slide = ((this.elapsedSeconds * (1.2 + (i % 3) * 0.45) + seed) % 1);
          const gx = -len * 0.44 + (i / (dropletCount - 1)) * (len * 0.88) + Math.sin(seed + slide * 5) * 2.5;
          const gy = -3.8 + slide * 7.6;

          ctx.fillStyle = `rgba(224, 242, 254, ${(0.85 - slide * 0.45).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(gx, gy, 1.35, 0, Math.PI * 2);
          ctx.fill();

          // Tiny vertical condensation streak behind droplet
          ctx.strokeStyle = `rgba(125, 211, 252, ${(0.42 - slide * 0.25).toFixed(2)})`;
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.moveTo(gx, gy - 3.2);
          ctx.lineTo(gx, gy);
          ctx.stroke();
        }

        // If damaged once by gunfire, draw spiderweb glass fractures
        if (win.damageHits > 0) {
          ctx.strokeStyle = 'rgba(224, 242, 254, 0.9)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-12, -3);
          ctx.lineTo(8, 3);
          ctx.moveTo(-6, 3);
          ctx.lineTo(10, -3);
          ctx.stroke();
        }
      } else {
        // Breached exterior wall / shattered window opening: jagged masonry edges + rain/wind inflow draft
        ctx.translate(mx, my);
        ctx.rotate(wallAngle);

        // Jagged broken wall gap threshold
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(-len * 0.5 + 2, -5, len - 4, 10);

        // Broken glass & concrete teeth along both sides of the breach
        ctx.fillStyle = '#64748B';
        ctx.fillRect(-len * 0.5, -5.5, 8, 11);
        ctx.fillRect(len * 0.5 - 8, -5.5, 8, 11);

        ctx.fillStyle = '#BAE6FD';
        for (let i = -len * 0.42; i <= len * 0.42; i += 14) {
          ctx.beginPath();
          ctx.moveTo(i, -4);
          ctx.lineTo(i + 4, 0);
          ctx.lineTo(i - 2, 3.5);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  private renderWallSconceFixtures(ctx: CanvasRenderingContext2D) {
    for (const sconce of this.wallSconces) {
      if (Math.hypot(sconce.x - this.camX, sconce.y - this.camY) > 750) continue;

      const flicker =
        sconce.flickerSpeed && sconce.flickerSpeed > 0
          ? 0.85 + 0.15 * Math.sin(this.elapsedSeconds * sconce.flickerSpeed + sconce.x)
          : 1.0;

      ctx.save();
      ctx.translate(sconce.x, sconce.y);
      ctx.rotate(sconce.normalAngle);

      const isPowered = !sconce.isDestroyed && sconce.isOn !== false;
      if (!isPowered) {
        // A broken or switched-off fixture stays visible as dark hardware without
        // the bloom that made it look like it was still illuminating the room.
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(-3.5, -7, 4, 14);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.strokeRect(-3.5, -7, 4, 14);
        ctx.fillStyle = sconce.isDestroyed ? '#7F1D1D' : '#334155';
        ctx.beginPath();
        ctx.arc(1.2, 0, 4.2, -Math.PI * 0.5, Math.PI * 0.5);
        ctx.fill();
        if (sconce.isDestroyed) {
          ctx.strokeStyle = '#FCA5A5';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(0.5, -3);
          ctx.lineTo(2.5, 0);
          ctx.lineTo(1, 3.5);
          ctx.stroke();
        }
        ctx.restore();
        continue;
      }

      // 1. Soft radial bloom halo immediately around the wall lamp glass diffuser
      const haloGrad = ctx.createRadialGradient(2, 0, 1, 2, 0, 24);
      haloGrad.addColorStop(0, sconce.coreColor);
      haloGrad.addColorStop(0.35, sconce.color);
      haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.globalAlpha = 0.85 * flicker;
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(2, 0, 24, 0, Math.PI * 2);
      ctx.fill();

      // 2. Metallic Wall Mounting Bracket Base (flush against the wall at x = -3..0)
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-3.5, -7, 3.5, 14);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.strokeRect(-3.5, -7, 3.5, 14);

      // 3. Lamp Diffuser Housing & Glowing Filament Core
      if (sconce.style === 'EMERGENCY_LED') {
        // Rectangular Austrian stairwell emergency luminaire
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(0, -6.5, 4, 13);
        ctx.fillStyle = sconce.coreColor;
        ctx.fillRect(0.8, -5, 2.4, 10);
      } else if (sconce.style === 'EXTERIOR_LANTERN') {
        // Caged balcony bulkhead wall lamp
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.arc(1.5, 0, 5.2, -Math.PI * 0.5, Math.PI * 0.5);
        ctx.fill();
        ctx.fillStyle = sconce.coreColor;
        ctx.beginPath();
        ctx.arc(1.5, 0, 3.4, -Math.PI * 0.5, Math.PI * 0.5);
        ctx.fill();
      } else {
        // Classic warm half-cylinder corridor wall sconce (Wandlampe) with brass trim
        ctx.fillStyle = '#78350F';
        ctx.fillRect(-0.5, -6, 2.2, 12);
        ctx.fillStyle = sconce.coreColor;
        ctx.beginPath();
        ctx.arc(1.2, 0, 4.6, -Math.PI * 0.5, Math.PI * 0.5);
        ctx.fill();
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private renderLightSwitches(ctx: CanvasRenderingContext2D) {
    const player = this.getPlayer();
    // La misma función que usa E decide qué interruptor puede mostrar su cartel.
    const activeSwitch = player ? this.getInteractableLightSwitch(player.x, player.y) : null;
    for (const lightSwitch of this.lightSwitches) {
      if (Math.hypot(lightSwitch.x - this.camX, lightSwitch.y - this.camY) > 750) continue;
      const sconces = (lightSwitch.sconceIds?.length ? lightSwitch.sconceIds : [lightSwitch.sconceId])
        .map((id) => this.wallSconces.find((item) => item.id === id))
        .filter((sconce): sconce is WallSconceLight => sconce !== undefined);
      const sconce = sconces[0];
      if (!sconce) continue;

      const isOn = sconces.some((item) => !item.isDestroyed && item.isOn !== false);
      const allDestroyed = sconces.every((item) => item.isDestroyed);
      ctx.save();
      ctx.translate(lightSwitch.x, lightSwitch.y);
      ctx.rotate(lightSwitch.normalAngle ?? sconce.normalAngle);

      // Wall plate with a small rocker and status LED.
      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      ctx.fillRect(-2.5, -5, 8, 11);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-4, -6.5, 8, 13);
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(-4, -6.5, 8, 13);
      ctx.fillStyle = '#334155';
      ctx.fillRect(-2.8, -4.8, 5.6, 9.6);
      ctx.fillStyle = isOn ? '#F59E0B' : '#64748B';
      if (isOn) ctx.fillRect(-2.4, -4.2, 4.8, 3.2);
      else ctx.fillRect(-2.4, 1, 4.8, 3.2);
      ctx.fillStyle = allDestroyed ? '#EF4444' : isOn ? '#34D399' : '#94A3B8';
      ctx.beginPath();
      ctx.arc(2.6, 5.2, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (activeSwitch && activeSwitch.id === lightSwitch.id) {
        const label = allDestroyed
          ? '[E] LUZ ROTA'
          : isOn
            ? '[E] APAGAR LUZ'
            : '[E] ENCENDER LUZ';
        ctx.save();
        ctx.font = '700 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        const width = ctx.measureText(label).width + 8;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(lightSwitch.x - width * 0.5, lightSwitch.y - 25, width, 13);
        ctx.strokeStyle = isOn ? '#F59E0B' : '#64748B';
        ctx.lineWidth = 1;
        ctx.strokeRect(lightSwitch.x - width * 0.5, lightSwitch.y - 25, width, 13);
        ctx.fillStyle = isOn ? '#FDE68A' : '#CBD5E1';
        ctx.fillText(label, lightSwitch.x, lightSwitch.y - 16);
        ctx.restore();
      }
    }
  }

  private renderSurfaceImpactMarks(
    ctx: CanvasRenderingContext2D,
    filterKind: 'WALL' | 'DOOR' | 'FURNITURE'
  ) {
    for (const imp of this.surfaceImpacts) {
      if (imp.surfaceKind !== filterKind) continue;
      // Viewport spatial culling: Skip rendering offscreen bullet impacts
      if (Math.hypot(imp.x - this.camX, imp.y - this.camY) > 750) continue;

      ctx.save();
      ctx.translate(imp.x, imp.y);

      // 1. Radial stress fracture cracks / wood splinters around the bullet crater
      ctx.strokeStyle =
        imp.surfaceKind === 'DOOR'
          ? 'rgba(251, 191, 36, 0.85)'
          : imp.surfaceKind === 'FURNITURE'
            ? 'rgba(15, 23, 42, 0.85)'
            : 'rgba(226, 232, 240, 0.78)';
      ctx.lineWidth = 1.1;
      for (const crack of imp.cracks) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(crack.angle) * crack.len, Math.sin(crack.angle) * crack.len);
        ctx.stroke();
      }

      // 2. Outer pulverized spall / scorch ring
      ctx.fillStyle =
        imp.surfaceKind === 'DOOR'
          ? 'rgba(146, 64, 14, 0.88)'
          : imp.surfaceKind === 'FURNITURE'
            ? 'rgba(30, 41, 59, 0.85)'
            : 'rgba(71, 85, 105, 0.9)';
      ctx.beginPath();
      ctx.arc(0, 0, imp.craterRadius * 1.45, 0, Math.PI * 2);
      ctx.fill();

      // 3. Directional ballistic lead-smear / scorch streak
      const backAng = imp.bulletAngle + Math.PI;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(backAng) * 6.5, Math.sin(backAng) * 6.5);
      ctx.stroke();

      // 4. Deep dark bullet entry hole core
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.arc(0, 0, imp.craterRadius * 0.8, 0, Math.PI * 2);
      ctx.fill();

      // 5. Hot glowing kinetic friction ember that cools down after impact
      if (imp.emberTimer > 0) {
        const emberRatio = imp.emberTimer / 1.8;
        ctx.fillStyle = `rgba(251, 146, 60, ${emberRatio * 0.95})`;
        ctx.beginPath();
        ctx.arc(0, 0, imp.craterRadius * 0.7 * emberRatio + 0.8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private renderEvidence(ctx: CanvasRenderingContext2D) {
    const player = this.getPlayer();
    for (const ev of this.evidenceList) {
      if (ev.secured) continue;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(ev.x, ev.y);
      ctx.fillStyle = '#06090E';
      ctx.fillRect(-9, -6, 18, 12);
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(-7, -4, 14, 4);
      ctx.fillStyle = '#475569';
      ctx.fillRect(-7, 0, 5, 5);
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(5, -4, 2, 2);

      if (player && Math.hypot(player.x - ev.x, player.y - ev.y) < 110) {
        ctx.fillStyle = '#FDE68A';
        ctx.font = '600 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('[E] EVIDENCIA', 0, -10);
      }
      ctx.restore();
    }

    // Render Tactical Pad GPS Waypoint Marker if placed by the operator
    if (this.tacticalWaypoint) {
      const wp = this.tacticalWaypoint;
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsedSeconds * 5.2);
      ctx.save();
      ctx.translate(wp.x, wp.y);
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.45 + pulse * 0.45})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, 12 + pulse * 6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(56, 189, 248, 0.9)';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '700 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#BAE6FD';
      ctx.fillText(`⌖ ${wp.label}`, 0, -18);
      ctx.restore();
    }

    if (this.isRightDragging) {
      ctx.save();
      const startX = this.rightClickDragStart.x;
      const startY = this.rightClickDragStart.y;
      const currX = this.rightClickDragCurrent.x;
      const currY = this.rightClickDragCurrent.y;
      const dragDist = Math.hypot(currX - startX, currY - startY);
      const angle = Math.atan2(currY - startY, currX - startX);

      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(startX, startY, 18, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.beginPath();
      ctx.arc(startX, startY, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.arc(startX, startY, Math.max(45, dragDist), angle - 0.45, angle + 0.45);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(currX, currY);
      ctx.stroke();

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(startX - 95, startY - 42, 190, 22);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1;
      ctx.strokeRect(startX - 95, startY - 42, 190, 22);

      ctx.fillStyle = '#38BDF8';
      ctx.font = '600 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('OCUPAR POSICIÓN & PROTEGER ÁREA', startX, startY - 27);

      ctx.restore();
    }
  }

  private renderActors(ctx: CanvasRenderingContext2D, player: ActorEntity | undefined) {
    const squad = this.getSquadmate();
    for (const actor of this.actors) {
      const isOperator = actor.role === 'PLAYER' || actor.role === 'SQUAD';
      const showFull =
        isOperator ||
        this.gameState === 'TITLE' ||
        actor.visibleToPlayer ||
        actor.visibleToSquad ||
        actor.state === 'ARRESTED' ||
        actor.state === 'DEAD';

      if (actor.role === 'SUSPECT' && actor.lastSeenX !== undefined && actor.lastSeenY !== undefined && !showFull && !actor.spottedByMirror && !actor.identifiedByRadio) {
        const age = this.elapsedSeconds - (actor.lastSeenAt ?? 0);
        if (age >= 0 && age < 4) {
          ctx.save();
          ctx.translate(actor.lastSeenX, actor.lastSeenY);
          const alpha = (1 - age / 4) * 0.55;
          ctx.strokeStyle = `rgba(239, 68, 68, ${alpha.toFixed(3)})`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(0, 0, actor.radius + 9, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }

      if (actor.role === 'SUSPECT' && (showFull || actor.spottedByMirror || actor.identifiedByRadio)) {
        actor.lastSeenX = actor.x;
        actor.lastSeenY = actor.y;
        actor.lastSeenAt = this.elapsedSeconds;
      }

      if (!showFull && !actor.spottedByMirror && !actor.identifiedByRadio) continue;

      // Draw subtle helmet-camera telemetry link line ONLY while actively scanning an unidentified target
      if (
        !isOperator &&
        this.gameState === 'PLAYING' &&
        !actor.identifiedByRadio &&
        (actor.biometricScanProgress ?? 0) > 0 &&
        (actor.visibleToPlayer || actor.visibleToSquad) &&
        actor.state !== 'DEAD' &&
        actor.state !== 'ARRESTED'
      ) {
        const camAgent = actor.visibleToPlayer ? player : squad;
        if (camAgent) {
          ctx.save();
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.22)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 5]);
          ctx.beginPath();
          ctx.moveTo(camAgent.x, camAgent.y);
          ctx.lineTo(actor.x, actor.y);
          ctx.stroke();
          ctx.restore();
        }
      }

      ctx.save();
      ctx.translate(actor.x, actor.y);

      if (!showFull && (actor.spottedByMirror || actor.identifiedByRadio)) {
        drawPixelArtSonarActor(ctx, actor, this.elapsedSeconds, !!actor.spottedByThermal);
        this.renderBiometricOverlayOnActor(ctx, actor);
        ctx.restore();
        continue;
      }

      if (actor.role === 'SUSPECT' && actor.state === 'AIMING_WINDUP' && player) {
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.35 + actor.windupProgress * 0.6})`;
        ctx.lineWidth = 1.5 + actor.windupProgress * 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(actor.angle) * 260, Math.sin(actor.angle) * 260);
        ctx.stroke();

        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(
          0,
          0,
          actor.radius + 9,
          -Math.PI / 2,
          -Math.PI / 2 + actor.windupProgress * Math.PI * 2
        );
        ctx.stroke();
      }

      // For suspects, hostages, and targets, rotate coordinate system by actor.angle
      // For EKO Cobra operators, drawPixelArtActor handles the 8-directional sprite sheet with micro-aiming
      if (actor.role !== 'PLAYER' && actor.role !== 'SQUAD') {
        ctx.rotate(actor.angle);
      }

      drawPixelArtActor(
        ctx,
        actor,
        this.plan.primaryWeapon,
        this.activeTool,
        this.elapsedSeconds + this.titlePanTime
      );

      // Threat readability: clear contour keyed to alert level (no gameplay change).
      if (actor.role === 'SUSPECT' && actor.state !== 'DEAD' && actor.state !== 'ARRESTED') {
        const contourColor =
          actor.alertLevel === 'COMBAT'
            ? '#EF4444'
            : actor.alertLevel === 'READY'
              ? '#F59E0B'
              : '#38BDF8';
        ctx.strokeStyle = contourColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, actor.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();

      ctx.save();
      ctx.translate(actor.x, actor.y);
      ctx.font = '600 9.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';

      const distToPlayer = player ? Math.hypot(player.x - actor.x, player.y - actor.y) : 999;

      if (actor.role === 'SUSPECT' && actor.state !== 'DEAD') {
        if (actor.state === 'SURRENDERED' || actor.state === 'FEIGNING_SURRENDER') {
          ctx.fillStyle = '#FBBF24';
          ctx.fillText(distToPlayer < 130 ? '[E] ARRESTAR' : 'RENDIDO', 0, -actor.radius - 12);
        } else if (actor.state !== 'ARRESTED') {
          const barW = 28;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fillRect(-barW * 0.5, -actor.radius - 13, barW, 3.5);
          ctx.fillStyle = actor.morale > 40 ? '#EF4444' : '#F59E0B';
          ctx.fillRect(-barW * 0.5, -actor.radius - 13, (barW * actor.morale) / 100, 3.5);
        }
      } else if ((actor.role === 'HOSTAGE' || actor.role === 'CIVILIAN') && actor.state !== 'DEAD') {
        if (actor.state !== 'ARRESTED') {
          ctx.fillStyle = '#38BDF8';
          ctx.fillText(distToPlayer < 130 ? '[E] ASEGURAR' : 'REHÉN', 0, -actor.radius - 12);
        }
      } else if (actor.role === 'SQUAD' && actor.state !== 'DEAD') {
        const cmd = this.squadCommand || 'FOLLOW';
        const isMovingToTarget = !!actor.investigateTarget;
        const hpRatio = actor.hp / actor.maxHp;
        const isBleeding = actor.bodyHealth?.bleeding ?? false;
        const isWounded = hpRatio < 0.3 || isBleeding;
        const isReloading = this.squadReloadTimer > 0;
        const isExhausted = this.squadFatigue > 82;

        let badgeText = 'AVANZANDO EN FORMACIÓN';
        let badgeIcon = '➔';
        let bgStyle = 'rgba(15, 23, 42, 0.88)';
        let borderStyle = '#38BDF8';
        let textStyle = '#BAE6FD';

        if (isWounded) {
          // Priority 1: Critical Wounded / Bleeding Status Overlay (Blinking Red)
          badgeText = isBleeding
            ? 'HEMORRAGIA CRÍTICA'
            : 'HERIDO / SALUD CRÍTICA';
          badgeIcon = '🩸';
          bgStyle = 'rgba(220, 38, 38, 0.95)';
          borderStyle = '#EF4444';
          textStyle = '#FFFFFF';
        } else if (isReloading) {
          // Priority 2: Reloading Magazine Overlay (Amber)
          badgeText = 'RECARGANDO CARGADOR';
          badgeIcon = '🔄';
          bgStyle = 'rgba(217, 119, 6, 0.95)';
          borderStyle = '#F59E0B';
          textStyle = '#FEF3C7';
        } else if (isExhausted) {
          // Priority 3: Fatigue Warning Overlay (Amber/Orange)
          badgeText = 'FATIGA CRÍTICA';
          badgeIcon = '⚡';
          bgStyle = 'rgba(180, 83, 9, 0.92)';
          borderStyle = '#F59E0B';
          textStyle = '#FDE68A';
        } else {
          // Priority 4: Active Tactical Command Badge
          if (cmd === 'BREACH_AND_CLEAR') {
            badgeText = isMovingToTarget ? 'AVANZANDO A BRECHA' : 'BRECHANDO Y DESPEJANDO';
            badgeIcon = '💥';
            bgStyle = 'rgba(180, 83, 9, 0.9)';
            borderStyle = '#F59E0B';
            textStyle = '#FEF3C7';
          } else if (cmd === 'PIE_DOOR') {
            badgeText = isMovingToTarget ? 'POSICIONANDO SONDA' : 'CORTE DE ÁNGULO';
            badgeIcon = '👁';
            bgStyle = 'rgba(126, 34, 206, 0.9)';
            borderStyle = '#A855F7';
            textStyle = '#F3E8FF';
          } else if (cmd === 'DEPLOY_CS_GAS') {
            badgeText = isMovingToTarget ? 'AVANZANDO A POSICIÓN' : 'LANZANDO GAS CS';
            badgeIcon = '💨';
            bgStyle = 'rgba(6, 148, 162, 0.9)';
            borderStyle = '#10B981';
            textStyle = '#D1FAE5';
          } else if (cmd === 'SUPPRESS_TARGET') {
            badgeText = 'FUEGO DE SUPRESIÓN';
            badgeIcon = '🔥';
            bgStyle = 'rgba(185, 28, 28, 0.9)';
            borderStyle = '#EF4444';
            textStyle = '#FEE2E2';
          } else if (cmd === 'RESTRAIN_AND_SECURE') {
            badgeText = isMovingToTarget ? 'BUSCANDO OBJETIVO' : 'ESPOSANDO Y ASEGURANDO';
            badgeIcon = '⛓';
            bgStyle = 'rgba(16, 185, 129, 0.9)';
            borderStyle = '#34D399';
            textStyle = '#ECFDF5';
          } else if (cmd === 'HOLD') {
            badgeText = 'CUBRIENDO Y MANTENIENDO';
            badgeIcon = '🛡';
            bgStyle = 'rgba(14, 116, 144, 0.9)';
            borderStyle = '#38BDF8';
            textStyle = '#E0F2FE';
          } else if (cmd === 'REGROUP_HEAL') {
            badgeText = 'REAGRUPANDO Y VENDANDO';
            badgeIcon = '🩹';
            bgStyle = 'rgba(16, 185, 129, 0.9)';
            borderStyle = '#10B981';
            textStyle = '#FFFFFF';
          } else if (cmd === 'CLEAR_BLAST_AREA') {
            badgeText = isMovingToTarget ? 'DESPEJANDO ZONA C4' : 'ZONA C4 DESPEJADA';
            badgeIcon = '⚠';
            bgStyle = 'rgba(180, 83, 9, 0.92)';
            borderStyle = '#F59E0B';
            textStyle = '#FEF3C7';
          }
        }

        // Render overhead badge above Kobra-2's helmet
        ctx.font = '700 8.5px "JetBrains Mono", monospace';
        const fullLabel = `${badgeIcon} ${badgeText}`;
        const metrics = ctx.measureText(fullLabel);
        const padX = 6;
        const boxW = metrics.width + padX * 2;
        const boxH = 15;
        const boxY = -actor.radius - 22;

        ctx.save();
        // Dynamic command pulse animation & glowing halo on order accept
        if (this.commandPulseTimer > 0) {
          const pNorm = this.commandPulseTimer / 1.2; // 1.0 -> 0.0
          const pulseGlowAlpha = pNorm * 0.92;
          const pulseScale = 1 + Math.sin((1 - pNorm) * Math.PI * 3) * 0.14;

          ctx.save();
          ctx.scale(pulseScale, pulseScale);
          ctx.fillStyle = `rgba(16, 185, 129, ${pulseGlowAlpha * 0.45})`;
          ctx.fillRect(-boxW * 0.5 - 4, boxY - 3, boxW + 8, boxH + 6);
          ctx.strokeStyle = `rgba(52, 211, 153, ${pulseGlowAlpha})`;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(-boxW * 0.5 - 3, boxY - 2, boxW + 6, boxH + 4);
          ctx.restore();
        }

        // Translucent glass backing + crisp border (blinking if wounded)
        if (isWounded && Math.sin(this.elapsedSeconds * 8) > 0) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.98)';
        } else {
          ctx.fillStyle = bgStyle;
        }
        ctx.fillRect(-boxW * 0.5, boxY, boxW, boxH);
        ctx.strokeStyle = this.commandPulseTimer > 0 ? '#34D399' : borderStyle;
        ctx.lineWidth = this.commandPulseTimer > 0 ? 2 : 1.25;
        ctx.strokeRect(-boxW * 0.5, boxY, boxW, boxH);

        // Center text label
        ctx.fillStyle = textStyle;
        ctx.textAlign = 'center';
        ctx.fillText(fullLabel, 0, boxY + 10.5);

        // Sub-label below Kobra-2's feet
        ctx.fillStyle = borderStyle;
        ctx.font = '700 8px "JetBrains Mono", monospace';
        ctx.fillText(`K2 · ${cmd} (${Math.round(actor.hp)}HP)`, 0, actor.radius + 12);
        ctx.restore();
      }

      if (actor.speechBubble) {
        const text = actor.speechBubble.text;
        ctx.font = '600 10.5px "Plus Jakarta Sans", sans-serif';
        const boxY = -actor.radius - 28;

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
        ctx.shadowBlur = 4;
        ctx.fillStyle =
          actor.speechBubble.type === 'COMMAND'
            ? '#FBBF24'
            : actor.speechBubble.type === 'HOSTILE'
              ? '#EF4444'
              : '#F8FAFC';
        ctx.textAlign = 'center';
        ctx.fillText(text, 0, boxY);
        ctx.restore();
      }

      // Render Biometric Facial Recognition Reticle & Radio ID Tag
      if (!isOperator && this.gameState === 'PLAYING') {
        this.renderBiometricOverlayOnActor(ctx, actor);
      }

      ctx.restore();
    }
  }

  private renderTacticalMarkersOnCanvas(
    ctx: CanvasRenderingContext2D,
    player?: ActorEntity,
    squad?: ActorEntity
  ) {
    if (this.tacticalMarkers.length === 0 && !this.tacticalWaypoint) return;

    const pulse = 0.5 + 0.5 * Math.sin(this.elapsedSeconds * 5.2);

    ctx.save();
    for (const m of this.tacticalMarkers) {
      const colorMap: Record<TacticalMarkerType, { hex: string; rgb: string; icon: string }> = {
        HOSTILE: { hex: '#EF4444', rgb: '239, 68, 68', icon: '!' },
        BREACH_ZONE: { hex: '#F59E0B', rgb: '245, 158, 11', icon: '💥' },
        RALLY_POINT: { hex: '#38BDF8', rgb: '56, 189, 248', icon: '◈' },
        OBSERVE_SECTOR: { hex: '#A855F7', rgb: '168, 85, 247', icon: '👁' },
        EVIDENCE_LOC: { hex: '#10B981', rgb: '16, 185, 129', icon: '📦' },
        DANGER_AREA: { hex: '#F43F5E', rgb: '244, 63, 94', icon: '⚠' },
        CLEAR_SECTOR: { hex: '#10B981', rgb: '16, 185, 129', icon: '✓' },
      };
      const style = colorMap[m.type];

      // Subtle dashed tether line from squad/player to active tactical marker
      if (squad && squad.state !== 'DEAD' && (m.type === 'RALLY_POINT' || m.type === 'BREACH_ZONE')) {
        ctx.save();
        ctx.strokeStyle = `rgba(${style.rgb}, 0.35)`;
        ctx.lineWidth = 1.25;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(squad.x, squad.y);
        ctx.lineTo(m.x, m.y);
        ctx.stroke();
        ctx.restore();
      } else if (player && m.type === 'HOSTILE') {
        ctx.save();
        ctx.strokeStyle = `rgba(${style.rgb}, 0.28)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 6]);
        ctx.beginPath();
        ctx.moveTo(player.x, player.y);
        ctx.lineTo(m.x, m.y);
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(m.x, m.y);

      // Pulsing outer radar ring
      const ringRadius = 15 + pulse * 8;
      ctx.strokeStyle = `rgba(${style.rgb}, ${0.65 - pulse * 0.35})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner tactical diamond / crosshair
      ctx.fillStyle = `rgba(${style.rgb}, 0.22)`;
      ctx.strokeStyle = style.hex;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(10, 0);
      ctx.lineTo(0, 10);
      ctx.lineTo(-10, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Center icon
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(style.icon, 0, 0.5);

      // Translucent label + countdown tag below marker
      const tagText = `${m.label} · ${Math.ceil(m.remainingSeconds)}s`;
      ctx.font = '700 8.5px "JetBrains Mono", monospace';
      const tw = ctx.measureText(tagText).width;
      ctx.fillStyle = 'rgba(8, 12, 17, 0.45)';
      ctx.fillRect(-tw * 0.5 - 4, 13, tw + 8, 12);
      ctx.strokeStyle = `rgba(${style.rgb}, 0.55)`;
      ctx.lineWidth = 1;
      ctx.strokeRect(-tw * 0.5 - 4, 13, tw + 8, 12);
      ctx.fillStyle = style.hex;
      ctx.fillText(tagText, 0, 19);

      ctx.restore();
    }
    ctx.restore();
  }

  private renderBiometricOverlayOnActor(ctx: CanvasRenderingContext2D, actor: ActorEntity) {
    if (actor.state === 'DEAD' || actor.state === 'ARRESTED') return;
    const scanPct = Math.round(actor.biometricScanProgress ?? 0);
    if (scanPct <= 0 && !actor.identifiedByRadio) return;

    const isHostile = actor.role === 'SUSPECT';
    const isIdentified = !!actor.identifiedByRadio;
    const boxR = actor.radius + 7;
    const cornerLen = 6;

    // Tactical theme colors
    const primaryColor = isIdentified
      ? isHostile
        ? '#EF4444' // Hostile red
        : '#10B981' // Hostage / Civil green
      : scanPct >= 100
        ? '#F59E0B' // 100% scan ready for radio ID
        : '#38BDF8'; // Scanning cyan

    ctx.save();

    // 1. In-World Holographic Facial/Torso Reticle Framing Brackets [  ] around actor
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = isIdentified ? 1.6 : 1.3;
    ctx.beginPath();
    // Top-Left
    ctx.moveTo(-boxR, -boxR + cornerLen);
    ctx.lineTo(-boxR, -boxR);
    ctx.lineTo(-boxR + cornerLen, -boxR);
    // Top-Right
    ctx.moveTo(boxR - cornerLen, -boxR);
    ctx.lineTo(boxR, -boxR);
    ctx.lineTo(boxR, -boxR + cornerLen);
    // Bottom-Left
    ctx.moveTo(-boxR, boxR - cornerLen);
    ctx.lineTo(-boxR, boxR);
    ctx.lineTo(-boxR + cornerLen, boxR);
    // Bottom-Right
    ctx.moveTo(boxR - cornerLen, boxR);
    ctx.lineTo(boxR, boxR);
    ctx.lineTo(boxR, boxR - cornerLen);
    ctx.stroke();

    // Animated scanning laser sweep line across brackets while scanning
    if (!isIdentified && scanPct < 100) {
      const scanOffset = ((this.elapsedSeconds * 44) % (boxR * 2)) - boxR;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.70)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-boxR + 2, scanOffset);
      ctx.lineTo(boxR - 2, scanOffset);
      ctx.stroke();
    }

    // 2. Floating In-World Holographic Biometric Card (Hovering directly over the suspect on the map)
    const cardW = 158;
    const cardH = 46;
    const cardX = -cardW * 0.5;
    const cardY = -actor.radius - 22 - cardH;

    // Tactical leader line connecting the reticle bracket to the floating card
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -boxR);
    ctx.lineTo(0, cardY + cardH);
    ctx.stroke();

    // Leader anchor dot
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.arc(0, -boxR, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Frosted dark background slab
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.fillStyle = 'rgba(6, 11, 19, 0.94)';
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = isIdentified ? 1.5 : 1.2;
    ctx.beginPath();
    ctx.rect(cardX, cardY, cardW, cardH);
    ctx.fill();
    ctx.stroke();

    // Left colored accent indicator bar
    ctx.fillStyle = primaryColor;
    ctx.fillRect(cardX, cardY, 3.5, cardH);

    // Micro corner tech accents
    ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.fillRect(cardX + cardW - 3, cardY, 3, 3);
    ctx.fillRect(cardX + cardW - 3, cardY + cardH - 3, 3, 3);
    ctx.shadowBlur = 0;

    // --- ROW 1: NAME & MATCH STATUS ---
    const displayName = (actor.name || (isHostile ? 'SOSPECHOSO' : 'CIVIL')).toUpperCase();
    const matchPct = actor.biometricProfile?.facialMatchPct ?? (isIdentified ? 99 : Math.min(99, Math.round(72 + scanPct * 0.27)));

    ctx.textAlign = 'left';
    ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`🎥 ${displayName}`, cardX + 7, cardY + 11);

    ctx.textAlign = 'right';
    if (isIdentified) {
      ctx.font = 'bold 7.5px "JetBrains Mono", monospace';
      ctx.fillStyle = isHostile ? '#EF4444' : '#10B981';
      ctx.fillText('✓ ID OK', cardX + cardW - 6, cardY + 11);
    } else {
      ctx.font = 'bold 7.5px "JetBrains Mono", monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText(`${matchPct}% MATCH`, cardX + cardW - 6, cardY + 11);
    }

    // --- ROW 2: THREAT LEVEL & WEAPON STATUS ---
    let threatText = '';
    let threatColor = '#EF4444';

    if (isHostile) {
      if (actor.state === 'SURRENDERED' || actor.state === 'FEIGNING_SURRENDER') {
        threatText = 'AMENAZA: MEDIA (RENDIDO)';
        threatColor = '#F59E0B';
      } else {
        const weaponDesc = actor.weaponLabel ? `[${actor.weaponLabel}]` : 'ARMADO';
        threatText = `AMENAZA: ALTA ⚠ ${weaponDesc}`;
        threatColor = '#EF4444';
      }
    } else {
      threatText = 'AMENAZA: NINGUNA ✓ REHÉN VIP';
      threatColor = '#34D399';
    }

    ctx.textAlign = 'left';
    ctx.font = 'bold 7.5px "JetBrains Mono", monospace';
    ctx.fillStyle = threatColor;
    ctx.fillText(threatText, cardX + 7, cardY + 23);

    // --- ROW 3: BIOMETRIC SCAN PROGRESS / CONFIRMATION PROMPT ---
    if (!isIdentified) {
      if (scanPct < 100) {
        // Scanning in progress with animated progress bar
        ctx.font = 'bold 7.5px "JetBrains Mono", monospace';
        ctx.fillStyle = '#FBBF24';
        ctx.fillText(`ESCANEO: ${scanPct}%`, cardX + 7, cardY + 36);

        // Progress bar container
        const barX = cardX + 68;
        const barY = cardY + 30;
        const barW = cardW - 74;
        const barH = 7;

        ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
        ctx.fillRect(barX, barY, barW, barH);

        const fillW = Math.round((barW * scanPct) / 100);
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(barX, barY, fillW, barH);

        // Segment division ticks
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        for (let t = 1; t <= 3; t++) {
          ctx.fillRect(barX + Math.round((barW / 4) * t), barY, 1, barH);
        }
      } else {
        // Scan 100% complete - high visibility prompt to confirm ID via radio
        const pulse = Math.sin(this.elapsedSeconds * 10) > 0;
        ctx.fillStyle = pulse ? 'rgba(217, 119, 6, 0.95)' : 'rgba(245, 158, 11, 0.85)';
        ctx.fillRect(cardX + 6, cardY + 28, cardW - 12, 13);

        ctx.textAlign = 'center';
        ctx.font = '900 8px "JetBrains Mono", monospace';
        ctx.fillStyle = '#060B12';
        ctx.fillText('[B] CONFIRMAR ID RADIO (+ROE)', cardX + cardW * 0.5, cardY + 38);
      }
    } else {
      // Already identified via TETRA radio
      ctx.textAlign = 'left';
      ctx.font = 'bold 7.5px "JetBrains Mono", monospace';
      ctx.fillStyle = isHostile ? '#FECACA' : '#BAE6FD';
      const warrant = actor.biometricProfile?.warrantStatus || 'CONFIRMADO RED TETRA EKIS';
      ctx.fillText(`✓ ${warrant.slice(0, 26).toUpperCase()}`, cardX + 7, cardY + 36);
    }

    ctx.restore();
  }

  private renderPlayerLaserSight(ctx: CanvasRenderingContext2D, player: ActorEntity) {
    const maxLen = this.activeTool === 'TASER' ? 260 : 540;
    let endX = player.x + Math.cos(player.angle) * maxLen;
    let endY = player.y + Math.sin(player.angle) * maxLen;
    const hit = this.raycastPoint(player.x, player.y, endX, endY);
    if (hit) {
      endX = hit.x;
      endY = hit.y;
    }

    const attachment = EKO_COBRA_ATTACHMENTS[this.plan.attachment ?? 'NONE'];
    const hasGreenLaser = this.activeTool === 'PRIMARY' && attachment.hasVisibleLaser;
    const hasIrLaser = this.activeTool === 'PRIMARY' && attachment.hasIrLaser && this.nvgActive;

    ctx.save();

    if (hasGreenLaser || hasIrLaser) {
      // High-intensity tactical laser beam
      const laserColor = hasGreenLaser ? '#22C55E' : '#00FF88';
      const glowColor = hasGreenLaser ? 'rgba(34, 197, 94, 0.35)' : 'rgba(56, 189, 248, 0.45)';

      // Outer laser beam glow
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(player.x + Math.cos(player.angle) * 15, player.y + Math.sin(player.angle) * 15);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Core laser beam
      ctx.strokeStyle = laserColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(player.x + Math.cos(player.angle) * 15, player.y + Math.sin(player.angle) * 15);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Intense laser dot impact point
      ctx.fillStyle = laserColor;
      ctx.beginPath();
      ctx.arc(endX, endY, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle =
        this.activeTool === 'TASER' ? 'rgba(56, 189, 248, 0.55)' : 'rgba(16, 185, 129, 0.45)';
      ctx.lineWidth = 1.25;
      ctx.setLineDash(this.activeTool === 'TASER' ? [4, 4] : []);
      ctx.beginPath();
      ctx.moveTo(player.x + Math.cos(player.angle) * 15, player.y + Math.sin(player.angle) * 15);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      ctx.fillStyle = this.activeTool === 'TASER' ? '#38BDF8' : '#10B981';
      ctx.beginPath();
      ctx.arc(endX, endY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dynamic Weapon Dispersion & Pulse Stability Reticle around laser endpoint
    const fatigueRatio = this.playerFatigue / 100;
    const bh = player.bodyHealth;
    const armInstability = bh ? (100 - bh.arms) / 100 : 0;
    const isExtremities = this.aimZoneMode === 'EXTREMITIES';
    const focusedAim = this.isFocusedAiming();

    // Spread based on precision, status, and Focused Aim stance
    const rawSpreadRadius =
      (isExtremities ? 3.0 : 4.5) +
      fatigueRatio * (isExtremities ? 10 : 18) +
      armInstability * (isExtremities ? 8 : 12) +
      Math.sin(this.elapsedSeconds * (6 + fatigueRatio * 8)) * (1.2 + fatigueRatio * 2.8);
    const spreadRadius = focusedAim ? Math.max(2.2, rawSpreadRadius * 0.56) : rawSpreadRadius;

    ctx.strokeStyle = focusedAim
      ? 'rgba(52, 211, 153, 0.92)'
      : fatigueRatio > 0.65
        ? 'rgba(239, 68, 68, 0.65)'
        : fatigueRatio > 0.3
          ? 'rgba(245, 158, 11, 0.55)'
          : isExtremities
            ? 'rgba(56, 189, 248, 0.6)' // Blue for precise
            : 'rgba(16, 185, 129, 0.4)'; // Green for torso

    ctx.lineWidth = focusedAim ? 1.4 : 1.1;
    ctx.setLineDash(focusedAim ? [] : [3, 3]);
    ctx.beginPath();

    if (isExtremities) {
      // Diamond for extremities (more precise)
      ctx.moveTo(endX, endY - spreadRadius);
      ctx.lineTo(endX + spreadRadius, endY);
      ctx.lineTo(endX, endY + spreadRadius);
      ctx.lineTo(endX - spreadRadius, endY);
      ctx.closePath();
    } else {
      // Circle for torso
      ctx.arc(endX, endY, spreadRadius, 0, Math.PI * 2);
    }
    ctx.stroke();

    // Precision Cross-Ticks when EKO Cobra Focused Aiming is held
    if (focusedAim) {
      const tickInner = spreadRadius + 2;
      const tickOuter = spreadRadius + 6;
      ctx.beginPath();
      ctx.moveTo(endX - tickOuter, endY);
      ctx.lineTo(endX - tickInner, endY);
      ctx.moveTo(endX + tickInner, endY);
      ctx.lineTo(endX + tickOuter, endY);
      ctx.moveTo(endX, endY - tickOuter);
      ctx.lineTo(endX, endY - tickInner);
      ctx.moveTo(endX, endY + tickInner);
      ctx.lineTo(endX, endY + tickOuter);
      ctx.stroke();

      ctx.font = '700 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#6EE7B7';
      ctx.fillText('FOKUS +PREC', endX, endY - tickOuter - 4);
    }

    // Circular Visual Reload Progress Ring near aim reticle when reloading [Key R]
    if (this.reloadTimer > 0) {
      const progressRatio = Math.max(
        0,
        Math.min(1, 1 - this.reloadTimer / Math.max(0.1, this.reloadMaxDuration))
      );
      const reloadPct = Math.round(progressRatio * 100);
      const ringRadius = 24;

      ctx.save();
      ctx.translate(endX, endY);

      // 1. Translucent Glass Background Ring
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(8, 12, 17, 0.82)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.85)';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // 2. Glowing Clockwise Active Progress Arc
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, -Math.PI / 2, -Math.PI / 2 + progressRatio * Math.PI * 2);
      ctx.strokeStyle = progressRatio > 0.85 ? '#10B981' : '#F59E0B';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.stroke();

      // 3. Center Dot Indicator
      ctx.fillStyle = progressRatio > 0.85 ? '#10B981' : '#F59E0B';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();

      // 4. Percentage & German Tactical Reload Text
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FDE68A';
      ctx.fillText(`${reloadPct}%`, 0, -ringRadius - 8);

      ctx.font = '700 8px "JetBrains Mono", monospace';
      ctx.fillStyle = '#CBD5E1';
      ctx.fillText('WECHSELN', 0, ringRadius + 14);

      ctx.restore();
    }

    ctx.restore();
  }

  private renderSnowFootprints(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const f of this.snowFootprints) {
      ctx.globalAlpha = f.alpha;
      ctx.fillStyle = '#E2E8F0';
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.angle);
      ctx.fillRect(-3, -2, 6, 4);
      ctx.restore();
    }
    ctx.globalAlpha = 1.0;
    ctx.restore();
  }

  private renderAnamorphicLensFlares(ctx: CanvasRenderingContext2D, player: ActorEntity, squad?: ActorEntity) {
    if (!this.flashlightOn && (!squad || squad.state === 'DEAD')) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    
    const drawFlare = (ax: number, ay: number) => {
      const screenPos = this.worldToScreen(ax, ay);
      
      // Horizontal blue anamorphic streak across screen
      const streakGrad = ctx.createLinearGradient(0, screenPos.y, this.viewWidth, screenPos.y);
      streakGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
      streakGrad.addColorStop(0.5, 'rgba(186, 230, 253, 0.28)');
      streakGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      
      ctx.fillStyle = streakGrad;
      ctx.fillRect(0, screenPos.y - 1, this.viewWidth, 2);
      
      // Central hexagonal "ghost" artifact
      const pulse = 0.8 + 0.2 * Math.sin(this.elapsedSeconds * 4);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, 45 * pulse, 0, Math.PI * 2);
      ctx.fill();
    };

    if (this.flashlightOn) drawFlare(player.x, player.y);
    if (squad && squad.state !== 'DEAD') drawFlare(squad.x, squad.y);

    ctx.restore();
  }

  private renderSchwechatRunwayBeacons(ctx: CanvasRenderingContext2D) {
    const beaconAlpha = 0.4 + Math.sin(this.elapsedSeconds * 6.5) * 0.35;
    const beacons = [
      { x: 100, y: 100 }, { x: 500, y: 100 }, { x: 900, y: 100 },
      { x: 100, y: 700 }, { x: 500, y: 700 }, { x: 900, y: 700 }
    ];
    for (const b of beacons) {
      ctx.save();
      ctx.fillStyle = `rgba(52, 211, 153, ${beaconAlpha})`; // Green runway lights
      ctx.beginPath();
      ctx.arc(b.x, b.y, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderEffects(ctx: CanvasRenderingContext2D) {
    for (const t of this.traces) {
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = Math.max(0, t.alpha);
      ctx.lineWidth = t.isTaser ? 2.5 : 2;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (const w of this.shoutWaves) {
      ctx.strokeStyle = `rgba(217, 119, 6, ${w.alpha * 0.65})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const g of this.gadgets) {
      if (!g.detonated) {
        let gx = g.x;
        let gy = g.y;
        if (g.hasBounced && g.midX !== undefined && g.midY !== undefined) {
          if (g.progress <= 0.5) {
            const subT = g.progress / 0.5;
            gx = g.x + (g.midX - g.x) * subT;
            gy = g.y + (g.midY - g.y) * subT;
          } else {
            const subT = (g.progress - 0.5) / 0.5;
            gx = g.midX + (g.tx - g.midX) * subT;
            gy = g.midY + (g.ty - g.midY) * subT;
          }
        } else {
          gx = g.x + (g.tx - g.x) * g.progress;
          gy = g.y + (g.ty - g.y) * g.progress;
        }
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(gx, gy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    for (const ring of this.impactRings) {
      ctx.save();
      ctx.strokeStyle = ring.color;
      ctx.globalAlpha = Math.max(0, ring.alpha);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const p of this.particles) {
      const lifeRatio = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.rotation !== undefined) {
        ctx.rotate(p.rotation);
      }
      ctx.fillStyle = p.color;
      ctx.globalAlpha = lifeRatio;

      if (p.shape === 'CIRCLE' || p.shape === 'MIST') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'SHARD') {
        ctx.beginPath();
        ctx.moveTo(-p.size * 0.7, -p.size * 0.35);
        ctx.lineTo(p.size * 0.8, 0);
        ctx.lineTo(-p.size * 0.3, p.size * 0.55);
        ctx.closePath();
        ctx.fill();
      } else if (p.shape === 'SPARK') {
        ctx.fillRect(-p.size * 1.1, -p.size * 0.3, p.size * 2.2, p.size * 0.6);
      } else if (p.shape === 'CASING') {
        ctx.fillStyle = '#FBBF24';
        ctx.fillRect(-p.size * 0.7, -p.size * 0.3, p.size * 1.4, p.size * 0.6);
      } else if (p.shape === 'MUZZLE_FLASH') {
        ctx.globalCompositeOperation = 'lighter';
        const scale = 0.65 + 0.55 * lifeRatio;
        const r = p.size * scale;

        // 1. Warm yellow-orange radial bloom around the barrel tip
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.35);
        grad.addColorStop(0, `rgba(254, 249, 195, ${lifeRatio})`);
        grad.addColorStop(0.35, `rgba(251, 191, 36, ${lifeRatio * 0.92})`);
        grad.addColorStop(0.7, `rgba(249, 115, 22, ${lifeRatio * 0.68})`);
        grad.addColorStop(1, 'rgba(234, 88, 12, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2);
        ctx.fill();

        // 2. Directional 3-prong compensator flame (orange-amber outer spike)
        ctx.fillStyle = `rgba(249, 115, 22, ${lifeRatio * 0.9})`;
        ctx.beginPath();
        ctx.moveTo(-2, -2.5);
        ctx.lineTo(r * 0.55, -r * 0.52);
        ctx.lineTo(r * 0.35, -1.6);
        ctx.lineTo(r * 1.25, 0);
        ctx.lineTo(r * 0.35, 1.6);
        ctx.lineTo(r * 0.55, r * 0.52);
        ctx.lineTo(-2, 2.5);
        ctx.closePath();
        ctx.fill();

        // 3. Incandescent bright yellow-white inner core
        ctx.fillStyle = `rgba(254, 240, 138, ${lifeRatio})`;
        ctx.beginPath();
        ctx.ellipse(r * 0.22, 0, r * 0.46, r * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size * 0.5, -p.size * 0.5, p.size, p.size);
      }
      ctx.restore();
    }

    for (const pop of this.impactPopups) {
      const alpha = Math.max(0, pop.life / pop.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#06090E';
      ctx.fillText(pop.text, pop.x + 1, pop.y + 1);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    }

    // Render Blast Refraction Shockwaves
    for (const ring of this.refractionRings) {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${ring.alpha * 0.4})`;
      ctx.lineWidth = 6 * ring.alpha;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Distortion visual (subtle white/cyan double ring)
      ctx.strokeStyle = `rgba(186, 230, 253, ${ring.alpha * 0.2})`;
      ctx.lineWidth = 15 * ring.alpha;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.globalAlpha = 1;
  }

  private renderRain(ctx: CanvasRenderingContext2D) {
    const surgeRatio = Math.min(1, this.exteriorBreachSurgeTimer / this.exteriorBreachMaxDuration);
    ctx.save();
    ctx.strokeStyle =
      surgeRatio > 0.1
        ? `rgba(186, 230, 253, ${(0.18 + surgeRatio * 0.1).toFixed(2)})`
        : 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = 1.1;

    for (const r of this.rainDrops) {
      // Check if raindrop is inside the apartment roofed area (exclude outdoor Loggia x >= 960, y >= 360)
      const inSchlafzimmerEast = r.x >= 960 && r.x <= 1040 && r.y >= 100 && r.y <= 360;
      const inMainCore = r.x >= 250 && r.x <= 960 && r.y >= 100 && r.y <= 720;
      const insideRoofedBuilding = inMainCore || inSchlafzimmerEast;

      if (insideRoofedBuilding) {
        // Allow wind-driven rain to penetrate up to 75px inside breached exterior walls/doors!
        let nearBreach = false;
        for (const src of this.breachWindSources) {
          if (Math.hypot(r.x - src.x, r.y - src.y) < 78) {
            nearBreach = true;
            break;
          }
        }
        if (!nearBreach) continue;
      }

      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x - (3.2 + surgeRatio * 2.2), r.y + r.len);
      ctx.stroke();
    }

    // Render Window Rain Streaks, Sill Splashes, and Inflow Breach Gusts
    for (const wp of this.windowRainParticles) {
      const lifeRatio = Math.max(0, wp.life / wp.maxLife);
      const alpha = wp.alpha * lifeRatio;
      if (wp.kind === 'SILL_SPLASH') {
        ctx.fillStyle = `rgba(186, 230, 253, ${alpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, wp.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const spd = Math.hypot(wp.vx, wp.vy) || 1;
        const dx = (wp.vx / spd) * wp.len;
        const dy = (wp.vy / spd) * wp.len;
        ctx.strokeStyle =
          wp.kind === 'INFLOW_GUST'
            ? `rgba(186, 230, 253, ${(alpha * 1.1).toFixed(2)})`
            : `rgba(125, 211, 252, ${alpha.toFixed(2)})`;
        ctx.lineWidth = wp.kind === 'INFLOW_GUST' ? 1.3 : 1.0;
        ctx.beginPath();
        ctx.moveTo(wp.x, wp.y);
        ctx.lineTo(wp.x - dx, wp.y - dy);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private renderAmbientDustAndHaze(
    ctx: CanvasRenderingContext2D,
    player: ActorEntity | undefined,
    squad: ActorEntity | undefined
  ) {
    const surgeRatio = Math.min(1, this.exteriorBreachSurgeTimer / this.exteriorBreachMaxDuration);
    ctx.save();

    // 1. Render directional mist/dust inflow plumes at breached exterior walls & doors
    for (const src of this.breachWindSources) {
      const plumeLen = 115 + surgeRatio * 95;
      const gx = src.x + Math.cos(src.normalAngle) * (plumeLen * 0.55);
      const gy = src.y + Math.sin(src.normalAngle) * (plumeLen * 0.55);
      const plumeGrad = ctx.createRadialGradient(src.x, src.y, 6, gx, gy, plumeLen);
      const baseAlpha = (0.14 + surgeRatio * 0.18) * src.intensity;
      plumeGrad.addColorStop(0, `rgba(186, 230, 253, ${baseAlpha.toFixed(3)})`);
      plumeGrad.addColorStop(0.5, `rgba(148, 163, 184, ${(baseAlpha * 0.65).toFixed(3)})`);
      plumeGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = plumeGrad;
      ctx.beginPath();
      ctx.arc(gx, gy, plumeLen, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Render suspended indoor ambient dust motes with dynamic Tyndall flashlight & sconce scattering
    for (const m of this.ambientDustMotes) {
      const lifeFade =
        m.isSurgeMote && m.life !== undefined && m.maxLife
          ? Math.min(1, m.life / (m.maxLife * 0.35))
          : 1.0;
      const shimmer = 0.75 + 0.25 * Math.sin(this.elapsedSeconds * 3.1 + m.phase);

      // Calculate Tyndall illumination from Kobra-1 & Kobra-2 flashlights and corridor wall sconces
      let lightBoost = 0;
      let tintRgb = '203, 213, 225'; // Default cool slate dust mote

      if (player && this.flashlightOn) {
        const d = Math.hypot(m.x - player.x, m.y - player.y);
        if (d < 520) {
          const ang = Math.atan2(m.y - player.y, m.x - player.x);
          const diff = Math.abs(this.normalizeAngle(ang - player.angle));
          if (diff < 0.42 && !this.raycastWallsAndDoors(player.x, player.y, m.x, m.y)) {
            lightBoost = Math.max(lightBoost, (1 - d / 520) * (1 - diff / 0.42) * 2.4);
            tintRgb = '241, 245, 249';
          }
        }
      }

      if (squad && squad.state !== 'DEAD') {
        const d = Math.hypot(m.x - squad.x, m.y - squad.y);
        if (d < 400) {
          const ang = Math.atan2(m.y - squad.y, m.x - squad.x);
          const diff = Math.abs(this.normalizeAngle(ang - squad.angle));
          if (diff < 0.36 && !this.raycastWallsAndDoors(squad.x, squad.y, m.x, m.y)) {
            lightBoost = Math.max(lightBoost, (1 - d / 400) * 1.7);
          }
        }
      }

      for (const sc of this.wallSconces) {
        if (sc.isDestroyed || sc.isOn === false) continue;
        const d = Math.hypot(m.x - sc.x, m.y - sc.y);
        if (d < sc.radius * 0.85) {
          lightBoost = Math.max(lightBoost, (1 - d / (sc.radius * 0.85)) * 1.35);
          if (sc.style === 'WARM_SCONCE') {
            tintRgb = '254, 243, 199'; // Warm amber-gold dust mote in corridor sconce light
          }
        }
      }

      const finalAlpha = Math.min(
        0.92,
        (m.baseAlpha + surgeRatio * 0.14) * (1 + lightBoost) * shimmer * lifeFade
      );
      if (finalAlpha < 0.04) continue;

      // Soft Tyndall scattering halo when illuminated by flashlight or wall lamp
      if (lightBoost > 0.35) {
        ctx.fillStyle = `rgba(${tintRgb}, ${(finalAlpha * 0.28).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size * 2.3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = `rgba(${tintRgb}, ${finalAlpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderCSGasEffect(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    player: ActorEntity
  ) {
    if (!player.csGasExposure || player.csGasExposure < 0.05) return;

    ctx.save();
    const exposure = player.csGasExposure;

    // 1. Viscous green atmospheric haze from CS gas aerosol
    const hazeAlpha = Math.min(0.48, exposure * 0.75);
    const hazeGrad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      Math.min(width, height) * 0.15,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.75
    );
    hazeGrad.addColorStop(0, `rgba(16, 185, 129, ${(hazeAlpha * 0.18).toFixed(3)})`);
    hazeGrad.addColorStop(0.6, `rgba(5, 46, 22, ${(hazeAlpha * 0.45).toFixed(3)})`);
    hazeGrad.addColorStop(1, `rgba(6, 78, 59, ${hazeAlpha.toFixed(3)})`);
    ctx.fillStyle = hazeGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Lacrimation (tearing) & Blurred Vision artifacts
    // Simulated by high-frequency jitter and "floater" particles when exposure is high
    if (exposure > 0.35) {
      const jitterIntensity = (exposure - 0.35) * 8;
      const offsetX = (Math.random() - 0.5) * jitterIntensity;
      const offsetY = (Math.random() - 0.5) * jitterIntensity;
      
      ctx.globalAlpha = (exposure - 0.35) * 0.4;
      ctx.fillStyle = '#ECFDF5';
      for (let i = 0; i < 6; i++) {
        const rx = Math.random() * width;
        const ry = Math.random() * height;
        const rSize = 40 + Math.random() * 80 * exposure;
        ctx.beginPath();
        ctx.arc(rx + offsetX, ry + offsetY, rSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Peripheral Lacrimation Vignette (tightens as gas irritates eyes)
    const vignetteTightness = 0.45 - exposure * 0.25;
    const vignetteGrad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      Math.min(width, height) * vignetteTightness,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.9
    );
    vignetteGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignetteGrad.addColorStop(0.8, `rgba(6, 78, 59, ${(exposure * 0.6).toFixed(3)})`);
    vignetteGrad.addColorStop(1, `rgba(2, 44, 34, ${(exposure * 0.95).toFixed(3)})`);
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.restore();
  }

  private renderWeatherVisibilityOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    player: ActorEntity
  ) {
    const visMult = this.getWeatherVisibilityMultiplier(player.x, player.y);
    const visReductionPct = Math.round((1 - visMult) * 100);
    const surgeRatio = Math.min(1, this.exteriorBreachSurgeTimer / this.exteriorBreachMaxDuration);

    ctx.save();
    // Subtle atmospheric haze across the viewport proportional to dust/storm reduction
    if (visReductionPct > 6 || surgeRatio > 0.05) {
      const hazeAlpha = Math.min(0.22, (1 - visMult) * 0.65 + surgeRatio * 0.08);
      const hazeGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.2,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.7
      );
      hazeGrad.addColorStop(0, `rgba(148, 163, 184, ${(hazeAlpha * 0.25).toFixed(3)})`);
      hazeGrad.addColorStop(1, `rgba(30, 41, 59, ${hazeAlpha.toFixed(3)})`);
      ctx.fillStyle = hazeGrad;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
  }

  private renderNightVisionPostProcess(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) {
    ctx.save();

    // 1. Desaturate underlying scene to pure grayscale luminance
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = 'hsl(0, 0%, 50%)';
    ctx.fillRect(0, 0, width, height);

    // 2. Lift dark shadow floor so unlit rooms & corners become clearly readable
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(22, 163, 74, 0.24)';
    ctx.fillRect(0, 0, width, height);

    // 3. Steep S-curve contrast amplification in dark & midtone areas
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = 'rgba(34, 197, 94, 0.68)';
    ctx.fillRect(0, 0, width, height);

    // 4. Map grayscale luminance to monochromatic Gen-3 P43 Green Phosphor (#22C55E / #4ADE80)
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = '#4ADE80';
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = 'color';
    ctx.fillStyle = '#22C55E';
    ctx.fillRect(0, 0, width, height);

    // 5. Tube ignition warmup bloom when first flipping down the NVG goggles
    if (this.nvgWarmupTimer > 0) {
      const warmupRatio = Math.min(1, this.nvgWarmupTimer / 0.32);
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(134, 239, 172, ${(warmupRatio * 0.48).toFixed(3)})`;
      ctx.fillRect(0, 0, width, height);
    }

    // 6. High-frequency horizontal Electro-Optical Micro-Scanlines
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(2, 20, 10, 0.16)';
    for (let y = 0; y < height; y += 3) {
      ctx.fillRect(0, y, width, 1);
    }

    // 7. Dynamic Green Phosphor Scintillation / Photon Shot Noise Specks
    ctx.fillStyle = 'rgba(187, 247, 208, 0.28)';
    for (let i = 0; i < 95; i++) {
      const nx = Math.random() * width;
      const ny = Math.random() * height;
      ctx.fillRect(nx, ny, 1.5, 1.5);
    }

    // 8. Panoramic GPNVG-18 Optical Tube Vignette & Emerald Perimeter Ring
    const vigGrad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      Math.min(width, height) * 0.34,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.68
    );
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vigGrad.addColorStop(0.72, 'rgba(2, 28, 14, 0.25)');
    vigGrad.addColorStop(1, 'rgba(1, 10, 5, 0.78)');
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle green reticle cross & telemetry watermark inside the NVG tube optics
    ctx.globalAlpha = this.hudOpacity * 0.75;
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.22)';
    ctx.lineWidth = 1;
    const cx = width * 0.5;
    const cy = height * 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(width, height) * 0.42, -0.35, 0.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(width, height) * 0.42, Math.PI - 0.35, Math.PI + 0.35);
    ctx.stroke();

    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(134, 239, 172, 0.72)';
    ctx.textAlign = 'center';
    ctx.fillText('GPNVG-18 · GEN-3 PHOSPHOR · RESTLICHTVERSTÄRKUNG +24dB', cx, height - 58);

    ctx.restore();
  }

  private renderKobra2BodycamPiP(
    ctx: CanvasRenderingContext2D,
    _width: number,
    _height: number,
    squad?: ActorEntity
  ) {
    if (this.gameState !== 'PLAYING') return;

    const pipW = 190;
    const pipH = 120;
    const pipX = 16;
    const pipY = 16;

    ctx.save();
    ctx.globalAlpha = this.hudOpacity;

    // Outer Bodycam Frame / Chassis
    ctx.fillStyle = 'rgba(6, 11, 18, 0.92)';
    ctx.fillRect(pipX - 4, pipY - 18, pipW + 8, pipH + 22);
    ctx.strokeStyle = squad && squad.hp > 0 ? 'rgba(56, 189, 248, 0.7)' : 'rgba(239, 68, 68, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(pipX - 4, pipY - 18, pipW + 8, pipH + 22);

    // Title Bar
    ctx.fillStyle = squad && squad.hp > 0 ? '#38BDF8' : '#EF4444';
    ctx.font = '900 8px "JetBrains Mono", monospace';
    ctx.fillText('HELMKAMERA · KOBRA-2', pipX + 4, pipY - 6);

    ctx.textAlign = 'right';
    ctx.fillStyle = squad && squad.hp > 0 ? '#34D399' : '#EF4444';
    const recBlink = Math.floor(this.elapsedSeconds * 2) % 2 === 0;
    ctx.fillText(
      squad && squad.hp > 0 ? (recBlink ? '● REC 1080P' : '  REC 1080P') : '⚠ SIN SEÑAL',
      pipX + pipW - 2,
      pipY - 6
    );
    ctx.textAlign = 'left';

    // Viewport Clipping Region
    ctx.beginPath();
    ctx.rect(pipX, pipY, pipW, pipH);
    ctx.clip();

    if (!squad || squad.hp <= 0) {
      // Noise static if Kobra-2 is down
      ctx.fillStyle = '#0a0d12';
      ctx.fillRect(pipX, pipY, pipW, pipH);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      for (let i = 0; i < 180; i++) {
        const nx = pipX + Math.random() * pipW;
        const ny = pipY + Math.random() * pipH;
        ctx.fillRect(nx, ny, 2, 2);
      }
      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('[ TRANSMISIÓN CAÍDA ]', pipX + pipW * 0.5, pipY + pipH * 0.5);
      ctx.restore();
      return;
    }

    // Render perspective centered on squadmate
    ctx.fillStyle = '#080d14';
    ctx.fillRect(pipX, pipY, pipW, pipH);

    ctx.save();
    // Center squadmate in PIP
    ctx.translate(pipX + pipW * 0.5, pipY + pipH * 0.5);
    ctx.scale(0.36, 0.36);
    ctx.translate(-squad.x, -squad.y);

    // Draw rooms background/floors
    for (const r of this.rooms) {
      ctx.fillStyle = r.cleared ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }

    // Draw furniture
    for (const f of this.furniture) {
      if (f.isDestroyed) {
        ctx.fillStyle = 'rgba(120, 53, 15, 0.3)';
        ctx.fillRect(f.x, f.y, f.w, f.h);
      } else {
        ctx.fillStyle = f.color || '#475569';
        ctx.fillRect(f.x, f.y, f.w, f.h);
      }
    }

    // Draw doors
    for (const d of this.doors) {
      ctx.strokeStyle = d.isOpen ? '#10B981' : d.isBreached ? '#EF4444' : '#D97706';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(d.x1, d.y1);
      ctx.lineTo(d.x2, d.y2);
      ctx.stroke();
    }

    // Draw walls
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 6;
    for (const w of this.walls) {
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();
    }

    // Draw actors in squad vicinity
    for (const actor of this.actors) {
      if (actor.state === 'DEAD') continue;
      const d = Math.hypot(actor.x - squad.x, actor.y - squad.y);
      if (d > 550) continue;

      ctx.save();
      ctx.translate(actor.x, actor.y);
      ctx.rotate(actor.angle);

      if (actor.role === 'PLAYER') {
        ctx.fillStyle = '#38BDF8';
      } else if (actor.role === 'SQUAD') {
        ctx.fillStyle = '#06B6D4';
      } else if (actor.role === 'SUSPECT') {
        ctx.fillStyle =
          actor.state === 'ARRESTED' || actor.state === 'SURRENDERED' ? '#F59E0B' : '#EF4444';
      } else {
        ctx.fillStyle = '#10B981';
      }

      ctx.beginPath();
      ctx.arc(0, 0, actor.radius, 0, Math.PI * 2);
      ctx.fill();

      // Heading indicator
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(actor.radius + 8, 0);
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore(); // Restore squad transform

    // Bodycam Tactical Green/Blue Overlay Tint
    ctx.fillStyle = 'rgba(56, 189, 248, 0.06)';
    ctx.fillRect(pipX, pipY, pipW, pipH);

    // Bodycam Pitch & Roll Crosshair
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1;
    const pcX = pipX + pipW * 0.5;
    const pcY = pipY + pipH * 0.5;
    ctx.beginPath();
    ctx.moveTo(pcX - 10, pcY);
    ctx.lineTo(pcX + 10, pcY);
    ctx.moveTo(pcX, pcY - 10);
    ctx.lineTo(pcX, pcY + 10);
    ctx.stroke();

    // Bodycam Scanlines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    for (let y = pipY; y < pipY + pipH; y += 3) {
      ctx.fillRect(pipX, y, pipW, 1);
    }

    // Telemetry Footer
    ctx.font = '7.5px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'left';
    const hdg = Math.round((squad.angle * 180) / Math.PI + 90) % 360;
    ctx.fillText(`HDG: ${hdg < 0 ? hdg + 360 : hdg}° · SALUD: ${Math.round(squad.hp)}%`, pipX + 4, pipY + pipH - 4);

    ctx.restore(); // Restore main context
  }

  private renderSquareMinimap(
    ctx: CanvasRenderingContext2D,
    _width: number,
    _height: number,
    player: ActorEntity,
    squad?: ActorEntity
  ) {
    const halfSize = 54;
    const size = halfSize * 2;
    const cx = this.minimapCenter.x;
    const cy = this.minimapCenter.y;

    ctx.save();
    ctx.globalAlpha = this.hudOpacity;

    // 1. Outer Translucent Tactical Glass Border (Square)
    ctx.beginPath();
    ctx.fillStyle = 'rgba(8, 12, 17, 0.82)';
    ctx.fillRect(cx - halfSize - 4, cy - halfSize - 4, size + 8, size + 8);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 1.8;
    ctx.strokeRect(cx - halfSize - 4, cy - halfSize - 4, size + 8, size + 8);

    // 2. Square Radar Crop Path
    ctx.beginPath();
    ctx.rect(cx - halfSize, cy - halfSize, size, size);
    ctx.clip();

    // Dark Background
    ctx.fillStyle = '#05090e';
    ctx.fillRect(cx - halfSize, cy - halfSize, size, size);

    // Square Grid Lines & Crosshairs
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - halfSize, cy);
    ctx.lineTo(cx + halfSize, cy);
    ctx.moveTo(cx, cy - halfSize);
    ctx.lineTo(cx, cy + halfSize);
    ctx.stroke();
    ctx.strokeRect(cx - halfSize * 0.5, cy - halfSize * 0.5, size * 0.5, size * 0.5);

    const scale = 0.088;

    // Opposing City Buildings / Urban Blocks on Minimap
    ctx.fillStyle = 'rgba(30, 41, 59, 0.45)';
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
    ctx.lineWidth = 1;
    const oppBlocks = [
      { x: -350, y: -450, w: 1950, h: 325 }, // North block
      { x: -350, y: 885, w: 1950, h: 365 },  // South block
      { x: -420, y: -125, w: 295, h: 1010 }, // West block
      { x: 1425, y: -125, w: 295, h: 1010 }, // East block
    ];
    for (const b of oppBlocks) {
      const bx = cx + (b.x - player.x) * scale;
      const by = cy + (b.y - player.y) * scale;
      const bw = b.w * scale;
      const bh = b.h * scale;
      if (bx + bw < cx - halfSize || bx > cx + halfSize) continue;
      if (by + bh < cy - halfSize || by > cy + halfSize) continue;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);
    }

    // Walls
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.52)';
    ctx.lineWidth = 1.5;
    for (const w of this.walls) {
      const x1 = cx + (w.x1 - player.x) * scale;
      const y1 = cy + (w.y1 - player.y) * scale;
      const x2 = cx + (w.x2 - player.x) * scale;
      const y2 = cy + (w.y2 - player.y) * scale;

      if (Math.abs(x1 - cx) > halfSize + 25 && Math.abs(x2 - cx) > halfSize + 25) continue;
      if (Math.abs(y1 - cy) > halfSize + 25 && Math.abs(y2 - cy) > halfSize + 25) continue;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Doors
    for (const d of this.doors) {
      const midX = (d.x1 + d.x2) * 0.5;
      const midY = (d.y1 + d.y2) * 0.5;
      const dx = cx + (midX - player.x) * scale;
      const dy = cy + (midY - player.y) * scale;
      if (Math.abs(dx - cx) > halfSize + 10 || Math.abs(dy - cy) > halfSize + 10) continue;

      ctx.fillStyle = d.isOpen ? '#22C55E' : d.isBreached ? '#EF4444' : '#D97706';
      ctx.fillRect(dx - 3, dy - 3, 6, 6);
    }

    // Exit Routes / Evac Points
    const exitX = cx + (60 - player.x) * scale;
    const exitY = cy + (600 - player.y) * scale;
    if (Math.abs(exitX - cx) <= halfSize && Math.abs(exitY - cy) <= halfSize) {
      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.arc(exitX, exitY, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // EKO-PAD Markers
    for (const m of this.tacticalMarkers) {
      const mx = cx + (m.x - player.x) * scale;
      const my = cy + (m.y - player.y) * scale;
      if (Math.abs(mx - cx) > halfSize || Math.abs(my - cy) > halfSize) continue;

      ctx.fillStyle = m.type === 'HOSTILE' ? '#EF4444' : m.type === 'BREACH_ZONE' ? '#F59E0B' : '#38BDF8';
      ctx.beginPath();
      ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Detected Enemies
    for (const actor of this.actors) {
      if (actor.role !== 'SUSPECT') continue;
      if (!actor.visibleToPlayer && !actor.visibleToSquad && !actor.spottedByMirror && !actor.identifiedByRadio) continue;
      if (actor.state === 'DEAD' || actor.state === 'ARRESTED') continue;

      const ax = cx + (actor.x - player.x) * scale;
      const ay = cy + (actor.y - player.y) * scale;
      if (Math.abs(ax - cx) > halfSize || Math.abs(ay - cy) > halfSize) continue;

      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(ax, ay, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Squadmate Kobra-2
    if (squad && squad.hp > 0) {
      const sx = cx + (squad.x - player.x) * scale;
      const sy = cy + (squad.y - player.y) * scale;
      if (Math.abs(sx - cx) <= halfSize && Math.abs(sy - cy) <= halfSize) {
        ctx.fillStyle = '#06B6D4';
        ctx.beginPath();
        ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#E2E8F0';
        ctx.font = '8px monospace';
        ctx.fillText('K2', sx + 6, sy + 3);
      }
    }

    // Player (Kobra-1) Center
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(player.angle);

    ctx.fillStyle = 'rgba(217, 119, 6, 0.28)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 22, -0.45, 0.45);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    ctx.restore(); // Restore clip

    ctx.save();
    ctx.globalAlpha = this.hudOpacity;
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 8px monospace';
    ctx.fillText('N', cx - 2, cy - halfSize - 7);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '8px monospace';
    ctx.fillText('MINIMAP 2D', cx - 22, cy + halfSize + 13);
    ctx.restore();
  }

  private renderSmartDiegeticReticle(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    player: ActorEntity
  ) {
    if (this.gameState !== 'PLAYING') return;

    // Mouse coordinates in screen space
    const rx = this.mouseScreen.x;
    const ry = this.mouseScreen.y;

    // Ignore if cursor is far outside the viewport
    if (rx < -20 || rx > width + 20 || ry < -20 || ry > height + 20) return;

    const clampedX = Math.max(18, Math.min(width - 18, rx));
    const clampedY = Math.max(18, Math.min(height - 18, ry));

    const weaponSpec = EKO_COBRA_WEAPONS[this.plan.primaryWeapon];
    const isTaser = this.activeTool === 'TASER';
    const isReloading = this.reloadTimer > 0;
    const isExtremities = this.aimZoneMode === 'EXTREMITIES';
    const isLowAmmo = !isTaser && this.ammoInMag <= 5 && this.ammoInMag > 0;
    const isEmpty = !isTaser && this.ammoInMag === 0;

    // Detect target actor directly under the world cursor (contextual FOV lock)
    let targetActor: ActorEntity | null = null;
    let targetType: 'NONE' | 'SUSPECT' | 'HOSTAGE' | 'SQUAD' = 'NONE';

    for (const actor of this.actors) {
      if (actor.state === 'DEAD' || actor.state === 'INCAPACITATED') continue;
      const dist = Math.hypot(actor.x - this.mouseWorld.x, actor.y - this.mouseWorld.y);
      if (dist <= actor.radius + 14) {
        targetActor = actor;
        if (actor.role === 'SUSPECT') targetType = 'SUSPECT';
        else if (actor.role === 'HOSTAGE' || actor.role === 'CIVILIAN') targetType = 'HOSTAGE';
        else if (actor.role === 'SQUAD') targetType = 'SQUAD';
        break;
      }
    }

    // Dynamic reticle spread based on weapon spread, stance, arm injury, and movement
    const armHealth = player.bodyHealth?.arms ?? 100;
    const armPenalty = ((100 - armHealth) / 100) * 8;
    const isMoving = Math.hypot(player.vx, player.vy) > 12;
    const movePenalty = isMoving ? 5 : 0;
    const crouchBonus = this.playerStance === 'AGACHADO' ? -3 : 0;
    const focusedBonus = this.isFocusedAiming() ? -3 : 0;
    const fireCooldownKick = this.fireCooldown > 0 ? 4 : 0;

    const baseGap = 7;
    const gap = Math.max(4, Math.min(26, baseGap + armPenalty + movePenalty + crouchBonus + focusedBonus + fireCooldownKick));
    const tickLen = 6;

    // Reticle theme colors
    let reticleColor = 'rgba(56, 189, 248, 0.90)'; // Tactical cyan
    let reticleGlow = 'rgba(56, 189, 248, 0.45)';

    if (targetType === 'SUSPECT') {
      reticleColor = 'rgba(239, 68, 68, 0.95)'; // Hostile crimson
      reticleGlow = 'rgba(239, 68, 68, 0.55)';
    } else if (targetType === 'HOSTAGE') {
      reticleColor = 'rgba(16, 185, 129, 0.95)'; // Friendly green / non-shoot
      reticleGlow = 'rgba(16, 185, 129, 0.55)';
    } else if (targetType === 'SQUAD') {
      reticleColor = 'rgba(59, 130, 246, 0.95)'; // Kobra-2 ally blue
      reticleGlow = 'rgba(59, 130, 246, 0.55)';
    } else if (isEmpty) {
      const pulse = (Math.sin(this.elapsedSeconds * 12) + 1) * 0.5;
      reticleColor = `rgba(239, 68, 68, ${0.7 + pulse * 0.3})`;
      reticleGlow = 'rgba(239, 68, 68, 0.5)';
    } else if (isLowAmmo) {
      reticleColor = 'rgba(245, 158, 11, 0.95)'; // Amber
      reticleGlow = 'rgba(245, 158, 11, 0.5)';
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0.35, this.hudOpacity);

    // 1. Center Aim Dot
    ctx.fillStyle = reticleColor;
    ctx.shadowColor = reticleGlow;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(clampedX, clampedY, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 2. Crosshair Ticks with Dynamic Spread Gap
    ctx.strokeStyle = reticleColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Top
    ctx.moveTo(clampedX, clampedY - gap - tickLen);
    ctx.lineTo(clampedX, clampedY - gap);
    // Bottom
    ctx.moveTo(clampedX, clampedY + gap);
    ctx.lineTo(clampedX, clampedY + gap + tickLen);
    // Left
    ctx.moveTo(clampedX - gap - tickLen, clampedY);
    ctx.lineTo(clampedX - gap, clampedY);
    // Right
    ctx.moveTo(clampedX + gap, clampedY);
    ctx.lineTo(clampedX + gap + tickLen, clampedY);
    ctx.stroke();

    // 3. Subtle Outer Framing Corner Brackets
    const cornerDist = gap + tickLen + 5;
    const cornerSize = 4;
    ctx.lineWidth = 1;
    ctx.strokeStyle = targetType !== 'NONE' ? reticleColor : 'rgba(148, 163, 184, 0.45)';
    ctx.beginPath();
    // Top-Left
    ctx.moveTo(clampedX - cornerDist, clampedY - cornerDist + cornerSize);
    ctx.lineTo(clampedX - cornerDist, clampedY - cornerDist);
    ctx.lineTo(clampedX - cornerDist + cornerSize, clampedY - cornerDist);
    // Top-Right
    ctx.moveTo(clampedX + cornerDist - cornerSize, clampedY - cornerDist);
    ctx.lineTo(clampedX + cornerDist, clampedY - cornerDist);
    ctx.lineTo(clampedX + cornerDist, clampedY - cornerDist + cornerSize);
    // Bottom-Left
    ctx.moveTo(clampedX - cornerDist, clampedY + cornerDist - cornerSize);
    ctx.lineTo(clampedX - cornerDist, clampedY + cornerDist);
    ctx.lineTo(clampedX - cornerDist + cornerSize, clampedY + cornerDist);
    // Bottom-Right
    ctx.moveTo(clampedX + cornerDist - cornerSize, clampedY + cornerDist);
    ctx.lineTo(clampedX + cornerDist, clampedY + cornerDist);
    ctx.lineTo(clampedX + cornerDist, clampedY + cornerDist - cornerSize);
    ctx.stroke();

    // 4. Reload Progress Arc (if currently reloading)
    if (isReloading) {
      const reloadPct = Math.min(1, Math.max(0, 1 - this.reloadTimer / this.reloadMaxDuration));
      const reloadRadius = cornerDist + 7;
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(clampedX, clampedY, reloadRadius, -Math.PI * 0.5, -Math.PI * 0.5 + reloadPct * Math.PI * 2);
      ctx.stroke();

      // Reloading text directly below crosshair
      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`RECARGANDO ${Math.round(reloadPct * 100)}% [R]`, clampedX, clampedY + cornerDist + 16);
    }

    // 5. Target Identification Tag (if hovering an actor)
    if (targetActor) {
      ctx.textAlign = 'center';
      if (targetType === 'SUSPECT') {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
        const label = targetActor.isArmed ? `⚠ BLANCO: ${targetActor.weaponLabel || 'ARMADO'}` : '⚠ SOSPECHOSO';
        ctx.fillText(label, clampedX, clampedY - cornerDist - 7);
      } else if (targetType === 'HOSTAGE') {
        ctx.fillStyle = '#10B981';
        ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
        ctx.fillText('✓ NO DISPARAR (REHÉN)', clampedX, clampedY - cornerDist - 7);
      } else if (targetType === 'SQUAD') {
        ctx.fillStyle = '#38BDF8';
        ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
        ctx.fillText('ALIADO (KOBRA-2)', clampedX, clampedY - cornerDist - 7);
      }
    }

    // =========================================================================
    // 6. FLOATING DIEGETIC HUD (Contador de Balas + Modo de Disparo Torso/Extremidades)
    // =========================================================================
    const cardW = 126;
    const cardH = 46;
    let cardX = clampedX + cornerDist + 8;
    let cardY = clampedY - 22;

    // Edge flipping to ensure it never exits the canvas bounds
    if (cardX + cardW > width - 12) {
      cardX = clampedX - cornerDist - 8 - cardW;
    }
    if (cardY + cardH > height - 12) {
      cardY = height - 12 - cardH;
    }
    if (cardY < 12) {
      cardY = 12;
    }

    // High-tech leader line connecting the smart reticle framing bracket to the floating ammo card
    const accentColor = isExtremities ? '#34D399' : '#38BDF8';
    ctx.strokeStyle = this.modeSwitchPulseTimer > 0 ? accentColor : 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (cardX > clampedX) {
      ctx.moveTo(clampedX + cornerDist, clampedY);
      ctx.lineTo(cardX, clampedY);
    } else {
      ctx.moveTo(clampedX - cornerDist, clampedY);
      ctx.lineTo(cardX + cardW, clampedY);
    }
    ctx.stroke();

    // Background panel with military frosted high-contrast finish
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.fillStyle = 'rgba(6, 11, 18, 0.94)';
    ctx.strokeStyle = this.modeSwitchPulseTimer > 0
      ? (isExtremities ? '#34D399' : '#38BDF8')
      : 'rgba(51, 65, 85, 0.80)';
    ctx.lineWidth = this.modeSwitchPulseTimer > 0 ? 1.5 : 1;

    // Card background
    ctx.beginPath();
    ctx.rect(cardX, cardY, cardW, cardH);
    ctx.fill();
    ctx.stroke();

    // Mode Switch flash accent bar on the left edge of card
    ctx.fillStyle = accentColor;
    ctx.fillRect(cardX, cardY, 3, cardH);

    // Micro corner decoration
    ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.fillRect(cardX + cardW - 3, cardY, 3, 3);
    ctx.fillRect(cardX + cardW - 3, cardY + cardH - 3, 3, 3);

    ctx.shadowBlur = 0;

    // --- ROW 1: WEAPON & DIEGETIC AMMO READOUT ---
    const weaponLabel = isTaser
      ? 'TASER X2'
      : (weaponSpec?.name || 'STEYR AUG').replace('Steyr ', '').toUpperCase();

    ctx.textAlign = 'left';
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(weaponLabel, cardX + 7, cardY + 11);

    // Stance micro badge on top right of card
    const isCrouched = this.playerStance === 'AGACHADO';
    ctx.textAlign = 'right';
    ctx.font = 'bold 7.5px "JetBrains Mono", monospace';
    ctx.fillStyle = isCrouched ? '#34D399' : '#64748B';
    ctx.fillText(isCrouched ? 'AGACHADO' : 'PARADO', cardX + cardW - 5, cardY + 11);

    // Ammo Numbers
    ctx.textAlign = 'left';
    if (isTaser) {
      ctx.font = '900 14px "JetBrains Mono", monospace';
      ctx.fillStyle = '#F59E0B';
      ctx.fillText(`0${this.taserCharges}`, cardX + 7, cardY + 26);
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('/ 2 DARDOS', cardX + 28, cardY + 24);
    } else if (isEmpty) {
      ctx.font = '900 13px "JetBrains Mono", monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('00', cardX + 7, cardY + 26);
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('RECARGAR [R]', cardX + 28, cardY + 24);
    } else {
      ctx.font = '900 14px "JetBrains Mono", monospace';
      ctx.fillStyle = isLowAmmo ? '#F59E0B' : '#FFFFFF';
      const ammoStr = String(this.ammoInMag).padStart(2, '0');
      ctx.fillText(ammoStr, cardX + 7, cardY + 26);

      ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(`/ ${this.magCount}x`, cardX + 29, cardY + 23);

      // Micro segmented ammo bar (Steyr AUG visual magazine)
      const maxMag = weaponSpec?.magSize || 30;
      const magRatio = Math.max(0, Math.min(1, this.ammoInMag / maxMag));
      const barX = cardX + 64;
      const barY = cardY + 17;
      const barW = 56;
      const barH = 5;

      ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
      ctx.fillRect(barX, barY, barW, barH);

      const fillW = Math.round(barW * magRatio);
      ctx.fillStyle = isLowAmmo ? '#F59E0B' : '#38BDF8';
      ctx.fillRect(barX, barY, fillW, barH);

      // Bar tick marks (every 25%)
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      for (let t = 1; t <= 3; t++) {
        ctx.fillRect(barX + Math.round((barW / 4) * t), barY, 1, barH);
      }
    }

    // --- ROW 2: DIEGETIC AIM ZONE MODE (TORSO / EXTREMIDADES) ---
    const modeY = cardY + 38;
    const modeBadgeW = cardW - 12;
    const modeBadgeH = 13;

    ctx.fillStyle = isExtremities ? 'rgba(16, 185, 129, 0.18)' : 'rgba(56, 189, 248, 0.16)';
    ctx.strokeStyle = isExtremities ? 'rgba(16, 185, 129, 0.55)' : 'rgba(56, 189, 248, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(cardX + 6, modeY - 8, modeBadgeW, modeBadgeH);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    if (isExtremities) {
      ctx.fillStyle = '#34D399';
      ctx.fillText('◆ EXTREMIDADES [V]', cardX + 9, modeY + 2);
      ctx.textAlign = 'right';
      ctx.font = '7px "JetBrains Mono", monospace';
      ctx.fillStyle = '#A7F3D0';
      ctx.fillText('NO-LETAL §7', cardX + cardW - 9, modeY + 2);
    } else {
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('● MODO TORSO [V]', cardX + 9, modeY + 2);
      ctx.textAlign = 'right';
      ctx.font = '7px "JetBrains Mono", monospace';
      ctx.fillStyle = '#BAE6FD';
      ctx.fillText('LETAL CENTRO', cardX + cardW - 9, modeY + 2);
    }

    ctx.restore();
  }

}
