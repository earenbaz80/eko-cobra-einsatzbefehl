import {
  computeLoadoutMetrics,
  createGrazActors,
  createGrazApartmentLayout,
  createTrainingActors,
  createTrainingFacilityLayout,
  EKO_COBRA_AMMO,
  EKO_COBRA_ATTACHMENTS,
  EKO_COBRA_GADGETS,
  EKO_COBRA_INSPECTION_DEVICES,
  EKO_COBRA_PROFILES,
  EKO_COBRA_WEAPONS,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from './grazMap';
import {
  createStationActors,
  createStationLayout
} from './stationMap';
import {
  createLinzActors,
  createLinzLayout
} from './linzMap';
import {
  createTirolActors,
  createTirolLayout
} from './tirolMap';
import {
  createViennaAirportActors,
  createViennaAirportLayout
} from './viennaAirportMap';
import {
  battlemapAssetCache
} from './battlemapAssets';
import {
  applyZoneWound,
  selectHitZone,
  trainingScoreForZone
} from './ballistics';
import {
  DEFAULT_KEYBINDS,
  KEYBIND_ACTIONS,
  sanitizeKeybinds
} from './keybinds';
import {
  classifyLethalShot,
  computeRoeImpact,
  isLawfulThreat,
  LETHAL_SHOT_POINTS
} from './roe';
import {
  soundEngine
} from './soundEngine';
import {
  RadioFeed
} from './radioFeed';
import {
  C4ChargeSystem,
  C4_SAFE_RADIUS,
  type C4Dependencies,
  type C4SaveState
} from './c4Charges';
import {
  chooseSquadSteeringAngle,
  computeSquadNavTarget
} from './squadAi';
import {
  canSurrender,
  resolveBreachReaction
} from './suspectAi';
import { aplicarEvento, type GameEvent } from './gameState';
import {
  colisiona,
  crearPartidaDesdeMundo,
  deslizarConColision,
  distanciaASegmento,
  segmentoHojaPuerta,
  PASO_MAXIMO,
  type Partida,
  type SnapshotSimulacion
} from './simulation';
import {
  computeMoveSpeedPct,
  computePulseStabilityPct,
  computeAccuracyPct,
  computeVisionStabilityPct,
  computePulseBpm
} from './hudMetrics';
import {
  ActorEntity,
  AlertLevel,
  BiometricHudTarget,
  BodyPartHealth,
  ActiveC4Charge,
  CriticalEventLogEntry,
  CriticalEventType,
  DoorEntity,
  FurnitureItem,
  GameState,
  HitZone,
  HudSnapshot,
  MissionPlan,
  NoiseEvent,
  PrimaryWeaponId,
  ROEEvent,
  RoomZone,
  SquadCommand,
  SecondaryObjective,
  StationAlertLevel,
  TacticalMapMarker,
  TacticalMarkerType,
  TacticalPadData,
  Vec2,
  LightSwitchEntity,
  WallSconceLight,
  WallSegment,
  computePlayerMissionRank
} from './types';

type SquadBreachMode = 'SHOOT_LOCK' | 'KICK' | 'RAM' | 'C4';
type SquadCommandTarget = {
  type: 'DOOR' | 'WINDOW' | 'POINT';
  id?: string;
  name: string;
  x: number;
  y: number;
};

export interface BulletTrace {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  alpha: number;
  isTaser: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  shape?: 'SQUARE' | 'CIRCLE' | 'SHARD' | 'SPARK' | 'MIST' | 'CASING' | 'MUZZLE_FLASH';
  rotation?: number;
  vRot?: number;
  drag?: number;
}

export interface FloorDecal {
  x: number;
  y: number;
  radius: number;
  color: string;
  alpha: number;
  type: 'BLOOD_SPLATTER' | 'BLOOD_POOL' | 'DEBRIS' | 'SCORCH' | 'CASING';
  angle: number;
  aspect: number;
}

export interface ImpactShockRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
}

export interface ImpactPopup {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface ShoutWave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

export interface RefractionShockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  strength: number;
}

export interface SnowFootprint {
  x: number;
  y: number;
  angle: number;
  alpha: number;
  life: number;
}

export interface ThrownGadget {
  x: number;
  y: number;
  midX?: number;
  midY?: number;
  tx: number;
  ty: number;
  progress: number;
  type: 'FLASHBANG' | 'CS_GAS' | 'PEPPER_SPRAY';
  detonated: boolean;
  cloudTimer: number;
  hasBounced?: boolean;
  didBounceEffect?: boolean;
}

export interface DroppedEvidence {
  id: string;
  label: string;
  x: number;
  y: number;
  secured: boolean;
}

export interface RainDrop {
  x: number;
  y: number;
  len: number;
  speed: number;
}

export interface DynamicPointLight {
  x: number;
  y: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface AcousticEdgeIndicator {
  id: string;
  sourceId: string;
  x: number;
  y: number;
  kind: 'GUNSHOT' | 'FOOTSTEP' | 'ALERT_VOICE';
  intensity: number; // 0..1
  life: number;
  maxLife: number;
  label: string;
}

export interface AmbientDustMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseAlpha: number;
  phase: number;
  turbulenceFreq: number;
  isSurgeMote?: boolean;
  life?: number;
  maxLife?: number;
}

export interface WindowRainParticle {
  windowId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  kind: 'GLASS_STREAK' | 'SILL_SPLASH' | 'INFLOW_GUST';
}

export interface ExteriorWindowSection {
  id: string;
  label: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  normalAngle: number; // Inward normal pointing into the apartment
  roomId: string;
  isBreached: boolean;
  damageHits: number;
}

export interface BreachWindSource {
  id: string;
  x: number;
  y: number;
  normalAngle: number;
  intensity: number;
  label: string;
}

export const AUSTRIAN_SHOUTS = [
  'POLIZEI! EKO COBRA! WAFFEN FALLEN LASSEN!',
  'HÄNDE HOCH! KEINE BEWEGUNG!',
  'WAFFE WEG! SOFORT AUF DEN BODEN!',
  'POLIZEI! ERGEBEN SIE SICH!',
];

/** World-to-screen zoom shared by rendering, aiming and hit testing. */
function getWeaponThreatRange(weaponLabel?: string): number {
  const label = (weaponLabel ?? '').toLowerCase();
  if (/vz\.?\s*58|aug|gewehr|rifle|ak-?47|karabiner/.test(label)) return 280;
  if (/skorpion|mp-?5|smg|maschinenpistole/.test(label)) return 230;
  if (/schrot|shotgun|flinte/.test(label)) return 150;
  if (/messer|knife|bajonett/.test(label)) return 120;
  return 180;
}

/** Zoom del encuadre táctico: se consume a través de `framing`, nunca suelto. */
const CAMERA_ZOOM = 1.55;

/** Contrato de introspección de solo lectura para las pruebas E2E. */
export interface EkoE2ESegment {
  readonly id: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface EkoE2EWall extends EkoE2ESegment {
  readonly isWindow: boolean;
}

export interface EkoE2EDoor extends EkoE2ESegment {
  readonly name: string;
  readonly isOpen: boolean;
  readonly isLocked: boolean;
  readonly isBreached: boolean;
  readonly isDestroyed: boolean;
  readonly mirrored: boolean;
}

export interface EkoE2EFurniture {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly blocksMovement: boolean;
  readonly blocksSight: boolean;
  readonly isDestroyed: boolean;
}

export interface EkoE2EWorld {
  readonly mission: string;
  readonly walls: readonly EkoE2EWall[];
  readonly doors: readonly EkoE2EDoor[];
  readonly furniture: readonly EkoE2EFurniture[];
}

export interface EkoE2ESpeechBubble {
  readonly text: string;
  readonly timer: number;
  readonly type: 'COMMAND' | 'HOSTILE' | 'SURRENDER' | 'PANIC';
}

export interface EkoE2ESquad {
  readonly x: number;
  readonly y: number;
  /** Radio de la silueta, para calcular su proyección visual en el canvas. */
  readonly radius: number;
  readonly command: SquadCommand;
  readonly target: Vec2 | null;
  /** Puerta fijada por la orden actual, para comprobar que no se sustituye. */
  readonly doorTargetId: string | null;
  /** Acción de brecha en curso, para observar el modo y su progreso. */
  readonly breachMode: SquadBreachMode | null;
  readonly breachProgress: number | null;
  readonly breachMaxProgress: number | null;
  /** Burbuja de texto situacional de Kobra-2; no es una locución. */
  readonly speechBubble: EkoE2ESpeechBubble | null;
}

export interface EkoE2EState {
  readonly gameState: GameState;
  readonly player: {
    readonly x: number;
    readonly y: number;
    readonly angle: number;
    /** Burbuja de texto situacional de Kobra-1; no es una locución. */
    readonly speechBubble: EkoE2ESpeechBubble | null;
  } | null;
  readonly squad: EkoE2ESquad | null;
  readonly tick: number;
  readonly world: EkoE2EWorld;
  /** Recursos y equipo del operador/binomio para comprobar consumos. */
  readonly c4Count: number;
  readonly squadGear: MissionPlan['squadGear'];
  /** Últimos mensajes de radio, con su hablante, para comprobar el texto en pantalla. */
  readonly radioFeed: readonly { readonly speaker: string; readonly text: string }[];
}

export interface EkoE2EHook extends EkoE2EState {
  /** Lee todos los campos en el mismo instante de simulación. */
  snapshot(): EkoE2EState;
  /** Coordenadas CSS para pulsar una posición del mundo desde Playwright. */
  worldToScreen(x: number, y: number): { x: number; y: number };
  /** FNV-1a del buffer del pase de arte; null si `?art=proof` no pintó nada. */
  artBufferHash(): string | null;
  /** Tamaño de ese buffer; null mientras el chunk del pase no esté cargado. */
  artBufferSize(): { readonly width: number; readonly height: number } | null;
}

export class TacticalEngineCore {
  protected canvas: HTMLCanvasElement;
  protected ctx: CanvasRenderingContext2D;
  /** Backing-store scale (devicePixelRatio); all drawing happens in CSS pixels. */
  protected renderScale: number = 1;
  /**
   * La capa de luz solo necesita cubrir el viewport y es suave por naturaleza.
   * Renderizarla a media resolución recorta el área a rellenar y a componer sin
   * afectar a la geometría de visión, que sigue calculándose en coordenadas de mundo.
   */
  /** Capa auxiliar de iluminación, a baja resolución y ajustada al viewport. */
  protected l: HTMLCanvasElement;
  protected lc: CanvasRenderingContext2D;
  /** Calles, aceras y decoración fija pre-renderizadas en coordenadas de mundo. */
  protected staticScene?: HTMLCanvasElement;
  protected onHudUpdate: (snapshot: HudSnapshot) => void;
  protected onStateChange: (newState: GameState) => void;

  public gameState: GameState = 'TITLE';
  /** Pasos de simulación dados; el informe de fallo lo enseña como «tick». */
  public ticks: number = 0;
  public plan: MissionPlan;

  protected rooms: RoomZone[] = [];
  protected walls: WallSegment[] = [];
  protected doors: DoorEntity[] = [];
  protected furniture: FurnitureItem[] = [];
  protected wallSconces: WallSconceLight[] = [];
  protected lightSwitches: LightSwitchEntity[] = [];
  /** Ruta de movimiento del jugador compartida con simulation.ts. */
  protected simulacion: Partida | null = null;
  protected actors: ActorEntity[] = [];
  protected traces: BulletTrace[] = [];
  protected particles: Particle[] = [];
  protected decals: FloorDecal[] = [];
  protected impactRings: ImpactShockRing[] = [];
  protected refractionRings: RefractionShockwave[] = [];
  protected snowFootprints: SnowFootprint[] = [];
  protected camInertiaX: number = 0;
  protected camInertiaY: number = 0;
  public thermalPaletteMode: 'WHITE_HOT' | 'BLACK_HOT' | 'IRONBOW' = 'WHITE_HOT';
  protected impactPopups: ImpactPopup[] = [];
  protected shoutWaves: ShoutWave[] = [];
  public grenadeAimingActive: boolean = false;
  protected gadgets: ThrownGadget[] = [];
  protected evidenceList: DroppedEvidence[] = [];
  protected rainDrops: RainDrop[] = [];
  protected ambientDustMotes: AmbientDustMote[] = [];
  protected windowRainParticles: WindowRainParticle[] = [];
  protected exteriorWindows: ExteriorWindowSection[] = [];
  protected breachWindSources: BreachWindSource[] = [];
  protected exteriorBreachSurgeTimer: number = 0;
  protected exteriorBreachMaxDuration: number = 14.0;
  protected radio: RadioFeed = new RadioFeed();
  protected pointLights: DynamicPointLight[] = [];
  protected acousticIndicators: AcousticEdgeIndicator[] = [];
  protected playerDarknessTimer: number = 0;
  protected lastPlayerShotTime: number = -999;
  protected playerHiddenInShadow: boolean = false;
  protected breachAction?: {
    doorId: string;
    mode: 'KICK' | 'RAM' | 'C4';
    progress: number;
    maxProgress: number;
    name: string;
    noiseLevel: string;
    stunRisk: string;
  };

  // Input state
  protected heldKeys: Set<string> = new Set();
  protected mouseScreen: Vec2 = { x: 640, y: 410 };
  protected mouseWorld: Vec2 = { x: 640, y: 410 };

  // Camera & Juice
  protected camX: number = 580;
  protected camY: number = 410;
  protected camPanOffsetX: number = 0;
  protected camPanOffsetY: number = 0;
  protected shakeIntensity: number = 0;
  protected hitstopTimer: number = 0;
  protected flashScreenAlpha: number = 0;
  protected playerHitFlashTimer: number = 0;
  protected playerHitSourceAngle: number = 0;
  protected titlePanTime: number = 0;
  protected hudOpacity: number = 0.9;
public lowQualityMode: boolean = false;
public investigationMode: boolean = false;
public nightMode: boolean = false;

  // Touch Movement Input for Mobile
  public touchMoveX: number = 0;
  public touchMoveY: number = 0;

  // Joystick virtual (móvil): vector -1..1 que manda sobre el arrastre táctil.
  public virtualStickX: number = 0;
  public virtualStickY: number = 0;

  public setVirtualStick(x: number, y: number) {
    const magnitud = Math.hypot(x, y);
    const escala = magnitud > 1 ? 1 / magnitud : 1;
    this.virtualStickX = x * escala;
    this.virtualStickY = y * escala;
  }

  public get virtualStickMagnitude(): number {
    return Math.hypot(this.virtualStickX, this.virtualStickY);
  }

  // Mission Operation Mode: APARTMENT (Graz Lend), STATION (Hauptbahnhof), TRAINING (Schießstand)
  public missionMode: 'APARTMENT' | 'STATION' | 'LINZ' | 'TIROL' | 'SCHWECHAT' | 'TRAINING' = 'APARTMENT';
  public isTrainingMode: boolean = false;
  protected trainingShotsFired: number = 0;
  protected trainingTargetsHit: number = 0;
  protected peakRecordedShake: number = 0;
  protected lastTrainingHitZone?: string;
  protected lastTrainingTargetName?: string;
  protected lastTrainingEnergy?: number;
  protected trainingDoorResetTimer: number = 0;

  // Noise & Detection System (Stealth, Decibels, Station Alert & Suspect Patrol Reactions)
  protected noiseEvents: NoiseEvent[] = [];
  protected currentNoiseDb: number = 22; // Base ambient noise level (20-25 dB)
  protected currentVisibilityPct: number = 20; // Player visibility percentage
  protected stationAlertScore: number = 0; // 0..100 (Calm -> Suspicious -> Alerted -> Lockdown)
  protected recentNoiseReason: string = 'Ambiente Normal';
  protected lastAlarmSirenTime: number = -999;

  // Player tactical inventory, localized trauma & lighting
  protected activeTool: 'PRIMARY' | 'TASER' | 'GADGET' = 'PRIMARY';
  protected ammoInMag: number = 25;
  protected magCount: number = 4;
  protected taserCharges: number = 3;
  protected gadgetCount: number = 3;
  protected ifakCount: number = 2;
  protected c4: C4ChargeSystem = new C4ChargeSystem();
  protected c4WarningBeepTimer: number = 0;
  protected aimZoneMode: 'TORSO' | 'EXTREMITIES' = 'TORSO';
  protected modeSwitchPulseTimer: number = 0;
  protected aimTremorOffset: number = 0;
  protected playerFatigue: number = 0; // 0..100
  protected sprintModeToggled: boolean = false;
  public playerStance: 'PARADO' | 'AGACHADO' = 'PARADO';
  protected currentMovementGait: 'RESTING' | 'WALKING' | 'SPRINTING' = 'RESTING';
  protected lastFatigueWarningTime: number = -999;
  protected bleedTickTimer: number = 0;
  protected footstepTimer: number = 0;
  protected breathingTimer: number = 0;
  protected suppressionTimer: number = 0;
  protected fireCooldown: number = 0;
  protected armor: number = 100;
  protected squadArmor: number = 100;
  protected squadFatigue: number = 0;
  protected squadMovementGait: 'RESTING' | 'WALKING' | 'SPRINTING' = 'RESTING';
  protected squadScanningTimer: number = 0;
  protected squadHoldAnchorAngle: number = 0;
  protected squadLastWoundReportTimer: number = 0;
  protected squadDoorCooldown: number = 0;
  protected squadDoorWarnCooldown: number = 0;
  /** Puerta fijada por la orden actual: no se vuelve a elegir por cercanía. */
  protected squadDoorTargetId?: string;
  protected squadBreachAction?: {
    doorId: string;
    mode: SquadBreachMode;
    progress: number;
    maxProgress: number;
  };
  protected squadSteerSide: 1 | -1 = 1;
  protected minimapCenter: Vec2 = { x: 74, y: 74 };
  protected isDraggingMinimap: boolean = false;
  protected minimapDragOffset: Vec2 = { x: 0, y: 0 };
  protected baseCareerXp: number = 420;
  protected sessionXp: number = 0;
  protected lastRankTitle?: string;
  protected lastRankStars?: number;
  protected isEmittingHudSnapshot: boolean = false;
  protected tacticalWaypoint?: { x: number; y: number; label: string };
  protected tacticalMarkers: TacticalMapMarker[] = [];
  protected mirrorDoorId: string | null = null;
  protected thermalActive: boolean = false;
  public flashlightOn: boolean = true;
  public nvgActive: boolean = false;
  public nvgKeyCode: string = 'KeyN';
  public keybinds: Record<string, string> = { ...DEFAULT_KEYBINDS };
  protected nvgWarmupTimer: number = 0;
  protected commandPulseTimer: number = 0;

  // Mission metrics & ROE
  protected squadCommand: SquadCommand = 'FOLLOW';
  protected score: number = 0;
  protected roeViolations: number = 0;
  protected elapsedSeconds: number = 0;
  protected hudSyncTimer: number = 0;
  protected roeEvents: ROEEvent[] = [];
  protected criticalEvents: CriticalEventLogEntry[] = [];

  protected missionOutcome: HudSnapshot['missionResult'] | undefined = undefined;
  protected secondaryObjectives: SecondaryObjective[] = [];

  // Reload state
  protected reloadTimer: number = 0;
  protected readonly reloadMaxDuration: number = 1.8;
  protected squadReloadTimer: number = 0;

  constructor(
    canvas: HTMLCanvasElement,
    initialPlan: MissionPlan,
    onHudUpdate: (snapshot: HudSnapshot) => void,
    onStateChange: (newState: GameState) => void
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context unavailable');
    this.ctx = context;

    // Offscreen Darkness & Dynamic Shadow Compositor
    this.l = document.createElement('canvas');
    const lCtx = this.l.getContext('2d');
    if (!lCtx) throw new Error('Offscreen light canvas context unavailable');
    this.lc = lCtx;

    this.plan = initialPlan;
    this.onHudUpdate = onHudUpdate;
    this.onStateChange = onStateChange;

    for (let i = 0; i < 110; i++) {
      this.rainDrops.push({
        x: Math.random() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT,
        len: 12 + Math.random() * 14,
        speed: 380 + Math.random() * 160,
      });
    }

    try {
      const savedXp = window.localStorage.getItem('eko_cobra_career_xp');
      if (savedXp) {
        const parsed = parseInt(savedXp, 10);
        if (!Number.isNaN(parsed) && parsed >= 0) {
          this.baseCareerXp = parsed;
        }
      }
    } catch {
      // Ignore storage errors in sandboxed iframes
    }

    try {
      const savedBinds = window.localStorage.getItem('eko_cobra_keybinds');
      // Un JSON corrupto o manipulado no debe dejar acciones sin tecla: se normaliza.
      if (savedBinds) this.keybinds = sanitizeKeybinds(savedBinds);
    } catch {
      // ignore
    }

    this.resetMission(initialPlan);
  }

  public resetMission(newPlan?: MissionPlan) {
    this.staticScene = undefined;
    if (newPlan) {
      this.plan = newPlan;
      if (newPlan.operationId) {
        this.missionMode = newPlan.operationId;
        this.isTrainingMode = newPlan.operationId === 'TRAINING';
      }
    }
    const layout =
      this.missionMode === 'STATION'
        ? createStationLayout()
        : this.missionMode === 'LINZ'
          ? createLinzLayout()
          : this.missionMode === 'TIROL'
            ? createTirolLayout()
            : this.missionMode === 'SCHWECHAT'
              ? createViennaAirportLayout()
              : this.isTrainingMode
                ? createTrainingFacilityLayout()
                : createGrazApartmentLayout();
    this.rooms = layout.rooms;
    this.walls = layout.walls;
    this.doors = layout.doors;
    this.furniture = layout.furniture;
    this.wallSconces = layout.wallSconces;
    this.lightSwitches = this.createLightSwitches(this.wallSconces, this.rooms, this.walls);
    const rawActors =
      this.missionMode === 'STATION'
        ? createStationActors(this.plan)
        : this.missionMode === 'LINZ'
          ? createLinzActors(this.plan)
          : this.missionMode === 'TIROL'
            ? createTirolActors(this.plan)
            : this.missionMode === 'SCHWECHAT'
              ? createViennaAirportActors(this.plan)
              : this.isTrainingMode
                ? createTrainingActors(this.plan)
                : createGrazActors(this.plan);
    this.stationAlertScore = 0;
    this.noiseEvents = [];
    this.currentNoiseDb = this.missionMode === 'STATION' ? 24 : 18;
    this.currentVisibilityPct = 20;
    this.recentNoiseReason = 'Ambiente Silencioso';
    this.actors = rawActors.map((a) => ({
      ...a,
      speed: 0,
      animFrame: 0,
      animTimer: 0,
      alertLevel: a.role === 'PLAYER' || a.role === 'SQUAD' ? 'CALM' : 'READY',
      recoilTimer: 0,
      hitReactionTimer: 0,
      hitFlashTimer: 0,
      hitAngle: 0,
      lastHitType: 'BLOOD',
      spottedByThermal: false,
      visibleToSquad: false,
      biometricScanProgress: 0,
      identifiedByRadio: false,
      identifiedCameraSource: undefined,
      bodyHealth: {
        torso: 100,
        arms: 100,
        legs: 100,
        bleeding: false,
        woundsCount: 0,
      },
    }));
    this.traces = [];
    this.particles = [];
    this.decals = [];
    this.impactRings = [];
    this.impactPopups = [];
    this.shoutWaves = [];
    this.gadgets = [];
    this.evidenceList = [];
    this.pointLights = [];
    this.acousticIndicators = [];
    this.windowRainParticles = [];
    this.breachWindSources = [];
    this.exteriorBreachSurgeTimer = 0;
    this.criticalEvents = [];
    this.initExteriorWindowsAndAmbientDust();
    this.breachAction = undefined;
    this.c4.planting = undefined;
    this.c4.charges = [];
    this.c4WarningBeepTimer = 0;
    this.playerDarknessTimer = 0;
    this.lastPlayerShotTime = -999;
    this.playerHiddenInShadow = false;
    this.playerHitFlashTimer = 0;

    const weaponSpec = EKO_COBRA_WEAPONS[this.plan.primaryWeapon];
    const metrics = computeLoadoutMetrics(this.plan);

    this.activeTool = 'PRIMARY';
    this.ammoInMag = weaponSpec.magSize;
    this.magCount = weaponSpec.totalMags;
    this.reloadTimer = 0;
    this.taserCharges = metrics.totalTaser;
    this.gadgetCount = metrics.totalGadgets;
    this.ifakCount = this.plan.profile === 'BREACHER' ? 3 : 2;
    this.c4.count = this.plan.profile === 'BREACHER' ? 3 : 2;
    this.aimZoneMode = this.plan.profile === 'VERHANDLUNGSFUEHRER' ? 'EXTREMITIES' : 'TORSO';
    this.aimTremorOffset = 0;
    this.playerFatigue = 0;
    this.sprintModeToggled = false;
    this.currentMovementGait = 'RESTING';
    this.lastFatigueWarningTime = -999;
    this.bleedTickTimer = 0;
    this.fireCooldown = 0;
    this.armor = metrics.totalArmor;
    this.squadArmor = 100;
    this.squadFatigue = 0;
    this.squadMovementGait = 'RESTING';
    this.squadDoorCooldown = 0;
    this.squadDoorWarnCooldown = 0;
    this.squadDoorTargetId = undefined;
    this.squadBreachAction = undefined;
    this.squadSteerSide = 1;
    this.sessionXp = 0;
    this.tacticalWaypoint = undefined;
    this.tacticalMarkers = [];
    this.mirrorDoorId = null;
    this.thermalActive = false;
    this.flashlightOn = true;

    this.squadCommand = this.plan.squadOrderInitial;
    this.score = 0;
    this.lastRankTitle = undefined;
    this.lastRankStars = undefined;
    this.roeViolations = 0;
    this.elapsedSeconds = 0;
    this.roeEvents = [];
    this.missionOutcome = undefined;

    const player = this.getPlayer();
    if (player) {
      this.camX = player.x;
      this.camY = player.y;
    }
    this.simulacion = player
      ? crearPartidaDesdeMundo(
          this.missionMode,
          { paredes: this.walls, puertas: this.doors, muebles: this.furniture },
          { x: player.x, y: player.y },
          0
        )
      : null;

    const profileSpec = EKO_COBRA_PROFILES[this.plan.profile];
    const inspSpec = EKO_COBRA_INSPECTION_DEVICES[this.plan.inspectionDevice];

    this.radio.items = [
      {
        id: 'r0',
        speaker: 'LEITSTELLE GRAZ',
        text: `Perfil: ${profileSpec.nameDe}. Sensor: ${inspSpec.nameDe}. Strom im Gemeindebau unterbrochen (Dunkelheit).`,
        time: '22:14:02',
        tone: 'info',
      },
      {
        id: 'r1',
        speaker: 'KOBRA-1',
        text: `Waffenlicht aktiv [L]. Bereit an ${this.plan.entryPoint === 'HAUPTEINGANG_A' ? 'Tür A (Stiegenhaus)' : 'Tür B (Loggia)'}.`,
        time: '22:14:06',
        tone: 'ok',
      },
    ];

    this.emitHudSnapshot();
  }

  public startOperation(mode?: 'APARTMENT' | 'STATION' | 'LINZ' | 'TIROL' | 'SCHWECHAT', investigation: boolean = false) {
    if (mode) {
      this.missionMode = mode;
      this.plan.operationId = mode;
    }
    this.investigationMode = investigation;
    this.nightMode = false;
    this.isTrainingMode = false;
    this.resetMission(this.plan);
    this.aplicarEstado('START');
    soundEngine.startRainAmbience();
    soundEngine.startAmbientDrone();
    soundEngine.playTetraRadioTransmission('info', 46);
    this.radio.txTimer = 2.1;

    if (this.missionMode === 'TIROL') {
      this.pushRadio(
        'LEITSTELLE TIROL',
        'ATENCIÓN: Ventisca alpina (-11°C). Tirador Steyr SSG 08 en posición sobre cresta montañosa listo para apoyo.',
        'info'
      );
    } else if (this.missionMode === 'SCHWECHAT') {
      this.pushRadio(
        'LEITSTELLE SCHWECHAT',
        'ALERTA ROJA: Terminal VIP y Hangar 1 comprometidos. Coordine asalto quirúrgico para evitar impacto en depósitos de combustible.',
        'alert'
      );
    }

    // La doctrina dinámica no abre la entrada sola: la puerta sólo se rompe
    // cuando el operador o Kobra-2 ejecutan realmente una brecha en ella.
    this.onStateChange(this.gameState);
    this.emitHudSnapshot();
  }

  public startStationOperation() {
    this.missionMode = 'STATION';
    this.plan.operationId = 'STATION';
    this.startOperation('STATION');
  }

  public startNightStationOperation() {
    this.missionMode = 'STATION';
    this.plan.operationId = 'STATION';
    this.startOperation('STATION');
    this.nightMode = true;
  }

  public startMetroOperation() {
    this.missionMode = 'STATION';
    this.plan.operationId = 'STATION';
    this.startOperation('STATION');
    this.pushRadio(
      'LEITSTELLE WIEN',
      'ALERTA: Incidente en estación de metro U3. Sospechosos armados en andén y túneles. Evacuación en curso.',
      'alert'
    );
  }

  public startApartmentOperation() {
    this.missionMode = 'APARTMENT';
    this.plan.operationId = 'APARTMENT';
    this.startOperation('APARTMENT');
  }

  public startInvestigationOperation() {
    this.missionMode = 'APARTMENT';
    this.plan.operationId = 'APARTMENT';
    this.startOperation('APARTMENT', true);
  }

  public startLinzOperation() {
    this.missionMode = 'LINZ';
    this.plan.operationId = 'LINZ';
    this.startOperation('LINZ');
  }

  public startTirolOperation() {
    this.missionMode = 'TIROL';
    this.plan.operationId = 'TIROL';
    this.startOperation('TIROL');
  }

  public startSchwechatOperation() {
    this.missionMode = 'SCHWECHAT';
    this.plan.operationId = 'SCHWECHAT';
    this.startOperation('SCHWECHAT');
  }

  public startTrainingRange() {
    this.isTrainingMode = true;
    this.trainingShotsFired = 0;
    this.trainingTargetsHit = 0;
    this.peakRecordedShake = 0;
    this.lastTrainingHitZone = undefined;
    this.lastTrainingTargetName = undefined;
    this.lastTrainingEnergy = undefined;
    this.trainingDoorResetTimer = 0;
    this.resetMission(this.plan);
    this.aplicarEstado('START');
    this.ammoInMag = EKO_COBRA_WEAPONS[this.plan.primaryWeapon].magSize;
    this.magCount = 99;
    soundEngine.startRainAmbience();
    soundEngine.startAmbientDrone();
    soundEngine.playUiClick();
    this.pushRadio(
      'LEITSTELLE',
      'Galería de tiro táctica DSE Cobra activa. Fuego libre para comprobar balística y sacudida de retroceso.',
      'ok'
    );
    this.onStateChange(this.gameState);
    this.emitHudSnapshot();
  }

  public switchTrainingWeapon(weaponId: PrimaryWeaponId) {
    this.plan.primaryWeapon = weaponId;
    const spec = EKO_COBRA_WEAPONS[weaponId];
    this.ammoInMag = spec.magSize;
    this.magCount = 99;
    this.fireCooldown = 0.08;
    soundEngine.playUiClick();
    this.pushRadio(
      'KOBRA-1',
      `Arma de prueba equipada: ${spec.name} (${spec.caliber} · ${spec.rpm} RPM)`,
      'info'
    );
    this.emitHudSnapshot();
  }

  public triggerTrainingDoorBreach(mode: 'KICK' | 'RAM' | 'C4') {
    const door = this.doors.find((d) => d.id === 'TRAINING_DOOR');
    if (!door || door.isOpen) return;
    if (mode === 'C4') {
      this.c4.beginPlant({
        targetName: door.name,
        x: (door.x1 + door.x2) / 2,
        y: (door.y1 + door.y2) / 2,
        doorId: door.id,
        isWindow: false,
      }, this.c4Dependencies);
      return;
    }
    this.initiateBreach(door, mode);
  }

  public replayRadioMessage(item: {
    speaker: string;
    text: string;
    tone: 'info' | 'warn' | 'alert' | 'ok';
    silent?: boolean;
  }) {
    if (item.silent) {
      soundEngine.playTetraStaticBurst(0.35, 0.12);
      this.radio.txTimer = 0.35;
      this.emitHudSnapshot();
      return;
    }
    if (!soundEngine.isRadioAudioEnabled()) {
      this.emitHudSnapshot();
      return;
    }
    // La repetición reemite sólo la textura TETRA; el mensaje sigue siendo texto.
    soundEngine.playTetraRadioTransmission(item.tone, item.text.length);
    this.radio.txTimer = 1.95;
    if (item.tone === 'alert' || item.tone === 'warn') {
      this.radio.staticTimer = 0.75;
    }
    this.emitHudSnapshot();
  }

  public toggleFlashlight() {
    this.flashlightOn = !this.flashlightOn;
    soundEngine.playOpticCam();
    this.pushRadio(
      'KOBRA-1',
      this.flashlightOn
        ? 'Taktisches Waffenlicht eingeschaltet (1000 Lumen).'
        : 'Waffenlicht ausgeschaltet (Schleichmodus).',
      'info',
      { silent: true }
    );
    this.emitHudSnapshot();
  }

  public toggleNightVision() {
    this.nvgActive = !this.nvgActive;
    if (this.nvgActive) {
      this.nvgWarmupTimer = 0.32;
    }
    soundEngine.playNvgToggle(this.nvgActive);
    this.pushRadio(
      'KOBRA-1',
      this.nvgActive
        ? 'Nachtsichtgerät (GPNVG-18 Gen-3 Phosphor) aktiv — Restlichtverstärkung & Kontrast im Dunkeln erhöht.'
        : 'Nachtsichtgerät hochgeklappt (Normaler Sichtmodus).',
      this.nvgActive ? 'ok' : 'info',
      { silent: true }
    );
    this.emitHudSnapshot();
  }

  public togglePlayerStance() {
    this.playerStance = this.playerStance === 'PARADO' ? 'AGACHADO' : 'PARADO';
    const player = this.getPlayer();
    if (player) {
      player.isCrouched = this.playerStance === 'AGACHADO';
    }
    soundEngine.playOpticCam();
    this.pushRadio(
      'KOBRA-1',
      this.playerStance === 'AGACHADO'
        ? 'Postura: Agachado (Menor perfil balístico, mayor estabilidad)'
        : 'Postura: Parado (Desplazamiento táctico estándar)',
      'ok',
      { silent: true }
    );
    this.emitHudSnapshot();
  }

  public setNvgKeyCode(code: string) {
    if (!code) return;
    this.nvgKeyCode = code;
    this.emitHudSnapshot();
  }

  public setKeybind(action: string, code: string) {
    if (!code) return;
    if (!KEYBIND_ACTIONS.has(action)) return;
    this.keybinds[action] = code;
    try {
      window.localStorage.setItem('eko_cobra_keybinds', JSON.stringify(this.keybinds));
    } catch {
      // ignore
    }
    this.emitHudSnapshot();
  }

  public resetKeybinds() {
    this.keybinds = { ...DEFAULT_KEYBINDS };
    try {
      window.localStorage.setItem('eko_cobra_keybinds', JSON.stringify(this.keybinds));
    } catch {
      // ignore
    }
    this.emitHudSnapshot();
  }

  public isFocusedAiming(): boolean {
    return (
      this.heldKeys.has(this.keybinds.stance) ||
      this.heldKeys.has('AltLeft') ||
      this.heldKeys.has('AltRight') ||
      this.heldKeys.has('ControlLeft') ||
      this.heldKeys.has('ControlRight')
    );
  }

  public clearHeldKeys() {
    this.heldKeys.clear();
  }

  public randomizeBattlemapProps() {
    battlemapAssetCache.ensureLoaded();
    const layout = this.isTrainingMode
      ? createTrainingFacilityLayout()
      : createGrazApartmentLayout();
    this.furniture = layout.furniture;
    soundEngine.playUiClick();
    this.pushRadio(
      'LEITSTELLE GRAZ',
      'Reconocimiento interior actualizado: disposición aleatoria de mobiliario y objetos tácticos regenerada.',
      'info'
    );
    this.emitHudSnapshot();
  }

  public handleKeyDown(code: string) {
    const wasFocused = this.isFocusedAiming();
    this.heldKeys.add(code);
    if (!wasFocused && this.isFocusedAiming() && this.gameState === 'PLAYING') {
      soundEngine.playUiClick();
      this.emitHudSnapshot();
    }

    if (this.gameState === 'TITLE') {
      if (code === 'Enter' || code === this.keybinds.policeShout) {
        this.startOperation();
      }
      return;
    }

    if (code === 'Escape') {
      if (this.grenadeAimingActive) {
        this.cancelGrenadeAiming();
        return;
      }
      if (this.gameState === 'PLAYING') {
        this.cambiarEstado('PAUSE');
        this.emitHudSnapshot();
      } else if (this.gameState === 'PAUSED') {
        this.cambiarEstado('RESUME');
        this.emitHudSnapshot();
      }
      return;
    }

    if (this.gameState !== 'PLAYING') return;

    if (code === this.keybinds.policeShout) {
      this.triggerPoliceShout();
    } else if (code === this.keybinds.interact) {
      this.handleContextualInteract();
    } else if (code === this.keybinds.breachKick) {
      this.handleDoorBreachKick();
    } else if (code === this.keybinds.breachC4) {
      this.handleDoorBreachC4();
    } else if (code === this.keybinds.breachRam) {
      this.handleDoorBreachRam();
    } else if (code === this.keybinds.inspect) {
      this.toggleInspectionDevice();
    } else if (code === this.keybinds.gadget) {
      this.throwTacticalGadget();
    } else if (code === this.keybinds.toolTaser) {
      this.activeTool = this.activeTool === 'TASER' ? 'PRIMARY' : 'TASER';
      soundEngine.playOpticCam();
      this.emitHudSnapshot();
    } else if (code === this.keybinds.flashlight) {
      this.toggleFlashlight();
    } else if (code === this.nvgKeyCode) {
      this.toggleNightVision();
    } else if (code === this.keybinds.ifak) {
      this.applyIfakTreatment();
    } else if (code === this.keybinds.aimZone) {
      this.toggleAimZoneMode();
    } else if (code === this.keybinds.stance) {
      this.togglePlayerStance();
    } else if (code === 'KeyY') {
      // KeyY is now handled by the Voice Command system in App.tsx
    } else if (code === this.keybinds.thermalPalette) {
      if (this.thermalActive && this.plan.inspectionDevice === 'THERMAL_CAM') {
        this.cycleThermalPaletteMode();
      }
    } else if (code === this.keybinds.biometric) {
      this.triggerBiometricRadioId();
    } else if (code === this.keybinds.interrogate) {
      this.triggerSuspectInterrogation();
    } else if (code === this.keybinds.reload) {
      this.reloadWeapon();
    } else if (code === this.keybinds.clearBlastArea) {
      this.orderBlastAreaClear();
    } else if (code === this.keybinds.squad1) {
      if (this.isTrainingMode) {
        this.switchTrainingWeapon('AUG_A3');
      } else {
        this.issueSquadCommand('FOLLOW');
      }
    } else if (code === this.keybinds.squad2) {
      if (this.isTrainingMode) {
        this.switchTrainingWeapon('AUG_PARA');
      } else {
        this.issueSquadCommand('HOLD');
      }
    } else if (code === this.keybinds.squad3) {
      if (this.isTrainingMode) {
        this.switchTrainingWeapon('MP7A1');
      } else {
        this.issueSquadCommand('BREACH_AND_CLEAR');
      }
    } else if (code === this.keybinds.squad4) {
      if (this.isTrainingMode) {
        this.switchTrainingWeapon('GLOCK_SHIELD');
      } else {
        this.issueSquadCommand('PIE_DOOR');
      }
    } else if (code === this.keybinds.squad5) {
      this.issueSquadCommand('DEPLOY_CS_GAS');
    } else if (code === this.keybinds.squad6) {
      this.issueSquadCommand('RESTRAIN_AND_SECURE');
    } else if (code === this.keybinds.squad7) {
      this.issueSquadCommand('SUPPRESS_TARGET');
    } else if (code === this.keybinds.squad8) {
      this.issueSquadCommand('REGROUP_HEAL');
    } else if (code === 'Digit9') {
      this.issueSquadCommand('FORM_WEDGE');
    } else if (code === 'Digit0') {
      this.issueSquadCommand('FORM_STAGGERED');
    }
  }

  public addTacticalMarker(
    x: number,
    y: number,
    type: TacticalMarkerType = 'HOSTILE',
    customLabel?: string
  ) {
    const clampedX = Math.max(90, Math.min(WORLD_WIDTH - 90, Math.round(x)));
    const clampedY = Math.max(70, Math.min(WORLD_HEIGHT - 70, Math.round(y)));

    // If clicking very close to an existing marker, remove it (toggle behavior)
    const existingIdx = this.tacticalMarkers.findIndex(
      (m) => Math.hypot(m.x - clampedX, m.y - clampedY) < 26
    );
    if (existingIdx !== -1 && !customLabel) {
      const removed = this.tacticalMarkers[existingIdx];
      this.tacticalMarkers.splice(existingIdx, 1);
      soundEngine.playUiClick();
      this.pushRadio(
        'KOBRA-1',
        `EKO-Pad C4I: Marcador [${removed.label}] eliminado de ${removed.roomName}.`,
        'info'
      );
      this.emitHudSnapshot();
      return;
    }

    const roomId = this.getRoomAt(clampedX, clampedY);
    const roomObj = this.rooms.find((r) => r.id === roomId);
    const roomName = roomObj ? roomObj.nameDe : 'EXTERIOR';

    const defaultLabels: Record<TacticalMarkerType, string> = {
      HOSTILE: 'HOSTIL DETECTADO',
      BREACH_ZONE: 'ZONA DE BRECHA',
      RALLY_POINT: 'PUNTO DE AVANCE',
      OBSERVE_SECTOR: 'VIGILAR SECTOR',
      EVIDENCE_LOC: 'ASEGURAR EVIDENCIA',
      DANGER_AREA: 'SECTOR PELIGROSO',
      CLEAR_SECTOR: 'SECTOR DESPEJADO',
    };
    const label = customLabel || defaultLabels[type];
    const duration = type === 'CLEAR_SECTOR' ? 60 : 45;

    const newMarker: TacticalMapMarker = {
      id: `m-${Date.now()}-${Math.floor(Math.random() * 999)}`,
      type,
      label,
      roomName,
      x: clampedX,
      y: clampedY,
      remainingSeconds: duration,
      maxSeconds: duration,
    };

    // Keep up to 6 active tactical markers
    this.tacticalMarkers = [newMarker, ...this.tacticalMarkers.slice(0, 5)];

    const squad = this.getSquadmate();
    if (type === 'RALLY_POINT' || type === 'BREACH_ZONE') {
      this.tacticalWaypoint = {
        x: clampedX,
        y: clampedY,
        label: `${label} (${roomName})`,
      };
      if (squad && squad.state !== 'DEAD') {
        squad.speechBubble = {
          text:
            type === 'BREACH_ZONE'
              ? `¡Recibido! Me posiciono en zona de brecha (${roomName}).`
              : `¡Copiado! Avanzando a ${roomName}.`,
          timer: 2.2,
          type: 'COMMAND',
        };
      }
    } else if (type === 'HOSTILE' && squad && squad.state !== 'DEAD') {
      squad.alertLevel = 'COMBAT';
      squad.angle = Math.atan2(clampedY - squad.y, clampedX - squad.x);
      squad.speechBubble = {
        text: `¡Hostil marcado en ${roomName}! Cubriendo línea de fuego.`,
        timer: 2.2,
        type: 'COMMAND',
      };
    }

    soundEngine.playOpticCam();
    this.pushRadio(
      'EKO-PAD C4I',
      `Marcador temporal [${label}] fijado en ${roomName} (${duration}s) — visible para Kobra-1 y Kobra-2.`,
      type === 'HOSTILE' || type === 'DANGER_AREA' ? 'warn' : 'info'
    );
    this.emitHudSnapshot();
  }

  public removeTacticalMarker(markerId: string) {
    this.tacticalMarkers = this.tacticalMarkers.filter((m) => m.id !== markerId);
    soundEngine.playUiClick();
    this.emitHudSnapshot();
  }

  public clearTacticalMarkers() {
    this.tacticalMarkers = [];
    this.tacticalWaypoint = undefined;
    soundEngine.playOpticCam();
    this.pushRadio('EKO-PAD C4I', 'Todos los marcadores tácticos temporales borrados.', 'info');
    this.emitHudSnapshot();
  }

  public clearTacticalWaypoint() {
    this.tacticalWaypoint = undefined;
    soundEngine.playOpticCam();
    this.emitHudSnapshot();
  }

  public triggerBiometricRadioId(specificActorId?: string) {
    const player = this.getPlayer();
    if (!player || player.state === 'DEAD') return;

    // Find best candidate for biometric facial identification via agent cameras (Kobra-1, Kobra-2, or Optical Cam)
    let candidate: ActorEntity | undefined;

    if (specificActorId) {
      candidate = this.actors.find(
        (a) =>
          a.id === specificActorId &&
          a.role !== 'PLAYER' &&
          a.role !== 'SQUAD' &&
          !a.identifiedByRadio &&
          (a.visibleToPlayer || a.visibleToSquad || a.spottedByMirror || (a.biometricScanProgress ?? 0) > 0)
      );
    }

    if (!candidate) {
      const candidates = this.actors.filter(
        (a) =>
          a.role !== 'PLAYER' &&
          a.role !== 'SQUAD' &&
          !a.identifiedByRadio &&
          (a.visibleToPlayer || a.visibleToSquad || a.spottedByMirror || (a.biometricScanProgress ?? 0) >= 20)
      );

      // Sort by highest scan progress and proximity to player's aim line
      candidates.sort((a, b) => {
        const angA = Math.abs(
          this.normalizeAngle(Math.atan2(a.y - player.y, a.x - player.x) - player.angle)
        );
        const angB = Math.abs(
          this.normalizeAngle(Math.atan2(b.y - player.y, b.x - player.x) - player.angle)
        );
        const scoreA = (a.biometricScanProgress ?? 0) * 1.5 - angA * 80;
        const scoreB = (b.biometricScanProgress ?? 0) * 1.5 - angB * 80;
        return scoreB - scoreA;
      });

      candidate = candidates[0];
    }

    if (!candidate) {
      this.pushRadio(
        'EKIS-BIOMETRIE',
        'Kein unidentifiziertes Ziel im Kamerabild (Kobra-1 / Kobra-2 / Optik-Sonde [Q]).',
        'warn'
      );
      this.emitHudSnapshot();
      return;
    }

    candidate.biometricScanProgress = 100;
    candidate.identifiedByRadio = true;

    const camSource =
      candidate.identifiedCameraSource ||
      (candidate.visibleToPlayer
        ? 'KOBRA-1 HELMKAMERA'
        : candidate.visibleToSquad
          ? 'KOBRA-2 HELMKAMERA'
          : 'OPTIK-SONDE [Q]');
    candidate.identifiedCameraSource = camSource;

    const bio = candidate.biometricProfile;
    const isHostile = candidate.role === 'SUSPECT';
    soundEngine.playBiometricLock(isHostile);
    soundEngine.playRadioEcho();

    const speaker = camSource.startsWith('KOBRA-2') ? 'KOBRA-2' : 'KOBRA-1';

    if (isHostile) {
      const roePts = 90;
      const ekisTag = bio ? `${bio.ekisCode} (${bio.facialMatchPct}% Match)` : 'EKIS-TREFFER';
      const weaponInfo = candidate.isArmed
        ? `bewaffnet (${candidate.weaponLabel || 'Kurzwaffe'})`
        : 'unbewaffnet';

      this.recordRoeEvent(
        `Identificación biométrica hostil en radio: ${candidate.name} [${bio?.ekisCode || 'EKIS'}]`,
        roePts,
        true
      );
      this.pushRadio(
        speaker,
        `FUNK-ID [${camSource}]: Feindziel identifiziert — ${candidate.name} · ${ekisTag}, ${weaponInfo} in ${candidate.roomName}!`,
        'alert'
      );

      // Psychological pressure on suspect when laser/camera designated and called out over radio
      if (candidate.state !== 'DEAD' && candidate.state !== 'ARRESTED') {
        candidate.morale = Math.max(0, candidate.morale - 12);
      }

      this.impactPopups.push({
        x: candidate.x,
        y: candidate.y - candidate.radius - 22,
        text: `📡 ID HOSTIL CONFIRMADA (+${roePts} ROE)`,
        color: '#F59E0B',
        life: 1.45,
        maxLife: 1.45,
        vy: -24,
      });
      this.impactRings.push({
        x: candidate.x,
        y: candidate.y,
        radius: 6,
        maxRadius: 34,
        color: '#EF4444',
        alpha: 0.95,
      });
    } else {
      const roePts = 75;
      const zmrTag = bio ? `${bio.ekisCode} (${bio.facialMatchPct}% Match)` : 'ZMR-TREFFER';

      this.recordRoeEvent(
        `Identificación positiva de rehén/civil en radio: ${candidate.name} [${bio?.ekisCode || 'ZMR'}]`,
        roePts,
        true
      );
      this.pushRadio(
        speaker,
        `FUNK-ID [${camSource}]: Schutzperson positiv identifiziert — ${candidate.name} · ${zmrTag} in ${candidate.roomName}. Feuerdisziplin!`,
        'ok'
      );

      this.impactPopups.push({
        x: candidate.x,
        y: candidate.y - candidate.radius - 22,
        text: `📡 ID REHÉN CONFIRMADA (+${roePts} ROE)`,
        color: '#38BDF8',
        life: 1.45,
        maxLife: 1.45,
        vy: -24,
      });
      this.impactRings.push({
        x: candidate.x,
        y: candidate.y,
        radius: 6,
        maxRadius: 34,
        color: '#38BDF8',
        alpha: 0.95,
      });
    }

    player.speechBubble = {
      text: isHostile
        ? `Leitstelle: Zielperson ${candidate.name.split(' ')[0]} per Kamera identifiziert!`
        : `Leitstelle: Geisel ${candidate.name.split(' ')[0]} positiv identifiziert!`,
      timer: 2.1,
      type: 'COMMAND',
    };

    this.emitHudSnapshot();
  }

  public toggleAimZoneMode() {
    this.aimZoneMode = this.aimZoneMode === 'TORSO' ? 'EXTREMITIES' : 'TORSO';
    this.modeSwitchPulseTimer = 0.75;
    soundEngine.playOpticCam();
    this.pushRadio(
      'KOBRA-1',
      this.aimZoneMode === 'EXTREMITIES'
        ? 'Zielpunkt-Wahl: EXTREMITÄTEN (Beine/Waffenarm — Nicht-tödliche Kampfunfähigkeit §7 WVG).'
        : 'Zielpunkt-Wahl: TORSO (Körpermitte / Plattenträger).',
      'info',
      { silent: true }
    );
    this.emitHudSnapshot();
  }

  public applyIfakTreatment() {
    const player = this.getPlayer();
    if (!player || player.state === 'DEAD' || !player.bodyHealth) return;

    const bh = player.bodyHealth;
    const isPlayerInjured =
      bh.bleeding || bh.torso < 100 || bh.arms < 100 || bh.legs < 100 || player.hp < 100;
    const squad = this.getSquadmate();
    const sqBh = squad?.bodyHealth;
    const isSquadInjured =
      squad &&
      squad.state !== 'DEAD' &&
      (squad.hp < 100 ||
        (sqBh && (sqBh.bleeding || sqBh.torso < 100 || sqBh.arms < 100 || sqBh.legs < 100)));

    if (!isPlayerInjured && !isSquadInjured) {
      this.pushRadio('KOBRA-1', 'Keine offenen Verwundungen bei Kobra-1 oder Kobra-2.', 'info');
      return;
    }

    if (this.ifakCount <= 0) {
      this.pushRadio('KOBRA-1', 'Keine IFAK / CAT-Tourniquets mehr verfügbar!', 'warn');
      return;
    }

    this.ifakCount -= 1;

    if (isPlayerInjured) {
      bh.bleeding = false;
      bh.woundsCount = 0;
      bh.torso = Math.min(100, bh.torso + 34);
      bh.arms = Math.min(100, bh.arms + 42);
      bh.legs = Math.min(100, bh.legs + 42);
      player.hp = Math.min(player.maxHp, player.hp + 20);
      this.playerFatigue = Math.max(0, this.playerFatigue - 18);
    }

    if (isSquadInjured && squad && sqBh) {
      sqBh.bleeding = false;
      sqBh.woundsCount = 0;
      sqBh.torso = Math.min(100, sqBh.torso + 36);
      sqBh.arms = Math.min(100, sqBh.arms + 42);
      sqBh.legs = Math.min(100, sqBh.legs + 42);
      squad.hp = Math.min(squad.maxHp, squad.hp + 25);
      this.squadFatigue = Math.max(0, this.squadFatigue - 20);
    }

    soundEngine.playArrestCuffs();
    player.speechBubble = {
      text: 'CAT-Tourniquet & QuikClot angelegt!',
      timer: 2.0,
      type: 'COMMAND',
    };
    this.pushRadio(
      'KOBRA-1',
      'IFAK / CAT-Tourniquet angelegt. Blutung gestoppt, Vitalwerte stabilisiert.',
      'ok'
    );
    this.emitHudSnapshot();
  }

  public handleKeyUp(code: string) {
    const wasFocused = this.isFocusedAiming();
    this.heldKeys.delete(code);
    if (wasFocused && !this.isFocusedAiming() && this.gameState === 'PLAYING') {
      this.emitHudSnapshot();
    }
  }

  public handleMouseMove(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseScreen.x = clientX - rect.left;
    this.mouseScreen.y = clientY - rect.top;

    if (this.isDraggingMinimap) {
      this.minimapCenter.x = this.mouseScreen.x - this.minimapDragOffset.x;
      this.minimapCenter.y = this.mouseScreen.y - this.minimapDragOffset.y;

      // Clamp to screen
      this.minimapCenter.x = Math.max(60, Math.min(this.viewWidth - 60, this.minimapCenter.x));
      this.minimapCenter.y = Math.max(60, Math.min(this.viewHeight - 60, this.minimapCenter.y));
    }
  }

  public handleMouseDown(button: number) {
    if (this.gameState !== 'PLAYING') return;

    if (this.grenadeAimingActive) {
      if (button === 0) {
        // Left click confirms and throws the grenade!
        this.executeGrenadeThrow();
        return;
      } else if (button === 2) {
        // Right click cancels grenade aiming
        this.cancelGrenadeAiming();
        return;
      }
    }

    const halfSize = 58;
    const inMinimap =
      Math.abs(this.mouseScreen.x - this.minimapCenter.x) <= halfSize &&
      Math.abs(this.mouseScreen.y - this.minimapCenter.y) <= halfSize;
    if (inMinimap) {
      this.isDraggingMinimap = true;
      this.minimapDragOffset.x = this.mouseScreen.x - this.minimapCenter.x;
      this.minimapDragOffset.y = this.mouseScreen.y - this.minimapCenter.y;
      return;
    }

    if (button === 0) {
      this.fireActiveWeapon();
    }
    // Note: Right click (button === 2) opens the tactical squad orders context menu in App.tsx
  }

  /** Botón derecho con movimiento real: sólo entonces se dibuja la guía de arrastre. */
  public isRightDragging: boolean = false;
  /**
   * Botón derecho abajo sin haberse movido todavía.
   *
   * Un clic no es un arrastre, y confundirlos rompía el menú de puerta en Linux:
   * ahí el `contextmenu` llega entre el `mousedown` y el `mouseup`, así que marcar
   * `isRightDragging` al presionar hacía que App.tsx descartara el menú siempre.
   */
  private rightClickPending: boolean = false;
  /** Umbral en píxeles de mundo para distinguir un clic de un arrastre. */
  private static readonly RIGHT_DRAG_THRESHOLD = 8;
  public rightClickDragStart: Vec2 = { x: 0, y: 0 };
  public rightClickDragCurrent: Vec2 = { x: 0, y: 0 };

  public startRightClickDrag(clientX: number, clientY: number) {
    if (this.gameState !== 'PLAYING') return;
    const worldPos = this.screenToWorld(clientX, clientY);
    this.rightClickPending = true;
    this.isRightDragging = false;
    this.rightClickDragStart = worldPos;
    this.rightClickDragCurrent = worldPos;
  }

  public updateRightClickDrag(clientX: number, clientY: number) {
    if (!this.rightClickPending) return;
    const worldPos = this.screenToWorld(clientX, clientY);
    this.rightClickDragCurrent = worldPos;
    if (
      Math.hypot(
        worldPos.x - this.rightClickDragStart.x,
        worldPos.y - this.rightClickDragStart.y
      ) > TacticalEngineCore.RIGHT_DRAG_THRESHOLD
    ) {
      this.isRightDragging = true;
    }
  }

  public completeRightClickDrag() {
    if (!this.isRightDragging) return;
    this.isRightDragging = false;

    const dist = Math.hypot(
      this.rightClickDragCurrent.x - this.rightClickDragStart.x,
      this.rightClickDragCurrent.y - this.rightClickDragStart.y
    );

    const squad = this.getSquadmate();
    if (squad) {
      squad.investigateTarget = { x: this.rightClickDragStart.x, y: this.rightClickDragStart.y };
      this.tacticalWaypoint = {
        x: Math.round(this.rightClickDragStart.x),
        y: Math.round(this.rightClickDragStart.y),
        label: 'Ocupar Posición y Proteger Área',
      };

      if (dist > 8) {
        squad.targetFacingAngle = Math.atan2(
          this.rightClickDragCurrent.y - this.rightClickDragStart.y,
          this.rightClickDragCurrent.x - this.rightClickDragStart.x
        );
      } else {
        const player = this.getPlayer();
        if (player) {
          squad.targetFacingAngle = Math.atan2(player.y - this.rightClickDragStart.y, player.x - this.rightClickDragStart.x);
        }
      }

      squad.speechBubble = { text: 'Ocupando posición y cubriendo sector!', timer: 2.4, type: 'COMMAND' };
      this.squadCommand = 'HOLD';
      soundEngine.playUiClick();
      this.pushRadio('KOBRA-2', '[*] Ocupando posición designada y protegiendo área con ángulo de cobertura asignado.', 'ok');
    }
  }

  public handleMouseUp() {
    this.isDraggingMinimap = false;
    this.isRightDragging = false;
    this.rightClickPending = false;
  }

  protected touchActive: boolean = false;

  public handleTouchStart(clientX: number, clientY: number) {
    this.handleMouseMove(clientX, clientY);
    this.touchActive = true;
    const player = this.getPlayer();
    if (!player || player.state === 'DEAD') return;
    const worldPos = this.screenToWorld(this.mouseScreen.x, this.mouseScreen.y);

    const dist = Math.hypot(worldPos.x - player.x, worldPos.y - player.y);
    if (dist < 90) {
      this.handleContextualInteract();
    } else {
      this.fireActiveWeapon();
    }
  }

  public handleTouchMove(clientX: number, clientY: number) {
    this.handleMouseMove(clientX, clientY);
    if (this.touchActive) {
      const worldPos = this.screenToWorld(this.mouseScreen.x, this.mouseScreen.y);
      const player = this.getPlayer();
      if (player) {
        const dx = worldPos.x - player.x;
        const dy = worldPos.y - player.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 35) {
          this.touchMoveX = Math.sign(dx);
          this.touchMoveY = Math.sign(dy);
        } else {
          this.touchMoveX = 0;
          this.touchMoveY = 0;
        }
      }
    }
  }

  public handleTouchEnd() {
    this.touchActive = false;
    this.touchMoveX = 0;
    this.touchMoveY = 0;
    this.isDraggingMinimap = false;
  }

  protected getPlayer(): ActorEntity | undefined {
    return this.actors.find((a) => a.role === 'PLAYER');
  }

  protected getSquadmate(): ActorEntity | undefined {
    return this.actors.find((a) => a.role === 'SQUAD');
  }

  protected pushRadio(
    speaker: string,
    text: string,
    tone: 'info' | 'warn' | 'alert' | 'ok' = 'info',
    options: { silent?: boolean } = {}
  ) {
    this.radio.push(speaker, text, tone, options, {
      gameState: this.gameState,
      emitHudSnapshot: () => this.emitHudSnapshot(),
    });
  }

  protected awardOperatorXp(xpAmount: number, reason?: string) {
    if (xpAmount <= 0) return;
    this.sessionXp += xpAmount;
    const newTotal = this.baseCareerXp + this.sessionXp;
    try {
      window.localStorage.setItem('eko_cobra_career_xp', String(newTotal));
    } catch {
      // Ignore storage errors
    }
    const player = this.getPlayer();
    if (player && reason) {
      this.impactPopups.push({
        x: player.x + (Math.random() - 0.5) * 18,
        y: player.y - player.radius - 26,
        vy: -22,
        text: `+${xpAmount} XP · ${reason}`,
        color: '#38BDF8',
        life: 1.2,
        maxLife: 1.2,
      });
    }
  }

  protected logCriticalEvent(
    type: CriticalEventType,
    title: string,
    location: string,
    severity: 'INFO' | 'SUCCESS' | 'WARN' | 'VIOLATION',
    options?: {
      actorName?: string;
      pointsDelta?: number;
      lawful?: boolean;
      details?: string;
    }
  ) {
    const elapsed = Math.max(0, Math.floor(this.elapsedSeconds));
    const m = Math.floor(elapsed / 60)
      .toString()
      .padStart(2, '0');
    const s = (elapsed % 60).toString().padStart(2, '0');
    const timeStr = `${m}:${s}`;

    const entry: CriticalEventLogEntry = {
      id: `ev_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
      timeStr,
      elapsedSeconds: elapsed,
      type,
      title,
      location,
      actorName: options?.actorName,
      pointsDelta: options?.pointsDelta,
      lawful: options?.lawful,
      severity,
      details: options?.details || title,
    };

    this.criticalEvents = [entry, ...this.criticalEvents.slice(0, 75)];
  }

  protected recordRoeEvent(label: string, points: number, lawful: boolean) {
    const impact = computeRoeImpact({ points, lawful });
    this.score += impact.scoreDelta;
    if (impact.isViolation) {
      this.roeViolations += 1;
      soundEngine.playRoePenalty();
    } else if (impact.xpAward > 0) {
      this.awardOperatorXp(impact.xpAward, 'ROE');
    }
    this.roeEvents = [
      {
        id: `${Date.now()}_${Math.random()}`,
        timestamp: this.elapsedSeconds,
        label,
        points,
        lawful,
      },
      ...this.roeEvents.slice(0, 7),
    ];

    const player = this.getPlayer();
    const currentRoomName = player ? this.getRoomAt(player.x, player.y) : 'GRAZ-LEND';
    this.logCriticalEvent(
      lawful ? 'ROE_REWARD' : 'ROE_VIOLATION',
      lawful ? `Auditoría ROE: ${label}` : `Infracción WVG §7: ${label}`,
      currentRoomName,
      lawful ? 'SUCCESS' : 'VIOLATION',
      {
        pointsDelta: points,
        lawful,
        details: `${label} (${points >= 0 ? '+' : ''}${points} PTS)`,
      }
    );
  }

  public emitNoise(
    x: number,
    y: number,
    dB: number,
    radius: number,
    source: string,
    color?: string
  ) {
    this.currentNoiseDb = Math.max(this.currentNoiseDb, dB);
    this.recentNoiseReason = source;
    this.noiseEvents.push({
      id: `noise_${Date.now()}_${Math.random()}`,
      x,
      y,
      dB,
      radius,
      source,
      timer: 1.25,
      maxTimer: 1.25,
      color: color || '#38BDF8',
    });

    // Check acoustic perception for each suspect
    for (const actor of this.actors) {
      if (
        actor.role !== 'SUSPECT' ||
        actor.state === 'DEAD' ||
        actor.state === 'ARRESTED' ||
        actor.state === 'INCAPACITATED'
      )
        continue;

      const dist = Math.hypot(actor.x - x, actor.y - y);
      const hasLOS = !this.raycastWallsAndDoors(actor.x, actor.y, x, y);
      // Walls and closed doors attenuate noise perception by ~35%
      const effectiveRadius = hasLOS ? radius : radius * 0.65;
      if (dist <= effectiveRadius) {
        actor.lastHeardNoiseDesc = source;
        if (dB >= 75) {
          // Violent/high-decibel sound: immediate alert & investigation
          actor.suspicionMeter = 100;
          actor.state = 'ALERTED';
          actor.investigateTarget = { x, y };
          actor.investigateTimer = 7.5;
          actor.angle = Math.atan2(y - actor.y, x - actor.x);
          this.stationAlertScore = Math.min(100, this.stationAlertScore + (dB >= 120 ? 25 : 15));
          if (!actor.speechBubble) {
            const loudAlarms = [
              '¡DISPAROS O EXPLOSIÓN! ¡A LAS ARMAS!',
              '¡Estruendo en el sector! ¡Cubrid las entradas!',
              '¡ALARM AM GLEIS! ¡ESTÁN AQUÍ!',
              '¡Han derribado un acceso! ¡Fuego a discreción!',
            ];
            actor.speechBubble = {
              text: loudAlarms[Math.floor(Math.random() * loudAlarms.length)],
              timer: 2.2,
              type: 'HOSTILE',
            };
          }
          soundEngine.playSuspicionPing();
        } else if (dB >= 30) {
          // Moderate footstep or mechanical sound
          actor.suspicionMeter = Math.min(100, (actor.suspicionMeter ?? 0) + (hasLOS ? 40 : 25));
          actor.angle = Math.atan2(y - actor.y, x - actor.x);
          actor.patrolWaitTimer = 3.0; // halts patrol to listen
          this.stationAlertScore = Math.min(100, this.stationAlertScore + 3.5);
          if ((actor.suspicionMeter ?? 0) >= 45) {
            actor.state = 'ALERTED';
            actor.investigateTarget = { x, y };
            actor.investigateTimer = 6.0;
            if (!actor.speechBubble) {
              const quietPings = [
                '¿Qué fue ese ruido? Algo se mueve...',
                'Was war das am Bahnsteig?',
                '¿Quién anda ahí? He oído pasos...',
                'Atención: posible intrusión en el andén.',
              ];
              actor.speechBubble = {
                text: quietPings[Math.floor(Math.random() * quietPings.length)],
                timer: 2.0,
                type: 'HOSTILE',
              };
            }
            soundEngine.playSuspicionPing();
          }
        }
      }
    }
  }

  public getStationAlertLevel(): StationAlertLevel {
    if (this.stationAlertScore >= 85) return 'LOCKDOWN';
    if (this.stationAlertScore >= 55) return 'ALERTED';
    if (this.stationAlertScore >= 25) return 'SUSPICIOUS';
    return 'CALM';
  }

  protected updateStealthAndNoise(dt: number, player: ActorEntity) {
    // 1. Update Noise Events lifecycle & decay
    for (const ne of this.noiseEvents) {
      ne.timer -= dt;
    }
    this.noiseEvents = this.noiseEvents.filter((ne) => ne.timer > 0);

    // Natural ambient sound floor: 24 dB (station rail ambient) or 18 dB (apartment)
    const ambientFloor = this.missionMode === 'STATION' ? 24 : 18;
    this.currentNoiseDb = Math.max(ambientFloor, this.currentNoiseDb - 38 * dt);

    // 2. Compute Player Dynamic Visibility Percentage
    let vis = this.playerHiddenInShadow ? 12 : 36;

    // Illumination from Wall Sconces & platform lights
    for (const sc of this.wallSconces) {
      if (sc.isDestroyed || sc.isOn === false) continue;
      const d = Math.hypot(sc.x - player.x, sc.y - player.y);
      if (d < sc.radius * 0.7) {
        vis = Math.max(vis, 70);
      }
    }

    // Motion gait impact on visibility
    if (this.currentMovementGait === 'SPRINTING') {
      vis += 35;
    } else if (this.currentMovementGait === 'WALKING') {
      vis += 16;
    }

    // Flashlight beam drastically exposes the player
    if (this.flashlightOn) {
      vis = Math.min(100, vis + 45);
    }

    // Cover reduces visibility
    if (player.inCover) {
      vis = Math.max(8, vis - 26);
    }

    // Check LOS and angle from hostile suspects looking towards player
    let maxEnemyEyeExposure = 0;
    for (const actor of this.actors) {
      if (
        actor.role !== 'SUSPECT' ||
        actor.state === 'DEAD' ||
        actor.state === 'ARRESTED' ||
        actor.state === 'INCAPACITATED'
      )
        continue;

      const hasLOS = !this.raycastWallsAndDoors(actor.x, actor.y, player.x, player.y);
      if (hasLOS) {
        const dist = Math.hypot(actor.x - player.x, actor.y - player.y);
        const angToPlayer = Math.atan2(player.y - actor.y, player.x - actor.x);
        const diff = Math.abs(this.normalizeAngle(angToPlayer - actor.angle));
        // Inside enemy 120° front vision arc (diff < 1.05 rad)
        if (diff < 1.05 && dist < 420) {
          const proximityExposure = Math.max(0, (1 - dist / 420) * 58);
          maxEnemyEyeExposure = Math.max(maxEnemyEyeExposure, proximityExposure);
        }
      }
    }
    vis = Math.min(100, Math.max(5, vis + maxEnemyEyeExposure));
    this.currentVisibilityPct = Math.round(vis);

    // 3. Station Alert Level Progression
    const hasCombatEnemy = this.actors.some(
      (a) => a.role === 'SUSPECT' && (a.state === 'FIRING' || a.state === 'AIMING_WINDUP')
    );
    const hasAlertedEnemy = this.actors.some(
      (a) => a.role === 'SUSPECT' && a.state === 'ALERTED'
    );

    if (hasCombatEnemy) {
      this.stationAlertScore = Math.min(100, this.stationAlertScore + 18 * dt);
    } else if (hasAlertedEnemy) {
      this.stationAlertScore = Math.min(100, this.stationAlertScore + 4 * dt);
    } else if (this.currentNoiseDb < 30) {
      // Slow recovery if stealth is maintained
      this.stationAlertScore = Math.max(0, this.stationAlertScore - 2.2 * dt);
    }

    // If Station is in Lockdown, trigger ambient warning siren occasionally
    if (this.missionMode === 'STATION' && this.stationAlertScore >= 85) {
      const now = Date.now();
      if (now - this.lastAlarmSirenTime >= 12000) {
        this.lastAlarmSirenTime = now;
        soundEngine.playStationAlarmSiren();
      }
    }
  }

  public triggerPoliceShout() {
    const player = this.getPlayer();
    if (!player || player.state === 'DEAD') return;

    this.mirrorDoorId = null;
    this.thermalActive = false;
    player.alertLevel = 'COMBAT';
    soundEngine.playPoliceShout();

    const phrase = AUSTRIAN_SHOUTS[Math.floor(Math.random() * AUSTRIAN_SHOUTS.length)];
    player.speechBubble = {
      text: phrase,
      timer: 2.2,
      type: 'COMMAND',
    };

    const profileSpec = EKO_COBRA_PROFILES[this.plan.profile];
    const maxShoutRadius = this.plan.profile === 'BREACHER' ? 390 : 340;

    // Emit acoustic shout noise to the noise & detection system
    this.emitNoise(player.x, player.y, 92, maxShoutRadius + 140, 'Grito Policial ROE: ¡POLIZEI!', '#38BDF8');

    this.shoutWaves.push({
      x: player.x,
      y: player.y,
      radius: 18,
      maxRadius: maxShoutRadius,
      alpha: 0.85,
    });

    for (const actor of this.actors) {
      if (actor.role === 'PLAYER' || actor.role === 'SQUAD') continue;
      if (actor.state === 'DEAD' || actor.state === 'ARRESTED') continue;

      const dist = Math.hypot(actor.x - player.x, actor.y - player.y);
      if (dist <= maxShoutRadius) {
        const hasLOS = !this.raycastWallsAndDoors(player.x, player.y, actor.x, actor.y);
        const angleToActor = Math.atan2(actor.y - player.y, actor.x - player.x);
        const angleDiff = Math.abs(this.normalizeAngle(angleToActor - player.angle));
        const aimedAt = hasLOS && angleDiff < 0.42;
        const flashlightBonus = this.flashlightOn && aimedAt ? 10 : 0;

        if (actor.role === 'SUSPECT') {
          const weaponBonus = EKO_COBRA_WEAPONS[this.plan.primaryWeapon].suppressionBonus;
          const moraleDrop =
            (hasLOS ? 22 + profileSpec.shoutMoraleBonus : 9) +
            (aimedAt ? weaponBonus + flashlightBonus : 0);
          actor.morale = Math.max(0, actor.morale - moraleDrop);
          actor.stress = Math.min(100, actor.stress + 20);

          if (actor.state === 'UNAWARE') {
            actor.state = 'ALERTED';
          }

          if (actor.morale <= 28 && actor.state !== 'SURRENDERED') {
            if (actor.id === 'SUSPECT_ MILAN' && actor.feignTimer === 0 && Math.random() < 0.45) {
              actor.state = 'FEIGNING_SURRENDER';
              actor.feignTimer = 2.8;
              actor.speechBubble = {
                text: 'Nicht schießen! Ich ergebe mich...',
                timer: 2.4,
                type: 'SURRENDER',
              };
            } else {
              this.makeSuspectSurrender(actor, 'Intimidación verbal EKO Cobra');
            }
          } else if (actor.state !== 'SURRENDERED' && hasLOS) {
            actor.speechBubble = {
              text: actor.morale < 48 ? 'Verdammt... zurückbleiben!' : 'Weg da! Ich hab eine Waffe!',
              timer: 1.9,
              type: 'HOSTILE',
            };
          }
        } else if (actor.role === 'HOSTAGE' || actor.role === 'CIVILIAN') {
          if (hasLOS) {
            actor.isCompliant = true;
            actor.complianceTimer = 14.0;
            actor.isProne = true;
            actor.isCrouched = true;
            actor.state = 'SURRENDERED';
            actor.speechBubble = {
              text: 'Polizei! Gott sei Dank! Ich liege am Boden!',
              timer: 2.2,
              type: 'SURRENDER',
            };
          }
        }
      }
    }

    this.emitHudSnapshot();
  }

  public executeVoiceCommand(commandText: string) {
    const player = this.getPlayer();
    if (!player || player.state === 'DEAD') return;

    this.mirrorDoorId = null;
    this.thermalActive = false;
    player.alertLevel = 'COMBAT';
    soundEngine.playPoliceShout();

    player.speechBubble = {
      text: commandText,
      timer: 2.6,
      type: 'COMMAND',
    };

    const maxShoutRadius = 420;
    this.emitNoise(player.x, player.y, 108, maxShoutRadius + 100, `Voz de Mando: "${commandText}"`, '#10B981');

    this.shoutWaves.push({
      x: player.x,
      y: player.y,
      radius: 18,
      maxRadius: maxShoutRadius,
      alpha: 0.9,
    });

    const upper = commandText.toUpperCase();
    let moraleDrop = 65;
    let effectLabel = commandText;

    if (upper.includes('MANOS') || upper.includes('HANDS') || upper.includes('POLIZEI')) {
      moraleDrop = 75;
      effectLabel = '¡POLIZEI, MANOS ARRIBA!';
    } else if (upper.includes('AFLOJA') || upper.includes('WEG') || upper.includes('ARMA')) {
      moraleDrop = 70;
      effectLabel = '¡AFLOJA EL ARMA!';
    } else if (upper.includes('QUIETO') || upper.includes('BEWEGUNG')) {
      moraleDrop = 65;
      effectLabel = '¡QUIETO!';
    }

    let affectedCount = 0;
    for (const actor of this.actors) {
      if (actor.role === 'SUSPECT' && actor.state !== 'DEAD' && actor.state !== 'ARRESTED') {
        const dist = Math.hypot(actor.x - player.x, actor.y - player.y);
        const hasLOS = !this.raycastWallsAndDoors(player.x, player.y, actor.x, actor.y);
        if (dist <= maxShoutRadius && (hasLOS || dist < 180)) {
          actor.morale = Math.max(0, actor.morale - moraleDrop);
          actor.stunTimer = Math.max(actor.stunTimer, 4.5); // Immediate high stun
          affectedCount++;
          if (actor.morale <= 35 && actor.state !== 'SURRENDERED') {
            this.makeSuspectSurrender(actor, `Voz de Mando: ${effectLabel}`);
          } else {
            actor.state = 'HESITATING';
            actor.speechBubble = { text: '¡Verdammt, die Stimme!', timer: 2.0, type: 'HOSTILE' };
          }
        }
      }
    }

    this.pushRadio('KOBRA-1', `🎙 Mando de voz ejecutado [${effectLabel}]: ${affectedCount} sospechosos afectados.`, 'ok');
    this.emitHudSnapshot();
  }

  public triggerVerbalNegotiation() {
    const player = this.getPlayer();
    if (!player || player.state === 'DEAD') return;

    const isNegotiator = this.plan.profile === 'VERHANDLUNGSFUEHRER';

    // Find barricaded suspect or suspect holding human shield in line of sight or nearby room
    const suspect = this.actors.find(
      (a) =>
        a.role === 'SUSPECT' &&
        a.state !== 'DEAD' &&
        a.state !== 'ARRESTED' &&
        a.state !== 'SURRENDERED' &&
        (a.state === 'USING_HUMAN_SHIELD' ||
          a.state === 'AIMING_WINDUP' ||
          a.state === 'FIRING' ||
          a.state === 'BARGAINING' ||
          a.state === 'HESITATING' ||
          a.humanShieldHostageId !== undefined) &&
        !this.raycastWallsAndDoors(player.x, player.y, a.x, a.y) &&
        Math.hypot(a.x - player.x, a.y - player.y) < 480
    );

    if (!suspect) {
      this.pushRadio(
        'KOBRA-1',
        'Kein Zielperson für verhandlung bereit (Acércate con línea de visión al sospechoso atrinchero o con rehén).',
        'warn'
      );
      this.emitHudSnapshot();
      return;
    }

    suspect.state = 'BARGAINING';
    const increment = isNegotiator ? 38 : 22;
    suspect.negotiationProgress = Math.min(100, (suspect.negotiationProgress ?? 0) + increment);

    soundEngine.playPoliceShout();
    player.speechBubble = {
      text: `${suspect.name.split(' ')[0]}! Habla con nosotros. La policía tiene el perímetro. ¡Libera la posición y ríndete!`,
      timer: 2.8,
      type: 'COMMAND',
    };

    if (suspect.negotiationProgress >= 100) {
      // Human shield release & surrender
      if (suspect.humanShieldHostageId) {
        const hostage = this.actors.find((a) => a.id === suspect.humanShieldHostageId);
        if (hostage) {
          hostage.isShieldedByHostage = false;
          hostage.state = 'SURRENDERED';
          hostage.isProne = true;
          hostage.speechBubble = {
            text: '¡Gott sei Dank! ¡He sido liberada pacíficamente!',
            timer: 3.0,
            type: 'SURRENDER',
          };
        }
        suspect.humanShieldHostageId = undefined;
      }

      this.makeSuspectSurrender(suspect, 'Negociación táctica verbal exitosa WVG §7');
      this.recordRoeEvent(`Desescalada y rendición negociada sin disparos (${suspect.name})`, 300, true);
      this.pushRadio(
        'LEITSTELLE',
        `¡NEGOCIACIÓN EXITOSA! ${suspect.name} ha soltado el arma y entregado la posición pacíficamente.`,
        'ok'
      );
      const roomCode = this.getRoomAt(suspect.x, suspect.y);
      this.logCriticalEvent(
        'NEGOTIATION_SUCCESS',
        `Negociación táctica completada: ${suspect.name}`,
        roomCode,
        'SUCCESS',
        {
          details: `El sospechoso entregó su arma y liberó la posición pacíficamente (+300 PTS ROE).`,
        }
      );
    } else {
      suspect.morale = Math.max(0, suspect.morale - 22);
      suspect.speechBubble = {
        text: `¡No den ni un paso más! (${suspect.negotiationProgress}% Negociación)...`,
        timer: 2.5,
        type: 'SURRENDER',
      };
      this.pushRadio(
        'KOBRA-1',
        `Verbal-Verhandlung mit ${suspect.name}: ${suspect.negotiationProgress}% avance de desescalada.`,
        'info'
      );
      this.impactPopups.push({
        x: suspect.x,
        y: suspect.y - suspect.radius - 22,
        vy: -22,
        text: `🗣 NEGOCIACIÓN VERBAL: ${suspect.negotiationProgress}%`,
        color: '#38BDF8',
        life: 1.3,
        maxLife: 1.3,
      });
    }

    this.emitHudSnapshot();
  }

  public triggerSuspectInterrogation() {
    const player = this.getPlayer();
    if (!player || player.state === 'DEAD') return;

    for (const actor of this.actors) {
      if (
        actor.role === 'SUSPECT' &&
        actor.state === 'ARRESTED' &&
        Math.hypot(actor.x - player.x, actor.y - player.y) <= 65
      ) {
        if (actor.interrogated) {
          this.pushRadio('KOBRA-1', `El sospechoso ${actor.name} ya fue interrogado.`, 'info');
          this.emitHudSnapshot();
          return;
        }

        actor.interrogated = true;

        let revealedCount = 0;
        for (const target of this.actors) {
          if (
            (target.role === 'SUSPECT' || target.role === 'HOSTAGE' || target.role === 'CIVILIAN') &&
            target.id !== actor.id &&
            target.state !== 'DEAD' &&
            target.state !== 'ARRESTED'
          ) {
            target.identifiedByRadio = true;
            target.spottedByMirror = true;
            revealedCount++;
            this.addTacticalMarker(
              target.x,
              target.y,
              target.role === 'SUSPECT' ? 'HOSTILE' : 'OBSERVE_SECTOR',
              `${target.role === 'SUSPECT' ? 'SOSPECHOSO' : 'REHÉN'}: ${target.name}`
            );
          }
        }

        soundEngine.playTetraRadioTransmission('info', 30);
        actor.speechBubble = {
          text: '¡Está bien, hablaré! Las posiciones del grupo están transmitidas en vuestro C4I...',
          timer: 3.5,
          type: 'SURRENDER',
        };

        this.awardOperatorXp(100, 'INTERROGATORIO EXPRÈS');
        this.recordRoeEvent(`Interrogatorio C4I completado (${actor.name})`, 100, true);
        this.pushRadio(
          'KOBRA-1',
          `[I] Interrogatorio exprès a ${actor.name} completado: ${revealedCount} contactos transmitidos a la red C4I.`,
          'ok'
        );
        this.emitHudSnapshot();
        return;
      }
    }

    this.pushRadio('KOBRA-1', 'Acércate a un sospechoso esposado para interrogarlo [I].', 'warn');
    this.emitHudSnapshot();
  }

  protected makeSuspectSurrender(suspect: ActorEntity, reason: string) {
    if (!canSurrender(suspect.state)) return;
    suspect.state = 'SURRENDERED';
    suspect.windupProgress = 0;

    if (suspect.isArmed) {
      suspect.isArmed = false;
      this.evidenceList.push({
        id: `EV_${suspect.id}`,
        label: suspect.weaponLabel || 'Pistole 9mm',
        x: suspect.x + Math.cos(suspect.angle + 0.5) * 22,
        y: suspect.y + Math.sin(suspect.angle + 0.5) * 22,
        secured: false,
      });
    }

    suspect.speechBubble = {
      text: 'Ich werfe die Waffe weg! Nicht schießen!',
      timer: 3.0,
      type: 'SURRENDER',
    };
    this.pushRadio('KOBRA-1', `${suspect.name} hat die Waffe fallengelassen (${reason}).`, 'ok');
    this.recordRoeEvent(`Sospechoso desarmado (${suspect.name})`, 100, true);
  }

  protected isPlayerInDarkness(player: ActorEntity): boolean {
    const nearStairwell = Math.hypot(player.x - 170, player.y - 410) < 280;
    const nearBalcony = Math.hypot(player.x - 1055, player.y - 540) < 240;
    if (!this.flashlightOn && !nearStairwell && !nearBalcony) {
      return true;
    }
    for (const f of this.furniture) {
      if (f.blocksSight) {
        const distToFurn = Math.hypot(player.x - (f.x + f.w * 0.5), player.y - (f.y + f.h * 0.5));
        if (distToFurn < 70 && !this.flashlightOn) {
          return true;
        }
      }
    }
    return false;
  }

  protected findNearestDoor(x: number, y: number, maxDist = 56): DoorEntity | null {
    let best: DoorEntity | null = null;
    let bestDist = maxDist;
    for (const d of this.doors) {
      const mx = (d.x1 + d.x2) * 0.5;
      const my = (d.y1 + d.y2) * 0.5;
      const dist = Math.hypot(mx - x, my - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    }
    return best;
  }

  /** Puerta cerrada más cercana, ignorando puertas ya abiertas o destruidas. */
  protected findNearestClosedDoor(x: number, y: number, maxDist = 550): DoorEntity | null {
    let best: DoorEntity | null = null;
    let bestDist = maxDist;
    for (const door of this.doors) {
      if (door.isOpen || door.isDestroyed) continue;
      const mx = (door.x1 + door.x2) * 0.5;
      const my = (door.y1 + door.y2) * 0.5;
      const dist = Math.hypot(mx - x, my - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = door;
      }
    }
    return best;
  }

  /** Un interruptor por estancia con lámparas, montado sobre uno de sus muros. */
  protected createLightSwitches(
    sconces: WallSconceLight[],
    rooms: RoomZone[] = this.rooms ?? [],
    walls: WallSegment[] = this.walls ?? [],
    doors: DoorEntity[] = this.doors ?? []
  ): LightSwitchEntity[] {
    if (!rooms.length) {
      // Fallback para motores de prueba sin layout: la lámpara ya está en el muro.
      return sconces.map((sconce) => ({
        id: `switch_${sconce.id}`,
        sconceId: sconce.id,
        sconceIds: [sconce.id],
        x: sconce.x,
        y: sconce.y,
        normalAngle: sconce.normalAngle,
      }));
    }

    const sconcesByRoom = new Map<string, WallSconceLight[]>();
    for (const room of rooms) sconcesByRoom.set(room.id, []);

    for (const sconce of sconces) {
      let bestRoom: RoomZone | undefined;
      let bestDistance = Infinity;
      let bestCenterDistance = Infinity;
      for (const room of rooms) {
        const dx = Math.max(room.x - sconce.x, 0, sconce.x - (room.x + room.w));
        const dy = Math.max(room.y - sconce.y, 0, sconce.y - (room.y + room.h));
        const distance = Math.hypot(dx, dy);
        const centerDistance = Math.hypot(
          sconce.x - (room.x + room.w * 0.5),
          sconce.y - (room.y + room.h * 0.5)
        );
        if (
          distance < bestDistance - 0.01 ||
          (Math.abs(distance - bestDistance) <= 0.01 && centerDistance < bestCenterDistance)
        ) {
          bestRoom = room;
          bestDistance = distance;
          bestCenterDistance = centerDistance;
        }
      }
      if (bestRoom && bestDistance <= 8) sconcesByRoom.get(bestRoom.id)?.push(sconce);
    }

    const switches: LightSwitchEntity[] = [];
    for (const room of rooms) {
      const roomSconces = sconcesByRoom.get(room.id) ?? [];
      if (!roomSconces.length) continue;
      const centerX = room.x + room.w * 0.5;
      const centerY = room.y + room.h * 0.5;
      const primary = roomSconces.reduce((closest, sconce) => {
        const closestDistance = Math.hypot(closest.x - centerX, closest.y - centerY);
        const sconceDistance = Math.hypot(sconce.x - centerX, sconce.y - centerY);
        return sconceDistance < closestDistance ? sconce : closest;
      });
      const wallPoint = this.findRoomWallPoint(room, walls, doors);
      const normalAngle = wallPoint?.normalAngle ?? primary.normalAngle;
      const offset = wallPoint ? 2 : 0;

      switches.push({
        id: `switch_${room.id.toLowerCase()}`,
        sconceId: primary.id,
        sconceIds: roomSconces.map((sconce) => sconce.id),
        x: Math.round((wallPoint?.x ?? primary.x) + Math.cos(normalAngle) * offset),
        y: Math.round((wallPoint?.y ?? primary.y) + Math.sin(normalAngle) * offset),
        normalAngle,
      });
    }
    return switches;
  }

  /** Punto de un muro del perímetro de la estancia más cercano a su centro. */
  protected findRoomWallPoint(
    room: RoomZone,
    walls: WallSegment[],
    doors: DoorEntity[] = this.doors ?? []
  ): { x: number; y: number; normalAngle: number } | null {
    const centerX = room.x + room.w * 0.5;
    const centerY = room.y + room.h * 0.5;
    const epsilon = 1.5;
    let bestSafe: { x: number; y: number; normalAngle: number; distance: number } | null = null;
    let bestAny: { x: number; y: number; normalAngle: number; distance: number } | null = null;

    // La tecla E prioriza puertas a 62 px; el interruptor no debe quedar dentro de ese radio.
    const doorClear = (x: number, y: number) =>
      doors.every((door) => distanciaASegmento(x, y, door.x1, door.y1, door.x2, door.y2) >= 72);

    const consider = (x: number, y: number) => {
      const distance = Math.hypot(x - centerX, y - centerY);
      const candidate = { x, y, normalAngle: Math.atan2(centerY - y, centerX - x), distance };
      if (!bestAny || distance < bestAny.distance) bestAny = candidate;
      if (doorClear(x, y) && (!bestSafe || distance < bestSafe.distance)) bestSafe = candidate;
    };

    const considerHorizontal = (start: number, end: number, y: number) => {
      if (end - start < 10) return;
      for (const x of [Math.min(Math.max(centerX, start), end), start + 8, end - 8, (start + end) * 0.5]) {
        if (x >= start && x <= end) consider(x, y);
      }
    };

    const considerVertical = (x: number, start: number, end: number) => {
      if (end - start < 10) return;
      for (const y of [Math.min(Math.max(centerY, start), end), start + 8, end - 8, (start + end) * 0.5]) {
        if (y >= start && y <= end) consider(x, y);
      }
    };

    for (const wall of walls) {
      if (wall.isWindow) continue;
      const minX = Math.min(wall.x1, wall.x2);
      const maxX = Math.max(wall.x1, wall.x2);
      const minY = Math.min(wall.y1, wall.y2);
      const maxY = Math.max(wall.y1, wall.y2);
      if (Math.abs(wall.y1 - wall.y2) <= epsilon) {
        if (
          Math.abs(wall.y1 - room.y) <= epsilon ||
          Math.abs(wall.y1 - (room.y + room.h)) <= epsilon
        ) {
          considerHorizontal(Math.max(minX, room.x), Math.min(maxX, room.x + room.w), wall.y1);
        }
      } else if (Math.abs(wall.x1 - wall.x2) <= epsilon) {
        if (
          Math.abs(wall.x1 - room.x) <= epsilon ||
          Math.abs(wall.x1 - (room.x + room.w)) <= epsilon
        ) {
          considerVertical(wall.x1, Math.max(minY, room.y), Math.min(maxY, room.y + room.h));
        }
      }
    }

    const bestPoint = () => bestSafe ?? bestAny;
    const boundary = bestPoint();
    if (boundary) return boundary;

    // Sin un muro exactamente sobre el perímetro, usa el muro más cercano.
    for (const wall of walls) {
      if (wall.isWindow) continue;
      const dx = wall.x2 - wall.x1;
      const dy = wall.y2 - wall.y1;
      const lengthSq = dx * dx + dy * dy;
      if (lengthSq === 0) continue;
      const t = Math.min(
        1,
        Math.max(0, ((centerX - wall.x1) * dx + (centerY - wall.y1) * dy) / lengthSq)
      );
      consider(wall.x1 + dx * t, wall.y1 + dy * t);
    }

    const fallback = bestPoint();
    return fallback ? { x: fallback.x, y: fallback.y, normalAngle: fallback.normalAngle } : null;
  }

  protected findNearestLightSwitch(
    x: number,
    y: number,
    maxDist = 44
  ): LightSwitchEntity | null {
    let best: LightSwitchEntity | null = null;
    let bestDist = maxDist;
    for (const lightSwitch of this.lightSwitches) {
      const dist = Math.hypot(lightSwitch.x - x, lightSwitch.y - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = lightSwitch;
      }
    }
    return best;
  }

  protected isContextInteractableActor(actor: ActorEntity, x: number, y: number): boolean {
    if (actor.role === 'PLAYER' || actor.role === 'SQUAD') return false;
    if (Math.hypot(actor.x - x, actor.y - y) > 52) return false;
    if (actor.role === 'SUSPECT') {
      return (
        actor.state === 'SURRENDERED' ||
        actor.state === 'INCAPACITATED' ||
        actor.state === 'FEIGNING_SURRENDER'
      );
    }
    return (
      (actor.role === 'HOSTAGE' || actor.role === 'CIVILIAN') &&
      actor.state !== 'ARRESTED' &&
      actor.state !== 'DEAD'
    );
  }

  protected isContextInteractableEvidence(evidence: DroppedEvidence, x: number, y: number): boolean {
    return !evidence.secured && Math.hypot(evidence.x - x, evidence.y - y) <= 50;
  }

  /**
   * Devuelve el interruptor que la tecla E activaría en este instante.
   * Las interacciones con personas/evidencia y las puertas tienen prioridad;
   * el cartel y la acción real usan esta misma comprobación.
   */
  protected getInteractableLightSwitch(
    x: number,
    y: number
  ): LightSwitchEntity | null {
    if (this.findNearestDoor(x, y, 62)) return null;
    if (this.actors.some((actor) => this.isContextInteractableActor(actor, x, y))) return null;
    if (
      this.evidenceList.some((evidence) => this.isContextInteractableEvidence(evidence, x, y))
    ) {
      return null;
    }
    return this.findNearestLightSwitch(x, y, 46);
  }

  protected toggleLightSwitch(lightSwitch: LightSwitchEntity) {
    const ids = lightSwitch.sconceIds?.length ? lightSwitch.sconceIds : [lightSwitch.sconceId];
    const sconces = ids
      .map((id) => this.wallSconces.find((item) => item.id === id))
      .filter((sconce): sconce is WallSconceLight => sconce !== undefined);
    if (!sconces.length) return;

    if (sconces.every((sconce) => sconce.isDestroyed)) {
      soundEngine.playUiClick();
      this.impactPopups.push({
        x: lightSwitch.x,
        y: lightSwitch.y - 12,
        vy: -28,
        text: 'INTERRUPTOR SIN LUZ',
        color: '#94A3B8',
        life: 1.1,
        maxLife: 1.1,
      });
      return;
    }

    const turningOn = !sconces.some((sconce) => !sconce.isDestroyed && sconce.isOn !== false);
    for (const sconce of sconces) {
      if (!sconce.isDestroyed) sconce.isOn = turningOn;
    }
    soundEngine.playLightSwitch(turningOn);
    this.impactPopups.push({
      x: lightSwitch.x,
      y: lightSwitch.y - 12,
      vy: -28,
      text: turningOn ? 'LUZ ENCENDIDA' : 'LUZ APAGADA',
      color: turningOn ? '#FDE68A' : '#94A3B8',
      life: 1.1,
      maxLife: 1.1,
    });
    this.emitHudSnapshot();
  }

  public handleContextualInteract() {
    const player = this.getPlayer();
    if (!player || player.state === 'DEAD') return;

    this.mirrorDoorId = null;
    this.thermalActive = false;

    for (const actor of this.actors) {
      if (!this.isContextInteractableActor(actor, player.x, player.y)) continue;

      if (actor.role === 'SUSPECT') {
        actor.state = 'ARRESTED';
        if (actor.isArmed) {
          actor.isArmed = false;
          this.evidenceList.push({
            id: `EV_${actor.id}`,
            label: actor.weaponLabel || 'Kurzwaffe',
            x: actor.x + 18,
            y: actor.y + 12,
            secured: false,
          });
        }
        actor.speechBubble = {
          text: 'Festgenommen (Handfesseln angelegt).',
          timer: 2.2,
          type: 'SURRENDER',
        };
        soundEngine.playArrestCuffs();
        this.recordRoeEvent(`Arresto limpio con vida: ${actor.name}`, 250, true);
        this.pushRadio('KOBRA-1', `Zielperson ${actor.name} gesichert und festgenommen.`, 'ok');
        this.checkMissionCompletion();
        this.emitHudSnapshot();
        return;
      }

      actor.state = 'ARRESTED';
      actor.speechBubble = {
        text: 'Danke! Ich bin in Sicherheit.',
        timer: 2.5,
        type: 'SURRENDER',
      };
      soundEngine.playArrestCuffs();
      this.recordRoeEvent(`Rehén/Civil evacuado: ${actor.name}`, 200, true);
      this.pushRadio('KOBRA-1', `Schutzperson ${actor.name} unverletzt evakuiert!`, 'ok');
      this.checkMissionCompletion();
      this.emitHudSnapshot();
      return;
    }

    for (const ev of this.evidenceList) {
      if (!this.isContextInteractableEvidence(ev, player.x, player.y)) continue;

      ev.secured = true;
      soundEngine.playOpticCam();
      this.recordRoeEvent(`Evidencia balística asegurada (${ev.label})`, 75, true);
      this.pushRadio('KOBRA-2', `Beweismittel gesichert: ${ev.label}.`, 'info');
      this.checkMissionCompletion();
      this.emitHudSnapshot();
      return;
    }

    const lightSwitch = this.getInteractableLightSwitch(player.x, player.y);
    if (lightSwitch) {
      this.toggleLightSwitch(lightSwitch);
      return;
    }

    const door = this.findNearestDoor(player.x, player.y, 62);
    if (door) {
      if (door.isLocked) {
        door.isLocked = false;
        door.isOpen = true;
        door.currentAngle = door.closedAngle + (door.openAngle - door.closedAngle) * 0.28;
        soundEngine.playDoorAction(false);
        this.pushRadio('KOBRA-1', `${door.name} desbloqueada y entreabierta (28% peek).`, 'info');
      } else {
        // Incremental inching: Closed -> 28% peek -> 65% wide -> Fully Open -> Closed
        const closed = door.closedAngle;
        const open = door.openAngle;
        const diff = open - closed;
        const cur = door.currentAngle;

        if (!door.isOpen || Math.abs(cur - closed) < 0.05) {
          // Closed -> 28% peek
          door.isOpen = true;
          door.currentAngle = closed + diff * 0.28;
          soundEngine.playDoorAction(false);
          this.pushRadio('KOBRA-1', `${door.name} entreabierta con precaución (28% peek).`, 'info');
        } else if (Math.abs(cur - (closed + diff * 0.28)) < 0.05) {
          // 28% -> 65% peek
          door.currentAngle = closed + diff * 0.65;
          soundEngine.playDoorAction(false);
          this.pushRadio('KOBRA-1', `${door.name} abierta a mitad (65% peek).`, 'info');
        } else if (door.isOpen && Math.abs(cur - open) > 0.05) {
          // -> Fully open
          door.currentAngle = open;
          soundEngine.playDoorAction(false);
          this.pushRadio('KOBRA-1', `${door.name} completamente abierta.`, 'info');
        } else {
          // Fully open -> Closed
          door.isOpen = false;
          door.currentAngle = closed;
          soundEngine.playDoorAction(false);
          this.pushRadio('KOBRA-1', `${door.name} cerrada y asegurada.`, 'info');
        }
      }
      this.emitHudSnapshot();
    }
  }

  public handleWheel(deltaY: number) {
    const player = this.getPlayer();
    if (!player || player.state === 'DEAD') return;
    const door = this.findNearestDoor(player.x, player.y, 80);
    if (!door) return;
    if (door.isLocked) {
      door.isLocked = false;
    }
    const closed = door.closedAngle;
    const open = door.openAngle;
    const diff = open - closed;
    // deltaY < 0 scrolls up (open more), deltaY > 0 scrolls down (close more)
    const step = deltaY < 0 ? 0.15 : -0.15;
    let nextAngle = door.currentAngle + step * diff;
    if (diff > 0) {
      nextAngle = Math.max(closed, Math.min(open, nextAngle));
    } else {
      nextAngle = Math.min(closed, Math.max(open, nextAngle));
    }

    if (Math.abs(nextAngle - door.currentAngle) > 0.001) {
      door.currentAngle = nextAngle;
      door.isOpen = Math.abs(nextAngle - closed) > 0.03;
      soundEngine.playDoorAction(false);
      this.emitHudSnapshot();
    }
  }

  protected handleDoorBreachKick() {
    const player = this.getPlayer();
    if (!player || player.state === 'DEAD' || this.breachAction) return;
    const door = this.findNearestDoor(player.x, player.y, 65);
    if (door && !door.isOpen) {
      this.initiateBreach(door, 'KICK');
      return;
    }
    const extWin = this.findNearestExteriorWindow(player.x, player.y, 68);
    if (extWin && !extWin.isBreached) {
      this.executeExteriorWindowBreach(extWin, 'KICK');
    }
  }

  protected handleDoorBreachRam() {
    const player = this.getPlayer();
    if (!player || player.state === 'DEAD' || this.breachAction) return;
    const door = this.findNearestDoor(player.x, player.y, 65);
    if (door && !door.isOpen) {
      this.initiateBreach(door, 'RAM');
      return;
    }
    const extWin = this.findNearestExteriorWindow(player.x, player.y, 68);
    if (extWin && !extWin.isBreached) {
      this.executeExteriorWindowBreach(extWin, 'RAM');
    }
  }

  public handleDoorBreachC4() {
    const player = this.getPlayer();
    if (!player || player.state === 'DEAD' || this.breachAction || this.c4.planting) return;
    if (this.c4.count <= 0) {
      this.pushRadio('KOBRA-1', 'Keine Sprengladungen (C4) mehr verfügbar!', 'warn');
      return;
    }

    const door = this.findNearestDoor(player.x, player.y, 65);
    if (door && !door.isOpen) {
      this.c4.beginPlant({
        targetName: door.name,
        x: (door.x1 + door.x2) / 2,
        y: (door.y1 + door.y2) / 2,
        doorId: door.id,
        isWindow: false,
      }, this.c4Dependencies);
      return;
    }

    const extWin = this.findNearestExteriorWindow(player.x, player.y, 68);
    if (extWin && !extWin.isBreached) {
      this.c4.beginPlant({
        targetName: extWin.label || 'Ventana Exterior',
        x: (extWin.x1 + extWin.x2) / 2,
        y: (extWin.y1 + extWin.y2) / 2,
        windowId: extWin.id,
        isWindow: true,
      }, this.c4Dependencies);
    }
  }

  /** Comprueba que ningún agente propio quede dentro del radio de la explosión. */
  public isBlastAreaClear(charge: ActiveC4Charge): boolean {
    return this.c4.isBlastAreaClear(charge, this.getBlastFriendlies());
  }

  private getBlastFriendlies(): ActorEntity[] {
    const friendlies = this.actors.filter(
      (actor) =>
        (actor.role === 'PLAYER' || actor.role === 'SQUAD') &&
        actor.state !== 'DEAD'
    );
    if (friendlies.length === 0) {
      const player = this.getPlayer();
      const squad = this.getSquadmate();
      if (player && player.state !== 'DEAD') friendlies.push(player);
      if (squad && squad.state !== 'DEAD') friendlies.push(squad);
    }
    return friendlies;
  }

  /** Punto de reunión fuera del radio de la carga, evitando paredes y mobiliario. */
  protected findC4ClearancePoint(charge: ActiveC4Charge, actor: ActorEntity): Vec2 | undefined {
    const currentDistance = Math.hypot(actor.x - charge.x, actor.y - charge.y);
    // Si Kobra-2 ya está fuera del radio, que asegure su posición en vez de
    // acercarse de nuevo a la carga para "despejar".
    if (currentDistance >= C4_SAFE_RADIUS) return { x: actor.x, y: actor.y };

    const baseAngle = Math.atan2(actor.y - charge.y, actor.x - charge.x);
    const angleOffsets = [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35, Math.PI];
    const baseDistance = Math.max(C4_SAFE_RADIUS + 35, currentDistance + 60);
    const distances = [baseDistance, baseDistance + 45, baseDistance + 90];

    for (const distance of distances) {
      for (const offset of angleOffsets) {
        const angle = baseAngle + offset;
        const x = Math.max(90, Math.min(WORLD_WIDTH - 90, charge.x + Math.cos(angle) * distance));
        const y = Math.max(70, Math.min(WORLD_HEIGHT - 70, charge.y + Math.sin(angle) * distance));
        if (!this.collidesAt(x, y, 16)) return { x, y };
      }
    }
    return undefined;
  }

  /** Orden táctica para que Kobra-2 se retire de la zona de la carga. */
  public orderBlastAreaClear() {
    if (this.c4.charges.length === 0) {
      this.pushRadio('KOBRA-1', 'No hay ninguna carga C4 activa que despejar.', 'info');
      return;
    }
    this.issueSquadCommand('CLEAR_BLAST_AREA');
  }

  public detonateActiveC4() {
    this.c4.detonate(this.c4Dependencies);
  }

  private get c4Dependencies(): C4Dependencies {
    return {
      getPlayer: () => this.getPlayer(),
      getFriendlies: () => this.getBlastFriendlies(),
      isDoorTargetValid: (doorId) => {
        const door = this.doors.find((item) => item.id === doorId);
        return !!door && !door.isOpen && !door.isDestroyed;
      },
      isTrainingMode: this.isTrainingMode,
      pushRadio: (speaker, text, tone) => this.pushRadio(speaker, text, tone),
      emitHudSnapshot: () => this.emitHudSnapshot(),
      playPlantStarted: () => soundEngine.playBreachPrep('C4'),
      playArmedWarning: (seconds) => soundEngine.playC4WarningBeep(seconds),
      explode: (charge) => this.triggerC4Explosion(charge),
    };
  }

  protected triggerC4Explosion(charge: ActiveC4Charge) {
    if (charge.isWindow) {
      const extWin = this.exteriorWindows.find((w) => w.id === charge.windowId);
      if (extWin && !extWin.isBreached) {
        this.executeExteriorWindowBreach(extWin, 'C4');
      }
    } else {
      const door = this.doors.find((d) => d.id === charge.doorId);
      if (door && !door.isOpen) {
        this.executeBreach(door, 'C4');
      }
    }

    this.refractionRings.push({
      x: charge.x,
      y: charge.y,
      radius: 12,
      maxRadius: 380,
      alpha: 1.0,
      strength: 1.0,
    });

    // Proximity blast damage check: if player stayed glued too close to the door/window C4 explosion
    const player = this.getPlayer();
    if (player && player.state !== 'DEAD') {
      const distToC4 = Math.hypot(player.x - charge.x, player.y - charge.y);
      if (distToC4 < 135) {
        player.hp = Math.max(0, player.hp - 48);
        this.shakeIntensity = 45;
        this.flashScreenAlpha = 0.95;
        this.pushRadio('KOBRA-1', `¡Scheiße! ¡Estabas demasiado cerca de la explosión del C4 en ${charge.targetName}! Daño por onda expansiva.`, 'warn');
      }
    }

    // Blast radius damage & stun to all actors (suspects, hostages, squadmates) within 160px radius
    for (const actor of this.actors) {
      if (actor.state === 'DEAD' || actor.state === 'INCAPACITATED') continue;
      const distActor = Math.hypot(actor.x - charge.x, actor.y - charge.y);
      if (distActor < 160) {
        const blastDmg = Math.round(75 * (1 - distActor / 160));
        actor.hp = Math.max(0, actor.hp - blastDmg);
        actor.stunTimer = Math.max(actor.stunTimer, 4.0);
        actor.morale = Math.max(0, actor.morale - 85);
        // The enclosing loop already skips DEAD actors, so a lethal hit is always new.
        if (actor.hp <= 0) {
          actor.state = 'DEAD';
          this.pushRadio('LEITSTELLE', `¡Baja por onda expansiva de C4 en ${charge.targetName}!`, actor.role === 'HOSTAGE' ? 'alert' : 'warn');
        } else {
          actor.alertLevel = 'COMBAT';
          actor.speechBubble = { text: '¡Mierda, la explosión!', timer: 3.0, type: 'PANIC' };
          if (actor.role === 'SUSPECT' && actor.morale < 25 && actor.state !== 'SURRENDERED') {
            this.makeSuspectSurrender(actor, 'Onda expansiva C4 / Sobrecarga acústica');
          }
        }
      }
    }
  }

  protected initiateBreach(door: DoorEntity, mode: 'KICK' | 'RAM' | 'C4') {
    if (this.breachAction) return;

    const maxProgress = mode === 'C4' ? 1.3 : mode === 'RAM' ? 0.75 : 0.35;
    const name = mode === 'C4' ? 'C4 Sprengladung' : mode === 'RAM' ? 'Türramme (Ariete)' : 'Dynamischer Tritt';
    const noiseLevel = mode === 'C4' ? 'Extrem (Flashbang-Explosion)' : mode === 'RAM' ? 'Sehr Laut (Mechanischer Schlag)' : 'Mäßig (Schneller Tritt)';
    const stunRisk = mode === 'C4' ? 'Maximal (3.4s Stun · 72 Morale)' : mode === 'RAM' ? 'Hoch (1.8s Stun · 44 Morale)' : 'Moderat (1.2s Stun · 26 Morale)';

    this.breachAction = {
      doorId: door.id,
      mode,
      progress: 0,
      maxProgress,
      name,
      noiseLevel,
      stunRisk,
    };

    soundEngine.playBreachPrep(mode);
    if (mode === 'C4') {
      this.pushRadio('KOBRA-1', `Platziere C4-Sprengladung an ${door.name} [1.3s]...`, 'warn');
    } else if (mode === 'RAM') {
      this.pushRadio('KOBRA-1', `Setze schwere 16kg-Türramme an ${door.name} [0.75s]...`, 'info');
    } else {
      this.pushRadio('KOBRA-1', `Bereite dynamischen Tritt an ${door.name} [0.35s]...`, 'info');
    }
    this.emitHudSnapshot();
  }

  protected executeBreach(
    door: DoorEntity,
    mode: 'KICK' | 'RAM' | 'C4',
    source: 'KOBRA-1' | 'KOBRA-2' = 'KOBRA-1'
  ) {
    door.isLocked = false;
    door.isOpen = true;
    door.isBreached = true;
    if (mode === 'C4' || mode === 'RAM') {
      door.isDestroyed = true;
    }
    door.currentAngle = door.openAngle;
    this.mirrorDoorId = null;
    this.thermalActive = false;

    const mx = (door.x1 + door.x2) * 0.5;
    const my = (door.y1 + door.y2) * 0.5;
    const isGlazedDoor = door.id === 'DOOR_BALCONY_B';

    // Trigger distinct multi-layered breach audio (wooden splintering, heavy metal thud, or C4 blast)
    const breachListener = this.getPlayer();
    soundEngine.playDoorBreachSpatial(
      mode,
      isGlazedDoor,
      mx,
      my,
      breachListener?.x ?? mx,
      breachListener?.y ?? my
    );
    this.awardOperatorXp(mode === 'C4' ? 55 : mode === 'RAM' ? 45 : 35, `BRECHA ${mode}`);

    const breachDb = mode === 'C4' ? 142 : mode === 'RAM' ? 110 : 88;
    const breachNoiseRadius = mode === 'C4' ? 1000 : mode === 'RAM' ? 620 : 480;
    this.emitNoise(
      mx,
      my,
      breachDb,
      breachNoiseRadius,
      mode === 'C4' ? 'Explosión de C4 en Puerta' : mode === 'RAM' ? 'Impacto de Ariete Dinámico' : 'Patada Violenta en Puerta',
      '#EF4444'
    );

    if (mode === 'KICK') {
      this.shakeIntensity = 7;
      this.hitstopTimer = 0.035;
      this.pushRadio(source, `Dynamischer Tritt (Holzsplitter-Durchbruch) an ${door.name}!`, 'info');
    } else if (mode === 'RAM') {
      this.shakeIntensity = 13;
      this.hitstopTimer = 0.05;
      this.pushRadio(source, `Türramme (Schwerer Metallschlag & Rahmenbruch) an ${door.name}!`, 'warn');
    } else if (mode === 'C4') {
      this.shakeIntensity = 20;
      this.hitstopTimer = 0.07;
      this.flashScreenAlpha = 0.52;
      this.pointLights.push({
        x: mx,
        y: my,
        radius: 350,
        color: 'rgba(251, 191, 36, 0.8)',
        life: 0.35,
        maxLife: 0.35,
      });
      this.pushRadio(source, `Sprengladung (C4 Breaching Charge) gezündet an ${door.name}!`, 'alert');
    }

    const count = mode === 'C4' ? 42 : mode === 'RAM' ? 28 : 16;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 55 + Math.random() * (mode === 'C4' ? 290 : 195);
      const isWood = i % 2 === 0;
      this.particles.push({
        x: mx + (Math.random() - 0.5) * 14,
        y: my + (Math.random() - 0.5) * 14,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.45 + Math.random() * 0.45,
        maxLife: 0.9,
        color: isWood ? (Math.random() < 0.5 ? '#D97706' : '#92400E') : mode === 'C4' ? '#FBBF24' : '#94A3B8',
        size: mode === 'C4' ? 4.5 : 3,
        shape: isWood ? 'SHARD' : 'SPARK',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 16,
      });
    }
    // Dust mist & persistent floor debris decals from breach
    for (let i = 0; i < (mode === 'C4' ? 10 : 5); i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.random() * 34;
      this.decals.push({
        x: mx + Math.cos(ang) * dist,
        y: my + Math.sin(ang) * dist,
        radius: mode === 'C4' ? 8 + Math.random() * 10 : 5 + Math.random() * 6,
        color: mode === 'C4' && i < 3 ? '#1E293B' : '#78350F',
        alpha: 0.65,
        type: mode === 'C4' && i < 3 ? 'SCORCH' : 'DEBRIS',
        angle: ang,
        aspect: 0.45 + Math.random() * 0.4,
      });
    }

    const breachRadius = mode === 'C4' ? 340 : mode === 'RAM' ? 240 : 170;
    const moraleHit = mode === 'C4' ? 70 : mode === 'RAM' ? 42 : 26;
    const stunDuration = mode === 'C4' ? 3.2 : mode === 'RAM' ? 1.8 : 1.2;

    for (const actor of this.actors) {
      if (actor.role === 'SUSPECT' && actor.state !== 'DEAD' && actor.state !== 'ARRESTED') {
        const dist = Math.hypot(actor.x - mx, actor.y - my);
        if (dist <= breachRadius) {
          actor.morale = Math.max(0, actor.morale - moraleHit);
          actor.stunTimer = Math.max(actor.stunTimer, stunDuration);

          const reaction = resolveBreachReaction(actor.morale, Math.random());
          if (reaction === 'SURRENDER') {
            this.makeSuspectSurrender(actor, `Gewaltsamer Durchbruch (${mode})`);
          } else if (reaction === 'FLEEING') {
            actor.state = 'FLEEING';
            actor.speechBubble = {
              text: 'Verdammt! Rückzug! Abhauen!',
              timer: 2.2,
              type: 'PANIC',
            };
          } else if (reaction === 'PANIC') {
            actor.state = 'PANIC';
            actor.speechBubble = {
              text: 'Nein! Nicht schießen! Panik!',
              timer: 2.2,
              type: 'PANIC',
            };
          } else {
            actor.state = 'HESITATING';
            actor.speechBubble = {
              text: mode === 'C4' ? 'Scheiße! Die Explosion!' : 'Was zum—?! Tür aufgebrochen!',
              timer: 2.0,
              type: 'HOSTILE',
            };
          }
        }
      }
    }

    // Intensify meteorological rain draft & ambient dust clouds when breaching exterior/perimeter doors or interior walls
    const isExteriorPerimeterDoor =
      door.id === 'DOOR_BALCONY_B' || door.id === 'DOOR_MAIN_A';
    if (isExteriorPerimeterDoor) {
      const inwardAngle = door.id === 'DOOR_BALCONY_B' ? Math.PI : 0;
      const intensity = mode === 'C4' ? 1.0 : mode === 'RAM' ? 0.85 : 0.72;
      this.triggerExteriorBreachWeatherSurge(
        mx,
        my,
        inwardAngle,
        intensity,
        door.name,
        true
      );
    } else {
      // Interior door breach also kicks up a moderate indoor plaster dust surge
      const inwardAngle = Math.abs(door.x1 - door.x2) < 5 ? 0 : Math.PI / 2;
      this.triggerExteriorBreachWeatherSurge(
        mx,
        my,
        inwardAngle,
        mode === 'C4' ? 0.68 : 0.42,
        door.name,
        false
      );
    }

    this.emitHudSnapshot();
  }

  protected initExteriorWindowsAndAmbientDust() {
    this.exteriorWindows = [
      {
        id: 'EXT_WALL_KUECHE_W',
        label: 'Außenwand / Oberlicht West (Wohnküche)',
        x1: 250,
        y1: 165,
        x2: 250,
        y2: 235,
        normalAngle: 0, // Points East into Wohnküche
        roomId: 'WOHNKUECHE',
        isBreached: false,
        damageHits: 0,
      },
      {
        id: 'EXT_WIN_KUECHE_N',
        label: 'Außenfenster Nord (Wohnküche)',
        x1: 365,
        y1: 100,
        x2: 475,
        y2: 100,
        normalAngle: Math.PI / 2, // Points South into Wohnküche
        roomId: 'WOHNKUECHE',
        isBreached: false,
        damageHits: 0,
      },
      {
        id: 'EXT_WIN_SCHLAF_N',
        label: 'Außenfenster Nord (Schlafzimmer)',
        x1: 745,
        y1: 100,
        x2: 875,
        y2: 100,
        normalAngle: Math.PI / 2, // Points South into Schlafzimmer
        roomId: 'SCHLAFZIMMER',
        isBreached: false,
        damageHits: 0,
      },
      {
        id: 'EXT_WIN_SCHLAF_E',
        label: 'Außenfenster Ost (Schlafzimmer)',
        x1: 1040,
        y1: 175,
        x2: 1040,
        y2: 285,
        normalAngle: Math.PI, // Points West into Schlafzimmer
        roomId: 'SCHLAFZIMMER',
        isBreached: false,
        damageHits: 0,
      },
      {
        id: 'EXT_WIN_LOGGIA_E',
        label: 'Außenwand / Terrassenfenster (Loggia)',
        x1: 960,
        y1: 395,
        x2: 960,
        y2: 465,
        normalAngle: Math.PI, // Points West from outdoor Loggia into Wohnzimmer
        roomId: 'WOHNZIMMER',
        isBreached: false,
        damageHits: 0,
      },
      {
        id: 'EXT_WIN_WOHN_S',
        label: 'Panoramafenster Süd (Wohnzimmer)',
        x1: 635,
        y1: 720,
        x2: 775,
        y2: 720,
        normalAngle: -Math.PI / 2, // Points North into Wohnzimmer
        roomId: 'WOHNZIMMER',
        isBreached: false,
        damageHits: 0,
      },
      {
        id: 'EXT_WIN_BAD_S',
        label: 'Milchglasfenster Süd (Badezimmer)',
        x1: 355,
        y1: 720,
        x2: 435,
        y2: 720,
        normalAngle: -Math.PI / 2, // Points North into Badezimmer
        roomId: 'BADEZIMMER',
        isBreached: false,
        damageHits: 0,
      },
    ];

    this.ambientDustMotes = [];
    for (let i = 0; i < 105; i++) {
      this.ambientDustMotes.push({
        x: 258 + Math.random() * 765,
        y: 108 + Math.random() * 604,
        vx: (Math.random() - 0.5) * 9,
        vy: (Math.random() - 0.5) * 9,
        size: 1.1 + Math.random() * 2.1,
        baseAlpha: 0.14 + Math.random() * 0.24,
        phase: Math.random() * Math.PI * 2,
        turbulenceFreq: 0.65 + Math.random() * 1.25,
      });
    }
  }

  protected findNearestExteriorWindow(
    x: number,
    y: number,
    maxDist = 68
  ): ExteriorWindowSection | null {
    let best: ExteriorWindowSection | null = null;
    let bestDist = maxDist;
    for (const win of this.exteriorWindows) {
      const d = this.distToSegment(x, y, win.x1, win.y1, win.x2, win.y2);
      if (d < bestDist) {
        bestDist = d;
        best = win;
      }
    }
    return best;
  }

  protected splitWallSegmentForBreach(win: ExteriorWindowSection) {
    const nextWalls: WallSegment[] = [];
    const eps = 4;
    for (const w of this.walls) {
      const isHorizontal = Math.abs(w.y1 - w.y2) < 2 && Math.abs(win.y1 - win.y2) < 2;
      const isVertical = Math.abs(w.x1 - w.x2) < 2 && Math.abs(win.x1 - win.x2) < 2;

      if (isHorizontal && Math.abs(w.y1 - win.y1) < eps) {
        const minWx = Math.min(w.x1, w.x2);
        const maxWx = Math.max(w.x1, w.x2);
        const minBx = Math.min(win.x1, win.x2);
        const maxBx = Math.max(win.x1, win.x2);
        if (minBx >= minWx - eps && maxBx <= maxWx + eps) {
          if (minBx - minWx > 8) {
            nextWalls.push({ id: `${w.id}_L`, x1: minWx, y1: w.y1, x2: minBx, y2: w.y2 });
          }
          if (maxWx - maxBx > 8) {
            nextWalls.push({ id: `${w.id}_R`, x1: maxBx, y1: w.y1, x2: maxWx, y2: w.y2 });
          }
          continue;
        }
      } else if (isVertical && Math.abs(w.x1 - win.x1) < eps) {
        const minWy = Math.min(w.y1, w.y2);
        const maxWy = Math.max(w.y1, w.y2);
        const minBy = Math.min(win.y1, win.y2);
        const maxBy = Math.max(win.y1, win.y2);
        if (minBy >= minWy - eps && maxBy <= maxWy + eps) {
          if (minBy - minWy > 8) {
            nextWalls.push({ id: `${w.id}_T`, x1: w.x1, y1: minWy, x2: w.x2, y2: minBy });
          }
          if (maxWy - maxBy > 8) {
            nextWalls.push({ id: `${w.id}_B`, x1: w.x1, y1: maxBy, x2: w.x2, y2: maxWy });
          }
          continue;
        }
      }
      nextWalls.push(w);
    }
    this.walls = nextWalls;
  }

  protected executeExteriorWindowBreach(
    win: ExteriorWindowSection,
    mode: 'KICK' | 'RAM' | 'C4' | 'BALLISTIC'
  ) {
    if (win.isBreached) return;
    win.isBreached = true;

    // Open a physical breach gap in the exterior wall segment so rain, wind, bullets, and operators can pass through
    this.splitWallSegmentForBreach(win);

    const mx = (win.x1 + win.x2) * 0.5;
    const my = (win.y1 + win.y2) * 0.5;

    const extListener = this.getPlayer();
    soundEngine.playDoorBreachSpatial(mode, true, mx, my, extListener?.x ?? mx, extListener?.y ?? my);
    soundEngine.playMaterialImpact('GLASS');
    this.awardOperatorXp(50, `BRECHA EXTERIOR`);

    if (mode === 'C4') {
      this.shakeIntensity = 21;
      this.hitstopTimer = 0.065;
      this.flashScreenAlpha = 0.48;
      this.pointLights.push({
        x: mx,
        y: my,
        radius: 360,
        color: 'rgba(251, 191, 36, 0.82)',
        life: 0.36,
        maxLife: 0.36,
      });
    } else {
      this.shakeIntensity = Math.max(this.shakeIntensity, mode === 'RAM' ? 14 : 9);
      this.hitstopTimer = 0.035;
    }

    // Shattered window glass shards & exterior masonry fragments flying inward along normalAngle
    const shardCount = mode === 'C4' ? 46 : mode === 'RAM' ? 32 : 22;
    for (let i = 0; i < shardCount; i++) {
      const spread = (Math.random() - 0.5) * 1.45;
      const ang = win.normalAngle + spread;
      const spd = 65 + Math.random() * (mode === 'C4' ? 280 : 185);
      const isGlass = i % 3 !== 0;
      this.particles.push({
        x: mx + (Math.random() - 0.5) * 26,
        y: my + (Math.random() - 0.5) * 26,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.55 + Math.random() * 0.5,
        maxLife: 1.05,
        color: isGlass
          ? Math.random() < 0.5
            ? '#BAE6FD'
            : '#38BDF8'
          : mode === 'C4'
            ? '#FBBF24'
            : '#94A3B8',
        size: isGlass ? 3.2 + Math.random() * 2.2 : 4.2,
        shape: 'SHARD',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 20,
      });
    }

    // Persistent shattered glass & masonry rubble decals on the floor inside the room
    for (let i = 0; i < 8; i++) {
      const dist = 8 + Math.random() * 44;
      const ang = win.normalAngle + (Math.random() - 0.5) * 1.05;
      this.decals.push({
        x: mx + Math.cos(ang) * dist,
        y: my + Math.sin(ang) * dist,
        radius: 4 + Math.random() * 5,
        color: i % 2 === 0 ? '#38BDF8' : '#64748B',
        alpha: 0.58,
        type: 'DEBRIS',
        angle: ang,
        aspect: 0.45 + Math.random() * 0.35,
      });
    }

    // Stun & shock nearby suspects inside the room
    const stunRadius = mode === 'C4' ? 320 : mode === 'RAM' ? 220 : 155;
    for (const actor of this.actors) {
      if (actor.role === 'SUSPECT' && actor.state !== 'DEAD' && actor.state !== 'ARRESTED') {
        const dist = Math.hypot(actor.x - mx, actor.y - my);
        if (dist <= stunRadius) {
          actor.morale = Math.max(0, actor.morale - (mode === 'C4' ? 62 : 34));
          actor.stunTimer = Math.max(actor.stunTimer, mode === 'C4' ? 2.8 : 1.3);
          if (actor.morale <= 30) {
            this.makeSuspectSurrender(actor, `Außendurchbruch (${win.label})`);
          }
        }
      }
    }

    this.triggerExteriorBreachWeatherSurge(
      mx,
      my,
      win.normalAngle,
      mode === 'C4' ? 1.0 : mode === 'RAM' ? 0.88 : 0.76,
      win.label,
      true
    );
    this.emitHudSnapshot();
  }

  protected triggerExteriorBreachWeatherSurge(
    x: number,
    y: number,
    inwardAngle: number,
    intensity: number,
    sourceLabel: string,
    isExteriorOpening: boolean
  ) {
    this.exteriorBreachSurgeTimer = Math.max(
      this.exteriorBreachSurgeTimer,
      isExteriorOpening ? 14.0 * intensity : 6.0 * intensity
    );

    if (isExteriorOpening) {
      const existing = this.breachWindSources.find(
        (b) => Math.hypot(b.x - x, b.y - y) < 35
      );
      if (!existing) {
        this.breachWindSources.push({
          id: `BREACH_${this.breachWindSources.length + 1}`,
          x,
          y,
          normalAngle: inwardAngle,
          intensity,
          label: sourceLabel,
        });
      } else {
        existing.intensity = Math.max(existing.intensity, intensity);
      }

      this.pushRadio(
        'UMWELT-SENSOR',
        `AUSSENDURCHBRUCH (${sourceLabel}): Starkregen-Böen & dichter Mauerstaub dringen ein — Sichtweite leicht reduziert!`,
        'warn'
      );
    }

    // 1. Billowing masonry/plaster dust mist clouds pouring inward from the breach
    const mistCount = isExteriorOpening ? Math.round(18 * intensity) : Math.round(9 * intensity);
    for (let i = 0; i < mistCount; i++) {
      const spread = (Math.random() - 0.5) * 1.15;
      const ang = inwardAngle + spread;
      const spd = (isExteriorOpening ? 42 : 26) + Math.random() * (isExteriorOpening ? 115 : 65);
      this.particles.push({
        x: x + (Math.random() - 0.5) * 24,
        y: y + (Math.random() - 0.5) * 24,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 1.4 + Math.random() * 1.4,
        maxLife: 2.8,
        color:
          i % 3 === 0
            ? 'rgba(186, 230, 253, 0.26)'
            : 'rgba(148, 163, 184, 0.34)',
        size: 12 + Math.random() * 14,
        shape: 'MIST',
        drag: 0.94,
      });
    }

    // 2. Surge of suspended turbulent dust motes flooding into the room
    const extraMotes = isExteriorOpening ? Math.round(48 * intensity) : Math.round(22 * intensity);
    for (let i = 0; i < extraMotes; i++) {
      if (this.ambientDustMotes.length > 230) {
        const idx = this.ambientDustMotes.findIndex((m) => m.isSurgeMote);
        if (idx >= 0) this.ambientDustMotes.splice(idx, 1);
      }
      const ang = inwardAngle + (Math.random() - 0.5) * 1.3;
      const spd = 35 + Math.random() * 110 * intensity;
      const life = 8.0 + Math.random() * 6.5;
      this.ambientDustMotes.push({
        x: x + Math.cos(ang) * (6 + Math.random() * 24),
        y: y + Math.sin(ang) * (6 + Math.random() * 24),
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        size: 1.5 + Math.random() * 2.6,
        baseAlpha: 0.28 + Math.random() * 0.32,
        phase: Math.random() * Math.PI * 2,
        turbulenceFreq: 1.5 + Math.random() * 1.8,
        isSurgeMote: true,
        life,
        maxLife: life,
      });
    }

    // 3. Wind-blown rain gust streaks spraying inward if breaching an exterior wall/door/window
    if (isExteriorOpening) {
      for (let i = 0; i < 28; i++) {
        const ang = inwardAngle + (Math.random() - 0.5) * 0.75;
        const spd = 160 + Math.random() * 210;
        const life = 0.45 + Math.random() * 0.55;
        this.windowRainParticles.push({
          windowId: sourceLabel,
          x: x + (Math.random() - 0.5) * 28,
          y: y + (Math.random() - 0.5) * 28,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          len: 10 + Math.random() * 12,
          size: 1.8 + Math.random() * 1.4,
          alpha: 0.45 + Math.random() * 0.35,
          life,
          maxLife: life,
          kind: 'INFLOW_GUST',
        });
      }
    }
  }

  /**
   * Computes a subtle meteorological & particulate visibility multiplier (0.76 .. 0.95)
   * affected by outdoor/window rain mist, indoor suspended dust, and exterior wall/door breaches.
   */
  protected getWeatherVisibilityMultiplier(x: number, y: number): number {
    const room = this.getRoomAt(x, y);
    const isOutdoorOrSemiOutdoor =
      room === 'LOGGIA' || room === 'STIEGENHAUS' || room === 'AUSSENBEREICH';

    // Baseline subtle attenuation: -10% outdoors in the Graz rain, -5% indoors from suspended ambient dust
    let penalty = isOutdoorOrSemiOutdoor ? 0.1 : 0.05;

    // Proximity to rain-lashed windows or breached exterior walls
    for (const win of this.exteriorWindows) {
      const d = this.distToSegment(x, y, win.x1, win.y1, win.x2, win.y2);
      if (win.isBreached && d < 240) {
        penalty += (1 - d / 240) * 0.09;
      } else if (!win.isBreached && d < 95) {
        penalty += (1 - d / 95) * 0.03;
      }
    }

    // Proximity to active exterior breach wind inflows (e.g. breached Tür B Loggia or Tür A)
    for (const src of this.breachWindSources) {
      const d = Math.hypot(x - src.x, y - src.y);
      if (d < 260) {
        penalty += (1 - d / 260) * 0.08 * src.intensity;
      }
    }

    // Global dust & rain storm surge immediately following an exterior wall/door breach
    if (this.exteriorBreachSurgeTimer > 0) {
      const surgeRatio = Math.min(1, this.exteriorBreachSurgeTimer / this.exteriorBreachMaxDuration);
      penalty += surgeRatio * 0.08;
    }

    return Math.max(0.76, Math.min(0.96, 1 - penalty));
  }

  public toggleInspectionDevice() {
    const player = this.getPlayer();
    if (!player || player.state === 'DEAD') return;

    if (this.plan.inspectionDevice === 'THERMAL_CAM') {
      this.thermalActive = !this.thermalActive;
      this.mirrorDoorId = null;
      soundEngine.playOpticCam();

      if (this.thermalActive) {
        const range =
          EKO_COBRA_INSPECTION_DEVICES.THERMAL_CAM.rangePx *
          EKO_COBRA_PROFILES[this.plan.profile].sensorRangeMultiplier;
        let detected = 0;
        for (const actor of this.actors) {
          if (actor.role === 'PLAYER' || actor.role === 'SQUAD' || actor.state === 'DEAD') continue;
          const dist = Math.hypot(actor.x - player.x, actor.y - player.y);
          const ang = Math.atan2(actor.y - player.y, actor.x - player.x);
          const diff = Math.abs(this.normalizeAngle(ang - player.angle));
          if (dist <= range && diff <= 0.72) {
            actor.spottedByMirror = true;
            actor.spottedByThermal = true;
            detected++;
          }
        }
        this.pushRadio(
          'FLIR-THERMAL',
          `Wärmebildkamera aktiv: ${detected} Wärmesignaturen (37°C) durch Wände/Türen erfasst.`,
          'info'
        );
      }
      this.emitHudSnapshot();
      return;
    }

    if (this.mirrorDoorId) {
      this.mirrorDoorId = null;
      soundEngine.playOpticCam();
      this.emitHudSnapshot();
      return;
    }

    const door = this.findNearestDoor(player.x, player.y, 68);
    if (door && !door.isOpen) {
      this.mirrorDoorId = door.id;
      door.mirrored = true;
      soundEngine.playOpticCam();

      let spottedHostiles = 0;
      let spottedHostages = 0;
      for (const actor of this.actors) {
        if (actor.roomName === door.roomA || actor.roomName === door.roomB) {
          if (actor.role !== 'PLAYER' && actor.role !== 'SQUAD') {
            actor.spottedByMirror = true;
            actor.spottedByThermal = false;
            if (actor.role === 'SUSPECT') spottedHostiles++;
            if (actor.role === 'HOSTAGE' || actor.role === 'CIVILIAN') spottedHostages++;
          }
        }
      }

      const devName = EKO_COBRA_INSPECTION_DEVICES[this.plan.inspectionDevice].nameDe;
      this.pushRadio(
        'OPTIK-SONDE',
        `${devName} an ${door.name}: ${spottedHostiles} Verdächtige, ${spottedHostages} Schutzpersonen erkannt.`,
        'info'
      );
      this.emitHudSnapshot();
    } else {
      this.pushRadio(
        'KOBRA-1',
        'Acércate a una puerta cerrada para usar la Micro-Cámara / Espejo [Q].',
        'warn'
      );
      this.emitHudSnapshot();
    }
  }

  public throwTacticalGadget() {
    const player = this.getPlayer();
    if (!player || player.state === 'DEAD' || this.gadgetCount <= 0) {
      this.pushRadio('KOBRA-1', 'Keine Granaten / Gadgets mehr verfügbar!', 'warn');
      this.emitHudSnapshot();
      return;
    }

    const gadgetSpec = EKO_COBRA_GADGETS[this.plan.gadget];

    // Step 1: Toggle Aiming Trajectory Mode ON
    if (!this.grenadeAimingActive) {
      this.grenadeAimingActive = true;
      soundEngine.playOpticCam();
      this.pushRadio(
        'KOBRA-1',
        `APUNTA GRANADA [${gadgetSpec.nameDe}]: Ajusta ángulo y distancia con el ratón. [CLIC IZQ / G] para lanzar · [ESC / CLIC DER] para cancelar.`,
        'info'
      );
      this.emitHudSnapshot();
      return;
    }

    // Step 2: Second press / trigger executes the grenade throw!
    this.executeGrenadeThrow();
  }

  public cancelGrenadeAiming() {
    if (this.grenadeAimingActive) {
      this.grenadeAimingActive = false;
      soundEngine.playUiClick();
      this.pushRadio('KOBRA-1', 'Lanzamiento de granada cancelado.', 'info');
      this.emitHudSnapshot();
    }
  }

  public executeGrenadeThrow() {
    const player = this.getPlayer();
    if (!player || player.state === 'DEAD' || this.gadgetCount <= 0) {
      this.grenadeAimingActive = false;
      return;
    }

    this.gadgetCount -= 1;
    this.grenadeAimingActive = false;
    this.mirrorDoorId = null;
    this.thermalActive = false;

    const gadgetSpec = EKO_COBRA_GADGETS[this.plan.gadget];
    const maxThrowDist = this.plan.gadget === 'PEPPER_SPRAY' ? 165 : 235;
    const dx = this.mouseWorld.x - player.x;
    const dy = this.mouseWorld.y - player.y;
    const dist = Math.min(maxThrowDist, Math.hypot(dx, dy));
    const ang = Math.atan2(dy, dx);

    let targetX = player.x + Math.cos(ang) * dist;
    let targetY = player.y + Math.sin(ang) * dist;

    const surfaceHit = this.raycastSurface(player.x, player.y, targetX, targetY);
    let midX: number | undefined = undefined;
    let midY: number | undefined = undefined;
    let hasBounced = false;

    if (surfaceHit) {
      midX = surfaceHit.x;
      midY = surfaceHit.y;
      hasBounced = true;

      const wx = surfaceHit.bx - surfaceHit.ax;
      const wy = surfaceHit.by - surfaceHit.ay;
      const wLen = Math.hypot(wx, wy);

      let nx = 0;
      let ny = 0;
      let tx = 0;
      let ty = 0;

      if (wLen > 1) {
        nx = -(wy / wLen);
        ny = wx / wLen;
        tx = wx / wLen;
        ty = wy / wLen;
      } else {
        const dx = player.x - surfaceHit.x;
        const dy = player.y - surfaceHit.y;
        const dLen = Math.hypot(dx, dy) || 1;
        nx = dx / dLen;
        ny = dy / dLen;
        tx = -ny;
        ty = nx;
      }

      const vx = surfaceHit.x - player.x;
      const vy = surfaceHit.y - player.y;
      if (vx * nx + vy * ny < 0) {
        nx = -nx;
        ny = -ny;
      }

      const slideSign = Math.random() < 0.5 ? 1 : -1;
      const bounceDist = 90 + Math.random() * 60;
      let finalX = midX + nx * 35 + tx * (slideSign * bounceDist);
      let finalY = midY + ny * 35 + ty * (slideSign * bounceDist);

      const bounceHit = this.raycastPoint(midX, midY, finalX, finalY);
      if (bounceHit) {
        finalX = bounceHit.x - nx * 15;
        finalY = bounceHit.y - ny * 15;
      }
      targetX = finalX;
      targetY = finalY;
    }

    this.gadgets.push({
      x: player.x,
      y: player.y,
      midX,
      midY,
      tx: targetX,
      ty: targetY,
      progress: 0,
      type: this.plan.gadget,
      detonated: false,
      cloudTimer: gadgetSpec.durationSec,
      hasBounced,
    });

    soundEngine.playOpticCam();
    this.pushRadio('KOBRA-1', `¡${gadgetSpec.nameDe} lanzada${hasBounced ? ' con rebote en muro' : ''}!`, 'warn');
    this.emitHudSnapshot();
  }

  /**
   * Renders interactive 2-step grenade trajectory arc & blast radius aiming preview:
   * - Angle and distance determined by player position and world cursor (mouseWorld)
   * - Clamped to max throw range (165px for Pepper Spray, 235px for Flashbang/CS Gas)
   * - Raycasted against walls & doors to handle rebound/blocking at obstacles
   * - Parabolic trajectory arc with glowing animated particles & ground shadow
   * - Pulsing circular blast radius indicator on target landing point
   * - Floating diegetic HUD badge with hotkey guidance: [CLIC IZQ / G]: LANZAR · [ESC / CLIC DER]: CANCELAR
   */

  public reloadWeapon() {
    if (this.magCount <= 0) return;
    const spec = EKO_COBRA_WEAPONS[this.plan.primaryWeapon];
    if (this.ammoInMag === spec.magSize) return;
    this.magCount -= 1;
    this.ammoInMag = spec.magSize;
    soundEngine.playOpticCam();
    this.pushRadio('KOBRA-1', 'Magazinwechsel durchgeführt.', 'info');
    this.emitHudSnapshot();
  }

  public issueSquadCommand(cmd: SquadCommand, target?: SquadCommandTarget) {
    const squad = this.getSquadmate();
    const player = this.getPlayer();
    if (!squad || !player || squad.state === 'DEAD') return;
    if (cmd === 'CLEAR_BLAST_AREA' && this.c4.charges.length === 0) {
      this.pushRadio('KOBRA-1', 'No hay ninguna carga C4 activa que despejar.', 'info');
      return;
    }

    this.squadCommand = cmd;
    // Toda orden nueva cancela el destino anterior. Antes, HOLD y las
    // formaciones seguían arrastrando una brecha o un marcador viejo.
    squad.investigateTarget = undefined;
    squad.targetFacingAngle = undefined;
    this.squadDoorTargetId = undefined;
    this.squadBreachAction = undefined;
    this.tacticalWaypoint = undefined;
    squad.commandNodTimer = 0.48;
    this.commandPulseTimer = 1.2;
    soundEngine.playOpticCam();
    if (cmd === 'FOLLOW') {
      squad.gestureKind = 'ADVANCE';
      squad.gestureTimer = 0.65;
      squad.speechBubble = { text: 'Verstanden, schließe auf!', timer: 1.8, type: 'COMMAND' };
      this.pushRadio('KOBRA-2', '[1] Folge Einsatzleiter (Binomio en formación).', 'info');
    } else if (cmd === 'HOLD') {
      squad.gestureKind = 'HALT';
      squad.gestureTimer = 0.65;
      squad.speechBubble = { text: 'Sichere diesen Sektor!', timer: 1.8, type: 'COMMAND' };
      this.pushRadio('KOBRA-2', '[2] Position gehalten, decke Winkel (Cubriendo sector).', 'info');
    } else if (cmd === 'BREACH_AND_CLEAR') {
      squad.gestureKind = 'BREACH';
      squad.gestureTimer = 0.65;
      squad.speechBubble = { text: 'Rücke vor zum Zugriff!', timer: 2.2, type: 'COMMAND' };
      this.pushRadio('KOBRA-2', '[3] Avanzando para brechar y despejar el sector.', 'info');
      const door = this.findSquadDoorTarget(player, squad, target);
      this.squadDoorTargetId = door?.id;
      const stack = door ? this.findTacticalStackPosition(door, player) : undefined;
      squad.investigateTarget = stack ?? {
        x: player.x + Math.cos(player.angle) * 160,
        y: player.y + Math.sin(player.angle) * 160,
      };
      if (door && stack) {
        squad.targetFacingAngle = Math.atan2(
          (door.y1 + door.y2) * 0.5 - stack.y,
          (door.x1 + door.x2) * 0.5 - stack.x
        );
      }
    } else if (cmd === 'PIE_DOOR') {
      squad.gestureKind = 'POINT';
      squad.gestureTimer = 0.65;
      squad.speechBubble = { text: 'Sonde & Winkel schneiden!', timer: 2.2, type: 'COMMAND' };
      this.pushRadio('KOBRA-2', '[4] Posicionando para sonda óptica y corte de ángulo.', 'info');
      const door = this.findSquadDoorTarget(player, squad, target);
      this.squadDoorTargetId = door?.id;
      const stack = door ? this.findTacticalStackPosition(door, player) : undefined;
      squad.investigateTarget = stack ?? {
        x: player.x + Math.cos(player.angle) * 130,
        y: player.y + Math.sin(player.angle) * 130,
      };
      if (door && stack) {
        squad.targetFacingAngle = Math.atan2(
          (door.y1 + door.y2) * 0.5 - stack.y,
          (door.x1 + door.x2) * 0.5 - stack.x
        );
      }
    } else if (cmd === 'DEPLOY_CS_GAS') {
      squad.gestureKind = 'BREACH';
      squad.gestureTimer = 0.65;
      squad.speechBubble = { text: 'CS-Reizgas bereit!', timer: 2.2, type: 'COMMAND' };
      this.pushRadio('KOBRA-2', '[5] Desplazando para lanzar granada CS.', 'info');
      const hostileMarker = this.tacticalMarkers.find(
        (m) => m.type === 'HOSTILE' || m.type === 'BREACH_ZONE'
      );
      squad.investigateTarget = {
        x: hostileMarker ? hostileMarker.x : player.x + Math.cos(player.angle) * 180,
        y: hostileMarker ? hostileMarker.y : player.y + Math.sin(player.angle) * 180,
      };
    } else if (cmd === 'RESTRAIN_AND_SECURE') {
      squad.gestureKind = 'SECURE';
      squad.gestureTimer = 0.65;
      squad.speechBubble = {
        text: 'Sichere Verdächtige, Geiseln & Beweise!',
        timer: 2.2,
        type: 'COMMAND',
      };
      this.pushRadio(
        'KOBRA-2',
        '[6] Avanzando para esposar rendidos, evacuar rehenes e incautar armas caídas.',
        'ok'
      );
    } else if (cmd === 'SUPPRESS_TARGET') {
      squad.gestureKind = 'ADVANCE';
      squad.gestureTimer = 0.65;
      squad.speechBubble = { text: 'POLIZEI! KEINE BEWEGUNG!', timer: 2.2, type: 'COMMAND' };
      this.pushRadio(
        'KOBRA-2',
        '[7] ¡Intimidación policial y supresión táctica ejecutada sobre el sector!',
        'warn'
      );
      // Suppress a threat the operator can actually see; if the suspects are
      // behind a closed door, advance to the operator's sector instead of
      // walking Kobra-2 straight into an unreachable target behind a wall.
      const suspect = this.actors
        .filter(
          (a) =>
            a.role === 'SUSPECT' &&
            a.state !== 'DEAD' &&
            a.state !== 'ARRESTED' &&
            Math.hypot(a.x - player.x, a.y - player.y) <= 520 &&
            !this.raycastWallsAndDoors(player.x, player.y, a.x, a.y)
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - squad.x, a.y - squad.y) -
            Math.hypot(b.x - squad.x, b.y - squad.y)
        )[0];
      squad.investigateTarget = {
        x: suspect ? suspect.x : player.x + Math.cos(player.angle) * 160,
        y: suspect ? suspect.y : player.y + Math.sin(player.angle) * 160,
      };
    } else if (cmd === 'REGROUP_HEAL') {
      squad.gestureKind = 'HALT';
      squad.gestureTimer = 0.65;
      squad.hp = Math.min(squad.maxHp, squad.hp + 22);
      if (squad.bodyHealth) {
        squad.bodyHealth.bleeding = false;
        squad.bodyHealth.torso = Math.min(100, squad.bodyHealth.torso + 20);
        squad.bodyHealth.arms = Math.min(100, squad.bodyHealth.arms + 20);
        squad.bodyHealth.legs = Math.min(100, squad.bodyHealth.legs + 20);
      }
      player.hp = Math.min(player.maxHp, player.hp + 15);
      if (player.bodyHealth) {
        player.bodyHealth.bleeding = false;
      }
      this.squadFatigue = Math.max(0, this.squadFatigue - 35);
      this.playerFatigue = Math.max(0, this.playerFatigue - 25);
      squad.speechBubble = {
        text: 'Sammeln! Erste Hilfe & Tourniquet angelegt!',
        timer: 2.2,
        type: 'COMMAND',
      };
      this.pushRadio(
        'KOBRA-2',
        '[8] Reagrupación completada: vendaje táctico aplicado al binomio (+HP, -Fatiga).',
        'ok'
      );
      this.squadCommand = 'FOLLOW';
    } else if (cmd === 'CLEAR_BLAST_AREA') {
      const charge = this.c4.charges.find((item) => item.phase === 'ARMED');
      const safePoint = charge ? this.findC4ClearancePoint(charge, squad) : undefined;
      if (!charge || !safePoint) {
        this.squadCommand = 'HOLD';
        this.pushRadio('KOBRA-2', 'No encuentro una ruta segura fuera del radio de la C4.', 'warn');
        return;
      }
      squad.gestureKind = 'ADVANCE';
      squad.gestureTimer = 0.65;
      squad.speechBubble = { text: 'Sprengzone räumen!', timer: 2.0, type: 'COMMAND' };
      squad.investigateTarget = safePoint;
      squad.targetFacingAngle = Math.atan2(charge.y - safePoint.y, charge.x - safePoint.x);
      this.pushRadio(
        'KOBRA-2',
        `[J] Despejando la zona de ${charge.targetName}: punto seguro a ${Math.round(Math.hypot(safePoint.x - charge.x, safePoint.y - charge.y))} px.`,
        'warn'
      );
    } else if (cmd === 'FORM_WEDGE') {
      squad.gestureKind = 'POINT';
      squad.gestureTimer = 0.55;
      squad.speechBubble = { text: 'Keilformation! Decke Flanke!', timer: 1.8, type: 'COMMAND' };
      this.pushRadio('KOBRA-2', '[9] Adoptando formación en cuña para cobertura de flancos.', 'ok');
    } else if (cmd === 'FORM_STAGGERED') {
      squad.gestureKind = 'ADVANCE';
      squad.gestureTimer = 0.55;
      squad.speechBubble = { text: 'Staffelformation! Vorrücken!', timer: 1.8, type: 'COMMAND' };
      this.pushRadio('KOBRA-2', '[0] Pasando a formación escalonada para avance táctico.', 'ok');
    }

    // La confirmación de Kobra-2 es sólo la burbuja de texto situacional;
    // el binomio no locuta cada orden para no narrar constantemente sus acciones.

    // Las órdenes apuntadas desde el menú contextual conservan su punto exacto.
    // Brecha y sonda ya fijaron su puerta y su posición de pila arriba.
    if (target && cmd !== 'BREACH_AND_CLEAR' && cmd !== 'PIE_DOOR') {
      squad.investigateTarget = { x: target.x, y: target.y };
      squad.targetFacingAngle = Math.atan2(target.y - squad.y, target.x - squad.x);
      this.tacticalWaypoint = {
        x: Math.round(target.x),
        y: Math.round(target.y),
        label: target.name,
      };
    }

    // Anchor Kobra-2's base sector angle so he never spins when holding or executing an order.
    // Toda orden limpia el waypoint anterior, así que el destino sólo puede ser el target.
    const anchorTarget = squad.investigateTarget as Vec2 | undefined;
    this.squadHoldAnchorAngle = anchorTarget
      ? Math.atan2(anchorTarget.y - squad.y, anchorTarget.x - squad.x)
      : player.angle;

    // Dynamic visual confirmation signal centered over Agent Kobra-2 on Canvas
    this.impactRings.push({
      x: squad.x,
      y: squad.y,
      radius: 4,
      maxRadius: 48,
      color: '#10B981',
      alpha: 1.0,
    });
    this.impactRings.push({
      x: squad.x,
      y: squad.y,
      radius: 12,
      maxRadius: 64,
      color: '#38BDF8',
      alpha: 0.82,
    });

    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      const spd = 45 + Math.random() * 55;
      this.particles.push({
        x: squad.x,
        y: squad.y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.45,
        maxLife: 0.45,
        color: i % 2 === 0 ? '#10B981' : '#34D399',
        size: 3.2,
        shape: 'SPARK',
      });
    }

    this.impactPopups.push({
      x: squad.x + (Math.random() - 0.5) * 8,
      y: squad.y - squad.radius - 22,
      vy: -22,
      text: '✓ ORDEN ACEPTADA (KOBRA-2)',
      color: '#34D399',
      life: 1.25,
      maxLife: 1.25,
    });

    // If order has a target destination, also spawn green target beacon signal
    const targetPos = squad.investigateTarget || this.tacticalWaypoint;
    if (targetPos) {
      this.impactRings.push({
        x: targetPos.x,
        y: targetPos.y,
        radius: 3,
        maxRadius: 38,
        color: '#10B981',
        alpha: 0.95,
      });
      this.impactPopups.push({
        x: targetPos.x,
        y: targetPos.y - 16,
        vy: -18,
        text: '➔ PUNTO OBJETIVO',
        color: '#A7F3D0',
        life: 1.15,
        maxLife: 1.15,
      });
    }

    soundEngine.playBiometricLock(false);
    this.emitHudSnapshot();
  }

  public fireActiveWeapon() {
    const player = this.getPlayer();
    if (!player || player.state === 'DEAD' || this.fireCooldown > 0 || this.reloadTimer > 0) return;
    if (this.investigationMode) {
      this.pushRadio('KOBRA-1', 'Disparo no autorizado en modo investigación. Usa arresto y negociación.', 'warn');
      soundEngine.playRoePenalty();
      return;
    }

    this.mirrorDoorId = null;
    this.thermalActive = false;
    player.recoilTimer = 0.14;
    player.alertLevel = 'COMBAT';

    if (this.activeTool === 'TASER') {
      if (this.taserCharges <= 0) {
        this.pushRadio('KOBRA-1', 'Taser X2 keine Kartuschen mehr!', 'warn');
        return;
      }
      this.taserCharges -= 1;
      this.fireCooldown = 0.45;
      soundEngine.playTaser();
      this.castProjectile(player, player.angle, 260, 0, true);
      this.emitHudSnapshot();
      return;
    }

    if (this.ammoInMag <= 0) {
      this.reloadWeapon();
      return;
    }

    const spec = EKO_COBRA_WEAPONS[this.plan.primaryWeapon];
    const attachment = EKO_COBRA_ATTACHMENTS[this.plan.attachment ?? 'NONE'];
    const ammoSpec = EKO_COBRA_AMMO[this.plan.ammoType ?? 'FMJ_STANDARD'];

    this.ammoInMag -= 1;
    this.fireCooldown = 60 / spec.rpm;
    this.lastPlayerShotTime = this.elapsedSeconds;
    this.playerDarknessTimer = 0;
    this.playerHiddenInShadow = false;
    const focusedAim = this.isFocusedAiming();
    // Dynamic camera shake scaling by weapon caliber (reduced by 25% when braced in Focused Aim)
    const weaponShake =
      (this.plan.primaryWeapon === 'AUG_A3'
        ? 5.8 // 5.56x45mm NATO (High recoil, 780 RPM)
        : this.plan.primaryWeapon === 'MP7A1'
          ? 3.4 // 4.6x30mm Armor Piercing PDW
          : this.plan.primaryWeapon === 'AUG_PARA'
            ? 2.8 // 9x19mm Parabellum Subsonic SMG
            : 2.2) * (focusedAim ? 0.75 : 1.0); // 9x19mm Glock 17 Pistol
    this.shakeIntensity = Math.min(15, this.shakeIntensity + weaponShake);
    if (this.shakeIntensity > this.peakRecordedShake) {
      this.peakRecordedShake = +this.shakeIntensity.toFixed(1);
    }
    if (this.isTrainingMode) {
      this.trainingShotsFired++;
      // Immediate replenishment in training mode so player can test continuous automatic bursts
      if (this.ammoInMag <= 0) {
        this.ammoInMag = spec.magSize;
      }
    }

    const isSuppressedSound =
      attachment.soundType === 'SUPPRESSED' ||
      this.plan.primaryWeapon === 'AUG_PARA' ||
      this.plan.primaryWeapon === 'MP7A1';

    soundEngine.playGunshot(
      isSuppressedSound
        ? 'SUPPRESSED'
        : this.plan.primaryWeapon === 'AUG_A3'
          ? 'AUG'
          : 'PISTOL'
    );

    const bh = player.bodyHealth;
    const armDamagePenalty = bh ? ((100 - bh.arms) / 100) * 0.16 : 0;
    const bleedSpreadPenalty = bh?.bleeding ? 0.065 + bh.woundsCount * 0.02 : 0;
    const fatigueRatio = this.playerFatigue / 100;
    // Fatigue progressively degrades weapon accuracy & grouping until the operator stops and rests
    const fatigueSpreadPenalty = fatigueRatio * 0.21 + Math.pow(fatigueRatio, 2) * 0.09;
    // Focused Aiming (EKO Cobra Präzisionsanschlag) tightens weapon dispersion by 38%
    const focusedSpreadMult = focusedAim ? 0.62 : 1.0;
    const effectiveSpread =
      (spec.spread * attachment.spreadMult + armDamagePenalty + bleedSpreadPenalty + fatigueSpreadPenalty) *
      focusedSpreadMult;

    const finalDamage = Math.round(spec.damage * ammoSpec.damageMult);

    const spreadOffset = (Math.random() - 0.5) * effectiveSpread;
    this.castProjectile(
      player,
      player.angle + this.aimTremorOffset + spreadOffset,
      900,
      finalDamage,
      false
    );

    const roomCode = this.getRoomAt(player.x, player.y);
    const roomObj = this.rooms.find((r) => r.id === roomCode);
    const roomLabel = roomObj ? roomObj.nameDe : 'EXTERIOR';
    const accuracyPct = Math.min(100, Math.round((1 - effectiveSpread) * 100));
    this.logCriticalEvent(
      'SHOT_FIRED',
      `Percusión con ${spec.name}`,
      roomLabel,
      'INFO',
      {
        actorName: 'Kobra-1',
        details: `Disparo ejecutado en ${roomLabel} · Precisión estimada: ${accuracyPct}%`,
      }
    );

    this.emitHudSnapshot();
  }

  protected castProjectile(
    shooter: ActorEntity,
    angle: number,
    range: number,
    damage: number,
    isTaser: boolean
  ) {
    const startX = shooter.x + Math.cos(angle) * 16;
    const startY = shooter.y + Math.sin(angle) * 16;
    let endX = startX + Math.cos(angle) * range;
    let endY = startY + Math.sin(angle) * range;

    const barrelCos = Math.cos(shooter.angle);
    const barrelSin = Math.sin(shooter.angle);
    const isOperator = shooter.role === 'PLAYER' || shooter.role === 'SQUAD';
    // Exact barrel tip offset (23.5px forward, 2.0px right-shoulder offset for operators)
    const muzzleX = isOperator
      ? shooter.x + barrelCos * 23.5 - barrelSin * 2.0
      : shooter.x + Math.cos(angle) * 18;
    const muzzleY = isOperator
      ? shooter.y + barrelSin * 23.5 + barrelCos * 2.0
      : shooter.y + Math.sin(angle) * 18;

    // Spawn a dynamic muzzle-flash point light in the dark room!
    this.pointLights.push({
      x: muzzleX,
      y: muzzleY,
      radius: isTaser ? 150 : 285,
      color: isTaser ? 'rgba(56, 189, 248, 0.45)' : 'rgba(251, 146, 60, 0.55)',
      life: 0.08,
      maxLife: 0.08,
    });

    const isSuppressed = isOperator && this.plan.primaryWeapon === 'AUG_PARA';
    const shotDb = isTaser ? 42 : isSuppressed ? 64 : 135;
    const shotRadius = isTaser ? 190 : isSuppressed ? 320 : 1150;
    this.emitNoise(
      muzzleX,
      muzzleY,
      shotDb,
      shotRadius,
      isTaser ? 'Disparo de Taser X2' : isSuppressed ? 'Disparo Subsonico Silenciado (9mm)' : 'Disparo Calibre Abierto',
      isTaser ? '#38BDF8' : isSuppressed ? '#10B981' : '#EF4444'
    );

    // Short-lived yellow-orange muzzle flash particle at the tip of the operator's weapon
    if (!isTaser && isOperator) {
      const flashDuration = 0.075;
      this.particles.push({
        x: muzzleX,
        y: muzzleY,
        vx: barrelCos * 24,
        vy: barrelSin * 24,
        life: flashDuration,
        maxLife: flashDuration,
        color: '#F59E0B',
        size: 14 + Math.random() * 3.5,
        shape: 'MUZZLE_FLASH',
        rotation: shooter.angle + (Math.random() - 0.5) * 0.14,
        drag: 0.82,
      });

      // Rapidly fading yellow-orange incandescent gas & spark particles from barrel ports
      const sparkColors = ['#FEF08A', '#FACC15', '#F59E0B', '#F97316', '#EA580C'];
      for (let i = 0; i < 5; i++) {
        const coneAng = shooter.angle + (Math.random() - 0.5) * 0.65;
        const spd = 95 + Math.random() * 140;
        const pLife = 0.045 + Math.random() * 0.04;
        this.particles.push({
          x: muzzleX,
          y: muzzleY,
          vx: Math.cos(coneAng) * spd,
          vy: Math.sin(coneAng) * spd,
          life: pLife,
          maxLife: pLife,
          color: sparkColors[i % sparkColors.length],
          size: 2.2 + Math.random() * 2.0,
          shape: i % 2 === 0 ? 'SPARK' : 'CIRCLE',
          rotation: coneAng,
          drag: 0.84,
        });
      }
    }

    // Eject spinning brass shell casing from weapon ejection port & propagate gunshot acoustics
    if (!isTaser) {
      const ejectAngle = angle + Math.PI * 0.5 + (Math.random() - 0.5) * 0.45;
      const ejectSpd = 65 + Math.random() * 55;
      this.particles.push({
        x: shooter.x + Math.cos(angle) * 8,
        y: shooter.y + Math.sin(angle) * 8,
        vx: Math.cos(ejectAngle) * ejectSpd,
        vy: Math.sin(ejectAngle) * ejectSpd,
        life: 1.35,
        maxLife: 1.35,
        color: '#FBBF24',
        size: 3.2,
        shape: 'CASING',
        rotation: angle,
        vRot: (Math.random() - 0.5) * 22,
        drag: 0.88,
      });

      // Persistent brass shell casing decal on the floor where the shell settles
      if (this.decals.length > 320) this.decals.shift();
      const restDist = 14 + Math.random() * 18;
      this.decals.push({
        x: shooter.x + Math.cos(ejectAngle) * restDist,
        y: shooter.y + Math.sin(ejectAngle) * restDist,
        radius: 2.4,
        color: '#F59E0B',
        alpha: 0.85,
        type: 'CASING',
        angle: ejectAngle + (Math.random() - 0.5) * 1.4,
        aspect: 0.42,
      });

      this.propagateGunshotAlert(shooter, startX, startY);
    }

    const surfaceHit = this.raycastSurface(startX, startY, endX, endY);
    if (surfaceHit) {
      endX = surfaceHit.x;
      endY = surfaceHit.y;
    }

    let hitActor: ActorEntity | null = null;
    let closestDist = Math.hypot(endX - startX, endY - startY);

    for (const actor of this.actors) {
      if (actor.id === shooter.id || actor.state === 'DEAD') continue;
      const hitDist = this.rayCircleIntersect(
        startX,
        startY,
        endX,
        endY,
        actor.x,
        actor.y,
        actor.radius + 2
      );
      if (hitDist !== null && hitDist < closestDist) {
        closestDist = hitDist;
        hitActor = actor;
        endX = startX + Math.cos(angle) * hitDist;
        endY = startY + Math.sin(angle) * hitDist;
      }
    }

    if (!isTaser) {
      for (const sconce of this.wallSconces) {
        if (sconce.isDestroyed) continue;
        const hDist = this.rayCircleIntersect(startX, startY, endX, endY, sconce.x, sconce.y, 10);
        if (hDist !== null && hDist < closestDist) {
          closestDist = hDist;
          sconce.isDestroyed = true;
          sconce.isOn = false;
          endX = startX + Math.cos(angle) * hDist;
          endY = startY + Math.sin(angle) * hDist;
          this.impactPopups.push({
            x: sconce.x,
            y: sconce.y - 12,
            vy: -40,
            text: 'LUZ ROTA',
            color: '#EF4444',
            life: 0.85,
            maxLife: 0.85,
          });
          for (let i = 0; i < 6; i++) {
            this.particles.push({
              x: sconce.x,
              y: sconce.y,
              vx: (Math.random() - 0.5) * 140,
              vy: (Math.random() - 0.5) * 140,
              life: 0.5,
              maxLife: 0.5,
              color: '#F1F5F9',
              size: 2.2,
              shape: 'SHARD',
            });
          }
        }
      }
    }

    this.traces.push({
      x1: startX,
      y1: startY,
      x2: endX,
      y2: endY,
      color: isTaser ? '#38BDF8' : shooter.role === 'SUSPECT' ? '#EF4444' : '#F59E0B',
      alpha: 0.95,
      isTaser,
    });

    if (shooter.role === 'SUSPECT') {
      const player = this.getPlayer();
      if (player) {
        const distToPlayerLine = this.distToSegment(player.x, player.y, startX, startY, endX, endY);
        if (distToPlayerLine < 90) {
          this.suppressionTimer = 1.45;
          this.shakeIntensity = Math.max(this.shakeIntensity, 16);
        }
      }
    }

    if (hitActor) {
      const hitZone = this.computeBallisticHitZone(shooter, hitActor, endX, endY);
      this.spawnActorImpactEffects(hitActor, endX, endY, angle, isTaser, hitZone);
      // Visual hit confirmation for the player's shots (no mechanics change).
      if (shooter.role === 'PLAYER') {
        this.refractionRings.push({
          x: endX,
          y: endY,
          radius: 4,
          maxRadius: 46,
          alpha: 0.85,
          strength: 0.6,
        });
        this.impactPopups.push({
          x: endX,
          y: endY - 14,
          vy: -55,
          text: 'TREFFER',
          color: '#FBBF24',
          life: 0.55,
          maxLife: 0.55,
        });
      }
      this.resolveProjectileHit(shooter, hitActor, damage, isTaser, hitZone, angle);

      // Over-penetration / graze environmental mark on wall or furniture closely behind hit actor
      if (!isTaser && surfaceHit) {
        const distBehind = Math.hypot(surfaceHit.x - endX, surfaceHit.y - endY);
        if (distBehind < 68) {
          this.spawnSurfaceDebrisEffects(
            surfaceHit.x,
            surfaceHit.y,
            angle,
            false,
            surfaceHit.kind,
            surfaceHit.color
          );
        }
      }
    } else if (surfaceHit) {
      this.spawnSurfaceDebrisEffects(endX, endY, angle, isTaser, surfaceHit.kind, surfaceHit.color);

      // Close-range Ballistic Door Lock Shooting: Shatter door lock handle
      if (!isTaser && surfaceHit.kind === 'DOOR') {
        const hitDoor = this.doors.find(
          (d) =>
            d.isLocked &&
            !d.isOpen &&
            this.distToSegment(surfaceHit.x, surfaceHit.y, d.x1, d.y1, d.x2, d.y2) < 16
        );
        if (hitDoor) {
          hitDoor.isLocked = false;
          hitDoor.isOpen = true;
          hitDoor.currentAngle = hitDoor.openAngle;
          const kickListener = this.getPlayer();
          soundEngine.playDoorBreachSpatial(
            'KICK',
            false,
            surfaceHit.x,
            surfaceHit.y,
            kickListener?.x ?? surfaceHit.x,
            kickListener?.y ?? surfaceHit.y
          );
          soundEngine.playMaterialImpact('METAL');
          this.impactPopups.push({
            x: surfaceHit.x,
            y: surfaceHit.y - 12,
            vy: -40,
            text: '¡CERRADURA DESTRUIDA!',
            color: '#FBBF24',
            life: 1.1,
            maxLife: 1.1,
          });
          this.pushRadio(
            'KOBRA-1',
            `¡Cerradura de ${hitDoor.name} destruida por disparo balístico de precisión! Puerta forzada.`,
            'info'
          );
          for (let i = 0; i < 14; i++) {
            const a = angle + Math.PI + (Math.random() - 0.5) * 1.5;
            const s = 50 + Math.random() * 120;
            this.particles.push({
              x: surfaceHit.x,
              y: surfaceHit.y,
              vx: Math.cos(a) * s,
              vy: Math.sin(a) * s,
              life: 0.35,
              maxLife: 0.35,
              color: i % 2 === 0 ? '#FDE047' : '#D97706',
              size: 2.8,
              shape: i % 2 === 0 ? 'SPARK' : 'SHARD',
            });
          }
        }
      }

      // Ballistic Wall & Door Penetration (FMJ / AP Ammo Passthrough)
      if (!isTaser && (surfaceHit.kind === 'WALL' || surfaceHit.kind === 'DOOR')) {
        const isAp = this.plan.ammoType === 'AP_PIERCING';
        const isFmj = this.plan.ammoType === 'FMJ_STANDARD' || !this.plan.ammoType;
        if (isAp || isFmj) {
          const penDist = isAp ? 180 : 130;
          const penEndX = surfaceHit.x + Math.cos(angle) * penDist;
          const penEndY = surfaceHit.y + Math.sin(angle) * penDist;
          let penHitActor: ActorEntity | null = null;
          let penClosest = penDist;

          for (const actor of this.actors) {
            if (actor.id === shooter.id || actor.state === 'DEAD') continue;
            const hDist = this.rayCircleIntersect(
              surfaceHit.x,
              surfaceHit.y,
              penEndX,
              penEndY,
              actor.x,
              actor.y,
              actor.radius + 2
            );
            if (hDist !== null && hDist < penClosest) {
              penClosest = hDist;
              penHitActor = actor;
            }
          }

          if (penHitActor) {
            const penDamage = Math.round(damage * (isAp ? 0.8 : 0.62));
            const hitZone = this.computeBallisticHitZone(shooter, penHitActor, penEndX, penEndY);
            this.spawnActorImpactEffects(penHitActor, penHitActor.x, penHitActor.y, angle, false, hitZone);
            this.resolveProjectileHit(shooter, penHitActor, penDamage, false, hitZone, angle);
            this.impactPopups.push({
              x: penHitActor.x,
              y: penHitActor.y - 20,
              vy: -25,
              text: isAp ? '¡BALA PERFORANTE (AP)!' : '¡IMPACTO TRAS COBERTURA (FMJ)!',
              color: '#F59E0B',
              life: 1.1,
              maxLife: 1.1,
            });
          }

          this.traces.push({
            x1: surfaceHit.x,
            y1: surfaceHit.y,
            x2: penEndX,
            y2: penEndY,
            color: isAp ? '#F59E0B' : '#FDE047',
            alpha: 0.5,
            isTaser: false,
          });
        }
      }

      if (!isTaser && surfaceHit.kind === 'FURNITURE') {
        const hitFurniture = this.furniture.find(
          (f) =>
            !f.isDestroyed &&
            surfaceHit.x >= f.x - 6 &&
            surfaceHit.x <= f.x + f.w + 6 &&
            surfaceHit.y >= f.y - 6 &&
            surfaceHit.y <= f.y + f.h + 6
        ) || this.furniture.reduce<{ item: FurnitureItem | null; dist: number }>(
          (acc, f) => {
            if (f.isDestroyed) return acc;
            const cx = f.x + f.w * 0.5;
            const cy = f.y + f.h * 0.5;
            const d = Math.hypot(cx - surfaceHit.x, cy - surfaceHit.y);
            if (d < acc.dist && d < Math.max(f.w, f.h) * 1.2) {
              return { item: f, dist: d };
            }
            return acc;
          },
          { item: null, dist: 9999 }
        ).item;

        if (hitFurniture) {
          hitFurniture.maxHp = hitFurniture.maxHp || 45;
          hitFurniture.hp = hitFurniture.hp !== undefined ? hitFurniture.hp : hitFurniture.maxHp;
          hitFurniture.hp -= damage;

          if (hitFurniture.hp <= 0 && !hitFurniture.isDestroyed) {
            hitFurniture.isDestroyed = true;
            hitFurniture.blocksMovement = false;
            hitFurniture.blocksSight = false;
            const c4Listener = this.getPlayer();
            soundEngine.playDoorBreachSpatial(
              'C4',
              false,
              surfaceHit.x,
              surfaceHit.y,
              c4Listener?.x ?? surfaceHit.x,
              c4Listener?.y ?? surfaceHit.y
            );
            this.impactPopups.push({
              x: surfaceHit.x,
              y: surfaceHit.y - 12,
              vy: -45,
              text: '¡MUEBLE DESTRUIDO!',
              color: '#EF4444',
              life: 1.0,
              maxLife: 1.0,
            });
            for (let p = 0; p < 18; p++) {
              const ang = Math.random() * Math.PI * 2;
              const spd = 40 + Math.random() * 180;
              this.particles.push({
                x: surfaceHit.x,
                y: surfaceHit.y,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd,
                life: 0.5 + Math.random() * 0.5,
                maxLife: 1.0,
                color: p % 2 === 0 ? '#D97706' : '#78350F',
                size: 3.5 + Math.random() * 3,
                shape: 'SHARD',
                rotation: Math.random() * Math.PI * 2,
                vRot: (Math.random() - 0.5) * 12,
              });
            }
          }
        }
      }
    }
  }

  protected propagateGunshotAlert(shooter: ActorEntity, shotX: number, shotY: number) {
    const attachment = EKO_COBRA_ATTACHMENTS[this.plan.attachment ?? 'NONE'];
    const isSuppressed =
      (shooter.role === 'PLAYER' || shooter.role === 'SQUAD') &&
      (attachment.soundType === 'SUPPRESSED' ||
        this.plan.primaryWeapon === 'AUG_PARA' ||
        this.plan.primaryWeapon === 'MP7A1');
    const baseRadius = isSuppressed ? 250 : 680;
    const acousticRadius = Math.round(baseRadius * (shooter.role === 'PLAYER' ? attachment.noiseRadiusMult : 1.0));

    let newlyAlertedCount = 0;
    for (const actor of this.actors) {
      if (
        actor.id === shooter.id ||
        actor.role === 'PLAYER' ||
        actor.role === 'SQUAD' ||
        actor.state === 'DEAD' ||
        actor.state === 'ARRESTED'
      ) {
        continue;
      }

      const dist = Math.hypot(actor.x - shotX, actor.y - shotY);
      if (dist > acousticRadius) continue;

      if (actor.role === 'SUSPECT') {
        if (
          actor.state === 'SURRENDERED' ||
          actor.state === 'INCAPACITATED' ||
          actor.state === 'FEIGNING_SURRENDER'
        ) {
          continue;
        }

        const wasUnaware = actor.state === 'UNAWARE' || actor.state === 'HESITATING';
        if (wasUnaware) {
          actor.state = 'ALERTED';
          newlyAlertedCount++;
        }

        actor.alertLevel = 'COMBAT';
        actor.stress = Math.min(100, actor.stress + 18);
        actor.angle = Math.atan2(shotY - actor.y, shotX - actor.x);
        actor.investigateTarget = { x: shotX, y: shotY };
        actor.investigateTimer = 4.2;

        if (!actor.speechBubble && wasUnaware) {
          const alertLines = [
            'Schüsse gehört! Ich laufe hin!',
            'Feuergefecht im Nebenzimmer! Bewegung!',
            'Was war das?! Waffen bereit!',
          ];
          actor.speechBubble = {
            text: alertLines[Math.floor(Math.random() * alertLines.length)],
            timer: 2.0,
            type: 'HOSTILE',
          };
        }
      } else if (
        (actor.role === 'HOSTAGE' || actor.role === 'CIVILIAN') &&
        actor.state === 'UNAWARE'
      ) {
        actor.state = 'FLEEING';
        actor.speechBubble = {
          text: 'Schüsse! Hilfe, ich renne weg!',
          timer: 2.2,
          type: 'PANIC',
        };
      }
    }

    if (newlyAlertedCount > 0) {
      this.pushRadio(
        'KOBRA-2',
        `ACHTUNG: Schussgeräusch hat ${newlyAlertedCount} Verdächtige alarmiert — Schritte in Bewegung!`,
        'warn'
      );
    }

    // Register peripheral screen-edge acoustic indicator if a non-player gunshot occurs outside Kobra-1's direct FOV
    if (shooter.role !== 'PLAYER') {
      this.registerAcousticEdgeCue(
        shooter.id,
        shotX,
        shotY,
        'GUNSHOT',
        1.0,
        1.65,
        shooter.role === 'SUSPECT' ? 'DISPARO HOSTIL' : 'DISPARO KOBRA-2'
      );
    }
  }

  /**
   * Registers or refreshes a subtle peripheral screen-edge directional indicator
   * when gunshots or suspicious footsteps/voices originate outside Kobra-1's direct line of sight / FOV cone.
   */
  protected registerAcousticEdgeCue(
    sourceId: string,
    x: number,
    y: number,
    kind: 'GUNSHOT' | 'FOOTSTEP' | 'ALERT_VOICE',
    intensity: number,
    duration: number,
    label: string
  ) {
    const player = this.getPlayer();
    if (!player) return;

    const dist = Math.hypot(x - player.x, y - player.y);
    if (dist < 28) return;

    // Check if the sound source is already directly inside Kobra-1's unoccluded forward FOV cone
    const hasLOS = !this.raycastWallsAndDoors(player.x, player.y, x, y);
    const angleToSource = Math.atan2(y - player.y, x - player.x);
    const fovBoost = EKO_COBRA_INSPECTION_DEVICES[this.plan.inspectionDevice].fovBoost;
    const halfFov = 0.61 + fovBoost * 0.5;
    const angleDiff = Math.abs(this.normalizeAngle(angleToSource - player.angle));
    const maxVisRange =
      (this.flashlightOn ? 520 : 250) * this.getWeatherVisibilityMultiplier(player.x, player.y);

    // Only display the peripheral acoustic cue if the source is occluded by walls/doors OR outside the operator's FOV cone
    if (hasLOS && angleDiff <= halfFov && dist <= maxVisRange) {
      return;
    }

    const existing = this.acousticIndicators.find(
      (ind) => ind.sourceId === sourceId && ind.kind === kind
    );
    if (existing) {
      existing.x = x;
      existing.y = y;
      existing.intensity = Math.max(existing.intensity, intensity);
      existing.life = duration;
      existing.maxLife = duration;
      existing.label = label;
      return;
    }

    if (this.acousticIndicators.length >= 10) {
      this.acousticIndicators.shift();
    }
    this.acousticIndicators.push({
      id: `${sourceId}_${kind}_${this.elapsedSeconds.toFixed(2)}`,
      sourceId,
      x,
      y,
      kind,
      intensity,
      life: duration,
      maxLife: duration,
      label,
    });
  }

  protected spawnSurfaceDebrisEffects(
    x: number,
    y: number,
    bulletAngle: number,
    isTaser: boolean,
    surfaceKind: 'WALL' | 'DOOR' | 'FURNITURE',
    surfaceColor?: string
  ) {
    const mat = surfaceKind === 'DOOR' ? 'WOOD' : surfaceKind === 'FURNITURE' ? 'METAL' : 'WALL';
    soundEngine.playMaterialImpact(mat);

    if (isTaser) {
      for (let i = 0; i < 9; i++) {
        const a = bulletAngle + Math.PI + (Math.random() - 0.5) * 1.6;
        const s = 45 + Math.random() * 110;
        this.particles.push({
          x,
          y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: 0.22 + Math.random() * 0.14,
          maxLife: 0.36,
          color: i % 2 === 0 ? '#38BDF8' : '#E0F2FE',
          size: 2.5,
          shape: 'SPARK',
        });
      }
      return;
    }

    // 1. Ricochet sparks & hot ballistic fragments bouncing back from wall/door/furniture
    const palette =
      surfaceKind === 'DOOR'
        ? ['#D97706', '#92400E', '#FBBF24', '#78350F']
        : surfaceKind === 'FURNITURE'
          ? [surfaceColor || '#64748B', '#94A3B8', '#CBD5E1', '#F59E0B']
          : ['#CBD5E1', '#94A3B8', '#64748B', '#FDE047'];

    for (let i = 0; i < 14; i++) {
      const a = bulletAngle + Math.PI + (Math.random() - 0.5) * 1.75;
      const s = 45 + Math.random() * 165;
      const isSpark = i < 4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.26 + Math.random() * 0.32,
        maxLife: 0.58,
        color: isSpark ? '#FDE047' : palette[i % palette.length],
        size: isSpark ? 2.4 : 2.8 + Math.random() * 2.4,
        shape: isSpark ? 'SPARK' : 'SHARD',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 18,
      });
    }

    // 2. Concrete / plaster / wood dust puff at bullet impact site
    for (let i = 0; i < 4; i++) {
      const a = bulletAngle + Math.PI + (Math.random() - 0.5) * 1.2;
      const s = 15 + Math.random() * 38;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.42 + Math.random() * 0.25,
        maxLife: 0.67,
        color: surfaceKind === 'DOOR' ? 'rgba(217, 119, 6, 0.42)' : 'rgba(148, 163, 184, 0.42)',
        size: 7 + Math.random() * 6,
        shape: 'MIST',
        drag: 0.86,
      });
    }

    // 3. Persistent rubble / plaster chips & scorch marks on the floor near impact
    if (this.decals.length > 320) this.decals.shift();
    this.decals.push({
      x: x + Math.cos(bulletAngle + Math.PI) * (4 + Math.random() * 9),
      y: y + Math.sin(bulletAngle + Math.PI) * (4 + Math.random() * 9),
      radius: 3 + Math.random() * 3.8,
      color: surfaceKind === 'DOOR' ? '#92400E' : surfaceColor || '#64748B',
      alpha: 0.7,
      type: 'DEBRIS',
      angle: Math.random() * Math.PI * 2,
      aspect: 0.5 + Math.random() * 0.4,
    });

    this.impactRings.push({
      x,
      y,
      radius: 2,
      maxRadius: 15,
      color: surfaceKind === 'DOOR' ? '#F59E0B' : '#CBD5E1',
      alpha: 0.75,
    });

    // 5. If ballistic impact hits an exterior window section, crack or shatter/breach it!
    if (surfaceKind === 'WALL') {
      const hitWin = this.findNearestExteriorWindow(x, y, 16);
      if (hitWin && !hitWin.isBreached) {
        hitWin.damageHits += 1;
        if (hitWin.damageHits >= 2) {
          this.executeExteriorWindowBreach(hitWin, 'BALLISTIC');
        } else {
          for (let i = 0; i < 10; i++) {
            const ang = hitWin.normalAngle + (Math.random() - 0.5) * 1.1;
            const spd = 45 + Math.random() * 95;
            this.particles.push({
              x,
              y,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              life: 0.4 + Math.random() * 0.3,
              maxLife: 0.7,
              color: '#BAE6FD',
              size: 2.6,
              shape: 'SHARD',
            });
          }
        }
      }
    }
  }

  protected spawnActorImpactEffects(
    target: ActorEntity,
    hitX: number,
    hitY: number,
    bulletAngle: number,
    isTaser: boolean,
    hitZone: HitZone
  ) {
    // Trigger actor hit-reaction animation & directional jolt
    target.hitReactionTimer = 0.28;
    target.hitFlashTimer = 0.14;
    target.hitAngle = bulletAngle;

    const isArmoredHit =
      !isTaser &&
      hitZone === 'TORSO' &&
      ((target.role === 'PLAYER' && this.armor > 0) || target.role === 'SQUAD');

    target.lastHitType = isTaser ? 'TASER' : isArmoredHit ? 'ARMOR' : 'BLOOD';

    // Apply physical knockback impulse along bullet vector
    const knockbackDist = isTaser ? 3.5 : isArmoredHit ? 5.0 : 8.5;
    this.moveActorWithCollision(
      target,
      target.x + Math.cos(bulletAngle) * knockbackDist,
      target.y + Math.sin(bulletAngle) * knockbackDist
    );

    if (isTaser) {
      for (let i = 0; i < 14; i++) {
        const a = bulletAngle + Math.PI + (Math.random() - 0.5) * 2.2;
        const s = 50 + Math.random() * 130;
        this.particles.push({
          x: hitX,
          y: hitY,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: 0.28 + Math.random() * 0.18,
          maxLife: 0.46,
          color: i % 2 === 0 ? '#38BDF8' : '#FACC15',
          size: 2.8,
          shape: 'SPARK',
        });
      }
      this.impactRings.push({
        x: hitX,
        y: hitY,
        radius: 3,
        maxRadius: 22,
        color: '#38BDF8',
        alpha: 0.9,
      });
      return;
    }

    // 1. High-velocity exit-wound blood spray cone & arterial droplets
    const bloodColors = ['#EF4444', '#DC2626', '#B91C1C', '#991B1B', '#7F1D1D'];
    const sprayCount = isArmoredHit ? 12 : 22;
    for (let i = 0; i < sprayCount; i++) {
      // Half spray forward (exit wound), half splash radially/backward (entry wound)
      const isExitSpray = i < sprayCount * 0.65;
      const a = isExitSpray
        ? bulletAngle + (Math.random() - 0.5) * 0.85
        : bulletAngle + Math.PI + (Math.random() - 0.5) * 1.6;
      const s = isExitSpray ? 75 + Math.random() * 195 : 35 + Math.random() * 105;
      this.particles.push({
        x: hitX,
        y: hitY,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.32 + Math.random() * 0.35,
        maxLife: 0.67,
        color: bloodColors[i % bloodColors.length],
        size: 2.4 + Math.random() * 3.2,
        shape: i % 3 === 0 ? 'CIRCLE' : 'SQUARE',
        drag: 0.9,
      });
    }

    // 2. Fine crimson blood mist / aerosol puff at impact point
    for (let i = 0; i < 5; i++) {
      const a = bulletAngle + (Math.random() - 0.5) * 1.4;
      const s = 18 + Math.random() * 45;
      this.particles.push({
        x: hitX,
        y: hitY,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.38 + Math.random() * 0.22,
        maxLife: 0.6,
        color: 'rgba(185, 28, 28, 0.52)',
        size: 8 + Math.random() * 7,
        shape: 'MIST',
        drag: 0.85,
      });
    }

    // 3. Equipment / Kevlar / Cloth debris shards flying off on impact
    const debrisCount = isArmoredHit ? 12 : 7;
    for (let i = 0; i < debrisCount; i++) {
      const a = bulletAngle + Math.PI + (Math.random() - 0.5) * 2.1;
      const s = 55 + Math.random() * 150;
      const isSpark = isArmoredHit && i < 6;
      this.particles.push({
        x: hitX,
        y: hitY,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.28 + Math.random() * 0.25,
        maxLife: 0.53,
        color: isSpark
          ? '#FDE047'
          : target.role === 'PLAYER' || target.role === 'SQUAD'
            ? '#334155'
            : '#64748B',
        size: isSpark ? 2.5 : 3.2,
        shape: isSpark ? 'SPARK' : 'SHARD',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 20,
      });
    }

    // 4. Persistent Floor Blood Splatter Decals along the exit trajectory
    const decalCount = isArmoredHit ? 2 : 4;
    for (let i = 0; i < decalCount; i++) {
      if (this.decals.length > 260) this.decals.shift();
      const dist = 6 + Math.random() * 28;
      const spreadAng = bulletAngle + (Math.random() - 0.5) * 0.65;
      this.decals.push({
        x: target.x + Math.cos(spreadAng) * dist,
        y: target.y + Math.sin(spreadAng) * dist,
        radius: 3.5 + Math.random() * 5.5,
        color: i % 2 === 0 ? '#7F1D1D' : '#991B1B',
        alpha: 0.78,
        type: 'BLOOD_SPLATTER',
        angle: spreadAng,
        aspect: 0.55 + Math.random() * 0.45,
      });
    }

    // 5. Ballistic Shock Ring & Floating Tactical Hit Zone Indicator
    this.impactRings.push({
      x: hitX,
      y: hitY,
      radius: 3,
      maxRadius: isArmoredHit ? 22 : 26,
      color: isArmoredHit ? '#FBBF24' : '#EF4444',
      alpha: 0.92,
    });

    const zoneLabel =
      isArmoredHit
        ? 'KEVLAR · TORSO'
        : hitZone === 'LEGS'
          ? 'IMPACTO PIERNA'
          : hitZone === 'ARMS'
            ? 'IMPACTO BRAZO'
            : 'IMPACTO TORSO';

    this.impactPopups.push({
      x: target.x + (Math.random() - 0.5) * 14,
      y: target.y - target.radius - 10,
      vy: -28,
      text: zoneLabel,
      color: isArmoredHit ? '#FDE047' : '#FCA5A5',
      life: 0.85,
      maxLife: 0.85,
    });
  }

  protected computeBallisticHitZone(
    shooter: ActorEntity,
    target: ActorEntity,
    hitX: number,
    hitY: number
  ): HitZone {
    return selectHitZone({
      shooterIsPlayerSide: shooter.role === 'PLAYER' || shooter.role === 'SQUAD',
      aimZoneMode: this.aimZoneMode,
      // Geometric offset from the target's centre of mass
      offsetRatio: Math.hypot(hitX - target.x, hitY - target.y) / Math.max(1, target.radius),
      roll: Math.random(),
    });
  }

  protected ensureBodyHealth(actor: ActorEntity): BodyPartHealth {
    if (!actor.bodyHealth) {
      actor.bodyHealth = {
        torso: 100,
        arms: 100,
        legs: 100,
        bleeding: false,
        woundsCount: 0,
      };
    }
    return actor.bodyHealth;
  }

  protected resolveProjectileHit(
    shooter: ActorEntity,
    target: ActorEntity,
    damage: number,
    isTaser: boolean,
    hitZone: HitZone = 'TORSO',
    bulletAngle: number = 0
  ) {
    this.hitstopTimer = 0.042;

    if (isTaser) {
      if (target.role === 'SUSPECT') {
        target.stunTimer = 5.0;
        target.morale = 0;
        this.makeSuspectSurrender(target, 'Taser X2 Elektroimpuls');
        this.recordRoeEvent(`Incapacitación no-letal Taser (${target.name})`, 180, true);
      } else if (target.role === 'HOSTAGE' || target.role === 'CIVILIAN') {
        this.recordRoeEvent(`Uso indebido de Taser contra civil (${target.name})`, -250, false);
      }
      return;
    }

    const targetBh = this.ensureBodyHealth(target);
    targetBh.lastHitZone = hitZone;

    if (this.isTrainingMode && (target.id.startsWith('TARGET_') || target.role === 'SUSPECT')) {
      this.trainingTargetsHit++;
      this.lastTrainingHitZone = hitZone;
      this.lastTrainingTargetName = target.name;
      const kineticEnergy =
        this.plan.primaryWeapon === 'AUG_A3'
          ? 1780
          : this.plan.primaryWeapon === 'MP7A1'
            ? 540
            : this.plan.primaryWeapon === 'AUG_PARA'
              ? 580
              : 510;
      this.lastTrainingEnergy = kineticEnergy;
      const scorePts = trainingScoreForZone(hitZone);
      this.score += scorePts;

      if (target.id.includes('STEEL') || target.id.includes('GONG')) {
        soundEngine.playSteelTargetPing();
      }

      this.impactPopups.push({
        x: target.x,
        y: target.y - 18,
        vy: -22,
        text: `🎯 +${scorePts} PTS [${hitZone}] · ${kineticEnergy}J`,
        color: hitZone === 'TORSO' ? '#F59E0B' : hitZone === 'ARMS' ? '#38BDF8' : '#10B981',
        life: 1.25,
        maxLife: 1.25,
      });
      return;
    }

    if (shooter.role === 'PLAYER' || shooter.role === 'SQUAD') {
      if (target.role === 'HOSTAGE' || target.role === 'CIVILIAN') {
        target.hp = 0;
        target.state = 'DEAD';
        this.recordRoeEvent(`FUEGO A REHÉN/CIVIL (${target.name}) - WVG §7 VIOLADO`, -1000, false);
        this.triggerMissionEnd(
          'ROE_TERMINATED',
          'F',
          'INVESTIGACIÓN INTERNA (MISIÓN FALLIDA)',
          `Has abatido a una persona protegida (${target.name}). El Staatsanwaltschaft Graz ha ordenado tu suspensión inmediata.`
        );
        return;
      }

      if (target.role === 'SUSPECT') {
        // Human Shield Interception Check: if suspect holds a hostage as human shield and hitZone is TORSO
        if (target.humanShieldHostageId && hitZone === 'TORSO') {
          const hostage = this.actors.find((a) => a.id === target.humanShieldHostageId);
          if (hostage && hostage.state !== 'DEAD') {
            this.pushRadio('KOBRA-1', `¡ALERTA! El disparo al torso de ${target.name} impactó en la rehén ${hostage.name} usada como escudo humano.`, 'alert');
            this.resolveProjectileHit(shooter, hostage, damage, isTaser, 'TORSO', bulletAngle);
            return;
          }
        }

        const verdict = classifyLethalShot(target, hitZone);

        if (verdict === 'UNLAWFUL') {
          this.recordRoeEvent(
            `Uso letal desproporcionado (${target.name} no apuntaba con arma)`,
            LETHAL_SHOT_POINTS.UNLAWFUL,
            false
          );
          this.pushRadio(
            'LEITSTELLE',
            'WARNUNG: Schusswaffengebrauch ohne unmittelbare Lebensgefahr (§7 WVG)!',
            'alert'
          );
        } else if (verdict === 'LIMB') {
          this.recordRoeEvent(
            `Disparo incapacitante a extremidad (${hitZone === 'LEGS' ? 'Pierna' : 'Brazo'} · ${target.name})`,
            LETHAL_SHOT_POINTS.LIMB,
            true
          );
        } else {
          this.recordRoeEvent(
            `Defensa legítima autorizada (${target.name})`,
            LETHAL_SHOT_POINTS.TORSO,
            true
          );
        }

        // Apply localized zone damage to suspect
        targetBh.bleeding = true;
        targetBh.woundsCount += 1;

        const wound = applyZoneWound(
          hitZone,
          damage,
          { torso: targetBh.torso, arms: targetBh.arms, legs: targetBh.legs },
          target.isArmed
        );
        targetBh.torso = wound.next.torso;
        targetBh.arms = wound.next.arms;
        targetBh.legs = wound.next.legs;
        target.hp -= wound.hpDamage;
        target.morale = Math.max(0, target.morale - wound.moraleLoss);
        if (wound.stunSeconds > 0) {
          target.stunTimer = Math.max(target.stunTimer, wound.stunSeconds);
        }

        if (hitZone === 'LEGS') {
          target.speechBubble = {
            text: 'Agh! Mein Bein! Ich kann kaum stehen!',
            timer: 2.2,
            type: 'SURRENDER',
          };
          this.pushRadio(
            'KOBRA-1',
            `Beintreffer bei ${target.name} — Zielperson verlangsamt!`,
            'ok'
          );
        } else if (hitZone === 'ARMS') {
          target.windupProgress = 0;

          if (wound.disarmed) {
            // Non-lethal ballistic disarm!
            this.makeSuspectSurrender(target, ' Armtreffer — Schusswaffe entwaffnet');
            this.recordRoeEvent(
              `Desarme quirúrgico en brazo sin baja letal (${target.name})`,
              160,
              true
            );
            return;
          }

          target.speechBubble = {
            text: 'Verdammt! Mein Waffenarm!',
            timer: 2.0,
            type: 'HOSTILE',
          };
        }

        if (target.hp <= 0 || targetBh.torso <= 0) {
          target.hp = 0;
          target.state = 'DEAD';
          this.decals.push({
            x: target.x,
            y: target.y,
            radius: 15,
            color: '#7F1D1D',
            alpha: 0.85,
            type: 'BLOOD_POOL',
            angle: bulletAngle,
            aspect: 0.85,
          });
          if (target.isArmed) {
            target.isArmed = false;
            this.evidenceList.push({
              id: `EV_${target.id}`,
              label: target.weaponLabel || 'Schusswaffe',
              x: target.x + 14,
              y: target.y + 14,
              secured: false,
            });
          }

          // Morale cascade on suspect death: remaining suspects panic, flee, or surrender
          for (const other of this.actors) {
            if (other.role === 'SUSPECT' && other.id !== target.id && other.state !== 'DEAD' && other.state !== 'ARRESTED') {
              other.morale = Math.max(0, other.morale - 36);
              other.stress = Math.min(100, other.stress + 35);
              if (other.morale <= 30) {
                const roll = Math.random();
                if (roll < 0.45) {
                  this.makeSuspectSurrender(other, 'Verlust von Kamerad im Feuergefecht');
                } else if (roll < 0.75) {
                  other.state = 'FLEEING';
                  other.speechBubble = { text: 'Sie haben ihn getötet! Abhauen!', timer: 2.2, type: 'PANIC' };
                } else {
                  other.state = 'PANIC';
                  other.speechBubble = { text: 'Nein, nein! Ich will nicht sterben!', timer: 2.2, type: 'PANIC' };
                }
              }
            }
          }

          this.pushRadio('KOBRA-1', `Täter ${target.name} kampfunfähig / neutralisiert.`, 'warn');

          if (!isLawfulThreat(target) && this.roeViolations >= 2) {
            this.triggerMissionEnd(
              'ROE_TERMINATED',
              'F',
              'INVESTIGACIÓN INTERNA — EXCESO DE FUERZA LETAL',
              'Múltiples violaciones del Waffengebrauchsgesetz austriaco. El EKO Cobra exige neutralización proporcional.'
            );
            return;
          }
          this.checkMissionCompletion();
        } else if (target.hp <= 42 || targetBh.legs <= 20) {
          target.state = 'INCAPACITATED';
          this.makeSuspectSurrender(
            target,
            hitZone === 'LEGS' ? 'Beinschuss — Bewegungsunfähig' : 'Schwer verwundet'
          );
        }
      }
    } else if (shooter.role === 'SUSPECT') {
      if (target.role === 'PLAYER') {
        const hasShield = EKO_COBRA_WEAPONS[this.plan.primaryWeapon].hasShield;
        const coverMitigation = target.inCover ? 0.52 : 1.0;
        const effectiveDmg = Math.round(damage * (hasShield ? 0.35 : 1.0) * coverMitigation);

        if (hitZone === 'LEGS') {
          targetBh.legs = Math.max(15, targetBh.legs - Math.round(effectiveDmg * 1.4));
          targetBh.bleeding = true;
          targetBh.woundsCount += 1;
          target.hp -= Math.round(effectiveDmg * 0.65);
          this.pushRadio(
            'KOBRA-1',
            'TREFFER AM BEIN! Bewegung verlangsamt & Blutung aktiv — [H] Tourniquet!',
            'alert'
          );
        } else if (hitZone === 'ARMS') {
          targetBh.arms = Math.max(15, targetBh.arms - Math.round(effectiveDmg * 1.45));
          targetBh.bleeding = true;
          targetBh.woundsCount += 1;
          target.hp -= Math.round(effectiveDmg * 0.6);
          this.pushRadio(
            'KOBRA-1',
            'TREFFER AM WAFFENARM! Zielgenauigkeit & Sichtstabilität reduziert — [H] IFAK!',
            'alert'
          );
        } else {
          // Torso hit — ceramic plate carrier absorbs portion of impact
          if (this.armor > 0) {
            const absorbed = Math.min(this.armor, Math.round(effectiveDmg * 0.68));
            this.armor -= absorbed;
            const penDmg = effectiveDmg - absorbed;
            target.hp -= penDmg;
            targetBh.torso = Math.max(10, targetBh.torso - penDmg * 1.15);
            if (penDmg >= 9) {
              targetBh.bleeding = true;
              targetBh.woundsCount += 1;
              this.pushRadio('KOBRA-1', 'TREFFER AM TORSO (Plattenträger)! Schutzweste absorbiert Teilenergie.', 'warn');
            }
          } else {
            target.hp -= effectiveDmg;
            targetBh.torso = Math.max(0, targetBh.torso - effectiveDmg * 1.25);
            targetBh.bleeding = true;
            targetBh.woundsCount += 1;
            this.pushRadio('KOBRA-1', 'SCHWERER TORSETRFFER OHNE SCHUTZWESTE! Medizinische Hilfe erforderlich!', 'alert');
          }
        }

        // Trigger tactical damage sound effects: Kevlar impact thud, operator pain gasp & distorted radio static
        soundEngine.playPlayerDamageSequence();

        // Receiving ballistic impact spikes operator fatigue & destabilizes pulse
        const fatigueSpike = hitZone === 'TORSO' ? 32 : 26;
        this.playerFatigue = Math.min(100, this.playerFatigue + fatigueSpike);
        this.impactPopups.push({
          x: target.x + (Math.random() - 0.5) * 16,
          y: target.y - target.radius - 24,
          vy: -24,
          text: `+${fatigueSpike}% FATIGA · PULSO INESTABLE`,
          color: '#F59E0B',
          life: 1.05,
          maxLife: 1.05,
        });

        this.shakeIntensity = 13;
        this.playerHitFlashTimer = 0.42;
        this.playerHitSourceAngle = bulletAngle + Math.PI;
        if (target.hp <= 0 || targetBh.torso <= 0) {
          target.hp = 0;
          target.state = 'DEAD';
          this.decals.push({
            x: target.x,
            y: target.y,
            radius: 16,
            color: '#7F1D1D',
            alpha: 0.88,
            type: 'BLOOD_POOL',
            angle: bulletAngle,
            aspect: 0.85,
          });
          this.pushRadio('LEITSTELLE', 'ALARM / BAJA DE AGENTE: Kobra-1 KIA! Operator im Einsatz gefallen!', 'alert');
          this.triggerMissionEnd(
            'KIA',
            'F',
            'OPERADOR CAÍDO EN INTERVENCIÓN',
            'Kobra-1 ha sido abatido en el interior del piso en Graz-Lend. Recuerda usar "Slicing the Pie", cámara óptica/térmica (Q), granadas (G) y torniquete IFAK (H).'
          );
        }
      } else if (target.role === 'SQUAD') {
        const sqRawDmg = Math.round(damage * 0.45);
        const sqAbsorbed = Math.min(this.squadArmor, Math.round(sqRawDmg * 0.55));
        this.squadArmor = Math.max(0, this.squadArmor - sqAbsorbed);
        const sqDmg = Math.max(4, sqRawDmg - sqAbsorbed);
        target.hp = Math.max(0, target.hp - sqDmg);
        this.squadFatigue = Math.min(100, this.squadFatigue + 24);
        targetBh.bleeding = true;
        targetBh.woundsCount += 1;
        if (hitZone === 'LEGS') {
          targetBh.legs = Math.max(0, targetBh.legs - 28);
        } else if (hitZone === 'ARMS') {
          targetBh.arms = Math.max(0, targetBh.arms - 28);
        } else {
          targetBh.torso = Math.max(0, targetBh.torso - sqDmg * 1.2);
        }
        this.pushRadio('KOBRA-1', `FUNKMELDUNG: Kobra-2 (${target.name}) wurde verwundet! Sanitätsunterstützung [H] IFAK anfordern.`, 'warn');

        if (target.hp <= 0 || targetBh.torso <= 0) {
          target.hp = 0;
          target.state = 'DEAD';
          this.decals.push({
            x: target.x,
            y: target.y,
            radius: 16,
            color: '#7F1D1D',
            alpha: 0.88,
            type: 'BLOOD_POOL',
            angle: bulletAngle,
            aspect: 0.85,
          });
          target.speechBubble = { text: 'Argh... Kann nicht fortfahren...', timer: 4.0, type: 'PANIC' };
          this.pushRadio('LEITSTELLE', `ALARM / BAJA DE AGENTE: Kobra-2 (${target.name}) KIA im Feuergefecht gefallen!`, 'alert');
        }
      }
    }
  }

  protected detonateGadgetAt(x: number, y: number, type: 'FLASHBANG' | 'CS_GAS' | 'PEPPER_SPRAY') {
    const gadgetSpec = EKO_COBRA_GADGETS[type];
    const gadgetListener = this.getPlayer();
    soundEngine.playFlashbangSpatial(x, y, gadgetListener?.x ?? x, gadgetListener?.y ?? y);
    this.shakeIntensity = type === 'FLASHBANG' ? 12 : 6;
    this.flashScreenAlpha = type === 'FLASHBANG' ? 0.55 : 0.16;

    // Dynamic point light on detonation
    this.pointLights.push({
      x,
      y,
      radius: type === 'FLASHBANG' ? 420 : 220,
      color: type === 'CS_GAS' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.75)',
      life: type === 'FLASHBANG' ? 0.35 : 0.2,
      maxLife: type === 'FLASHBANG' ? 0.35 : 0.2,
    });

    this.refractionRings.push({
      x,
      y,
      radius: 10,
      maxRadius: type === 'FLASHBANG' ? 340 : 180,
      alpha: 0.9,
      strength: 0.8,
    });

    const gadDb = type === 'FLASHBANG' ? 148 : type === 'CS_GAS' ? 48 : 38;
    const gadRad = type === 'FLASHBANG' ? 1200 : type === 'CS_GAS' ? 240 : 160;
    this.emitNoise(
      x,
      y,
      gadDb,
      gadRad,
      type === 'FLASHBANG' ? 'Detonación Aturdidora Flashbang 170dB' : 'Liberación Química Gas CS',
      type === 'FLASHBANG' ? '#FFFFFF' : '#10B981'
    );

    for (let i = 0; i < 32; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 240;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
        color: type === 'CS_GAS' ? '#10B981' : type === 'PEPPER_SPRAY' ? '#F97316' : '#F8FAFC',
        size: type === 'CS_GAS' ? 6 : 3.5,
      });
    }

    if (type === 'CS_GAS') {
      // Spawn persistent gas cloud particles
      for (let i = 0; i < 45; i++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = Math.random() * 80;
        this.particles.push({
          x: x + Math.cos(ang) * dist,
          y: y + Math.sin(ang) * dist,
          vx: (Math.random() - 0.5) * 15,
          vy: (Math.random() - 0.5) * 15,
          life: 5.5 + Math.random() * 1.5,
          maxLife: 7.0,
          color: '#10B981',
          size: 18 + Math.random() * 24,
          shape: 'MIST',
          drag: 0.94,
        });
      }
    }

    for (const actor of this.actors) {
      if (actor.role === 'PLAYER' || actor.role === 'SQUAD') continue;
      if (actor.state === 'DEAD' || actor.state === 'ARRESTED') continue;

      const dist = Math.hypot(actor.x - x, actor.y - y);
      if (dist <= gadgetSpec.radiusPx && !this.raycastWallsAndDoors(x, y, actor.x, actor.y)) {
        if (actor.role === 'SUSPECT') {
          actor.stunTimer = type === 'CS_GAS' ? 6.2 : 4.8;
          actor.morale = Math.max(0, actor.morale - gadgetSpec.moraleDrop);
          if (actor.morale <= 35) {
            const roll = Math.random();
            if (roll < 0.6) {
              this.makeSuspectSurrender(actor, gadgetSpec.nameDe);
            } else if (roll < 0.85) {
              actor.state = 'FLEEING';
              actor.speechBubble = { text: 'Blind! Ich kann nichts sehen! Weg hier!', timer: 2.5, type: 'PANIC' };
            } else {
              actor.state = 'PANIC';
              actor.speechBubble = { text: 'Ahhh! Meine Augen! Panik!', timer: 2.5, type: 'PANIC' };
            }
          } else {
            actor.state = 'HESITATING';
          }
        }
      }
    }
  }

  protected checkMissionCompletion() {
    if (this.gameState !== 'PLAYING') return;

    const suspects = this.actors.filter((a) => a.role === 'SUSPECT');
    const allSuspectsResolved = suspects.every(
      (s) => s.state === 'ARRESTED' || s.state === 'DEAD'
    );

    const hostages = this.actors.filter((a) => a.role === 'HOSTAGE' || a.role === 'CIVILIAN');
    const allHostagesResolved = hostages.every((h) => h.state === 'ARRESTED');

    if (allSuspectsResolved && allHostagesResolved) {
      const arrestedAlive = suspects.filter((s) => s.state === 'ARRESTED').length;
      let grade: 'S' | 'A' | 'B' | 'C' | 'F' = 'A';
      if (arrestedAlive === suspects.length && this.roeViolations === 0) {
        grade = 'S';
        this.score += 500;
      } else if (this.roeViolations === 0) {
        grade = 'A';
      } else if (this.roeViolations === 1) {
        grade = 'B';
      } else {
        grade = 'C';
      }

      this.triggerMissionEnd(
        'VICTORY',
        grade,
        grade === 'S'
          ? 'EINSATZ ERFOLGREICH — GRADO S (CERO BAJAS)'
          : 'EINSATZ BEENDET — PISO ASEGURADO',
        grade === 'S'
          ? 'Intervención impecable según doctrina del EKO Cobra: todos los sospechosos han sido arrestados con vida y la rehén Julia M. está a salvo.'
          : `${arrestedAlive}/${suspects.length} sospechosos arrestados con vida. Rehenes rescatados.`
      );
    }
  }

  protected triggerMissionEnd(
    outcome: 'VICTORY' | 'ROE_TERMINATED' | 'KIA' | 'HOSTAGE_LOST',
    grade: 'S' | 'A' | 'B' | 'C' | 'F',
    title: string,
    subtitle: string
  ) {
    this.missionOutcome = { outcome, grade, title, subtitle };
    this.baseCareerXp += this.sessionXp;
    this.sessionXp = 0;
    this.cambiarEstado(outcome === 'VICTORY' ? 'WIN' : 'LOSE');
    try {
      window.localStorage.setItem('eko_cobra_career_xp', String(this.baseCareerXp));
    } catch {
      // ignore storage errors
    }
    this.emitHudSnapshot();
  }

  public update(rawDt: number) {
    const dt = Math.min(rawDt, PASO_MAXIMO);

    this.updateWeatherAndAmbientDust(dt);

    if (this.gameState === 'TITLE') {
      this.titlePanTime += dt;
      this.camX = 610 + Math.cos(this.titlePanTime * 0.22) * 190;
      this.camY = 410 + Math.sin(this.titlePanTime * 0.17) * 95;
      this.updateActorAnimations(dt);
      return;
    }

    if (this.gameState !== 'PLAYING') return;

    this.ticks += 1;

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    this.elapsedSeconds += dt;
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.modeSwitchPulseTimer = Math.max(0, this.modeSwitchPulseTimer - dt);
    this.shakeIntensity = Math.max(0, this.shakeIntensity - 28 * dt);
    this.flashScreenAlpha = Math.max(0, this.flashScreenAlpha - 1.4 * dt);
    this.nvgWarmupTimer = Math.max(0, this.nvgWarmupTimer - dt);

    // La C4 se coloca primero y queda armada. No hay detonación automática.
    this.c4.updatePlanting(dt, this.c4Dependencies);

    // Aviso acústico moderado mientras el binomio siga dentro del radio seguro.
    const unsafeArmedC4 = this.c4.charges.filter((charge) => !this.isBlastAreaClear(charge));
    if (unsafeArmedC4.length > 0) {
      this.c4WarningBeepTimer += dt;
      if (this.c4WarningBeepTimer >= 1.25) {
        this.c4WarningBeepTimer = 0;
        soundEngine.playC4WarningBeep(1.0);
      }
    } else {
      this.c4WarningBeepTimer = 0;
    }

    if (this.isTrainingMode) {
      const trainDoor = this.doors.find((d) => d.id === 'TRAINING_DOOR');
      if (trainDoor && (trainDoor.isOpen || trainDoor.isBreached || trainDoor.isDestroyed)) {
        this.trainingDoorResetTimer += dt;
        if (this.trainingDoorResetTimer >= 3.8) {
          trainDoor.isOpen = false;
          trainDoor.isLocked = true;
          trainDoor.isBreached = false;
          trainDoor.isDestroyed = false;
          trainDoor.currentAngle = trainDoor.closedAngle;
          this.trainingDoorResetTimer = 0;
          this.pushRadio('LEITSTELLE', 'Puerta blindada rearmada para nueva prueba de brecha [F/X/C].', 'ok');
          this.emitHudSnapshot();
        }
      }
    }

    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloadTimer = 0;
        const spec = EKO_COBRA_WEAPONS[this.plan.primaryWeapon];
        if (this.magCount > 0) {
          this.magCount -= 1;
          this.ammoInMag = spec.magSize;
          soundEngine.playOpticCam();
          const player = this.getPlayer();
          const roomCode = player ? this.getRoomAt(player.x, player.y) : 'EXTERIOR';
          this.pushRadio('KOBRA-1', `Cargador de ${spec.name} insertado (${spec.magSize} proyectiles).`, 'ok');
          this.logCriticalEvent(
            'RELOAD',
            `Recarga completada (${spec.name})`,
            roomCode,
            'INFO',
            { details: `Cargador listo con ${spec.magSize} balas. Cargadores restantes: ${this.magCount}` }
          );
        }
      }
      this.emitHudSnapshot();
    }

    for (const pl of this.pointLights) {
      pl.life -= dt;
    }
    this.pointLights = this.pointLights.filter((pl) => pl.life > 0);

    const player = this.getPlayer();
    if (!player) return;

    // Update dynamic stealth visibility, decibel noise decay, and station alert score
    this.updateStealthAndNoise(dt, player);

    const prevPositions = new Map<string, { x: number; y: number }>();
    for (const actor of this.actors) {
      prevPositions.set(actor.id, { x: actor.x, y: actor.y });
    }

    // Automatic Tactical Cover Detection (walls & furniture objects)
    for (const actor of this.actors) {
      if (actor.state === 'DEAD' || actor.state === 'ARRESTED') {
        actor.inCover = false;
        continue;
      }
      let inCover = false;
      for (const w of this.walls) {
        const d = this.distToSegment(actor.x, actor.y, w.x1, w.y1, w.x2, w.y2);
        if (d <= 35) {
          inCover = true;
          break;
        }
      }
      if (!inCover) {
        for (const f of this.furniture) {
          const fDist = Math.hypot(actor.x - f.x, actor.y - f.y);
          if (fDist <= Math.max(f.w, f.h) * 0.5) {
            inCover = true;
            break;
          }
        }
      }
      actor.inCover = inCover;
    }

    // El cursor se resuelve con la misma conversión que usan los handlers de
    // ratón, para que apuntado, arrastre y clics no puedan encuadrar distinto.
    const pointer = this.screenToWorld(this.mouseScreen.x, this.mouseScreen.y);
    this.mouseWorld.x = pointer.x;
    this.mouseWorld.y = pointer.y;

    // 1. Update Player Movement, Limb Slowdown, Untreated Bleeding & Aim Tremor
    const playerBh = this.ensureBodyHealth(player);
    this.bleedTickTimer += dt;
    if (this.bleedTickTimer >= 0.65) {
      this.bleedTickTimer = 0;
      for (const actor of this.actors) {
        if (actor.state === 'DEAD' || actor.state === 'ARRESTED') continue;
        const bh = actor.bodyHealth;
        if (bh && bh.bleeding) {
          const bleedDmg = Math.max(1, bh.woundsCount);
          actor.hp = Math.max(1, actor.hp - bleedDmg);
          bh.torso = Math.max(8, bh.torso - bleedDmg * 0.8);
          // Leave crimson blood droplet particle on floor
          this.particles.push({
            x: actor.x + (Math.random() - 0.5) * 8,
            y: actor.y + (Math.random() - 0.5) * 8,
            vx: 0,
            vy: 0,
            life: 3.6,
            maxLife: 3.6,
            color: '#991B1B',
            size: 3.5,
          });
        }
      }
    }

    let moveX = 0;
    let moveY = 0;
    if (this.heldKeys.has(this.keybinds.moveForward)) moveY -= 1;
    if (this.heldKeys.has(this.keybinds.moveBackward)) moveY += 1;
    if (this.heldKeys.has(this.keybinds.moveLeft)) moveX -= 1;
    if (this.heldKeys.has(this.keybinds.moveRight)) moveX += 1;

    if (this.virtualStickMagnitude > 0.2) {
      moveX = this.virtualStickX;
      moveY = this.virtualStickY;
    } else if (this.touchMoveX !== 0 || this.touchMoveY !== 0) {
      moveX = this.touchMoveX;
      moveY = this.touchMoveY;
    }

    // Leg injury & Dynamic Trauma slows movement down & induces dragging effect
    const legMoveMultiplier = 0.35 + 0.65 * (playerBh.legs / 100);
    const dragMultiplier = playerBh.legs < 40 ? 0.45 : 1.0;
    const bleedMovePenalty = playerBh.bleeding ? 0.88 : 1.0;

    const focusedAim = this.isFocusedAiming();
    const wantsSprint =
      !focusedAim &&
      (this.heldKeys.has('ShiftLeft') ||
        this.heldKeys.has('ShiftRight') ||
        this.sprintModeToggled ||
        this.virtualStickMagnitude > 0.92);
    const canSprint = playerBh.legs >= 35 && this.playerFatigue < 97;

    if (moveX !== 0 || moveY !== 0) {
      const isSprinting = wantsSprint && canSprint;
      this.currentMovementGait = isSprinting ? 'SPRINTING' : 'WALKING';

      // Fatigue increases rapidly while sprinting/running, and moderately during sustained brisk movement
      if (isSprinting) {
        this.playerFatigue = Math.min(100, this.playerFatigue + 21.5 * dt);
      } else {
        // Walking builds mild exertion up to 38%, or slowly recovers if calming down from a high sprint
        if (this.playerFatigue < 38) {
          this.playerFatigue = Math.min(38, this.playerFatigue + 4.8 * dt);
        } else {
          this.playerFatigue = Math.max(38, this.playerFatigue - 5.5 * dt);
        }
      }

      if (this.playerFatigue >= 82 && this.elapsedSeconds - this.lastFatigueWarningTime > 12) {
        this.lastFatigueWarningTime = this.elapsedSeconds;
        this.pushRadio(
          'BIOMETRIE-PULS',
          `WARNUNG: Hohe Erschöpfung (${Math.round(this.playerFatigue)}%) & Puls instabil! Kurz anhalten und rasten, um Präzision wiederherzustellen.`,
          'warn'
        );
      }

      player.isCrouched = this.playerStance === 'AGACHADO';
      const hasShield = EKO_COBRA_WEAPONS[this.plan.primaryWeapon].hasShield;
      const profileSpeedMult = EKO_COBRA_PROFILES[this.plan.profile].speedMultiplier;
      // High fatigue (>80%) slightly reduces peak sprint speed due to exhaustion
      const exhaustionSpeedFactor =
        this.playerFatigue > 80 ? 1 - ((this.playerFatigue - 80) / 20) * 0.16 : 1.0;
      const crouchSpeedFactor = this.playerStance === 'AGACHADO' ? 0.62 : 1.0;
      const sprintSpeedMult = isSprinting && this.playerStance !== 'AGACHADO' ? 1.36 * exhaustionSpeedFactor : focusedAim ? 0.78 : 1.0;
      const baseSpeed =
        (hasShield ? 132 : 168) *
        profileSpeedMult *
        legMoveMultiplier *
        dragMultiplier *
        bleedMovePenalty *
        sprintSpeedMult *
        crouchSpeedFactor;
      this.avanzarJugador(player, moveX, moveY, baseSpeed, dt);

      // Audible Kobra-1 Agent Footsteps: distinct cadence & acoustic signature for Walking vs. Running
      this.footstepTimer += dt;
      const stepInterval = isSprinting
        ? 0.24
        : playerBh.legs < 50
          ? 0.56
          : 0.42;
      if (this.footstepTimer >= stepInterval) {
        this.footstepTimer = 0;
        soundEngine.playFootstep({
          isRunning: isSprinting,
          distanceRatio: 0,
          isAgent: true,
        });

        // Visual acoustic step ripple under Kobra-1's boots (subtle cyan ring when walking, wider amber/cyan ring when sprinting)
        this.impactRings.push({
          x: player.x,
          y: player.y,
          radius: 3,
          maxRadius: isSprinting ? 28 : 14,
          color: isSprinting ? 'rgba(245, 158, 11, 0.7)' : 'rgba(56, 189, 248, 0.4)',
          alpha: isSprinting ? 0.65 : 0.32,
        });

        const stepDb = isSprinting ? 72 : 36;
        const stepRadius = isSprinting ? 380 : 180;
        this.emitNoise(
          player.x,
          player.y,
          stepDb,
          stepRadius,
          isSprinting ? 'Carrera Táctica (Botas)' : 'Pasos de Avance',
          isSprinting ? '#F59E0B' : '#38BDF8'
        );
      }

      if (playerBh.legs < 70 && Math.random() < 0.28) {
        this.particles.push({
          x: player.x,
          y: player.y,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          life: 5.0,
          maxLife: 5.0,
          color: '#991B1B',
          size: 3.5,
        });
      }

      if (this.mirrorDoorId) {
        const d = this.doors.find((door) => door.id === this.mirrorDoorId);
        if (
          !d ||
          Math.hypot((d.x1 + d.x2) * 0.5 - player.x, (d.y1 + d.y2) * 0.5 - player.y) > 70
        ) {
          this.mirrorDoorId = null;
        }
      }
    } else {
      // Operator is stationary & resting: Fatigue recovers smoothly, restoring weapon accuracy & pulse stability
      this.currentMovementGait = 'RESTING';
      const restRecoveryRate = player.inCover ? 24.0 : 17.5;
      this.playerFatigue = Math.max(0, this.playerFatigue - restRecoveryRate * dt);
    }

    // Calculate arm injury, untreated bleeding & Fatigue / Pulse Instability tremor on aim and vision stability
    const armInstability = (100 - playerBh.arms) / 100;
    const torsoInstability = (100 - playerBh.torso) / 100;
    const bleedInstability = playerBh.bleeding ? 0.35 + playerBh.woundsCount * 0.12 : 0;
    const fatigueRatio = this.playerFatigue / 100;
    const fatigueTremorAmp = fatigueRatio * 0.072 + Math.pow(fatigueRatio, 2) * 0.048;

    const totalTremorAmp =
      armInstability * 0.085 +
      torsoInstability * 0.035 +
      bleedInstability * 0.055 +
      fatigueTremorAmp;

    const pulseFreq = 6.5 + fatigueRatio * 7.5;
    this.aimTremorOffset =
      totalTremorAmp > 0.002
        ? Math.sin(this.elapsedSeconds * pulseFreq) * totalTremorAmp +
          Math.cos(this.elapsedSeconds * (pulseFreq * 1.85)) * (totalTremorAmp * 0.48)
        : 0;

    const rawAimAngle = Math.atan2(this.mouseWorld.y - player.y, this.mouseWorld.x - player.x);
    const targetAimAngle = rawAimAngle + this.aimTremorOffset * (focusedAim ? 0.38 : 0.72);
    if (focusedAim) {
      // EKO Cobra Focused Aiming (Präzisionsanschlag): reduces operator turning speed (3.2 rad/s max)
      // to stabilize the barrel and allow surgical micro-adjustments on targets
      const angleDiff = this.normalizeAngle(targetAimAngle - player.angle);
      const maxTurnStep = 3.2 * dt;
      if (Math.abs(angleDiff) <= maxTurnStep) {
        player.angle = targetAimAngle;
      } else {
        player.angle = this.normalizeAngle(player.angle + Math.sign(angleDiff) * maxTurnStep);
      }
    } else {
      player.angle = targetAimAngle;
    }
    player.roomName = this.getRoomAt(player.x, player.y);

    // Update player shadow / darkness stealth state
    const inDark = this.isPlayerInDarkness(player);
    const firedRecently = (this.elapsedSeconds - this.lastPlayerShotTime) < 3.0;
    if (inDark && !firedRecently) {
      this.playerDarknessTimer += dt;
      if (this.playerDarknessTimer >= 3.0) {
        if (!this.playerHiddenInShadow) {
          this.playerHiddenInShadow = true;
          this.pushRadio('KOBRA-1', 'Im Schatten verborgen. Feinde haben Sichtkontakt und Position verloren.', 'ok');
        }
      }
    } else {
      this.playerDarknessTimer = 0;
      this.playerHiddenInShadow = false;
    }

    if (this.thermalActive && this.plan.inspectionDevice === 'THERMAL_CAM') {
      const range =
        EKO_COBRA_INSPECTION_DEVICES.THERMAL_CAM.rangePx *
        EKO_COBRA_PROFILES[this.plan.profile].sensorRangeMultiplier;
      for (const actor of this.actors) {
        if (actor.role === 'PLAYER' || actor.role === 'SQUAD' || actor.state === 'DEAD') continue;
        const dist = Math.hypot(actor.x - player.x, actor.y - player.y);
        const ang = Math.atan2(actor.y - player.y, actor.x - player.x);
        const diff = Math.abs(this.normalizeAngle(ang - player.angle));
        if (dist <= range && diff <= 0.72) {
          actor.spottedByMirror = true;
          actor.spottedByThermal = true;
        }
      }
    }

    // Camera jitter when suffering from untreated bleeding, torso trauma, or high pulse fatigue
    const fatigueCameraSway = fatigueRatio > 0.25 ? (fatigueRatio - 0.25) * 9.5 : 0;
    const swayAmp =
      (playerBh.bleeding || playerBh.torso < 75 ? torsoInstability * 14 + (playerBh.bleeding ? 9 : 0) : 0) +
      fatigueCameraSway;
    const visionSwayX =
      swayAmp > 0.1 ? Math.sin(this.elapsedSeconds * (3.8 + fatigueRatio * 2.4)) * swayAmp : 0;
    const visionSwayY =
      swayAmp > 0.1 ? Math.cos(this.elapsedSeconds * (3.2 + fatigueRatio * 2.1)) * swayAmp : 0;

    this.breathingTimer += dt;
    const breathInterval = Math.max(1.15, 3.2 - fatigueRatio * 1.95);
    if (this.breathingTimer >= breathInterval) {
      this.breathingTimer = 0;
      soundEngine.playBreathing(fatigueRatio);
    }
    soundEngine.updateHeartbeat(this.squadFatigue, player.hp, player.maxHp, dt);

    let camPanDeltaX = 0;
    let camPanDeltaY = 0;
    const camPanSpeed = 2600;
    if (this.heldKeys.has('ArrowUp')) camPanDeltaY -= camPanSpeed * dt;
    if (this.heldKeys.has('ArrowDown')) camPanDeltaY += camPanSpeed * dt;
    if (this.heldKeys.has('ArrowLeft')) camPanDeltaX -= camPanSpeed * dt;
    if (this.heldKeys.has('ArrowRight')) camPanDeltaX += camPanSpeed * dt;

    if (camPanDeltaX !== 0 || camPanDeltaY !== 0) {
      this.camPanOffsetX += camPanDeltaX * dt;
      this.camPanOffsetY += camPanDeltaY * dt;
      this.camPanOffsetX = Math.max(-WORLD_WIDTH * 1.5, Math.min(WORLD_WIDTH * 1.5, this.camPanOffsetX));
      this.camPanOffsetY = Math.max(-WORLD_HEIGHT * 1.5, Math.min(WORLD_HEIGHT * 1.5, this.camPanOffsetY));
    } else {
      this.camPanOffsetX *= Math.max(0, 1 - 5 * dt);
      this.camPanOffsetY *= Math.max(0, 1 - 5 * dt);
    }

    // 1.5 Calculate Tactical Bodycam / Helmet-Cam Lean & Inertia Parallax
    const pVelX = player.vx || 0;
    const pVelY = player.vy || 0;
    const leanIntensity = 0.08;
    this.camInertiaX += (pVelX * leanIntensity - this.camInertiaX) * Math.min(1, 4 * dt);
    this.camInertiaY += (pVelY * leanIntensity - this.camInertiaY) * Math.min(1, 4 * dt);

    const lookAheadX = (this.mouseWorld.x - player.x) * 0.14 + visionSwayX + this.camPanOffsetX + this.camInertiaX;
    const lookAheadY = (this.mouseWorld.y - player.y) * 0.14 + visionSwayY + this.camPanOffsetY + this.camInertiaY;
    this.camX += (player.x + lookAheadX - this.camX) * Math.min(1, 8 * dt);
    this.camY += (player.y + lookAheadY - this.camY) * Math.min(1, 8 * dt);

    // 1.6 Update Snow Footprints (Tirol)
    if (this.missionMode === 'TIROL') {
      if (this.currentMovementGait !== 'RESTING' && Math.random() < 12 * dt) {
        this.snowFootprints.push({
          x: player.x + (Math.random() - 0.5) * 8,
          y: player.y + (Math.random() - 0.5) * 8,
          angle: player.angle,
          alpha: 0.6,
          life: 8.0
        });
      }
      for (const f of this.snowFootprints) {
        f.life -= dt;
        f.alpha = Math.max(0, (f.life / 8.0) * 0.6);
      }
      this.snowFootprints = this.snowFootprints.filter(f => f.life > 0);
    }

    // 2. Update Thrown Gadgets & Persistent CS Tear-Gas Clouds
    for (const actor of this.actors) {
      actor.inCSGas = false;
    }

    for (const g of this.gadgets) {
      if (!g.detonated) {
        g.progress = Math.min(1, g.progress + dt * 2.8);
        if (g.progress >= 0.5 && g.hasBounced && !g.didBounceEffect) {
          g.didBounceEffect = true;
          soundEngine.playDoorAction(false);
          for (let p = 0; p < 8; p++) {
            this.particles.push({
              x: g.midX ?? g.x,
              y: g.midY ?? g.y,
              vx: (Math.random() - 0.5) * 120,
              vy: (Math.random() - 0.5) * 120,
              life: 0.4,
              maxLife: 0.4,
              color: '#F59E0B',
              size: 2.5,
              shape: 'CIRCLE',
            });
          }
        }
        if (g.progress >= 1) {
          g.detonated = true;
          this.detonateGadgetAt(g.tx, g.ty, g.type);
        }
      } else {
        g.cloudTimer -= dt;
        if (g.type === 'CS_GAS' && g.cloudTimer > 0) {
          for (const actor of this.actors) {
            if (actor.state === 'DEAD' || actor.state === 'ARRESTED') continue;
            const dist = Math.hypot(actor.x - g.tx, actor.y - g.ty);
            if (dist <= 170) {
              actor.inCSGas = true;
              actor.csGasExposure = Math.min(1, (actor.csGasExposure ?? 0) + dt * 0.8);

              if (actor.role === 'SUSPECT') {
                actor.morale = Math.max(0, actor.morale - 22 * dt);
                actor.stunTimer = Math.max(actor.stunTimer, 0.8);
                if (actor.morale <= 26 && actor.state !== 'SURRENDERED') {
                  this.makeSuspectSurrender(actor, 'Nube persistente CS-Reizgas');
                }
              } else if (actor.role === 'PLAYER' || actor.role === 'SQUAD') {
                // Agents are trained but still affected by dense CS gas if exposed for too long
                if (actor.csGasExposure && actor.csGasExposure > 0.4) {
                  actor.stunTimer = Math.max(actor.stunTimer, 0.4);
                }
              }
            }
          }
        }
      }
    }

    for (const actor of this.actors) {
      if (!actor.inCSGas) {
        actor.csGasExposure = Math.max(0, (actor.csGasExposure ?? 0) - dt * 0.3);
      }
    }
    this.gadgets = this.gadgets.filter((g) => !g.detonated || g.cloudTimer > 0);

    // 2.5 Update Tactical Breach Action
    if (this.breachAction) {
      const door = this.doors.find((d) => d.id === this.breachAction?.doorId);
      if (!door || door.isOpen || Math.hypot(player.x - (door.x1 + door.x2) * 0.5, player.y - (door.y1 + door.y2) * 0.5) > 85) {
        this.breachAction = undefined;
      } else {
        this.breachAction.progress += dt;
        if (this.breachAction.progress >= this.breachAction.maxProgress) {
          const mode = this.breachAction.mode;
          if (mode === 'C4') {
            this.c4.count = Math.max(0, this.c4.count - 1);
          }
          const finishedDoor = door;
          this.breachAction = undefined;
          this.executeBreach(finishedDoor, mode);
        }
      }
    }

    // 3. Update Squadmate AI (Kobra-2)
    this.updateSquadmateAI(dt, player);

    // 4. Update Suspects & Hostages AI
    this.updateSuspectsAI(dt, player);
    this.updateHostagesAI(dt, player);

    // 5. Compute actor velocity, alert levels, and advance sprite animation frames
    for (const actor of this.actors) {
      const prev = prevPositions.get(actor.id);
      if (prev && dt > 0) {
        actor.vx = (actor.x - prev.x) / dt;
        actor.vy = (actor.y - prev.y) / dt;
        actor.speed = Math.hypot(actor.vx, actor.vy);
      } else {
        actor.speed = 0;
      }
      if (actor.recoilTimer && actor.recoilTimer > 0) {
        actor.recoilTimer = Math.max(0, actor.recoilTimer - dt);
      }
      if (actor.hitReactionTimer && actor.hitReactionTimer > 0) {
        actor.hitReactionTimer = Math.max(0, actor.hitReactionTimer - dt);
      }
      if (actor.hitFlashTimer && actor.hitFlashTimer > 0) {
        actor.hitFlashTimer = Math.max(0, actor.hitFlashTimer - dt);
      }

      // Audible footsteps & acoustic ripple rings for Squadmate (Kobra-2) and Suspects/Hostages (differentiating Walk vs. Run)
      if (actor.role !== 'PLAYER' && actor.state !== 'DEAD' && actor.state !== 'ARRESTED') {
        const spd = actor.speed ?? 0;
        const isMoving = spd > 10;
        const isRunning =
          actor.role === 'SQUAD'
            ? spd > 108 || this.currentMovementGait === 'SPRINTING'
            : spd > 62 ||
              actor.state === 'FLEEING' ||
              ((actor.investigateTimer ?? 0) > 0 && spd > 32);

        if (isMoving) {
          actor.footstepAudioTimer = (actor.footstepAudioTimer ?? 0) + dt;
          const stepInterval =
            actor.role === 'SQUAD'
              ? isRunning
                ? 0.25
                : 0.43
              : isRunning
                ? spd > 95
                  ? 0.22
                  : 0.27
                : 0.46;

          if (actor.footstepAudioTimer >= stepInterval) {
            actor.footstepAudioTimer = 0;
            const distToPlayer = Math.hypot(actor.x - player.x, actor.y - player.y);
            if (distToPlayer <= 560) {
              soundEngine.playFootstep({
                isRunning,
                distanceRatio: distToPlayer / 560,
                isAgent: actor.role === 'SQUAD',
              });

              // Acoustic footstep wave ring (differentiated size & opacity for Walk vs. Run)
              this.impactRings.push({
                x: actor.x,
                y: actor.y,
                radius: 3,
                maxRadius: isRunning ? 24 : 11,
                color:
                  actor.role === 'SQUAD'
                    ? isRunning
                      ? 'rgba(56, 189, 248, 0.65)'
                      : 'rgba(56, 189, 248, 0.32)'
                    : actor.role === 'SUSPECT'
                      ? isRunning
                        ? 'rgba(245, 158, 11, 0.75)'
                        : 'rgba(245, 158, 11, 0.35)'
                      : 'rgba(56, 189, 248, 0.55)',
                alpha: (isRunning ? 0.72 : 0.35) * Math.max(0.25, 1 - distToPlayer / 560),
              });

              // Register subtle screen-edge directional indicator when suspicious running footsteps occur outside operator's FOV
              if (actor.role !== 'SQUAD' && isRunning) {
                const stepIntensity = Math.max(0.32, 1 - distToPlayer / 560);
                this.registerAcousticEdgeCue(
                  actor.id,
                  actor.x,
                  actor.y,
                  'FOOTSTEP',
                  stepIntensity,
                  0.95,
                  actor.role === 'SUSPECT' ? 'PASOS SOSPECHOSOS' : 'PASOS EN PÁNICO'
                );
              }
            }
          }
        } else {
          actor.footstepAudioTimer = 0;
        }
      }
    }
    this.updateActorAnimations(dt);

    // 6. Update Traces, Particles, Impact Rings, Popups & Shout Waves
    for (const t of this.traces) {
      t.alpha -= dt * 4.5;
    }
    this.traces = this.traces.filter((t) => t.alpha > 0);

    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const drag = p.drag ?? 0.92;
      p.vx *= drag;
      p.vy *= drag;
      if (p.rotation !== undefined && p.vRot !== undefined) {
        p.rotation += p.vRot * dt;
        p.vRot *= 0.94;
      }
      if (p.shape === 'MIST') {
        p.size += dt * 16;
      }
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.particles.length > 300) {
      this.particles = this.particles.slice(this.particles.length - 300);
    }

    for (const ring of this.impactRings) {
      ring.radius += (ring.maxRadius - ring.radius) * Math.min(1, dt * 18);
      ring.alpha -= dt * 4.2;
    }
    this.impactRings = this.impactRings.filter((r) => r.alpha > 0.02);

    for (const pop of this.impactPopups) {
      pop.y += pop.vy * dt;
      pop.vy *= 0.92;
      pop.life -= dt;
    }
    this.impactPopups = this.impactPopups.filter((p) => p.life > 0);

    for (const w of this.shoutWaves) {
      w.radius += 480 * dt;
      w.alpha = Math.max(0, 1 - w.radius / w.maxRadius);
    }
    this.shoutWaves = this.shoutWaves.filter((w) => w.alpha > 0.02);

    for (let i = this.refractionRings.length - 1; i >= 0; i--) {
      const ring = this.refractionRings[i];
      ring.radius += 420 * dt;
      ring.alpha -= 1.8 * dt;
      if (ring.alpha <= 0) {
        this.refractionRings.splice(i, 1);
      }
    }

    for (const actor of this.actors) {
      if (actor.speechBubble) {
        actor.speechBubble.timer -= dt;
        if (actor.speechBubble.timer <= 0) {
          actor.speechBubble = undefined;
        }
      }
      if (actor.commandNodTimer && actor.commandNodTimer > 0) {
        actor.commandNodTimer = Math.max(0, actor.commandNodTimer - dt);
      }
      if (actor.gestureTimer && actor.gestureTimer > 0) {
        actor.gestureTimer = Math.max(0, actor.gestureTimer - dt);
      }
    }

    this.commandPulseTimer = Math.max(0, this.commandPulseTimer - dt);
    this.suppressionTimer = Math.max(0, this.suppressionTimer - dt);
    this.playerHitFlashTimer = Math.max(0, this.playerHitFlashTimer - dt);
    this.squadReloadTimer = Math.max(0, this.squadReloadTimer - dt);
    this.radio.tick(dt);

    for (const ind of this.acousticIndicators) {
      ind.life -= dt;
    }
    this.acousticIndicators = this.acousticIndicators.filter((ind) => ind.life > 0);

    // Dynamic tactical heartbeat audio simulation (accelerates when fatigue > 70% or HP < 40%)
    if (player && this.gameState === 'PLAYING' && player.state !== 'DEAD') {
      soundEngine.updateHeartbeat(this.playerFatigue, player.hp, player.maxHp, dt);
    }

    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.12) {
      this.hudSyncTimer = 0;
      this.emitHudSnapshot();
    }
  }

  protected updateCivilianAi(dt: number) {
    const player = this.getPlayer();
    const squad = this.getSquadmate();

    for (const actor of this.actors) {
      if ((actor.role !== 'HOSTAGE' && actor.role !== 'CIVILIAN') || actor.state === 'DEAD' || actor.state === 'ARRESTED') {
        continue;
      }

      const distToPlayer = player ? Math.hypot(player.x - actor.x, player.y - actor.y) : 999;
      const distToSquad = squad ? Math.hypot(squad.x - actor.x, squad.y - actor.y) : 999;

      const visibleOp = (distToPlayer < 210 && player && !this.raycastWallsAndDoors(actor.x, actor.y, player.x, player.y)) ||
                        (distToSquad < 210 && squad && !this.raycastWallsAndDoors(actor.x, actor.y, squad.x, squad.y));

      if (visibleOp) {
        if (actor.state === 'UNAWARE' || actor.state === 'FLEEING' || actor.state === 'ALERTED') {
          actor.state = 'SURRENDERED';
          actor.isCrouched = true;
          if (!actor.speechBubble || actor.speechBubble.type !== 'PANIC') {
            const panicLines = [
              '¡Manos arriba! ¡Soy civil, no disparen!',
              '¡Por favor, no disparen! ¡Estoy indefenso!',
              '¡Menos mal, la policía! ¡Manos arriba!',
            ];
            actor.speechBubble = {
              text: panicLines[Math.floor(Math.random() * panicLines.length)],
              timer: 3.0,
              type: 'PANIC',
            };
          }
        }
      } else if (actor.state === 'FLEEING') {
        actor.isCrouched = true;
        const speed = 90;
        const room = this.rooms.find(r => actor.x >= r.x && actor.x <= r.x + r.w && actor.y >= r.y && actor.y <= r.y + r.h);
        if (room) {
          const cornerX = room.x + 24 + ((actor.id.charCodeAt(0) % 2) * (room.w - 48));
          const cornerY = room.y + 24 + ((actor.id.charCodeAt(1) % 2) * (room.h - 48));
          const ang = Math.atan2(cornerY - actor.y, cornerX - actor.x);
          this.moveActorWithCollision(actor, actor.x + Math.cos(ang) * speed * dt, actor.y + Math.sin(ang) * speed * dt);
          actor.angle = ang;
          if (Math.hypot(actor.x - cornerX, actor.y - cornerY) < 35) {
            actor.state = 'SURRENDERED';
            actor.isCrouched = true;
          }
        }
      }
    }
  }

  protected updateActorAnimations(dt: number) {
    this.updateCivilianAi(dt);
    const player = this.getPlayer();
    const anyHostileVisibleInCombat = this.actors.some(
      (a) =>
        a.role === 'SUSPECT' &&
        a.visibleToPlayer &&
        a.isArmed &&
        a.state !== 'SURRENDERED' &&
        a.state !== 'ARRESTED' &&
        a.state !== 'DEAD'
    );

    const playerInsideBuilding =
      player !== undefined &&
      player.roomName !== 'STIEGENHAUS' &&
      player.roomName !== 'LOGGIA' &&
      player.roomName !== 'AUSSENBEREICH';

    for (const actor of this.actors) {
      if (actor.state === 'DEAD') continue;

      // Las burbujas son exclusivamente visuales: no se convierten en locuciones.
      let alert: AlertLevel = 'CALM';
      if (actor.role === 'PLAYER' || actor.role === 'SQUAD') {
        if (
          anyHostileVisibleInCombat ||
          (actor.recoilTimer ?? 0) > 0 ||
          this.shoutWaves.length > 0
        ) {
          alert = 'COMBAT';
        } else if (playerInsideBuilding || this.mirrorDoorId !== null || this.thermalActive) {
          alert = 'READY';
        } else {
          alert = 'CALM';
        }
      } else if (actor.role === 'SUSPECT') {
        if (actor.state === 'AIMING_WINDUP' || actor.state === 'FIRING') {
          alert = 'COMBAT';
        } else if (actor.state === 'ALERTED' || actor.state === 'HESITATING') {
          alert = 'READY';
        } else {
          alert = 'CALM';
        }
      } else {
        alert = anyHostileVisibleInCombat ? 'COMBAT' : 'READY';
      }
      actor.alertLevel = alert;

      const spd = actor.speed ?? 0;
      const alertMultiplier = alert === 'COMBAT' ? 1.35 : alert === 'READY' ? 1.1 : 0.85;
      const bh = actor.bodyHealth;
      const legAnimMult = bh && bh.legs < 70 ? 0.5 + 0.5 * (bh.legs / 70) : 1.0;
      let targetFps = 1.4;
      if (spd > 6) {
        targetFps = (5.5 + (spd / 168) * 8.5) * alertMultiplier * legAnimMult;
      } else {
        targetFps = (alert === 'COMBAT' ? 4.2 : alert === 'READY' ? 2.2 : 1.1) * legAnimMult;
      }

      const nextTimer = (actor.animTimer ?? 0) + dt * targetFps;
      if (nextTimer >= 1) {
        actor.animFrame = ((actor.animFrame ?? 0) + Math.floor(nextTimer)) % 4;
        actor.animTimer = nextTimer % 1;
      } else {
        actor.animTimer = nextTimer;
      }
    }
  }

  /**
   * Evaluates surrounding furniture, walls, and corners to locate the optimal defensive cover position
   * that occludes or buffers the actor from incoming fire along the vector to (threatX, threatY).
   */
  protected findBestCoverForActor(
    actor: ActorEntity,
    threatX: number,
    threatY: number,
    maxRadius = 260
  ): Vec2 | null {
    let bestSpot: Vec2 | null = null;
    let bestScore = -Infinity;

    for (const f of this.furniture) {
      if (f.isDestroyed || f.zLayer === 'FLOOR') continue;
      if (!f.blocksSight && !f.blocksMovement) continue;

      const fx = f.x + f.w * 0.5;
      const fy = f.y + f.h * 0.5;
      const dToActor = Math.hypot(actor.x - fx, actor.y - fy);
      if (dToActor > maxRadius) continue;

      // Vector pointing away from the threat behind the piece of furniture
      const dxThreat = fx - threatX;
      const dyThreat = fy - threatY;
      const lenThreat = Math.hypot(dxThreat, dyThreat) || 1;
      const dirX = dxThreat / lenThreat;
      const dirY = dyThreat / lenThreat;

      // Candidate spots behind and slightly hugging the flanks of the furniture
      const span = Math.max(f.w, f.h) * 0.5;
      const candidateOffsets = [
        { x: dirX * (span + 24), y: dirY * (span + 24) },
        { x: dirX * (span + 18) - dirY * 20, y: dirY * (span + 18) + dirX * 20 },
        { x: dirX * (span + 18) + dirY * 20, y: dirY * (span + 18) - dirX * 20 },
      ];

      for (const off of candidateOffsets) {
        const spotX = fx + off.x;
        const spotY = fy + off.y;

        if (this.collidesAt(spotX, spotY, actor.radius)) continue;

        // Verify raycast to threat has obstruction
        const hasCover = this.raycastWallsAndDoors(spotX, spotY, threatX, threatY);
        if (!hasCover) continue;

        const distFromActor = Math.hypot(actor.x - spotX, actor.y - spotY);
        const distFromThreat = Math.hypot(threatX - spotX, threatY - spotY);

        const score = 380 - distFromActor + Math.min(180, distFromThreat * 0.45);
        if (score > bestScore) {
          bestScore = score;
          bestSpot = { x: Math.round(spotX), y: Math.round(spotY) };
        }
      }
    }

    return bestSpot;
  }

  /**
   * Friendly-Fire Prevention Check:
   * Returns true if Kobra-1 (player), hostages, or compliant non-combatants lie within
   * the ballistic cylinder (26px) between the shooter and the intended target.
   */
  protected isTrajectoryBlockedByFriendlies(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    shooterId: string
  ): boolean {
    const shotLen = Math.hypot(toX - fromX, toY - fromY);
    if (shotLen < 15) return false;

    for (const a of this.actors) {
      if (a.id === shooterId || a.state === 'DEAD') continue;
      const isProtected =
        a.role === 'PLAYER' ||
        a.role === 'SQUAD' ||
        a.role === 'HOSTAGE' ||
        a.role === 'CIVILIAN' ||
        a.state === 'SURRENDERED' ||
        a.state === 'ARRESTED';

      if (!isProtected) continue;

      const dSeg = this.distToSegment(a.x, a.y, fromX, fromY, toX, toY);
      if (dSeg < a.radius + 15) {
        const dFromShooter = Math.hypot(a.x - fromX, a.y - fromY);
        if (dFromShooter < shotLen + 20) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Broadcasts coordinated combat alerts to other armed suspects within acoustic and visual radius,
   * snapping them out of unaware patrolling and initiating defensive cover or flanking postures.
   */
  protected propagateSuspectCombatAlert(sourceSuspect: ActorEntity, threatX: number, threatY: number) {
    let alertedOthers = 0;
    for (const actor of this.actors) {
      if (
        actor.role === 'SUSPECT' &&
        actor.id !== sourceSuspect.id &&
        actor.state !== 'DEAD' &&
        actor.state !== 'ARRESTED' &&
        actor.state !== 'SURRENDERED'
      ) {
        const dist = Math.hypot(actor.x - sourceSuspect.x, actor.y - sourceSuspect.y);
        if (dist <= 680 && (actor.state === 'UNAWARE' || actor.state === 'ALERTED')) {
          actor.state = 'ALERTED';
          actor.alertLevel = 'COMBAT';
          actor.investigateTarget = {
            x: threatX + (Math.random() - 0.5) * 45,
            y: threatY + (Math.random() - 0.5) * 45,
          };
          actor.investigateTimer = 6.5;
          actor.angle = Math.atan2(threatY - actor.y, threatX - actor.x);
          alertedOthers++;

          if (!actor.speechBubble) {
            const shoutReplies = [
              'Deckung! Kobra ist drin!',
              'Polizei im Flur! Feuer frei!',
              'Halt die Stellung! Ich komme!',
              'Waffen sichern und zielen!',
            ];
            actor.speechBubble = {
              text: shoutReplies[Math.floor(Math.random() * shoutReplies.length)],
              timer: 2.2,
              type: 'HOSTILE',
            };
          }
        }
      }
    }

    if (alertedOthers > 0 && !sourceSuspect.speechBubble) {
      sourceSuspect.speechBubble = {
        text: 'POLIZEI! DECKUNG! ALLE ZUM FLUR!',
        timer: 2.2,
        type: 'HOSTILE',
      };
    }
  }

  /**
   * Tactical Door Stacking:
   * Computes an offset position on the wall jamb outside the fatal funnel (38px from threshold),
   * allowing Kobra-2 to stack alongside Kobra-1 ready for dynamic breach or pieing.
   */
  protected findTacticalStackPosition(door: DoorEntity, player: ActorEntity): Vec2 {
    const isVertical = Math.abs(door.x1 - door.x2) < 6;
    const mx = (door.x1 + door.x2) * 0.5;
    const my = (door.y1 + door.y2) * 0.5;

    if (isVertical) {
      const sideX = player.x < mx ? mx - 38 : mx + 38;
      const cand1 = { x: sideX, y: Math.min(door.y1, door.y2) - 28 };
      const cand2 = { x: sideX, y: Math.max(door.y1, door.y2) + 28 };
      if (!this.collidesAt(cand1.x, cand1.y, 16)) return cand1;
      if (!this.collidesAt(cand2.x, cand2.y, 16)) return cand2;
      return { x: sideX, y: my };
    } else {
      const sideY = player.y < my ? my - 38 : my + 38;
      const cand1 = { x: Math.min(door.x1, door.x2) - 28, y: sideY };
      const cand2 = { x: Math.max(door.x1, door.x2) + 28, y: sideY };
      if (!this.collidesAt(cand1.x, cand1.y, 16)) return cand1;
      if (!this.collidesAt(cand2.x, cand2.y, 16)) return cand2;
      return { x: mx, y: sideY };
    }
  }

  /** Fija la puerta de la orden: puerta apuntada, marcador BREACH_ZONE u operador. */
  protected findSquadDoorTarget(
    player: ActorEntity,
    squad: ActorEntity,
    target?: SquadCommandTarget
  ): DoorEntity | null {
    if (target?.type === 'DOOR' && target.id) {
      // La puerta apuntada manda incluso si ya fue abierta: así la orden no se
      // desvía a otra puerta cercana y la llegada puede resolverla sin brecha.
      return this.doors.find((door) => door.id === target.id) ?? null;
    }
    const marker = this.tacticalMarkers.find((m) => m.type === 'BREACH_ZONE');
    if (marker) {
      const markedDoor = this.findNearestClosedDoor(marker.x, marker.y, 1200);
      if (markedDoor) return markedDoor;
    }
    if (target) {
      return this.findNearestClosedDoor(target.x, target.y, 1200);
    }
    return (
      this.findNearestClosedDoor(player.x, player.y, 1200) ||
      this.findNearestClosedDoor(squad.x, squad.y, 1200)
    );
  }

  protected getSquadTargetDoor(): DoorEntity | null {
    if (!this.squadDoorTargetId) return null;
    return this.doors.find((door) => door.id === this.squadDoorTargetId) ?? null;
  }

  /**
   * Elige el método según el estado real de la puerta y el equipo del binomio:
   * cerrojo -> disparo de precisión, puerta normal -> patada, blindada -> C4
   * o ariete si el equipo lo lleva.
   */
  protected chooseSquadBreachMode(door: DoorEntity): SquadBreachMode {
    if (!door.isLocked) return 'KICK';

    const heavyDoor = /blindad|reforz|antiexplos|stellwerk|seguridad|industrial|port[oó]n/i.test(
      `${door.id} ${door.name}`
    );
    if (this.plan.squadGear === 'RAM') return 'RAM';
    if (heavyDoor && this.c4.count > 0) return 'C4';
    return 'SHOOT_LOCK';
  }

  /** La acción empieza sólo cuando Kobra-2 ya está en la posición de pila. */
  protected beginSquadBreach(door: DoorEntity, squad: ActorEntity): void {
    if (this.squadBreachAction || door.isOpen || door.isDestroyed) return;

    const mode = this.chooseSquadBreachMode(door);
    const maxProgress =
      mode === 'SHOOT_LOCK' ? 0.5 : mode === 'C4' ? 1.3 : mode === 'RAM' ? 0.75 : 0.35;

    this.squadBreachAction = {
      doorId: door.id,
      mode,
      progress: 0,
      maxProgress,
    };
    this.squadDoorTargetId = door.id;
    squad.gestureKind = 'BREACH';
    squad.gestureTimer = 0.8;
    squad.targetFacingAngle = Math.atan2(
      (door.y1 + door.y2) * 0.5 - squad.y,
      (door.x1 + door.x2) * 0.5 - squad.x
    );

    if (mode === 'SHOOT_LOCK') {
      const listener = this.getPlayer();
      soundEngine.playGunshotSpatial(
        'SUPPRESSED',
        squad.x,
        squad.y,
        listener?.x ?? squad.x,
        listener?.y ?? squad.y
      );
      this.traces?.push({
        x1: squad.x,
        y1: squad.y,
        x2: (door.x1 + door.x2) * 0.5,
        y2: (door.y1 + door.y2) * 0.5,
        color: '#F59E0B',
        alpha: 0.85,
        isTaser: false,
      });
      squad.recoilTimer = 0.12;
      this.pushRadio('KOBRA-2', `[3] Disparo de precisión al cerrojo de ${door.name}.`, 'info');
      squad.speechBubble = { text: 'Cerrojo neutralizado con disparo.', timer: 1.8, type: 'COMMAND' };
      this.emitNoise(squad.x, squad.y, 64, 320, 'Disparo al cerrojo', '#F59E0B');
    } else {
      soundEngine.playBreachPrep(mode);
      const method =
        mode === 'C4' ? 'carga C4' : mode === 'RAM' ? 'ariete' : 'patada';
      this.pushRadio('KOBRA-2', `[3] Preparando ${method} en ${door.name}.`, 'warn');
      squad.speechBubble = {
        text: mode === 'C4' ? '¡C4 lista, atrás!' : mode === 'RAM' ? '¡Ariete listo!' : '¡Patada!',
        timer: 1.8,
        type: 'COMMAND',
      };
    }
  }

  /**
   * Ejecuta la acción de brecha del binomio. La puerta permanece cerrada hasta
   * que termina el tiempo de preparación; nunca se abre una puerta distinta.
   */
  protected updateSquadBreachAction(dt: number, squad: ActorEntity): boolean {
    const action = this.squadBreachAction;
    if (!action) return false;

    const door = this.doors.find((d) => d.id === action.doorId);
    if (!door) {
      this.squadBreachAction = undefined;
      this.squadDoorTargetId = undefined;
      this.squadCommand = 'HOLD';
      squad.investigateTarget = undefined;
      return true;
    }

    if (door.isOpen || door.isDestroyed) {
      this.squadBreachAction = undefined;
      this.squadDoorTargetId = undefined;
      this.moveSquadIntoRoom(squad, door);
      return true;
    }

    const doorX = (door.x1 + door.x2) * 0.5;
    const doorY = (door.y1 + door.y2) * 0.5;
    squad.angle = Math.atan2(doorY - squad.y, doorX - squad.x);
    squad.targetFacingAngle = squad.angle;
    squad.gestureKind = 'BREACH';
    squad.gestureTimer = 0.65;
    action.progress += dt;

    if (action.progress < action.maxProgress) return true;

    if (action.mode === 'SHOOT_LOCK') {
      door.isLocked = false;
      this.pushRadio('KOBRA-2', `[3] Cerrojo de ${door.name} neutralizado. Preparando entrada.`, 'ok');
      squad.speechBubble = { text: 'Cerrojo neutralizado. ¡Entrando!', timer: 1.8, type: 'COMMAND' };
      this.squadBreachAction = {
        doorId: door.id,
        mode: 'KICK',
        progress: 0,
        maxProgress: 0.35,
      };
      return true;
    }

    if (action.mode === 'C4') {
      this.c4.count = Math.max(0, this.c4.count - 1);
    }
    this.executeBreach(door, action.mode, 'KOBRA-2');
    this.detonateGadgetAt(doorX, doorY, 'FLASHBANG');
    this.squadBreachAction = undefined;
    this.squadDoorTargetId = undefined;
    squad.speechBubble = { text: 'Zugriff! Raum betreten!', timer: 2.6, type: 'COMMAND' };
    this.pushRadio('KOBRA-2', `[3] ¡Brecha en ${door.name}! Entrando al compartimento.`, 'ok');
    this.moveSquadIntoRoom(squad, door);
    return true;
  }

  protected moveSquadIntoRoom(squad: ActorEntity, door: DoorEntity): boolean {
    // Si el binomio viene del rellano, entra al lado interior (roomB); si ya
    // está dentro, sale al lado exterior (roomA). Con habitación desconocida
    // preferimos el lado interior, no el rellano.
    const targetRoomId =
      squad.roomName === door.roomA
        ? door.roomB
        : squad.roomName === door.roomB
          ? door.roomA
          : door.roomB;
    const roomObj =
      (this.rooms ?? []).find((r) => r.id === targetRoomId) ??
      (this.rooms ?? []).find((r) => r.id === door.roomB);
    if (!roomObj) {
      this.squadCommand = 'HOLD';
      squad.investigateTarget = undefined;
      return false;
    }
    squad.investigateTarget = {
      x: roomObj.x + roomObj.w * 0.5,
      y: roomObj.y + roomObj.h * 0.5,
    };
    squad.targetFacingAngle = Math.atan2(
      roomObj.y + roomObj.h * 0.5 - squad.y,
      roomObj.x + roomObj.w * 0.5 - squad.x
    );
    return true;
  }

  /**
   * Kobra-2 can open an unlocked door while conducting a security sweep. He must
   * not do it while following or stacking: the stack is deliberate. Locked doors
   * stay closed and are reported once, waiting for a breach order.
   */
  protected tryOpenSquadDoor(squad: ActorEntity, desiredAngle: number): boolean {
    if (this.squadDoorCooldown > 0) return false;

    const probeDistance = 28;
    const probeX = squad.x + Math.cos(desiredAngle) * probeDistance;
    const probeY = squad.y + Math.sin(desiredAngle) * probeDistance;
    const door = this.findNearestClosedDoor(probeX, probeY, 46);
    if (!door || door.isBreached) return false;

    const doorMidX = (door.x1 + door.x2) * 0.5;
    const doorMidY = (door.y1 + door.y2) * 0.5;
    const doorAngle = Math.atan2(doorMidY - squad.y, doorMidX - squad.x);
    if (Math.abs(this.normalizeAngle(doorAngle - desiredAngle)) > 1.05) return false;

    if (door.isLocked) {
      if (this.squadDoorWarnCooldown <= 0) {
        this.squadDoorWarnCooldown = 8;
        squad.speechBubble = { text: 'Tür verschlossen! Zugriff nötig!', timer: 2.0, type: 'COMMAND' };
        this.pushRadio('KOBRA-2', `[!] ${door.name} cerrada con llave. Esperando orden de brecha.`, 'warn');
      }
      return false;
    }

    door.isOpen = true;
    door.currentAngle = door.openAngle;
    this.squadDoorCooldown = 1.4;
    soundEngine.playDoorAction(false);
    squad.speechBubble = { text: 'Tür auf, weiter sichern!', timer: 1.6, type: 'COMMAND' };
    this.pushRadio('KOBRA-2', `[6] ${door.name} abierta; avanzando al objetivo.`, 'info');
    return true;
  }

  protected updateSquadmateAI(dt: number, player: ActorEntity) {
    this.squadDoorCooldown = Math.max(0, this.squadDoorCooldown - dt);
    this.squadDoorWarnCooldown = Math.max(0, this.squadDoorWarnCooldown - dt);

    // Tick down temporary tactical markers placed in EKO-PAD
    if (this.tacticalMarkers.length > 0) {
      for (let i = this.tacticalMarkers.length - 1; i >= 0; i--) {
        this.tacticalMarkers[i].remainingSeconds -= dt;
        if (this.tacticalMarkers[i].remainingSeconds <= 0) {
          this.tacticalMarkers.splice(i, 1);
        }
      }
    }

    const squad = this.getSquadmate();
    if (!squad || squad.state === 'DEAD') return;

    // La brecha se resuelve aquí, después de que la puerta objetivo haya sido
    // fijada por la orden. Mientras dura, Kobra-2 no vuelve a navegar ni elige
    // otra puerta por proximidad.
    if (this.updateSquadBreachAction(dt, squad)) return;

    // Health / Help Request logic
    if (squad.bodyHealth) {
      const avgHealth = (squad.bodyHealth.torso + squad.bodyHealth.arms + squad.bodyHealth.legs) / 3;
      if (avgHealth < 45 || squad.bodyHealth.bleeding) {
        this.squadLastWoundReportTimer += dt;
        if (this.squadLastWoundReportTimer > 15.0) {
          this.squadLastWoundReportTimer = 0;
          const msg = squad.bodyHealth.bleeding
            ? '¡Estoy herido! ¡Hemorragia activa, necesito asistencia médica!'
            : '¡He recibido impactos! Mi efectividad es baja, necesito apoyo.';
          squad.speechBubble = { text: 'Sanitäter! Ich bin getroffen!', timer: 2.5, type: 'PANIC' };
          this.pushRadio('KOBRA-2', `[!] ${msg}`, 'alert');
        }
      }
    }

    const prevX = squad.x;
    const prevY = squad.y;

    // Determine navigation target based on active SquadCommand, targeted order, or EKO-PAD Waypoint/Marker
    let navTarget: { x: number; y: number } | null = null;

    // Transit Interruption Check: Detect suspects or civilians in transit.
    // Despejar una zona C4 tiene prioridad absoluta: no detenerse dentro del radio.
    if (
      this.squadCommand !== 'CLEAR_BLAST_AREA' &&
      (squad.investigateTarget || this.tacticalWaypoint) &&
      (squad.state as string) !== 'DEAD'
    ) {
      const targetPos = squad.investigateTarget || this.tacticalWaypoint;
      if (targetPos) {
        for (const actor of this.actors) {
          if (actor.id === squad.id || (actor.state as string) === 'DEAD' || (actor.state as string) === 'ARRESTED') continue;
          const distToActor = Math.hypot(actor.x - squad.x, actor.y - squad.y);
          if (distToActor <= 260 && !this.raycastWallsAndDoors(squad.x, squad.y, actor.x, actor.y)) {
            if (actor.role === 'SUSPECT' && actor.state !== 'SURRENDERED') {
              squad.investigateTarget = undefined;
              this.tacticalWaypoint = undefined;
              squad.speechBubble = { text: 'Feindkontakt in der Bewegung! Feuer!', timer: 2.2, type: 'HOSTILE' };
              this.pushRadio('KOBRA-2', '[!] Contacto hostil en tránsito. Interrumpiendo marcha y comprometiendo amenaza.', 'alert');
              break;
            } else if ((actor.role === 'HOSTAGE' || actor.role === 'CIVILIAN') && actor.state !== 'ARRESTED') {
              squad.investigateTarget = undefined;
              this.tacticalWaypoint = undefined;
              squad.speechBubble = { text: 'Zivilist in der Route! Halt!', timer: 2.2, type: 'COMMAND' };
              this.pushRadio('KOBRA-2', '[i] Civil avistado en la ruta de avance. Alto temporal para asegurar.', 'info');
              actor.speechBubble = { text: '¡Ayuda! ¡Protejanme!', timer: 2.0, type: 'PANIC' };
              break;
            }
          }
        }
      }
    }

    if (squad.investigateTarget) {
      navTarget = squad.investigateTarget;
      const dist = Math.hypot(squad.investigateTarget.x - squad.x, squad.investigateTarget.y - squad.y);
      if (dist < 6) {
        squad.x = squad.investigateTarget.x;
        squad.y = squad.investigateTarget.y;
        if (squad.targetFacingAngle !== undefined) {
          squad.angle = squad.targetFacingAngle;
          this.squadHoldAnchorAngle = squad.targetFacingAngle;
        }
        if (this.squadCommand === 'BREACH_AND_CLEAR') {
          const targetDoor = this.getSquadTargetDoor();
          if (targetDoor && (targetDoor.isOpen || targetDoor.isDestroyed)) {
            // La puerta ya fue abierta por el operador: entramos, pero no
            // buscamos otra puerta ni ejecutamos una brecha distinta.
            this.squadDoorTargetId = undefined;
            this.pushRadio('KOBRA-2', `[3] ${targetDoor.name} ya está abierta. Entrando.`, 'info');
            this.moveSquadIntoRoom(squad, targetDoor);
            return;
          }
          if (targetDoor && !targetDoor.isBreached) {
            // Inicia el método elegido sin abrir la puerta todavía.
            this.beginSquadBreach(targetDoor, squad);
            return;
          }
          // Llegada al centro de la estancia tras la brecha, o orden sin puerta.
          squad.speechBubble = { text: 'Raum betreten, inspiziert und gesichert!', timer: 2.2, type: 'COMMAND' };
          this.pushRadio('KOBRA-2', '[3] Espacio interior inspeccionado y asegurado con éxito. Sin amenazas.', 'ok');
          this.squadCommand = 'HOLD';
          squad.investigateTarget = undefined;
          return;
        } else if (this.squadCommand === 'PIE_DOOR') {
          const targetDoor = this.getSquadTargetDoor();
          if (targetDoor) {
            targetDoor.mirrored = true;
            let spotted = 0;
            for (const actor of this.actors) {
              if (
                (actor.roomName === targetDoor.roomA || actor.roomName === targetDoor.roomB) &&
                actor.role !== 'PLAYER' &&
                actor.role !== 'SQUAD'
              ) {
                actor.spottedByMirror = true;
                spotted++;
              }
            }
            squad.speechBubble = { text: `Optik-Sonde: ${spotted} Kontakte!`, timer: 2.2, type: 'COMMAND' };
            this.pushRadio('KOBRA-2', `[4] Sonda óptica en ${targetDoor.name}: ${spotted} contactos detectados.`, 'ok');
          }
          this.squadCommand = 'HOLD';
          this.squadDoorTargetId = undefined;
        } else if (this.squadCommand === 'DEPLOY_CS_GAS') {
          this.gadgets.push({
            x: squad.x,
            y: squad.y,
            tx: squad.investigateTarget.x,
            ty: squad.investigateTarget.y,
            progress: 0,
            type: 'CS_GAS',
            detonated: false,
            cloudTimer: EKO_COBRA_GADGETS.CS_GAS.durationSec,
          });
          squad.speechBubble = { text: 'CS-Reizgas unterwegs!', timer: 2.0, type: 'COMMAND' };
          this.pushRadio('KOBRA-2', '[5] ¡Granada CS lanzada con éxito sobre la posición objetivo!', 'warn');
          this.squadCommand = 'HOLD';
        } else if (this.squadCommand === 'SUPPRESS_TARGET') {
          soundEngine.playOpticCam();
          this.shoutWaves.push({ x: squad.x, y: squad.y, radius: 12, maxRadius: 340, alpha: 0.9 });
          squad.speechBubble = { text: 'POLIZEI! KEINE BEWEGUNG!', timer: 2.2, type: 'COMMAND' };
          for (const actor of this.actors) {
            if (actor.role === 'SUSPECT' && actor.state !== 'DEAD' && actor.state !== 'ARRESTED') {
              if (Math.hypot(actor.x - squad.x, actor.y - squad.y) <= 360) {
                actor.morale = Math.max(0, actor.morale - 35);
                if (actor.morale <= 28) {
                  this.makeSuspectSurrender(actor, 'Kobra-2 Sperrfeuer');
                }
              }
            }
          }
          this.pushRadio('KOBRA-2', '[7] Fuego de supresión e intimidación táctica sobre el sector.', 'warn');
          this.squadCommand = 'HOLD';
        } else if (this.squadCommand === 'CLEAR_BLAST_AREA') {
          squad.speechBubble = { text: 'Sprengzone geräumt!', timer: 2.0, type: 'COMMAND' };
          this.pushRadio('KOBRA-2', '[J] Zona de explosión despejada. A la espera de la detonación.', 'ok');
          this.squadCommand = 'HOLD';
        }
        squad.investigateTarget = undefined;
      }
    } else if (this.tacticalWaypoint) {
      navTarget = { x: this.tacticalWaypoint.x, y: this.tacticalWaypoint.y };
      const dist = Math.hypot(navTarget.x - squad.x, navTarget.y - squad.y);
      if (dist < 8) {
        squad.x = this.tacticalWaypoint.x;
        squad.y = this.tacticalWaypoint.y;
        if (this.squadCommand === 'PIE_DOOR') {
          this.squadCommand = 'HOLD';
        }
        this.tacticalWaypoint = undefined;
      }
    } else if (this.squadCommand === 'RESTRAIN_AND_SECURE') {
      // Find nearest surrendered suspect, unrescued hostage, or unsecured evidence anywhere in room/apartment
      const arrestCandidate = this.actors
        .filter(
          (a) =>
            ((a.role === 'SUSPECT' && a.state === 'SURRENDERED') ||
              ((a.role === 'HOSTAGE' || a.role === 'CIVILIAN') &&
                a.state !== 'ARRESTED' &&
                a.state !== 'DEAD')) &&
            Math.hypot(a.x - squad.x, a.y - squad.y) < 1200
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - squad.x, a.y - squad.y) - Math.hypot(b.x - squad.x, b.y - squad.y)
        )[0];
      const evCandidate = this.evidenceList
        .filter((e) => !e.secured && Math.hypot(e.x - squad.x, e.y - squad.y) < 1200)
        .sort(
          (a, b) =>
            Math.hypot(a.x - squad.x, a.y - squad.y) - Math.hypot(b.x - squad.x, b.y - squad.y)
        )[0];

      if (arrestCandidate) {
        navTarget = { x: arrestCandidate.x, y: arrestCandidate.y };
        if (Math.hypot(arrestCandidate.x - squad.x, arrestCandidate.y - squad.y) < 42) {
          arrestCandidate.state = 'ARRESTED';
          soundEngine.playArrestCuffs();
          if (arrestCandidate.role === 'SUSPECT') {
            this.recordRoeEvent(
              `Kobra-2 esposó con vida a ${arrestCandidate.name}`,
              200,
              true
            );
            this.pushRadio('KOBRA-2', `[6] ${arrestCandidate.name} asegurado y esposado.`, 'ok');
            squad.speechBubble = { text: 'Sospechoso asegurado.', timer: 1.8, type: 'COMMAND' };
          } else {
            this.recordRoeEvent(
              `Kobra-2 evacuó a salvo a ${arrestCandidate.name}`,
              150,
              true
            );
            this.pushRadio('KOBRA-2', `[6] ${arrestCandidate.name} evacuado a zona segura.`, 'ok');
            squad.speechBubble = { text: 'Civil a salvo.', timer: 1.8, type: 'COMMAND' };
          }
          this.checkMissionCompletion();
        }
      } else if (evCandidate) {
        navTarget = { x: evCandidate.x, y: evCandidate.y };
        if (Math.hypot(evCandidate.x - squad.x, evCandidate.y - squad.y) < 38) {
          evCandidate.secured = true;
          soundEngine.playOpticCam();
          this.recordRoeEvent(
            `Kobra-2 incautó evidencia balística (${evCandidate.label})`,
            50,
            true
          );
          this.pushRadio('KOBRA-2', `[6] Evidencia asegurada: ${evCandidate.label}.`, 'ok');
          squad.speechBubble = { text: 'Evidencia asegurada.', timer: 1.8, type: 'COMMAND' };
          this.checkMissionCompletion();
        }
      } else {
        this.squadCommand = 'FOLLOW';
      }
    } else {
      const rallyMarker = this.tacticalMarkers.find((m) => m.type === 'RALLY_POINT');
      const doorNear = this.findNearestDoor(player.x, player.y, 68);
      const isPlayerReloadingOrHealing = this.reloadTimer > 0 || (player.bodyHealth?.bleeding);
      const doorBlocking = Boolean(doorNear && !doorNear.isOpen && !doorNear.isDestroyed);

      navTarget = computeSquadNavTarget({
        command: this.squadCommand,
        player,
        rallyPoint: rallyMarker ? { x: rallyMarker.x, y: rallyMarker.y } : undefined,
        playerReloadingOrBleeding: Boolean(isPlayerReloadingOrHealing),
        doorBlocking,
        // Tactical door stacking: stack along the wall outside the fatal funnel
        stackPosition:
          doorBlocking && doorNear ? this.findTacticalStackPosition(doorNear, player) : undefined,
      });

      // Protective security: announce overwatch while covering a reload or medical aid.
      if (
        this.squadCommand === 'FOLLOW' &&
        !rallyMarker &&
        isPlayerReloadingOrHealing &&
        !squad.speechBubble &&
        Math.random() < 0.12
      ) {
        squad.speechBubble = { text: 'Deckung! Ich halte die Tür!', timer: 2.0, type: 'COMMAND' };
      }
    }

    let movementDirectionAngle: number | null = null;
    if (navTarget) {
      const dist = Math.hypot(navTarget.x - squad.x, navTarget.y - squad.y);
      if (dist > 6) {
        const ang = Math.atan2(navTarget.y - squad.y, navTarget.x - squad.x);
        const squadBh = squad.bodyHealth;
        const legMult = squadBh ? 0.35 + 0.65 * (squadBh.legs / 100) : 1.0;
        const dragMult = squadBh && squadBh.legs < 40 ? 0.45 : 1.0;
        const squadSpeed = (dist > 85 ? 175 : 145) * legMult * dragMult;
        const step = Math.min(dist, squadSpeed * dt);

        if (this.squadCommand === 'RESTRAIN_AND_SECURE') {
          this.tryOpenSquadDoor(squad, ang);
        }

        // Probe ahead instead of rubbing against the first wall/furniture. The
        // steering side persists until the direct bearing is clear again.
        const probeDistance = Math.max(24, step * 2.4);
        const steeringAngle = chooseSquadSteeringAngle(
          ang,
          (candidate) =>
            this.collidesAt(
              squad.x + Math.cos(candidate) * probeDistance,
              squad.y + Math.sin(candidate) * probeDistance,
              squad.radius
            ),
          this.squadSteerSide
        );
        const steeringDelta = this.normalizeAngle(steeringAngle - ang);
        if (Math.abs(steeringDelta) > 0.05) {
          this.squadSteerSide = steeringDelta > 0 ? 1 : -1;
        }
        movementDirectionAngle = steeringAngle;
        this.moveActorWithCollision(
          squad,
          squad.x + Math.cos(steeringAngle) * step,
          squad.y + Math.sin(steeringAngle) * step
        );
      }
    }

    squad.roomName = this.getRoomAt(squad.x, squad.y);
    const movedSpeed = dt > 0 ? Math.hypot(squad.x - prevX, squad.y - prevY) / dt : 0;
    if (movedSpeed > 110 || (movedSpeed > 25 && this.currentMovementGait === 'SPRINTING')) {
      this.squadMovementGait = 'SPRINTING';
      this.squadFatigue = Math.min(100, this.squadFatigue + 14.5 * dt);
    } else if (movedSpeed > 10) {
      this.squadMovementGait = 'WALKING';
      this.squadFatigue = Math.max(0, this.squadFatigue - 4.2 * dt);
    } else {
      this.squadMovementGait = 'RESTING';
      this.squadFatigue = Math.max(0, this.squadFatigue - 13.5 * dt);
    }

    // Tick down burst interval timer
    if (squad.burstTimer !== undefined && squad.burstTimer > 0) {
      squad.burstTimer = Math.max(0, squad.burstTimer - dt);
    }

    let threatFound = false;
    for (const actor of this.actors) {
      if (
        actor.role === 'SUSPECT' &&
        actor.state !== 'DEAD' &&
        actor.state !== 'ARRESTED' &&
        !this.raycastWallsAndDoors(squad.x, squad.y, actor.x, actor.y)
      ) {
        const distToThreat = Math.hypot(actor.x - squad.x, actor.y - squad.y);
        if (distToThreat < 550) {
          const threatAng = Math.atan2(actor.y - squad.y, actor.x - squad.x);
          const diff = this.normalizeAngle(threatAng - squad.angle);
          squad.angle = this.normalizeAngle(squad.angle + diff * Math.min(1, 14 * dt));
          this.squadHoldAnchorAngle = threatAng;
          threatFound = true;

          // Suppression logic
          const suppressBonus = this.squadCommand === 'SUPPRESS_TARGET' ? 14 : 4;
          actor.morale = Math.max(0, actor.morale - suppressBonus * dt);
          if (actor.morale <= 22 && actor.state !== 'SURRENDERED') {
            this.makeSuspectSurrender(actor, 'Kobra-2 Sperrfeuer');
          }

          // Active firing logic for Kobra-2 with friendly fire line-of-fire safety & controlled double-tap
          if (actor.isArmed && actor.state !== 'SURRENDERED') {
            const lineBlocked = this.isTrajectoryBlockedByFriendlies(
              squad.x,
              squad.y,
              actor.x,
              actor.y,
              squad.id
            );

            if (lineBlocked) {
              // Safety hold: Player or hostage is dangerously close to bullet path!
              squad.windupProgress = 0;
              squad.burstCount = 0;
              // Sidestep tactically to establish a clean firing lane
              const perpAng = threatAng + Math.PI * 0.5 * (Math.sin(this.elapsedSeconds * 2.5) > 0 ? 1 : -1);
              const sidestepSpeed = 70;
              this.moveActorWithCollision(
                squad,
                squad.x + Math.cos(perpAng) * sidestepSpeed * dt,
                squad.y + Math.sin(perpAng) * sidestepSpeed * dt
              );
              if (!squad.speechBubble && Math.random() < 0.06) {
                squad.speechBubble = { text: 'Schusslinie blockiert! Vorsicht!', timer: 1.8, type: 'COMMAND' };
              }
            } else {
              squad.windupProgress = (squad.windupProgress || 0) + dt;

              // Initiate double-tap burst when reaction windup reaches threshold
              if (squad.windupProgress >= 0.38 && (!squad.burstCount || squad.burstCount <= 0)) {
                squad.burstCount = 2; // Tactical 2-round controlled burst
                squad.burstTimer = 0;
              }

              if ((squad.burstCount ?? 0) > 0 && (squad.burstTimer ?? 0) <= 0) {
                squad.burstCount = (squad.burstCount ?? 1) - 1;
                squad.burstTimer = 0.11; // 110ms between rounds
                squad.recoilTimer = 0.11;
                squad.alertLevel = 'COMBAT';
                const spatialPlayer = this.getPlayer();
                soundEngine.playGunshotSpatial(
                  'SUPPRESSED',
                  squad.x,
                  squad.y,
                  spatialPlayer?.x ?? squad.x,
                  spatialPlayer?.y ?? squad.y
                );
                const spec = EKO_COBRA_WEAPONS['AUG_PARA'];
                const climbSpread = squad.burstCount === 0 ? 0.038 : 0.015;
                this.castProjectile(
                  squad,
                  squad.angle + (Math.random() - 0.5) * climbSpread,
                  700,
                  spec.damage,
                  false
                );

                if (squad.burstCount <= 0) {
                  squad.windupProgress = 0; // Reset windup cycle after burst completes
                }
              }
            }
          }
          break;
        }
      }
    }
    if (!threatFound) {
      squad.windupProgress = 0;
      squad.burstCount = 0;
      this.squadScanningTimer += dt;

      let desiredAngle = squad.angle;
      const hostileMarker = this.tacticalMarkers.find((m) => m.type === 'HOSTILE');

      const isFollowing =
        this.squadCommand === 'FOLLOW' ||
        this.squadCommand === 'FORM_WEDGE' ||
        this.squadCommand === 'FORM_STAGGERED';

      const doorNear = this.findNearestDoor(player.x, player.y, 68);
      const isPlayerReloadingOrHealing = this.reloadTimer > 0 || (player.bodyHealth?.bleeding);

      if (hostileMarker) {
        desiredAngle = Math.atan2(hostileMarker.y - squad.y, hostileMarker.x - squad.x);
        this.squadHoldAnchorAngle = desiredAngle;
      } else if (isPlayerReloadingOrHealing) {
        // Overwatch direction while shielding player
        desiredAngle = player.angle + Math.sin(this.squadScanningTimer * 1.6) * 0.22;
        this.squadHoldAnchorAngle = desiredAngle;
      } else if (isFollowing && doorNear && !doorNear.isOpen && !doorNear.isDestroyed) {
        // Aiming at the door threshold while stacked on the door jamb
        const doorMidX = (doorNear.x1 + doorNear.x2) * 0.5;
        const doorMidY = (doorNear.y1 + doorNear.y2) * 0.5;
        desiredAngle = Math.atan2(doorMidY - squad.y, doorMidX - squad.x);
        this.squadHoldAnchorAngle = desiredAngle;
      } else if (!isFollowing && movementDirectionAngle !== null) {
        // Moving to execute a specific order (door breach, optic probe, CS gas, restrain, waypoint):
        this.squadHoldAnchorAngle = movementDirectionAngle;
        desiredAngle = movementDirectionAngle + Math.sin(this.squadScanningTimer * 1.4) * 0.18;
      } else if (isFollowing) {
        // Dynamic protection while following/in formation: alternate between checking rear (6) and front
        const lookBackward = Math.sin(this.squadScanningTimer * 0.35) > -0.2;
        const baseAngle = lookBackward ? player.angle + Math.PI : player.angle;
        const scanOffset = Math.sin(this.squadScanningTimer * 0.85) * 0.42;
        desiredAngle = baseAngle + scanOffset;
        this.squadHoldAnchorAngle = player.angle;
      } else {
        // Holding position / covering breached sector
        const scanOffset = Math.sin(this.squadScanningTimer * 0.85) * 0.42;
        desiredAngle = this.squadHoldAnchorAngle + scanOffset;
      }

      const angleDiff = this.normalizeAngle(desiredAngle - squad.angle);
      const turnSpeed = !threatFound && movementDirectionAngle !== null ? 12.0 : 6.0;
      squad.angle = this.normalizeAngle(squad.angle + angleDiff * Math.min(1, turnSpeed * dt));
    }
  }

  protected updateHostagesAI(dt: number, player: ActorEntity) {
    const isGunfireActive =
      this.traces.length > 0 ||
      this.actors.some(
        (a) =>
          a.role === 'SUSPECT' &&
          (a.state === 'FIRING' || a.state === 'AIMING_WINDUP' || a.state === 'FLEEING')
      );

    const safeX = 185;
    const safeY = 410;

    for (const actor of this.actors) {
      if (
        (actor.role !== 'HOSTAGE' && actor.role !== 'CIVILIAN') ||
        actor.state === 'DEAD' ||
        actor.state === 'ARRESTED'
      ) {
        continue;
      }

      // 1. Compliance with Police Orders (Spacebar shout waves)
      if (actor.isCompliant) {
        if ((actor.complianceTimer ?? 0) > 0) {
          actor.complianceTimer = (actor.complianceTimer ?? 0) - dt;
          actor.isProne = true;
          actor.isCrouched = true;
          actor.state = 'SURRENDERED';
          if (actor.complianceTimer <= 0) {
            actor.isCompliant = false;
          }
          continue;
        }
      }

      const distToPlayer = Math.hypot(actor.x - player.x, actor.y - player.y);
      const inPlayerRoom = actor.roomName === player.roomName;

      // 2. Active Gunfight Defense: Seek immediate furniture cover & drop prone
      if (isGunfireActive) {
        if (!actor.inCover && !actor.isProne) {
          // Find nearest cover point (under table, behind sofa/bed)
          const threatActor = this.actors.find(
            (a) => a.role === 'SUSPECT' && (a.state === 'FIRING' || a.state === 'AIMING_WINDUP')
          );
          const threatRefX = threatActor ? threatActor.x : player.x;
          const threatRefY = threatActor ? threatActor.y : player.y;
          const coverSpot = this.findBestCoverForActor(actor, threatRefX, threatRefY, 180);

          if (coverSpot) {
            const dCover = Math.hypot(coverSpot.x - actor.x, coverSpot.y - actor.y);
            if (dCover > 16) {
              const ang = Math.atan2(coverSpot.y - actor.y, coverSpot.x - actor.x);
              actor.angle = ang;
              actor.isCrouched = true;
              this.moveActorWithCollision(
                actor,
                actor.x + Math.cos(ang) * 95 * dt,
                actor.y + Math.sin(ang) * 95 * dt
              );
            } else {
              actor.inCover = true;
              actor.isProne = true;
              actor.isCrouched = true;
              actor.state = 'SURRENDERED';
              if (!actor.speechBubble) {
                actor.speechBubble = {
                  text: 'Hilfe! Ich gehe in Deckung am Boden!',
                  timer: 2.2,
                  type: 'PANIC',
                };
              }
            }
          } else {
            // Drop prone on the floor immediately away from center of room
            actor.isProne = true;
            actor.isCrouched = true;
            actor.state = 'SURRENDERED';
            if (!actor.speechBubble) {
              actor.speechBubble = {
                text: 'Nicht schießen! Ich liege am Boden!',
                timer: 2.0,
                type: 'PANIC',
              };
            }
          }
        }
      }

      // 3. Fleeing condition & smart pathfinding away from danger
      if (actor.state === 'SURRENDERED' || actor.state === 'UNAWARE') {
        if (inPlayerRoom && distToPlayer < 240 && !isGunfireActive) {
          // Player has entered and room is relatively calm: hostage can safely evacuate
          if (Math.random() < 0.05) {
            actor.state = 'FLEEING';
            actor.isProne = false;
            actor.isCrouched = true;
            actor.speechBubble = {
              text:
                actor.role === 'HOSTAGE'
                  ? 'Polizei ist da! Ich laufe zum Ausgang!'
                  : 'Ausgang ist frei! Weg hier!',
              timer: 2.2,
              type: 'COMMAND',
            };
            this.pushRadio(
              'KOBRA-2',
              `Evakuierung: ${actor.name} weicht ab in Richtung Stiegenhaus.`,
              'info'
            );
          }
        }
      }

      if (actor.state === 'FLEEING') {
        // Smart Pathfinding Check: Does the line to Stiegenhaus cross active shooters?
        const activeShooters = this.actors.filter(
          (a) =>
            a.role === 'SUSPECT' &&
            a.state !== 'DEAD' &&
            a.state !== 'ARRESTED' &&
            (a.state === 'AIMING_WINDUP' || a.state === 'FIRING')
        );

        let pathDangerous = false;
        for (const s of activeShooters) {
          const dToEvacLine = this.distToSegment(s.x, s.y, actor.x, actor.y, safeX, safeY);
          if (dToEvacLine < 95) {
            pathDangerous = true;
            break;
          }
        }

        if (pathDangerous) {
          // Stop fleeing into crossfire! Freeze and drop prone behind cover
          actor.state = 'SURRENDERED';
          actor.isProne = true;
          actor.isCrouched = true;
          actor.speechBubble = {
            text: 'Schütze im Flur! Ich kann nicht durch!',
            timer: 2.2,
            type: 'PANIC',
          };
          continue;
        }

        // Safe to advance toward Stiegenhaus
        const ang = Math.atan2(safeY - actor.y, safeX - actor.x);
        const fleeSpeed = 115;
        this.moveActorWithCollision(
          actor,
          actor.x + Math.cos(ang) * fleeSpeed * dt,
          actor.y + Math.sin(ang) * fleeSpeed * dt
        );
        actor.angle = ang;
        actor.isCrouched = true;

        const distToSafe = Math.hypot(actor.x - safeX, actor.y - safeY);
        if (distToSafe < 60 || Math.hypot(actor.x - player.x, actor.y - player.y) > 420) {
          actor.state = 'SURRENDERED';
          actor.isProne = false;
          actor.isCrouched = true;
          actor.speechBubble = {
            text: 'Ich bin in Sicherheit... Danke, Polizei!',
            timer: 2.2,
            type: 'COMMAND',
          };
          this.pushRadio('KOBRA-1', `${actor.name} hat eine Sicherheitszone erreicht.`, 'ok');
        }
      }
    }
  }

  protected updateSuspectsAI(dt: number, player: ActorEntity) {
    const fovBoost = EKO_COBRA_INSPECTION_DEVICES[this.plan.inspectionDevice].fovBoost;
    const weatherVisMult = this.getWeatherVisibilityMultiplier(player.x, player.y);
    const maxVisionDist = (this.flashlightOn ? 540 : this.nvgActive ? 470 : 285) * weatherVisMult;
    const squad = this.getSquadmate();
    const isReconProfile = this.plan.profile === 'AUFKLAERER';

    for (const actor of this.actors) {
      if (actor.role === 'PLAYER' || actor.role === 'SQUAD') continue;

      const hasLOS = !this.raycastWallsAndDoors(player.x, player.y, actor.x, actor.y);
      const distToPlayer = Math.hypot(actor.x - player.x, actor.y - player.y);

      const angleFromPlayer = Math.atan2(actor.y - player.y, actor.x - player.x);
      const angleDiff = Math.abs(this.normalizeAngle(angleFromPlayer - player.angle));

      const inFlashlightCone =
        this.flashlightOn &&
        hasLOS &&
        distToPlayer <= 560 &&
        angleDiff <= 0.42;

      actor.visibleToPlayer =
        inFlashlightCone ||
        (hasLOS &&
          distToPlayer <= maxVisionDist &&
          (angleDiff < 1.15 + fovBoost || distToPlayer < 95));

      // Check Squadmate (Kobra-2) Helmet Camera line-of-sight
      if (squad && squad.state !== 'DEAD') {
        const squadHasLOS = !this.raycastWallsAndDoors(squad.x, squad.y, actor.x, actor.y);
        const distToSquad = Math.hypot(actor.x - squad.x, actor.y - squad.y);
        const angleFromSquad = Math.atan2(actor.y - squad.y, actor.x - squad.x);
        const squadAngleDiff = Math.abs(this.normalizeAngle(angleFromSquad - squad.angle));
        actor.visibleToSquad =
          squadHasLOS && distToSquad <= 430 && (squadAngleDiff < 1.05 || distToSquad < 85);
      } else {
        actor.visibleToSquad = false;
      }

      // Update Agent Helmet-Cam & Optical Sensor Biometric Facial Recognition Progress
      if (actor.visibleToPlayer || actor.visibleToSquad || actor.spottedByMirror) {
        const aimedClosely = actor.visibleToPlayer && angleDiff < 0.34;
        const baseScanSpeed = aimedClosely ? 95 : actor.visibleToPlayer ? 62 : 52;
        const profileBonus = isReconProfile ? 1.35 : 1.0;
        const nextScan = Math.min(
          100,
          (actor.biometricScanProgress ?? 0) + baseScanSpeed * profileBonus * dt
        );
        actor.biometricScanProgress = nextScan;

        if (actor.visibleToPlayer) {
          actor.identifiedCameraSource = 'KOBRA-1 HELMKAMERA';
        } else if (actor.visibleToSquad) {
          actor.identifiedCameraSource = 'KOBRA-2 HELMKAMERA';
        } else if (actor.spottedByMirror) {
          actor.identifiedCameraSource =
            this.plan.inspectionDevice === 'THERMAL_CAM'
              ? 'FLIR-THERMALKAMERA [Q]'
              : 'OPTIK-SONDE [Q]';
        }
      }

      if (actor.state === 'DEAD' || actor.state === 'ARRESTED') {
        if (actor.humanShieldHostageId) {
          const hostage = this.actors.find((a) => a.id === actor.humanShieldHostageId);
          if (hostage) {
            hostage.isShieldedByHostage = false;
            hostage.state = 'SURRENDERED';
            hostage.speechBubble = { text: '¡El sospechoso cayó! ¡Estoy a salvo!', timer: 2.5, type: 'SURRENDER' };
          }
          actor.humanShieldHostageId = undefined;
        }
        continue;
      }

      if (actor.stunTimer > 0) {
        actor.stunTimer = Math.max(0, actor.stunTimer - dt);
        if (actor.humanShieldHostageId) {
          const hostage = this.actors.find((a) => a.id === actor.humanShieldHostageId);
          if (hostage) {
            hostage.isShieldedByHostage = false;
            hostage.state = 'SURRENDERED';
            hostage.speechBubble = { text: '¡El estruendo lo aturdió! ¡Me liberé!', timer: 2.5, type: 'SURRENDER' };
          }
          actor.humanShieldHostageId = undefined;
          actor.state = 'HESITATING';
        }
        continue;
      }

      if (actor.role !== 'SUSPECT') continue;

      // Update position of hostage taken as Human Shield
      if (actor.humanShieldHostageId) {
        const hostage = this.actors.find((a) => a.id === actor.humanShieldHostageId);
        if (hostage && hostage.state !== 'DEAD') {
          hostage.x = actor.x + Math.cos(actor.angle) * 22;
          hostage.y = actor.y + Math.sin(actor.angle) * 22;
          hostage.angle = actor.angle;
          hostage.isShieldedByHostage = true;
        } else {
          actor.humanShieldHostageId = undefined;
        }
      }

      if (actor.state === 'FEIGNING_SURRENDER') {
        actor.feignTimer -= dt;
        if (actor.feignTimer <= 0) {
          actor.state = 'AIMING_WINDUP';
          actor.isArmed = true;
          actor.hasPointedWeaponAtPolice = true;
          actor.windupProgress = 0.25;
          actor.speechBubble = {
            text: 'Falle! Stirb, Bulle!',
            timer: 2.0,
            type: 'HOSTILE',
          };
          this.pushRadio(
            'KOBRA-2',
            `ACHTUNG! ${actor.name} täuscht Aufgabe vor und zieht Zweitwaffe!`,
            'alert'
          );
          this.registerAcousticEdgeCue(
            actor.id,
            actor.x,
            actor.y,
            'ALERT_VOICE',
            0.9,
            1.5,
            'MOVIMIENTO HOSTIL'
          );
        }
        continue;
      }

      if (actor.state === 'SURRENDERED' || actor.state === 'INCAPACITATED') {
        continue;
      }

      if (actor.state === 'PANIC') {
        actor.stunTimer = Math.max(0, actor.stunTimer - dt);
        if (actor.stunTimer <= 0 && actor.morale <= 25) {
          this.makeSuspectSurrender(actor, 'Zusammenbruch & Panik');
        } else if (actor.stunTimer <= 0) {
          actor.state = 'HESITATING';
        }
        continue;
      }

      if (actor.state === 'FLEEING') {
        const awayAng = Math.atan2(actor.y - player.y, actor.x - player.x) + (Math.random() - 0.5) * 0.9;
        const fleeSpeed = 115;
        this.moveActorWithCollision(
          actor,
          actor.x + Math.cos(awayAng) * fleeSpeed * dt,
          actor.y + Math.sin(awayAng) * fleeSpeed * dt
        );
        actor.angle = awayAng;
        actor.morale = Math.max(0, actor.morale - 6 * dt);
        if (actor.morale <= 18 || Math.hypot(actor.x - player.x, actor.y - player.y) > 380) {
          if (Math.random() < 0.7) {
            this.makeSuspectSurrender(actor, 'Erschöpft und geflohen');
          } else {
            actor.state = 'HESITATING';
          }
        }
        continue;
      }

      // Suspect detection distance depends on whether player's 1000-lumen flashlight is ON or OFF and subtle weather/dust visibility attenuation
      const suspectDetectionRange =
        (this.flashlightOn ? 500 : this.playerHiddenInShadow ? 80 : 320) * weatherVisMult;

      let targetThreat: ActorEntity | null = null;
      if (hasLOS && distToPlayer < suspectDetectionRange && !this.playerHiddenInShadow) {
        targetThreat = player;
      } else if (squad && squad.state !== 'DEAD' && squad.state !== 'ARRESTED') {
        const squadLOS = !this.raycastWallsAndDoors(actor.x, actor.y, squad.x, squad.y);
        const distToSquad = Math.hypot(actor.x - squad.x, actor.y - squad.y);
        if (squadLOS && distToSquad < suspectDetectionRange) {
          targetThreat = squad;
        }
      }

      if (targetThreat) {
        const threatX = targetThreat.x;
        const threatY = targetThreat.y;
        const distToThreat = Math.hypot(actor.x - threatX, actor.y - threatY);
        const targetAng = Math.atan2(threatY - actor.y, threatX - actor.x);
        actor.angle = targetAng;

        const playerAimDiff = Math.abs(this.normalizeAngle(angleFromPlayer - player.angle));
        const blindedByFlashlight =
          targetThreat === player && this.flashlightOn && playerAimDiff < 0.28 && distToPlayer < 310;

        if (targetThreat === player && playerAimDiff < 0.24) {
          actor.morale = Math.max(0, actor.morale - (blindedByFlashlight ? 16 : 10) * dt);
        }

        if (actor.morale <= 24) {
          this.makeSuspectSurrender(actor, 'Psychologischer Druck & Blendung');
          continue;
        }

        const suspectBh = this.ensureBodyHealth(actor);

        // Tactical Fallback: Heavy wounds or panic trigger fallback into inner room/cover
        const isSeverelyWounded = suspectBh.torso < 40 || suspectBh.legs < 40 || actor.morale < 32;
        if (isSeverelyWounded && distToThreat < 260 && Math.random() < 0.35 * dt) {
          actor.state = 'FLEEING';
          if (!actor.speechBubble) {
            actor.speechBubble = {
              text: 'Verdammt! Bin schwer getroffen! Rückzug!',
              timer: 2.0,
              type: 'HOSTILE',
            };
          }
          this.propagateSuspectCombatAlert(actor, threatX, threatY);
          continue;
        }

        if (!actor.humanShieldHostageId && actor.morale < 78 && actor.morale > 18) {
          const nearbyHostage = this.actors.find(
            (h) =>
              (h.role === 'HOSTAGE' || h.role === 'CIVILIAN') &&
              h.state !== 'DEAD' &&
              h.state !== 'ARRESTED' &&
              !h.isShieldedByHostage &&
              Math.hypot(h.x - actor.x, h.y - actor.y) < 140
          );
          if (nearbyHostage) {
            actor.state = 'USING_HUMAN_SHIELD';
            actor.humanShieldHostageId = nearbyHostage.id;
            nearbyHostage.isShieldedByHostage = true;
            nearbyHostage.state = 'SURRENDERED';
            actor.speechBubble = {
              text: '¡Atrás, policía! ¡Uso a la rehén como escudo!',
              timer: 2.6,
              type: 'HOSTILE',
            };
            this.pushRadio(
              'KOBRA-2',
              `¡ACHTUNG! ${actor.name} ha tomado a ${nearbyHostage.name} como ESCUDO HUMANO. ¡Usa disparo a extremidades [V], Taser [T] o Negociación [Y]!`,
              'alert'
            );
            const roomCode = this.getRoomAt(actor.x, actor.y);
            this.logCriticalEvent(
              'HUMAN_SHIELD_TAKEN',
              `Escudo humano tomado por ${actor.name}`,
              roomCode,
              'WARN',
              { details: `${actor.name} utiliza a ${nearbyHostage.name} para protegerse de disparos al torso.` }
            );
          }
        }

        if (
          actor.state === 'UNAWARE' ||
          actor.state === 'ALERTED' ||
          actor.state === 'HESITATING'
        ) {
          actor.state = 'AIMING_WINDUP';
          actor.hasPointedWeaponAtPolice = true;
          actor.windupProgress = 0;
          actor.coverWaitTimer = 0;
          actor.peekTimer = 1.8 + Math.random() * 1.0;
          if (!actor.speechBubble) {
            actor.speechBubble = {
              text: blindedByFlashlight
                ? 'Verdammtes Licht! Zurück!'
                : 'Zurück! Oder ich schieße!',
              timer: 1.6,
              type: 'HOSTILE',
            };
          }
          // Coordinated acoustic and visual combat alert broadcast across neighboring rooms
          this.propagateSuspectCombatAlert(actor, threatX, threatY);
        }

        if (actor.state === 'AIMING_WINDUP' || actor.state === 'FIRING' || actor.state === 'USING_HUMAN_SHIELD' || actor.state === 'BARGAINING') {
          // Dynamic Cover Seeking & Tactical Peeking / Crouching Cycles
          if (!actor.inCover) {
            if (!actor.coverPos) {
              actor.coverPos = this.findBestCoverForActor(actor, threatX, threatY, 260) ?? undefined;
            }

            if (actor.coverPos) {
              const dCover = Math.hypot(actor.coverPos.x - actor.x, actor.coverPos.y - actor.y);
              if (dCover > 16) {
                // Sprint dynamically toward evaluated cover spot
                const coverAng = Math.atan2(actor.coverPos.y - actor.y, actor.coverPos.x - actor.x);
                const legMult = 0.35 + 0.65 * (suspectBh.legs / 100);
                const runSpeed = 105 * legMult;
                this.moveActorWithCollision(
                  actor,
                  actor.x + Math.cos(coverAng) * runSpeed * dt,
                  actor.y + Math.sin(coverAng) * runSpeed * dt
                );
                actor.isCrouched = true;
                actor.angle = targetAng; // maintain eyes-on target vector
              } else {
                actor.inCover = true;
                actor.isCrouched = true;
                actor.coverWaitTimer = 1.2 + Math.random() * 1.5; // hide crouched in cover initially
                actor.peekTimer = 0;
              }
            }
          } else {
            // Already positioned in cover: alternate crouched hiding and active peeking bursts
            if ((actor.coverWaitTimer ?? 0) > 0) {
              actor.coverWaitTimer = (actor.coverWaitTimer ?? 0) - dt;
              actor.isCrouched = true;
              actor.windupProgress = Math.max(0, actor.windupProgress - dt * 0.5);
              if (actor.coverWaitTimer <= 0) {
                // Rise/peek out of cover to engage target
                actor.peekTimer = 1.8 + Math.random() * 1.4;
                actor.speechBubble = {
                  text: 'Feuer frei aus der Deckung!',
                  timer: 1.5,
                  type: 'HOSTILE',
                };
              }
            } else if ((actor.peekTimer ?? 0) > 0) {
              actor.peekTimer = (actor.peekTimer ?? 0) - dt;
              actor.isCrouched = false; // posture up to aim and open fire
              if (actor.peekTimer <= 0) {
                // Dip back down into protective cover
                actor.isCrouched = true;
                actor.coverWaitTimer = 1.4 + Math.random() * 1.8;
                actor.inCover = true;
              }
            }
          }

          // Advance aiming windup & firing when peeking or when no cover is available
          const canFire = !actor.inCover || (actor.peekTimer ?? 0) > 0;
          if (canFire) {
            const armSlowdown = 0.45 + 0.55 * (suspectBh.arms / 100);
            const baseRate = (actor.id === 'SUSPECT_MARKUS' ? 0.92 : 0.78) * armSlowdown;
            const windupRate = blindedByFlashlight ? baseRate * 0.75 : baseRate;
            actor.windupProgress += windupRate * dt;

            // Crippled leg dragging / slow fallback if wounded
            if (suspectBh.legs < 100 && distToThreat < 240 && !actor.inCover) {
              const retreatSpeed =
                42 * (0.35 + 0.65 * (suspectBh.legs / 100)) * (suspectBh.legs < 40 ? 0.45 : 1.0);
              const awayAng = targetAng + Math.PI;
              this.moveActorWithCollision(
                actor,
                actor.x + Math.cos(awayAng) * retreatSpeed * dt,
                actor.y + Math.sin(awayAng) * retreatSpeed * dt
              );
              if (suspectBh.legs < 70 && Math.random() < 0.25) {
                this.particles.push({
                  x: actor.x,
                  y: actor.y,
                  vx: 0,
                  vy: 0,
                  life: 5.0,
                  maxLife: 5.0,
                  color: '#991B1B',
                  size: 3.5,
                });
              }
            }

            if (actor.windupProgress >= 1) {
              actor.state = 'FIRING';
              actor.recoilTimer = 0.14;
              actor.windupProgress = 0.35;
              const spatialListener2 = this.getPlayer();
              soundEngine.playGunshotSpatial(
                'HOSTILE',
                actor.x,
                actor.y,
                spatialListener2?.x ?? actor.x,
                spatialListener2?.y ?? actor.y
              );
              const armPenaltySpread = ((100 - suspectBh.arms) / 100) * 0.32;
              const gasInaccuracy = actor.inCSGas ? 0.22 : 0;
              const inaccuracy =
                (Math.random() - 0.5) * ((blindedByFlashlight ? 0.26 : 0.16) + armPenaltySpread + gasInaccuracy);
              this.castProjectile(actor, actor.angle + inaccuracy, 600, 26, false);
              actor.state = 'AIMING_WINDUP';
            }
          }
        }
      } else if (this.playerHiddenInShadow && distToPlayer >= 80) {
        actor.windupProgress = Math.max(0, actor.windupProgress - dt * 0.8);
        if (actor.state === 'AIMING_WINDUP' || actor.state === 'FIRING') {
          actor.state = 'ALERTED';
          actor.windupProgress = 0;
          if (!actor.speechBubble) {
            actor.speechBubble = {
              text: 'Wo ist er hin? Nur Schatten...',
              timer: 1.8,
              type: 'HOSTILE',
            };
          }
        }
      } else {
        actor.windupProgress = Math.max(0, actor.windupProgress - dt * 0.6);

        // If suspect was alerted by gunfire or noise, they run/walk toward the noise origin to investigate
        if (
          actor.state === 'ALERTED' &&
          actor.investigateTarget &&
          (actor.investigateTimer ?? 0) > 0
        ) {
          actor.investigateTimer = Math.max(0, (actor.investigateTimer ?? 0) - dt);
          const dx = actor.investigateTarget.x - actor.x;
          const dy = actor.investigateTarget.y - actor.y;
          const distToTarget = Math.hypot(dx, dy);
          if (distToTarget > 48) {
            const runAng = Math.atan2(dy, dx);
            actor.angle = runAng;
            const suspectBh = this.ensureBodyHealth(actor);
            const legMult =
              (0.35 + 0.65 * (suspectBh.legs / 100)) * (suspectBh.legs < 40 ? 0.45 : 1.0);
            const runSpeed = 82 * legMult;
            this.moveActorWithCollision(
              actor,
              actor.x + Math.cos(runAng) * runSpeed * dt,
              actor.y + Math.sin(runAng) * runSpeed * dt
            );
          } else {
            // Reached noise origin! Scan area and cool down
            actor.investigateTimer = 0;
            actor.investigateTarget = undefined;
            actor.patrolWaitTimer = 3.5;
            actor.patrolBaseAngle = actor.angle;
            if (actor.speechBubble && actor.speechBubble.type === 'HOSTILE') {
              actor.speechBubble = {
                text: 'Falscher Alarm... Parece despejado por aquí.',
                timer: 2.0,
                type: 'HOSTILE',
              };
            }
          }
        } else if (actor.state === 'UNAWARE' || (actor.state === 'ALERTED' && !actor.investigateTarget)) {
          // Autonomous Suspect Patrol Behavior along waypoints
          if (actor.patrolRoute && actor.patrolRoute.length > 0) {
            if ((actor.patrolWaitTimer ?? 0) > 0) {
              actor.patrolWaitTimer = Math.max(0, (actor.patrolWaitTimer ?? 0) - dt);
              const baseAngle = actor.patrolBaseAngle ?? actor.angle;
              // Smoothly sweep eyes & weapon back and forth to scan the sector
              actor.angle = baseAngle + Math.sin(this.elapsedSeconds * 2.2) * 0.58;
            } else {
              const currentWpIndex = (actor.patrolIndex ?? 0) % actor.patrolRoute.length;
              const targetWp = actor.patrolRoute[currentWpIndex];
              const dx = targetWp.x - actor.x;
              const dy = targetWp.y - actor.y;
              const distToWp = Math.hypot(dx, dy);
              if (distToWp > 14) {
                const patrolAngle = Math.atan2(dy, dx);
                actor.angle = patrolAngle;
                actor.patrolBaseAngle = patrolAngle;
                const patrolSpeed = actor.state === 'ALERTED' ? 44 : 34; // brisker gait when alerted
                this.moveActorWithCollision(
                  actor,
                  actor.x + Math.cos(patrolAngle) * patrolSpeed * dt,
                  actor.y + Math.sin(patrolAngle) * patrolSpeed * dt
                );
              } else {
                // Reached patrol waypoint: pause, observe area, scan sector
                actor.patrolWaitTimer = 2.8 + Math.random() * 2.2;
                actor.patrolBaseAngle = actor.angle;
                actor.patrolIndex = (currentWpIndex + 1) % actor.patrolRoute.length;
              }
            }
          }
        }
      }
    }
  }



  /**
   * Renders immersive tactical camera film-grain noise and a deep crimson corner vignette
   * whenever the operator takes ballistic damage, bleeds, or comes under heavy fire.
   */

  /**
   * Renders a subtle directional acoustic indicator along the screen border (Peltor ComTac 3D Audio HUD)
   * pointing toward gunshots or suspicious footsteps/noises originating outside the operator's FOV.
   */








  /**
   * Casts dynamic 2D umbra shadow volumes behind furniture and actors
   * relative to the weapon-mounted flashlight positions of Kobra-1 and Kobra-2.
   */

  /**
   * Renders the offscreen darkness layer and carves out raycasted vision cones,
   * weapon-mounted tactical flashlights (Kobra-1 & Kobra-2), and dynamic muzzle flashes.
   */

  protected carveLightPolygon(
    lCtx: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    poly: Vec2[],
    radius: number,
    peakAlpha: number
  ) {
    if (poly.length === 0) return;
    lCtx.save();
    lCtx.beginPath();
    lCtx.moveTo(ox, oy);
    for (const pt of poly) {
      lCtx.lineTo(pt.x, pt.y);
    }
    lCtx.closePath();

    const grad = lCtx.createRadialGradient(ox, oy, 6, ox, oy, radius);
    grad.addColorStop(0, `rgba(255, 255, 255, ${peakAlpha})`);
    grad.addColorStop(0.65, `rgba(255, 255, 255, ${peakAlpha * 0.72})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    lCtx.fillStyle = grad;
    lCtx.fill();
    lCtx.restore();
  }

















  public cycleThermalPaletteMode() {
    const modes: ('WHITE_HOT' | 'BLACK_HOT' | 'IRONBOW')[] = ['WHITE_HOT', 'BLACK_HOT', 'IRONBOW'];
    const idx = modes.indexOf(this.thermalPaletteMode);
    this.thermalPaletteMode = modes[(idx + 1) % modes.length];
    soundEngine.playUiClick();
    this.emitHudSnapshot();
  }


  protected updateWeatherAndAmbientDust(dt: number) {
    if (this.exteriorBreachSurgeTimer > 0) {
      this.exteriorBreachSurgeTimer = Math.max(0, this.exteriorBreachSurgeTimer - dt);
    }

    const surgeRatio = Math.min(1, this.exteriorBreachSurgeTimer / this.exteriorBreachMaxDuration);
    const windBoost = 1 + surgeRatio * 1.15 + Math.min(0.65, this.breachWindSources.length * 0.22);

    // 1. Update Outdoor Graz Rain Drops (wind-slanted storm rain)
    for (const r of this.rainDrops) {
      r.x -= r.speed * (0.26 + surgeRatio * 0.14) * dt;
      r.y += r.speed * (1 + surgeRatio * 0.2) * dt;
      if (r.y > WORLD_HEIGHT) {
        r.y = -20;
        r.x = Math.random() * WORLD_WIDTH;
      }
      if (r.x < 0) {
        r.x = WORLD_WIDTH;
      }
    }

    // 2. Continuously emit rain streaks on windows & wind-driven rain/dust inflow from breached exterior walls/doors
    for (const win of this.exteriorWindows) {
      const mx = (win.x1 + win.x2) * 0.5;
      const my = (win.y1 + win.y2) * 0.5;
      const span = Math.hypot(win.x2 - win.x1, win.y2 - win.y1);
      const tx = (win.x2 - win.x1) / Math.max(1, span);
      const ty = (win.y2 - win.y1) / Math.max(1, span);
      const nx = Math.cos(win.normalAngle);
      const ny = Math.sin(win.normalAngle);

      if (!win.isBreached) {
        // Rain lashing against the exterior window glass & splashing on the sill
        if (Math.random() < 0.42) {
          const offset = (Math.random() - 0.5) * (span - 10);
          const wx = mx + tx * offset - nx * (2 + Math.random() * 5);
          const wy = my + ty * offset - ny * (2 + Math.random() * 5);
          const life = 0.24 + Math.random() * 0.22;
          this.windowRainParticles.push({
            windowId: win.id,
            x: wx,
            y: wy,
            vx: nx * (18 + Math.random() * 24) - 18,
            vy: ny * (18 + Math.random() * 24) + 32,
            len: 6 + Math.random() * 7,
            size: 1.4 + Math.random() * 1.1,
            alpha: 0.42 + Math.random() * 0.28,
            life,
            maxLife: life,
            kind: Math.random() < 0.65 ? 'GLASS_STREAK' : 'SILL_SPLASH',
          });
        }
      } else {
        // Breached exterior wall/window: continuous wind-driven rain spray & masonry dust drafting inside!
        const spawnProb = 0.68 + surgeRatio * 0.3;
        if (Math.random() < spawnProb) {
          const offset = (Math.random() - 0.5) * (span - 8);
          const wx = mx + tx * offset;
          const wy = my + ty * offset;
          const gustAngle = win.normalAngle + (Math.random() - 0.5) * 0.65;
          const spd = (95 + Math.random() * 145) * windBoost;
          const life = 0.48 + Math.random() * 0.52;
          this.windowRainParticles.push({
            windowId: win.id,
            x: wx,
            y: wy,
            vx: Math.cos(gustAngle) * spd,
            vy: Math.sin(gustAngle) * spd,
            len: 9 + Math.random() * 11,
            size: 1.6 + Math.random() * 1.3,
            alpha: 0.48 + Math.random() * 0.3,
            life,
            maxLife: life,
            kind: 'INFLOW_GUST',
          });
        }
      }
    }

    // Also emit wind-driven rain/dust inflow from breached exterior doors (e.g. Tür B Loggia or Tür A)
    for (const src of this.breachWindSources) {
      if (Math.random() < 0.52 * src.intensity * windBoost) {
        const gustAngle = src.normalAngle + (Math.random() - 0.5) * 0.72;
        const spd = (85 + Math.random() * 130) * windBoost;
        const life = 0.45 + Math.random() * 0.5;
        this.windowRainParticles.push({
          windowId: src.id,
          x: src.x + (Math.random() - 0.5) * 26,
          y: src.y + (Math.random() - 0.5) * 26,
          vx: Math.cos(gustAngle) * spd,
          vy: Math.sin(gustAngle) * spd,
          len: 8 + Math.random() * 10,
          size: 1.5 + Math.random() * 1.3,
          alpha: 0.38 + Math.random() * 0.28,
          life,
          maxLife: life,
          kind: 'INFLOW_GUST',
        });
      }
    }

    for (const wp of this.windowRainParticles) {
      wp.x += wp.vx * dt;
      wp.y += wp.vy * dt;
      wp.vx *= 0.96;
      wp.vy *= 0.96;
      wp.life -= dt;
    }
    if (this.windowRainParticles.length > 260) {
      this.windowRainParticles.splice(0, this.windowRainParticles.length - 260);
    }
    this.windowRainParticles = this.windowRainParticles.filter((wp) => wp.life > 0);

    // 3. Update Indoor Suspended Ambient Dust Motes (with turbulent draft acceleration from exterior breaches)
    for (const m of this.ambientDustMotes) {
      const turbX = Math.cos(this.elapsedSeconds * m.turbulenceFreq + m.phase) * 7.5 * windBoost;
      const turbY = Math.sin(this.elapsedSeconds * (m.turbulenceFreq * 0.85) + m.phase) * 7.5 * windBoost;

      let draftVx = 0;
      let draftVy = 0;
      for (const src of this.breachWindSources) {
        const dist = Math.hypot(m.x - src.x, m.y - src.y);
        if (dist < 340) {
          const factor = (1 - dist / 340) * (18 + surgeRatio * 42) * src.intensity;
          draftVx += Math.cos(src.normalAngle) * factor;
          draftVy += Math.sin(src.normalAngle) * factor;
        }
      }

      m.x += (m.vx * windBoost + turbX + draftVx) * dt;
      m.y += (m.vy * windBoost + turbY + draftVy) * dt;

      if (m.isSurgeMote) {
        m.vx *= 0.97;
        m.vy *= 0.97;
        if (m.life !== undefined) {
          m.life -= dt;
        }
      } else {
        // Wrap persistent indoor ambient dust motes within the apartment bounds
        if (m.x < 254) m.x = 1020;
        if (m.x > 1030) m.x = 258;
        if (m.y < 104) m.y = 714;
        if (m.y > 716) m.y = 108;
      }
    }
    this.ambientDustMotes = this.ambientDustMotes.filter(
      (m) => !m.isSurgeMote || (m.life ?? 0) > 0
    );
  }


  /**
   * Renders suspended indoor ambient dust motes with Tyndall light scattering when illuminated by
   * operator flashlights or wall sconces, plus volumetric dust/mist inflow plumes at breached exterior walls.
   */

  /**
   * Renders a subtle screen-space atmospheric dust/rain veil and compact meteorological visibility telemetry
   * that intensifies when an exterior wall, window, or door is breached.
   */


  protected normalizeAngle(a: number): number {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  protected getRoomAt(x: number, y: number): string {
    for (const r of this.rooms) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        return r.id;
      }
    }
    return 'AUSSENBEREICH';
  }

  /**
   * Mueve al operador con la ruta de simulation.ts: mismo recorte de paso, misma
   * normalización de entrada y misma colisión que los tests. El reloj del motor
   * (tick/tiempo) se espeja en la partida para que ambos usen el mismo tiempo.
   */
  protected avanzarJugador(player: ActorEntity, moveX: number, moveY: number, velocidad: number, dt: number) {
    const sim = this.simulacion;
    if (!sim) {
      const len = Math.hypot(moveX, moveY);
      if (len > 0) {
        this.moveActorWithCollision(
          player,
          player.x + (moveX / len) * velocidad * dt,
          player.y + (moveY / len) * velocidad * dt
        );
      }
      return;
    }
    // Los arrays del mapa pueden reemplazarse (brecha, mobiliario aleatorio).
    sim.mundo.paredes = this.walls;
    sim.mundo.puertas = this.doors;
    sim.mundo.muebles = this.furniture;
    sim.jugador.x = player.x;
    sim.jugador.y = player.y;
    sim.jugador.radio = player.radius;
    sim.jugador.velocidad = velocidad;
    sim.jugador.orientacion = player.angle;
    sim.entrada.x = moveX;
    sim.entrada.y = moveY;
    sim.tick = this.ticks;
    sim.tiempo = this.elapsedSeconds;
    sim.avanzar(dt);
    player.x = sim.jugador.x;
    player.y = sim.jugador.y;
    player.angle = sim.jugador.orientacion;
  }

  protected moveActorWithCollision(actor: ActorEntity, nextX: number, nextY: number) {
    // El deslizamiento y la colisión viven en simulation.ts, compartidos con los tests.
    deslizarConColision(actor, nextX, nextY, (x, y) => this.collidesAt(x, y, actor.radius));
  }

  protected collidesAt(x: number, y: number, radius: number): boolean {
    return colisiona(x, y, radius, this.walls, this.doors, this.furniture);
  }

  protected distToSegment(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): number {
    return distanciaASegmento(px, py, x1, y1, x2, y2);
  }

  protected computeVisibilityPolygon(
    ox: number,
    oy: number,
    centerAngle: number,
    maxDist: number,
    halfFov: number,
    rays: number
  ): Vec2[] {
    const pts: Vec2[] = [];
    for (let i = 0; i <= rays; i++) {
      const a = centerAngle - halfFov + (i / rays) * (halfFov * 2);
      const tx = ox + Math.cos(a) * maxDist;
      const ty = oy + Math.sin(a) * maxDist;
      const hit = this.raycastPoint(ox, oy, tx, ty);
      pts.push(hit ? hit : { x: tx, y: ty });
    }
    return pts;
  }

  protected raycastWallsAndDoors(x1: number, y1: number, x2: number, y2: number): boolean {
    return this.raycastPoint(x1, y1, x2, y2) !== null;
  }

  protected raycastPoint(x1: number, y1: number, x2: number, y2: number): Vec2 | null {
    const res = this.raycastSurface(x1, y1, x2, y2);
    return res ? { x: res.x, y: res.y } : null;
  }

  protected raycastSurface(
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): { x: number; y: number; kind: 'WALL' | 'DOOR' | 'FURNITURE'; color?: string; ax: number; ay: number; bx: number; by: number } | null {
    let closest: { x: number; y: number; kind: 'WALL' | 'DOOR' | 'FURNITURE'; color?: string; ax: number; ay: number; bx: number; by: number } | null =
      null;
    let minT = 1;

    const checkSeg = (
      ax: number,
      ay: number,
      bx: number,
      by: number,
      kind: 'WALL' | 'DOOR' | 'FURNITURE',
      color?: string
    ) => {
      const denom = (by - ay) * (x2 - x1) - (bx - ax) * (y2 - y1);
      if (denom === 0) return;
      const ua = ((bx - ax) * (y1 - ay) - (by - ay) * (x1 - ax)) / denom;
      const ub = ((x2 - x1) * (y1 - ay) - (y2 - y1) * (x1 - ax)) / denom;
      if (ua >= 0 && ua <= minT && ub >= 0 && ub <= 1) {
        minT = ua;
        closest = {
          x: x1 + ua * (x2 - x1),
          y: y1 + ua * (y2 - y1),
          kind,
          color,
          ax,
          ay,
          bx,
          by,
        };
      }
    };

    for (const w of this.walls) {
      checkSeg(w.x1, w.y1, w.x2, w.y2, 'WALL', '#94A3B8');
    }
    for (const d of this.doors) {
      // También la hoja abierta bloquea balas y línea de visión; el hueco de
      // paso queda libre, pero no se puede disparar ni ver a través del panel.
      const hoja = segmentoHojaPuerta(d);
      if (hoja) checkSeg(hoja.x1, hoja.y1, hoja.x2, hoja.y2, 'DOOR', '#D97706');
    }
    for (const f of this.furniture) {
      if (f.blocksSight && !f.isDestroyed) {
        checkSeg(f.x, f.y, f.x + f.w, f.y, 'FURNITURE', f.color);
        checkSeg(f.x + f.w, f.y, f.x + f.w, f.y + f.h, 'FURNITURE', f.color);
        checkSeg(f.x + f.w, f.y + f.h, f.x, f.y + f.h, 'FURNITURE', f.color);
        checkSeg(f.x, f.y + f.h, f.x, f.y, 'FURNITURE', f.color);
      }
    }
    // Las lámparas no bloquean la visión ni se rompen por un raycast de IA.
    // El impacto real de bala se resuelve en castProjectile con su propio hitbox.
    return closest;
  }

  protected rayCircleIntersect(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    cx: number,
    cy: number,
    r: number
  ): number | null {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len === 0) return null;
    const ux = dx / len;
    const uy = dy / len;
    const fx = x1 - cx;
    const fy = y1 - cy;
    const b = 2 * (fx * ux + fy * uy);
    const c = fx * fx + fy * fy - r * r;
    const disc = b * b - 4 * c;
    if (disc < 0) return null;
    const t = (-b - Math.sqrt(disc)) / 2;
    if (t >= 0 && t <= len) return t;
    return null;
  }

  protected computeContextPrompt(player: ActorEntity | undefined): string | null {
    if (!player) return null;

    const nearbyCharge = this.c4.charges.find(
      (charge) => Math.hypot(charge.x - player.x, charge.y - player.y) <= 170
    );
    if (nearbyCharge) {
      return this.isBlastAreaClear(nearbyCharge)
        ? `C4 armada en ${nearbyCharge.targetName}: zona despejada · [J] reiterar despeje · detona desde la HUD`
        : `C4 armada en ${nearbyCharge.targetName}: [J] despejar zona · aléjate >190 px antes de detonar`;
    }

    for (const actor of this.actors) {
      if (actor.role === 'PLAYER' || actor.role === 'SQUAD') continue;
      if (Math.hypot(actor.x - player.x, actor.y - player.y) <= 54) {
        if (
          actor.role === 'SUSPECT' &&
          (actor.state === 'SURRENDERED' ||
            actor.state === 'INCAPACITATED' ||
            actor.state === 'FEIGNING_SURRENDER')
        ) {
          return `[E] esposar y asegurar a ${actor.name}`;
        }
        if (actor.role === 'SUSPECT' && actor.state === 'ARRESTED') {
          if (!actor.interrogated) {
            return `[I] Interrogar a ${actor.name} (Revelar mapa C4I)`;
          }
        }
        if (
          (actor.role === 'HOSTAGE' || actor.role === 'CIVILIAN') &&
          actor.state !== 'ARRESTED' &&
          actor.state !== 'DEAD'
        ) {
          return `[E] asegurar y evacuar a ${actor.name}`;
        }
      }
    }

    for (const ev of this.evidenceList) {
      if (!ev.secured && Math.hypot(ev.x - player.x, ev.y - player.y) <= 50) {
        return `[E] asegurar arma como evidencia (${ev.label})`;
      }
    }

    const door = this.findNearestDoor(player.x, player.y, 64);
    if (door) {
      if (!door.isOpen) {
        const sensorLabel =
          this.plan.inspectionDevice === 'THERMAL_CAM'
            ? 'Cámara Térmica FLIR'
            : this.plan.inspectionDevice === 'MICRO_CAM'
              ? 'Micro-Cámara Óptica'
              : 'Espejo Táctico';
        return `${door.name}: [Q] ${sensorLabel} · [F] Patada · [C] C4 (${this.c4.count}) · [X] Ariete`;
      }
      return `${door.name}: [E] Cerrar puerta`;
    }

    const extWin = this.findNearestExteriorWindow(player.x, player.y, 68);
    if (extWin && !extWin.isBreached) {
      return `${extWin.label}: [F] Abrir brecha exterior · [X] Ariete · [C] Carga C4 (${this.c4.count})`;
    }

    // Check if there is an unidentified target in agent camera view to prompt [B] Radio ID
    const unidTarget = this.actors.find(
      (a) =>
        a.role !== 'PLAYER' &&
        a.role !== 'SQUAD' &&
        !a.identifiedByRadio &&
        (a.visibleToPlayer || a.visibleToSquad || a.spottedByMirror)
    );
    if (unidTarget) {
      const pts = unidTarget.role === 'SUSPECT' ? '+90' : '+75';
      return `[B] Identificar por cámara en radio: ${unidTarget.name} (${pts} PTS ROE)`;
    }

    return null;
  }

  protected getActiveBiometricHudTarget(player: ActorEntity | undefined): BiometricHudTarget | undefined {
    if (!player) return undefined;

    const visibleOrScanned = this.actors.filter(
      (a) =>
        a.role !== 'PLAYER' &&
        a.role !== 'SQUAD' &&
        (a.visibleToPlayer ||
          a.visibleToSquad ||
          a.spottedByMirror ||
          (a.biometricScanProgress ?? 0) > 0 ||
          a.identifiedByRadio)
    );
    if (visibleOrScanned.length === 0) return undefined;

    visibleOrScanned.sort((a, b) => {
      const aActive = a.visibleToPlayer || a.visibleToSquad || a.spottedByMirror ? 1 : 0;
      const bActive = b.visibleToPlayer || b.visibleToSquad || b.spottedByMirror ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      if (!!a.identifiedByRadio !== !!b.identifiedByRadio) {
        return a.identifiedByRadio ? 1 : -1; // Prefer unidentified targets in active view so player can mark them
      }
      const angA = Math.abs(
        this.normalizeAngle(Math.atan2(a.y - player.y, a.x - player.x) - player.angle)
      );
      const angB = Math.abs(
        this.normalizeAngle(Math.atan2(b.y - player.y, b.x - player.x) - player.angle)
      );
      return angA - angB;
    });

    const t = visibleOrScanned[0];
    const bio = t.biometricProfile;
    return {
      id: t.id,
      name: t.name,
      role: t.role,
      ekisCode: bio?.ekisCode ?? 'EKIS-AT #000',
      warrantStatus: bio?.warrantStatus ?? 'En verificación biométrica',
      threatLevel: bio?.threatLevel ?? (t.role === 'SUSPECT' ? 'ALTO' : 'PROTECCIÓN'),
      facialMatchPct: bio?.facialMatchPct ?? 98.5,
      dossierNote: bio?.dossierNote ?? '',
      scanProgress: Math.round(t.biometricScanProgress ?? 0),
      identifiedByRadio: !!t.identifiedByRadio,
      cameraSource: t.identifiedCameraSource ?? 'KOBRA-1 HELMKAMERA',
      isArmed: t.isArmed,
      weaponLabel: t.weaponLabel,
      state: t.state,
    };
  }

  public emitHudSnapshot() {
    if (this.isEmittingHudSnapshot) return;
    this.isEmittingHudSnapshot = true;
    try {
      const player = this.getPlayer();
    const profileSpec = EKO_COBRA_PROFILES[this.plan.profile];
    const spec = EKO_COBRA_WEAPONS[this.plan.primaryWeapon];
    const inspSpec = EKO_COBRA_INSPECTION_DEVICES[this.plan.inspectionDevice];
    const gadgetSpec = EKO_COBRA_GADGETS[this.plan.gadget];

    const suspects = this.actors.filter((a) => a.role === 'SUSPECT');
    const hostages = this.actors.filter((a) => a.role === 'HOSTAGE' || a.role === 'CIVILIAN');
    const identifiableActors = this.actors.filter(
      (a) => a.role !== 'PLAYER' && a.role !== 'SQUAD'
    );
    const roomObj = this.rooms.find((r) => r.id === player?.roomName);

    const bh: BodyPartHealth = player?.bodyHealth ?? {
      torso: 100,
      arms: 100,
      legs: 100,
      bleeding: false,
      woundsCount: 0,
    };

    const exhaustionSpeedPenalty =
      this.playerFatigue > 80 ? 1 - ((this.playerFatigue - 80) / 20) * 0.16 : 1.0;

    const focusedAimActive = this.isFocusedAiming();
    const moveSpeedPct = computeMoveSpeedPct(
      bh.legs,
      bh.bleeding,
      exhaustionSpeedPenalty,
      this.currentMovementGait,
      focusedAimActive
    );
    const pulseStabilityPct = computePulseStabilityPct(
      this.playerFatigue,
      bh.torso,
      bh.arms,
      bh.bleeding,
      focusedAimActive
    );
    const accuracyPct = computeAccuracyPct(
      bh.arms,
      bh.torso,
      bh.bleeding,
      this.playerFatigue,
      focusedAimActive
    );
    const visionStabilityPct = computeVisionStabilityPct(
      bh.torso,
      bh.arms,
      bh.bleeding,
      this.playerFatigue
    );
    const pulseBpm = computePulseBpm(
      this.playerFatigue,
      bh.torso,
      bh.bleeding,
      this.elapsedSeconds
    );

    const squad = this.getSquadmate();
    const sqBh: BodyPartHealth = squad?.bodyHealth ?? {
      torso: 100,
      arms: 100,
      legs: 100,
      bleeding: false,
      woundsCount: 0,
    };
    const sqFatigueRatio = this.squadFatigue / 100;
    const sqPulseBpm =
      squad && squad.state !== 'DEAD'
        ? Math.round(
            66 +
              sqFatigueRatio * 74 +
              ((100 - sqBh.torso) / 100) * 20 +
              (sqBh.bleeding ? 18 : 0) +
              (squad.alertLevel === 'COMBAT' ? 14 : 0) +
              Math.cos(this.elapsedSeconds * 3.9) * 2
          )
        : 0;
    const sqPulseStabilityPct =
      squad && squad.state !== 'DEAD'
        ? Math.max(
            20,
            Math.round(
              (100 - this.squadFatigue * 0.58 - (100 - sqBh.torso) * 0.22 - (100 - sqBh.arms) * 0.16) *
                (sqBh.bleeding ? 0.82 : 1)
            )
          )
        : 0;
    const sqRoomObj = this.rooms.find((r) => r.id === squad?.roomName);

    // Operator XP & Rank Calculation
    const totalXp = Math.max(0, this.baseCareerXp + this.sessionXp);
    const xpPerLevel = 500;
    const level = Math.floor(totalXp / xpPerLevel) + 1;
    const xpInLevel = totalXp % xpPerLevel;
    const xpProgressPct = Math.min(100, Math.round((xpInLevel / xpPerLevel) * 100));
    const ranks = [
      { de: 'Einsatzbeamter Cobra', es: 'Operador Táctico Nv. 1' },
      { de: 'Revierinspektor DSE', es: 'Inspector de Asalto Nv. 2' },
      { de: 'Gruppeninspektor Cobra', es: 'Jefe de Binomio Nv. 3' },
      { de: 'Abteilungsinspektor', es: 'Especialista CQB Nv. 4' },
      { de: 'Oberkommissär EKO', es: 'Comisario Táctico Nv. 5' },
      { de: 'Einsatzleiter Süd', es: 'Comandante EKO Cobra' },
    ];
    const rankSpec = ranks[Math.min(ranks.length - 1, level - 1)];

    // Tactical Pad C4I Live Map & Telemetry Snapshot
    const coveragePolygon: TacticalPadData['coveragePolygon'] = player
      ? this.computeVisibilityPolygon(
          player.x,
          player.y,
          player.angle,
          (this.flashlightOn ? 560 : 250) *
            this.getWeatherVisibilityMultiplier(player.x, player.y),
          this.flashlightOn ? 0.38 : 1.22,
          72
        )
      : [];

    const tacticalPad = {
      rooms: this.rooms.map((r) => {
        const roomActors = this.actors.filter((a) => a.roomName === r.id);
        const activeHostilesInRoom = roomActors.filter(
          (a) => a.role === 'SUSPECT' && a.state !== 'ARRESTED' && a.state !== 'DEAD'
        );
        const knownHostiles = roomActors.filter(
          (a) =>
            a.role === 'SUSPECT' &&
            a.state !== 'ARRESTED' &&
            a.state !== 'DEAD' &&
            (a.visibleToPlayer || a.visibleToSquad || a.spottedByMirror || a.identifiedByRadio)
        ).length;
        const knownHostages = roomActors.filter(
          (a) =>
            (a.role === 'HOSTAGE' || a.role === 'CIVILIAN') &&
            a.state !== 'ARRESTED' &&
            a.state !== 'DEAD' &&
            (a.visibleToPlayer || a.visibleToSquad || a.spottedByMirror || a.identifiedByRadio)
        ).length;
        const hasPlayer = player?.roomName === r.id;
        const hasSquad = squad?.roomName === r.id;
        return {
          id: r.id,
          nameDe: r.nameDe,
          nameEs: r.nameEs,
          x: r.x,
          y: r.y,
          w: r.w,
          h: r.h,
          cleared: (hasPlayer || hasSquad) && activeHostilesInRoom.length === 0,
          hasPlayer,
          hasSquad,
          knownHostiles,
          knownHostages,
        };
      }),
      doors: this.doors.map((d) => ({
        id: d.id,
        name: d.name,
        x1: d.x1,
        y1: d.y1,
        x2: d.x2,
        y2: d.y2,
        isOpen: d.isOpen,
        isLocked: d.isLocked,
        isBreached: d.isBreached,
        isDestroyed: !!d.isDestroyed,
      })),
      exteriorWindows: this.exteriorWindows.map((w) => ({
        id: w.id,
        label: w.label,
        x1: w.x1,
        y1: w.y1,
        x2: w.x2,
        y2: w.y2,
        isBreached: w.isBreached,
      })),
      contacts: this.actors
        .filter(
          (a) =>
            a.role === 'PLAYER' ||
            a.role === 'SQUAD' ||
            a.visibleToPlayer ||
            a.visibleToSquad ||
            a.spottedByMirror ||
            a.identifiedByRadio ||
            a.state === 'ARRESTED' ||
            a.state === 'DEAD'
        )
        .map((a) => ({
          id: a.id,
          name: a.name,
          role: a.role,
          x: Math.round(a.x),
          y: Math.round(a.y),
          angle: a.angle,
          state: a.state,
          roomName: a.roomName,
          isKnown: true,
          identifiedByRadio: !!a.identifiedByRadio,
          directlyVisible: !!(a.visibleToPlayer || a.visibleToSquad),
          isArmed: a.isArmed,
          threatPolygon:
            a.role === 'SUSPECT' &&
            a.isArmed &&
            (a.visibleToPlayer || a.visibleToSquad) &&
            a.state !== 'DEAD' &&
            a.state !== 'ARRESTED' &&
            a.state !== 'SURRENDERED'
              ? this.computeVisibilityPolygon(a.x, a.y, a.angle, getWeaponThreatRange(a.weaponLabel), 0.35, 24)
              : undefined,
          weaponLabel: a.weaponLabel,
          ekisCode: a.biometricProfile?.ekisCode,
          warrantStatus: a.biometricProfile?.warrantStatus,
        })),
      evidence: this.evidenceList.map((e) => ({
        id: e.id,
        label: e.label,
        x: Math.round(e.x),
        y: Math.round(e.y),
        secured: e.secured,
      })),
      waypoint: this.tacticalWaypoint,
      markers: this.tacticalMarkers.map((m) => ({
        ...m,
        remainingSeconds: Math.max(0, Math.round(m.remainingSeconds)),
      })),
      coveragePolygon,
    };

    const playerMissionRank = computePlayerMissionRank(this.score);
    if (this.lastRankTitle && this.lastRankTitle !== playerMissionRank.titleDe) {
      const prevStars = this.lastRankStars ?? 1;
      this.lastRankTitle = playerMissionRank.titleDe;
      this.lastRankStars = playerMissionRank.stars;

      const isDemotion = playerMissionRank.isDemoted || playerMissionRank.stars < prevStars;
      soundEngine.playBiometricLock(false);
      this.pushRadio(
        'LEITSTELLE',
        isDemotion
          ? `[!] RECLASIFICACIÓN DISCIPLINARIA: Rango reducido a ${playerMissionRank.titleDe} (${playerMissionRank.titleEs}). Puntuación: ${this.score} PTS.`
          : `🎖 ASCENSO POR DESEMPEÑO: ¡Promovido a ${playerMissionRank.titleDe} (${playerMissionRank.titleEs})! Puntuación: ${this.score} PTS.`,
        isDemotion ? 'warn' : 'ok'
      );
      if (player) {
        this.impactPopups.push({
          x: player.x,
          y: player.y - 28,
          vy: -24,
          text: isDemotion ? `⚠ ${playerMissionRank.titleDe.toUpperCase()}` : `🎖 ${playerMissionRank.titleDe.toUpperCase()}`,
          color: playerMissionRank.color,
          life: 2.2,
          maxLife: 2.2,
        });
      }
    } else {
      this.lastRankTitle = playerMissionRank.titleDe;
      this.lastRankStars = playerMissionRank.stars;
    }

    this.onHudUpdate({
      activeC4Charges: this.c4.charges.map((c) => ({
        ...c,
        remainingSeconds: Math.max(0, c.remainingSeconds),
        safeToDetonate: this.isBlastAreaClear(c),
      })),
      c4Planting: this.c4.planting
        ? {
            targetName: this.c4.planting.targetName,
            progressPct: Math.min(100, (this.c4.planting.progress / this.c4.planting.maxProgress) * 100),
            executionTime: `${Math.max(0, this.c4.planting.maxProgress - this.c4.planting.progress).toFixed(1)}s`,
          }
        : undefined,
      profileName: profileSpec.nameDe,
      health: player ? player.hp : 0,
      armor: this.armor,
      bodyHealth: { ...bh },
      ifakCount: this.ifakCount,
      aimZoneMode: this.aimZoneMode,
      moveSpeedPct,
      accuracyPct,
      visionStabilityPct,
      fatigue: Math.round(this.playerFatigue),
      pulseBpm,
      pulseStabilityPct,
      movementGait: this.currentMovementGait,
      sprintMode:
        !focusedAimActive &&
        (this.sprintModeToggled ||
          this.heldKeys.has('ShiftLeft') ||
          this.heldKeys.has('ShiftRight')),
      focusedAimActive,
      inCover: player ? !!player.inCover : false,
      squadVitals: {
        name: squad?.name ?? 'Kobra-2 (Rottenführer)',
        callsign: 'KOBRA-2',
        health: squad ? squad.hp : 0,
        maxHealth: squad ? squad.maxHp : 100,
        armor: this.squadArmor,
        fatigue: Math.round(this.squadFatigue),
        pulseBpm: sqPulseBpm,
        pulseStabilityPct: sqPulseStabilityPct,
        movementGait: this.squadMovementGait,
        bodyHealth: { ...sqBh },
        roomName: sqRoomObj ? sqRoomObj.nameDe : 'EXTERIOR',
        alertLevel: squad?.alertLevel ?? 'READY',
        state: squad?.state ?? 'UNAWARE',
      },
      xpTelemetry: {
        totalXp,
        sessionXp: this.sessionXp,
        level,
        rankDe: rankSpec.de,
        rankEs: rankSpec.es,
        xpInLevel,
        xpForNextLevel: xpPerLevel,
        progressPct: xpProgressPct,
      },
      tacticalPad,
      activeTool: this.activeTool,
      grenadeAimingActive: this.grenadeAimingActive,
      primaryName: spec.name,
      attachmentName: EKO_COBRA_ATTACHMENTS[this.plan.attachment ?? 'NONE'].nameEs,
      attachmentId: this.plan.attachment ?? 'NONE',
      ammoTypeName: EKO_COBRA_AMMO[this.plan.ammoType ?? 'FMJ_STANDARD'].nameEs,
      ammoTypeId: this.plan.ammoType ?? 'FMJ_STANDARD',
      ammoInMag: this.ammoInMag,
      magCount: this.magCount,
      taserCharges: this.taserCharges,
      inspectionName: inspSpec.nameEs,
      inspectionId: this.plan.inspectionDevice,
      gadgetName: gadgetSpec.nameDe,
      gadgetCount: this.gadgetCount,
      c4Count: this.c4.count,
      squadStatus: `KOBRA-2 · ${player?.alertLevel ?? 'READY'}`,
      squadCommand: this.squadCommand,
      suspectsSecured: suspects.filter((s) => s.state === 'ARRESTED' || s.state === 'DEAD').length,
      suspectsTotal: suspects.length,
      hostagesSecured: hostages.filter((h) => h.state === 'ARRESTED').length,
      hostagesTotal: hostages.length,
      evidenceSecured: this.evidenceList.filter((e) => e.secured).length,
      evidenceTotal: Math.max(3, this.evidenceList.length),
      identifiedCount: identifiableActors.filter((a) => a.identifiedByRadio).length,
      identifiableTotal: identifiableActors.length,
      activeBiometricTarget: this.getActiveBiometricHudTarget(player),
      score: this.score,
      playerMissionRank,
      roeViolations: this.roeViolations,
      elapsedSeconds: Math.floor(this.elapsedSeconds),
      contextPrompt: this.computeContextPrompt(player),
      mirrorActive: this.mirrorDoorId !== null || this.thermalActive,
      thermalPaletteMode: this.thermalPaletteMode,
      flashlightOn: this.flashlightOn,
      nvgActive: this.nvgActive,
      nvgKeyCode: this.nvgKeyCode,
      playerStance: this.playerStance,
      playerHiddenInShadow: this.playerHiddenInShadow,
      darknessTimerPct: Math.min(100, Math.round((this.playerDarknessTimer / 3.0) * 100)),
      breachAction: this.breachAction
        ? {
            mode: this.breachAction.mode,
            name: this.breachAction.name,
            progressPct: Math.min(
              100,
              Math.round((this.breachAction.progress / this.breachAction.maxProgress) * 100)
            ),
            executionTime: `${this.breachAction.maxProgress.toFixed(2)}s`,
            noiseLevel: this.breachAction.noiseLevel,
            stunRisk: this.breachAction.stunRisk,
          }
        : undefined,
      reloadProgress: {
        isReloading: this.reloadTimer > 0,
        progressPct: Math.round(
          (1 - Math.max(0, this.reloadTimer) / Math.max(0.1, this.reloadMaxDuration)) * 100
        ),
        durationSec: this.reloadMaxDuration,
      },
      dangerState: {
        active: this.playerHitFlashTimer > 0 || (player ? player.hp < 40 : false) || (player?.bodyHealth?.bleeding ?? false) || this.suppressionTimer > 0,
        reason: this.playerHitFlashTimer > 0
          ? '¡IMPACTO BALÍSTICO RECIBIDO!'
          : (player?.bodyHealth?.bleeding ?? false)
            ? 'HEMORRAGIA CRÍTICA ACTIVA'
            : (player ? player.hp < 40 : false)
              ? 'SALUD CRÍTICA (<40%)'
              : 'BAJO FUEGO DE SUPRESIÓN',
        severity: this.playerHitFlashTimer > 0 || (player ? player.hp < 40 : false) ? 'CRITICAL' : 'WARN',
        flashTimerPct: this.playerHitFlashTimer > 0
          ? Math.round((this.playerHitFlashTimer / 0.42) * 100)
          : 0,
      },
      currentRoom: roomObj ? `${roomObj.nameDe} · ${roomObj.nameEs}` : 'EXTERIOR · GRAZ-LEND',
      playerHeadingDeg: (() => {
        let hdg = player ? Math.round((player.angle * 180) / Math.PI + 90) % 360 : 0;
        if (hdg < 0) hdg += 360;
        return hdg;
      })(),
      radioTransmitting: this.radio.txTimer > 0,
      radioStaticActive: this.radio.staticTimer > 0,
      radioFeed: this.radio.items,
      roeEvents: this.radio.items ? this.roeEvents : [],
      criticalEvents: this.criticalEvents,
      secondaryObjectives: this.secondaryObjectives,
      isTrainingMode: this.isTrainingMode,
      trainingTelemetry: this.isTrainingMode
        ? {
            shotsFired: this.trainingShotsFired,
            targetsHit: this.trainingTargetsHit,
            accuracyPct:
              this.trainingShotsFired > 0
                ? Math.min(100, Math.round((this.trainingTargetsHit / this.trainingShotsFired) * 100))
                : 0,
            currentCaliber: spec.caliber,
            currentRpm: spec.rpm,
            currentDamage: spec.damage,
            currentSpread: spec.spread,
            currentShake: +this.shakeIntensity.toFixed(1),
            peakRecordedShake: this.peakRecordedShake,
            lastHitEnergyJoules: this.lastTrainingEnergy,
            lastHitZone: this.lastTrainingHitZone,
            lastTargetType: this.lastTrainingTargetName,
          }
        : undefined,
      missionMode: this.missionMode,
      stealthDetection: {
        visibilityPct: this.currentVisibilityPct,
        visibilityState:
          this.currentVisibilityPct <= 25
            ? 'HIDDEN'
            : this.currentVisibilityPct <= 55
              ? 'CONCEALED'
              : this.currentVisibilityPct <= 80
                ? 'EXPOSED'
                : 'DETECTED',
        noiseDb: Math.round(this.currentNoiseDb),
        noiseState:
          this.currentNoiseDb < 30
            ? 'SILENT'
            : this.currentNoiseDb < 55
              ? 'WHISPER'
              : this.currentNoiseDb < 80
                ? 'AUDIBLE'
                : this.currentNoiseDb < 110
                  ? 'LOUD'
                  : 'CRITICAL',
        stationAlertScore: Math.round(this.stationAlertScore),
        stationAlertLevel: this.getStationAlertLevel(),
        stationAlertTitle:
          this.getStationAlertLevel() === 'LOCKDOWN'
            ? 'NIVEL 4 · ALARMA TOTAL & CIERRE'
            : this.getStationAlertLevel() === 'ALERTED'
              ? 'NIVEL 3 · ALERTA TÁCTICA'
              : this.getStationAlertLevel() === 'SUSPICIOUS'
                ? 'NIVEL 2 · SOSPECHA / RUIDO'
                : 'NIVEL 1 · CALMA RUTINARIA',
        nearestPatrolDistance: Math.round(
          this.actors
            .filter((a) => a.role === 'SUSPECT' && a.state !== 'DEAD' && a.state !== 'ARRESTED')
            .reduce((minDist, a) => {
              const d = player ? Math.hypot(a.x - player.x, a.y - player.y) : 999;
              return Math.min(minDist, d);
            }, 999)
        ),
        activeSuspiciousCount: this.actors.filter(
          (a) => a.role === 'SUSPECT' && (a.state === 'ALERTED' || (a.suspicionMeter ?? 0) > 30)
        ).length,
        recentNoiseReason: this.recentNoiseReason,
      },
      missionResult: this.missionOutcome,
    });
    } finally {
      this.isEmittingHudSnapshot = false;
    }
  }

  /** Idempotent teardown: freezes the simulation and releases the audio graph. */
  /** Aplica una transición sin notificar a la UI (para arranques de misión). */
  protected aplicarEstado(evento: GameEvent): GameState {
    this.gameState = aplicarEvento(this.gameState, evento);
    return this.gameState;
  }

  /** Aplica una transición y notifica a la UI; un evento inválido no cambia nada. */
  public cambiarEstado(evento: GameEvent): GameState {
    const siguiente = this.aplicarEstado(evento);
    this.onStateChange(siguiente);
    return siguiente;
  }

  public destroy() {
    this.aplicarEstado('RETURN_TO_TITLE');
    this.heldKeys.clear();
    this.isEmittingHudSnapshot = false;
    soundEngine.destroy();
  }

  /**
   * Reanuda una partida guardada tras reiniciar el escenario: recupera marcador, tiempo
   * y tick para que el HUD continúe donde se dejó en vez de empezar de cero.
   */
  public restoreProgress(progress: { score?: number; elapsedSeconds?: number; tick?: number }) {
    if (typeof progress.score === 'number' && Number.isFinite(progress.score)) {
      this.score = Math.max(0, progress.score);
    }
    if (typeof progress.elapsedSeconds === 'number' && Number.isFinite(progress.elapsedSeconds)) {
      this.elapsedSeconds = Math.max(0, progress.elapsedSeconds);
    }
    if (typeof progress.tick === 'number' && Number.isFinite(progress.tick)) {
      this.ticks = Math.max(0, Math.floor(progress.tick));
    }
    this.emitHudSnapshot();
  }

  /**
   * Instantánea congelada para E2E. No la usa la lógica del juego: permite afirmar
   * estado real (estado de partida, jugador, tick y mundo) sin leer píxeles del canvas.
   */
  public snapshotE2E(): EkoE2EState {
    const player = this.getPlayer();
    const squad = this.getSquadmate();
    const walls: EkoE2EWall[] = this.walls.map((wall) =>
      Object.freeze({
        id: wall.id,
        x1: wall.x1,
        y1: wall.y1,
        x2: wall.x2,
        y2: wall.y2,
        isWindow: wall.isWindow ?? false,
      })
    );
    const doors: EkoE2EDoor[] = this.doors.map((door) =>
      Object.freeze({
        id: door.id,
        name: door.name,
        x1: door.x1,
        y1: door.y1,
        x2: door.x2,
        y2: door.y2,
        isOpen: door.isOpen,
        isLocked: door.isLocked,
        isBreached: door.isBreached,
        isDestroyed: door.isDestroyed ?? false,
        mirrored: door.mirrored,
      })
    );
    const furniture: EkoE2EFurniture[] = this.furniture.map((item) =>
      Object.freeze({
        id: item.id,
        label: item.label,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        blocksMovement: item.blocksMovement,
        blocksSight: item.blocksSight,
        isDestroyed: item.isDestroyed ?? false,
      })
    );

    return Object.freeze({
      gameState: this.gameState,
      player: player
        ? Object.freeze({
            x: player.x,
            y: player.y,
            angle: player.angle,
            speechBubble: player.speechBubble
              ? Object.freeze({
                  text: player.speechBubble.text,
                  timer: player.speechBubble.timer,
                  type: player.speechBubble.type,
                })
              : null,
          })
        : null,
      squad: squad
        ? Object.freeze({
            x: squad.x,
            y: squad.y,
            radius: squad.radius,
            command: this.squadCommand,
            target: squad.investigateTarget
              ? Object.freeze({ x: squad.investigateTarget.x, y: squad.investigateTarget.y })
              : null,
            doorTargetId: this.squadDoorTargetId ?? null,
            breachMode: this.squadBreachAction?.mode ?? null,
            breachProgress: this.squadBreachAction?.progress ?? null,
            breachMaxProgress: this.squadBreachAction?.maxProgress ?? null,
            speechBubble: squad.speechBubble
              ? Object.freeze({
                  text: squad.speechBubble.text,
                  timer: squad.speechBubble.timer,
                  type: squad.speechBubble.type,
                })
              : null,
          })
        : null,
      tick: this.ticks,
      c4Count: this.c4.count,
      squadGear: this.plan.squadGear,
      radioFeed: Object.freeze(
        this.radio.items.map((item) =>
          Object.freeze({ speaker: item.speaker, text: item.text })
        )
      ),
      world: Object.freeze({
        mission: this.missionMode,
        walls: Object.freeze(walls),
        doors: Object.freeze(doors),
        furniture: Object.freeze(furniture),
      }),
    });
  }

  /** Instantánea serializable del jugador, el mundo y las puertas. */
  public capturarSimulacion(): SnapshotSimulacion | null {
    const player = this.getPlayer();
    if (!player) return null;
    return {
      jugador: { x: player.x, y: player.y, angulo: player.angle },
      tick: this.ticks,
      tiempo: this.elapsedSeconds,
      mundo: {
        paredes: this.walls.map((pared) => ({ ...pared })),
        puertas: this.doors.map((puerta) => ({ ...puerta })),
        muebles: this.furniture.map((mueble) => ({ ...mueble })),
      },
    };
  }

  /** Inventario, cargas armadas y plantado en curso para el guardado. */
  public capturarC4(): C4SaveState {
    return this.c4.snapshot();
  }

  /**
   * Devuelve el C4 guardado al subsistema. Se llama después de reconstruir el
   * escenario: el inventario y las cargas no viven en la simulación.
   */
  public restaurarC4(saved: C4SaveState | undefined) {
    this.c4.restore(saved);
    this.emitHudSnapshot();
  }

  /** Reanuda la simulación guardada sin reconstruir el escenario. */
  public restaurarSimulacion(snapshot: SnapshotSimulacion) {
    const player = this.getPlayer();
    if (!player) return;
    player.x = snapshot.jugador.x;
    player.y = snapshot.jugador.y;
    player.angle = snapshot.jugador.angulo;
    this.walls = snapshot.mundo.paredes.map((pared) => ({ ...pared }));
    this.doors = snapshot.mundo.puertas.map((puerta) => ({ ...puerta }));
    this.furniture = snapshot.mundo.muebles.map((mueble) => ({ ...mueble }));
    this.ticks = Math.max(0, Math.floor(snapshot.tick));
    this.elapsedSeconds = Math.max(0, snapshot.tiempo);
    this.camX = player.x;
    this.camY = player.y;
    this.simulacion = crearPartidaDesdeMundo(
      this.missionMode,
      { paredes: this.walls, puertas: this.doors, muebles: this.furniture },
      { x: player.x, y: player.y }
    );
    this.simulacion.jugador.radio = player.radius;
    this.simulacion.jugador.orientacion = player.angle;
    this.emitHudSnapshot();
  }

  public screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const { x: cx, y: cy, zoom } = this.framing;
    return { x: (clientX - cx) / zoom + this.camX, y: (clientY - cy) / zoom + this.camY };
  }

  public worldToScreen(wx: number, wy: number): { x: number; y: number } {
    const { x: cx, y: cy, zoom } = this.framing;
    return { x: (wx - this.camX) * zoom + cx, y: (wy - this.camY) * zoom + cy };
  }

  public getInteractiveTargetAt(
    worldX: number,
    worldY: number
  ): { type: 'DOOR' | 'WINDOW' | 'POINT'; id?: string; name: string; x: number; y: number } {
    for (const d of this.doors) {
      const midX = (d.x1 + d.x2) * 0.5;
      const midY = (d.y1 + d.y2) * 0.5;
      const dist = Math.hypot(midX - worldX, midY - worldY);
      if (dist <= 42) {
        return { type: 'DOOR', id: d.id, name: d.name, x: midX, y: midY };
      }
    }
    for (const w of this.walls) {
      if (w.isWindow || w.id?.includes('WINDOW') || w.id?.includes('FENSTER')) {
        const midX = (w.x1 + w.x2) / 2;
        const midY = (w.y1 + w.y2) / 2;
        if (Math.hypot(midX - worldX, midY - worldY) <= 42) {
          return { type: 'WINDOW', id: w.id, name: 'Ventana Exterior', x: midX, y: midY };
        }
      }
    }
    return { type: 'POINT', name: 'Sector Táctico', x: worldX, y: worldY };
  }

  public issueSquadCommandTargeted(cmd: SquadCommand, target?: SquadCommandTarget) {
    // No fijar el destino antes de emitir la orden: issueSquadCommand limpia
    // los destinos anteriores y, si la orden es de brecha, calcula la pila.
    this.issueSquadCommand(cmd, target);
  }

  /** Sizes the backing store for CSS dimensions at the given pixel ratio. */
  public resize(cssWidth: number, cssHeight: number, pixelRatio: number) {
    const ratio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
    this.renderScale = ratio;
    this.canvas.width = Math.max(1, Math.round(cssWidth * ratio));
    this.canvas.height = Math.max(1, Math.round(cssHeight * ratio));
    this.l.width = cssWidth * 0.4;
    this.l.height = cssHeight * 0.4;
  }

  /** Canvas size in CSS pixels: the space all drawing and hit testing uses. */
  protected get viewWidth(): number {
    return this.canvas.width / this.renderScale;
  }

  protected get viewHeight(): number {
    return this.canvas.height / this.renderScale;
  }

  /**
   * Encuadre vigente: dónde cae la cámara en píxeles CSS y cuántos píxeles de
   * pantalla mide una unidad de mundo. `screenToWorld` y `worldToScreen` leen
   * sólo de aquí, así que un canal que presente otro buffer (otra escala, con
   * letterbox) puede sobrescribir este getter y el ratón sigue apuntando al
   * mismo punto del mundo sin tocar los handlers.
   */
  protected get framing(): { x: number; y: number; zoom: number } {
    return { x: this.viewWidth * 0.5, y: this.viewHeight * 0.5, zoom: CAMERA_ZOOM };
  }

  public setHudOpacity(opacityRatio: number) {
    this.hudOpacity = Math.max(0.15, Math.min(1, opacityRatio));
  }

  public setLowQualityMode(enabled: boolean) {
    this.lowQualityMode = enabled;
  }

  /**
   * Applies a Gen-3 P43 Monochromatic Green Phosphor Night Vision (GPNVG-18) post-processing
   * filter over the canvas, boosting luminance & contrast in dark areas with scanlines and tube vignette.
   */



  /**
   * Renders the Diegetic Smart Reticle (Retícula Inteligente & Estado Diegético)
   * Floats directly beside the mouse screen pointer, reducing ocular travel:
   * - High-precision military reticle with dynamic spread gap (motion, recoil, stance, arm wounds)
   * - Floating Diegetic Ammunition readout (live bullets in mag / reserve mags, low ammo alert, reload arc)
   * - Floating Diegetic Targeting Mode (TORSO vs EXTREMITIES §7 WVG, hotkey [V] feedback)
   * - Hover target friend-or-foe identification (Armed Suspect vs Hostage/Civilian vs Squadmate)
   */
}
