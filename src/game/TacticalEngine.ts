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
  WORLD_WIDTH,
} from './grazMap';
import {
  createStationActors,
  createStationLayout,
} from './stationMap';
import {
  createLinzActors,
  createLinzLayout,
} from './linzMap';
import {
  createTirolActors,
  createTirolLayout,
} from './tirolMap';
import {
  createViennaAirportActors,
  createViennaAirportLayout,
} from './viennaAirportMap';
import {
  battlemapAssetCache,
  renderBattlemapFurnitureItem,
  renderExteriorStreetsAndStairwell,
  URBAN_STREET_LAMPS,
} from './battlemapAssets';
import { fillAsphaltSurface } from './asphaltTexture';
import { applyZoneWound, selectHitZone, trainingScoreForZone } from './ballistics';
import { drawPixelArtActor, drawPixelArtSonarActor } from './pixelSprites';
import { classifyLethalShot, computeRoeImpact, isLawfulThreat, LETHAL_SHOT_POINTS } from './roe';
import { soundEngine } from './soundEngine';
import { computeSquadNavTarget } from './squadAi';
import { canSurrender, resolveBreachReaction } from './suspectAi';
import { colisiona, deslizarConColision, distanciaASegmento, PASO_MAXIMO } from './simulation';
import {
  computeMoveSpeedPct,
  computePulseStabilityPct,
  computeAccuracyPct,
  computeVisionStabilityPct,
  computePulseBpm,
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
  StealthDetectionTelemetry,
  TacticalMapMarker,
  TacticalMarkerType,
  Vec2,
  WallSconceLight,
  WallSegment,
  computePlayerMissionRank,
} from './types';

interface BulletTrace {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  alpha: number;
  isTaser: boolean;
}

interface Particle {
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

interface FloorDecal {
  x: number;
  y: number;
  radius: number;
  color: string;
  alpha: number;
  type: 'BLOOD_SPLATTER' | 'BLOOD_POOL' | 'DEBRIS' | 'SCORCH' | 'CASING';
  angle: number;
  aspect: number;
}

interface EnvironmentImpactMark {
  x: number;
  y: number;
  bulletAngle: number;
  surfaceKind: 'WALL' | 'DOOR' | 'FURNITURE';
  surfaceColor?: string;
  craterRadius: number;
  emberTimer: number;
  cracks: { angle: number; len: number }[];
}

interface ImpactShockRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
}

interface ImpactPopup {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

interface ShoutWave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

interface RefractionShockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  strength: number;
}

interface SnowFootprint {
  x: number;
  y: number;
  angle: number;
  alpha: number;
  life: number;
}

interface ThrownGadget {
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

interface DroppedEvidence {
  id: string;
  label: string;
  x: number;
  y: number;
  secured: boolean;
}

interface RainDrop {
  x: number;
  y: number;
  len: number;
  speed: number;
}

interface DynamicPointLight {
  x: number;
  y: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

interface AcousticEdgeIndicator {
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

interface AmbientDustMote {
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

interface WindowRainParticle {
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

interface ExteriorWindowSection {
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

interface BreachWindSource {
  id: string;
  x: number;
  y: number;
  normalAngle: number;
  intensity: number;
  label: string;
}

const AUSTRIAN_SHOUTS = [
  'POLIZEI! EKO COBRA! WAFFEN FALLEN LASSEN!',
  'HÄNDE HOCH! KEINE BEWEGUNG!',
  'WAFFE WEG! SOFORT AUF DEN BODEN!',
  'POLIZEI! ERGEBEN SIE SICH!',
];

/** World-to-screen zoom shared by rendering, aiming and hit testing. */
const CAMERA_ZOOM = 1.55;

export class TacticalEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  /** Backing-store scale (devicePixelRatio); all drawing happens in CSS pixels. */
  private renderScale: number = 1;
  private lightCanvas: HTMLCanvasElement;
  private lightCtx: CanvasRenderingContext2D;
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private onStateChange: (newState: GameState) => void;

  public gameState: GameState = 'TITLE';
  /** Pasos de simulación dados; el informe de fallo lo enseña como «tick». */
  public ticks: number = 0;
  public plan: MissionPlan;

  private rooms: RoomZone[] = [];
  private walls: WallSegment[] = [];
  private doors: DoorEntity[] = [];
  private furniture: FurnitureItem[] = [];
  private wallSconces: WallSconceLight[] = [];
  private actors: ActorEntity[] = [];
  private traces: BulletTrace[] = [];
  private particles: Particle[] = [];
  private decals: FloorDecal[] = [];
  private surfaceImpacts: EnvironmentImpactMark[] = [];
  private impactRings: ImpactShockRing[] = [];
  private refractionRings: RefractionShockwave[] = [];
  private snowFootprints: SnowFootprint[] = [];
  private camInertiaX: number = 0;
  private camInertiaY: number = 0;
  public thermalPaletteMode: 'WHITE_HOT' | 'BLACK_HOT' | 'IRONBOW' = 'WHITE_HOT';
  private impactPopups: ImpactPopup[] = [];
  private shoutWaves: ShoutWave[] = [];
  public grenadeAimingActive: boolean = false;
  private gadgets: ThrownGadget[] = [];
  private evidenceList: DroppedEvidence[] = [];
  private rainDrops: RainDrop[] = [];
  private ambientDustMotes: AmbientDustMote[] = [];
  private windowRainParticles: WindowRainParticle[] = [];
  private exteriorWindows: ExteriorWindowSection[] = [];
  private breachWindSources: BreachWindSource[] = [];
  private exteriorBreachSurgeTimer: number = 0;
  private exteriorBreachMaxDuration: number = 14.0;
  private radioTxTimer: number = 0;
  private radioStaticTimer: number = 0;
  private lastRadioAudioStamp: number = 0;
  private pointLights: DynamicPointLight[] = [];
  private acousticIndicators: AcousticEdgeIndicator[] = [];
  private playerDarknessTimer: number = 0;
  private lastPlayerShotTime: number = -999;
  private playerHiddenInShadow: boolean = false;
  private breachAction?: {
    doorId: string;
    mode: 'KICK' | 'RAM' | 'C4';
    progress: number;
    maxProgress: number;
    name: string;
    noiseLevel: string;
    stunRisk: string;
  };

  // Input state
  private heldKeys: Set<string> = new Set();
  private mouseScreen: Vec2 = { x: 640, y: 410 };
  private mouseWorld: Vec2 = { x: 640, y: 410 };

  // Camera & Juice
  private camX: number = 580;
  private camY: number = 410;
  private camPanOffsetX: number = 0;
  private camPanOffsetY: number = 0;
  private shakeIntensity: number = 0;
  private hitstopTimer: number = 0;
  private flashScreenAlpha: number = 0;
  private playerHitFlashTimer: number = 0;
  private playerHitSourceAngle: number = 0;
  private titlePanTime: number = 0;
  private hudOpacity: number = 0.9;
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

  public setTouchMoveVector(x: number, y: number) {
    this.touchMoveX = x;
    this.touchMoveY = y;
  }

  // Mission Operation Mode: APARTMENT (Graz Lend), STATION (Hauptbahnhof), TRAINING (Schießstand)
  public missionMode: 'APARTMENT' | 'STATION' | 'LINZ' | 'TIROL' | 'SCHWECHAT' | 'TRAINING' = 'APARTMENT';
  public isTrainingMode: boolean = false;
  private trainingShotsFired: number = 0;
  private trainingTargetsHit: number = 0;
  private peakRecordedShake: number = 0;
  private lastTrainingHitZone?: string;
  private lastTrainingTargetName?: string;
  private lastTrainingEnergy?: number;
  private trainingDoorResetTimer: number = 0;

  // Noise & Detection System (Stealth, Decibels, Station Alert & Suspect Patrol Reactions)
  private noiseEvents: NoiseEvent[] = [];
  private currentNoiseDb: number = 22; // Base ambient noise level (20-25 dB)
  private currentVisibilityPct: number = 20; // Player visibility percentage
  private stationAlertScore: number = 0; // 0..100 (Calm -> Suspicious -> Alerted -> Lockdown)
  private recentNoiseReason: string = 'Ambiente Normal';
  private lastAlarmSirenTime: number = -999;
  private lastFootstepEmitTime: number = 0;

  // Player tactical inventory, localized trauma & lighting
  private activeTool: 'PRIMARY' | 'TASER' | 'GADGET' = 'PRIMARY';
  private ammoInMag: number = 25;
  private magCount: number = 4;
  private taserCharges: number = 3;
  private gadgetCount: number = 3;
  private ifakCount: number = 2;
  private c4Count: number = 2;
  public activeC4Charges: ActiveC4Charge[] = [];
  private c4WarningBeepTimer: number = 0;
  private aimZoneMode: 'TORSO' | 'EXTREMITIES' = 'TORSO';
  private modeSwitchPulseTimer: number = 0;
  private aimTremorOffset: number = 0;
  private playerFatigue: number = 0; // 0..100
  private sprintModeToggled: boolean = false;
  public playerStance: 'PARADO' | 'AGACHADO' = 'PARADO';
  private currentMovementGait: 'RESTING' | 'WALKING' | 'SPRINTING' = 'RESTING';
  private lastFatigueWarningTime: number = -999;
  private bleedTickTimer: number = 0;
  private footstepTimer: number = 0;
  private breathingTimer: number = 0;
  private suppressionTimer: number = 0;
  private fireCooldown: number = 0;
  private armor: number = 100;
  private squadArmor: number = 100;
  private squadFatigue: number = 0;
  private squadMovementGait: 'RESTING' | 'WALKING' | 'SPRINTING' = 'RESTING';
  private squadScanningTimer: number = 0;
  private squadHoldAnchorAngle: number = 0;
  private squadLastWoundReportTimer: number = 0;
  private minimapCenter: Vec2 = { x: 74, y: 74 };
  private isDraggingMinimap: boolean = false;
  private minimapDragOffset: Vec2 = { x: 0, y: 0 };
  private baseCareerXp: number = 420;
  private sessionXp: number = 0;
  private lastRankTitle?: string;
  private lastRankStars?: number;
  private isEmittingHudSnapshot: boolean = false;
  private tacticalWaypoint?: { x: number; y: number; label: string };
  private tacticalMarkers: TacticalMapMarker[] = [];
  private mirrorDoorId: string | null = null;
  private thermalActive: boolean = false;
  public flashlightOn: boolean = true;
  public nvgActive: boolean = false;
  public nvgKeyCode: string = 'KeyN';
public keybinds: Record<string, string> = {
  moveForward: 'KeyW',
  moveBackward: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  policeShout: 'Space',
  interact: 'KeyE',
  breachKick: 'KeyF',
  breachC4: 'KeyC',
  breachRam: 'KeyX',
  inspect: 'KeyQ',
  gadget: 'KeyG',
  toolTaser: 'KeyT',
  flashlight: 'KeyL',
  ifak: 'KeyH',
  aimZone: 'KeyV',
  stance: 'KeyZ',
  thermalPalette: 'KeyK',
  biometric: 'KeyB',
  interrogate: 'KeyI',
  reload: 'KeyR',
  squad1: 'Digit1',
  squad2: 'Digit2',
  squad3: 'Digit3',
  squad4: 'Digit4',
  squad5: 'Digit5',
  squad6: 'Digit6',
  squad7: 'Digit7',
  squad8: 'Digit8',
};
  private nvgWarmupTimer: number = 0;
  private commandPulseTimer: number = 0;

  // Mission metrics & ROE
  private squadCommand: SquadCommand = 'FOLLOW';
  private score: number = 0;
  private roeViolations: number = 0;
  private elapsedSeconds: number = 0;
  private hudSyncTimer: number = 0;
  private roeEvents: ROEEvent[] = [];
  private criticalEvents: CriticalEventLogEntry[] = [];
  private radioFeed: HudSnapshot['radioFeed'] = [];
  private missionOutcome: HudSnapshot['missionResult'] | undefined = undefined;
  private secondaryObjectives: SecondaryObjective[] = [];

  // Reload state
  private reloadTimer: number = 0;
  private readonly reloadMaxDuration: number = 1.8;
  private squadReloadTimer: number = 0;

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
    this.lightCanvas = document.createElement('canvas');
    this.lightCanvas.width = WORLD_WIDTH;
    this.lightCanvas.height = WORLD_HEIGHT;
    const lCtx = this.lightCanvas.getContext('2d');
    if (!lCtx) throw new Error('Offscreen light canvas context unavailable');
    this.lightCtx = lCtx;

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
      if (savedBinds) {
        const parsed = JSON.parse(savedBinds);
        if (parsed && typeof parsed === 'object') {
          this.keybinds = { ...this.keybinds, ...parsed };
        }
      }
    } catch {
      // ignore
    }

    this.resetMission(initialPlan);
  }

  public resetMission(newPlan?: MissionPlan) {
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
    this.surfaceImpacts = [];
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
    this.c4Count = this.plan.profile === 'BREACHER' ? 3 : 2;
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

    const profileSpec = EKO_COBRA_PROFILES[this.plan.profile];
    const inspSpec = EKO_COBRA_INSPECTION_DEVICES[this.plan.inspectionDevice];

    this.radioFeed = [
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
    this.gameState = 'PLAYING';
    soundEngine.startRainAmbience();
    soundEngine.startAmbientDrone();
    const stationCall =
      this.missionMode === 'STATION'
        ? 'EKO COBRA · EINSATZ GRAZ HAUPTBAHNHOF'
        : this.missionMode === 'LINZ'
          ? 'EKO COBRA · SYNTHETIK-LABOR LINZ'
          : this.missionMode === 'TIROL'
            ? 'EKO COBRA · ALPEN-CHALET KITZBÜHEL'
            : this.missionMode === 'SCHWECHAT'
              ? 'EKO COBRA · FLUGHAFEN WIEN-SCHWECHAT'
              : 'LEITSTELLE GRAZ - LEND';
    soundEngine.playTetraRadioTransmission('info', 46, stationCall);
    this.radioTxTimer = 2.1;

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

    if (this.plan.doctrine === 'DYNAMIC') {
      const targetDoorId =
        this.missionMode === 'STATION'
          ? this.plan.entryPoint === 'HAUPTEINGANG_A'
            ? 'DOOR_PLATFORM_HALL'
            : 'DOOR_STATION_VORPLATZ'
          : this.missionMode === 'LINZ'
            ? this.plan.entryPoint === 'HAUPTEINGANG_A'
              ? 'DOOR_LINZ_DOCK_A'
              : 'DOOR_LINZ_DOCK_B'
            : this.missionMode === 'TIROL'
              ? this.plan.entryPoint === 'HAUPTEINGANG_A'
                ? 'DOOR_TIROL_TERRASSE_A'
                : 'DOOR_TIROL_BALKON_B'
              : this.missionMode === 'SCHWECHAT'
                ? this.plan.entryPoint === 'HAUPTEINGANG_A'
                  ? 'DOOR_VIE_HANGAR_GATE_A'
                  : 'DOOR_VIE_LOUNGE_GATE_B'
                : this.plan.entryPoint === 'HAUPTEINGANG_A'
                  ? 'DOOR_MAIN_A'
                  : 'DOOR_BALCONY_B';
      const entryDoor = this.doors.find((d) => d.id === targetDoorId);
      if (entryDoor) {
        this.executeBreach(entryDoor, 'C4');
      }
    }
    this.onStateChange('PLAYING');
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
    this.gameState = 'PLAYING';
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
    this.onStateChange('PLAYING');
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
    if (door && !door.isOpen) {
      this.initiateBreach(door, mode);
    }
  }

  public replayRadioMessage(item: {
    speaker: string;
    text: string;
    tone: 'info' | 'warn' | 'alert' | 'ok';
  }) {
    soundEngine.playTetraRadioTransmission(item.tone, item.text.length, item.speaker);
    this.radioTxTimer = 1.95;
    if (item.tone === 'alert' || item.tone === 'warn') {
      this.radioStaticTimer = 0.75;
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
      'info'
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
      this.nvgActive ? 'ok' : 'info'
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
      'ok'
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
    this.keybinds[action] = code;
    try {
      window.localStorage.setItem('eko_cobra_keybinds', JSON.stringify(this.keybinds));
    } catch {
      // ignore
    }
    this.emitHudSnapshot();
  }

  public resetKeybinds() {
    this.keybinds = {
      moveForward: 'KeyW',
      moveBackward: 'KeyS',
      moveLeft: 'KeyA',
      moveRight: 'KeyD',
      policeShout: 'Space',
      interact: 'KeyE',
      breachKick: 'KeyF',
      breachC4: 'KeyC',
      breachRam: 'KeyX',
      inspect: 'KeyQ',
      gadget: 'KeyG',
      toolTaser: 'KeyT',
      flashlight: 'KeyL',
      ifak: 'KeyH',
      aimZone: 'KeyV',
      stance: 'KeyZ',
      thermalPalette: 'KeyK',
      biometric: 'KeyB',
      interrogate: 'KeyI',
      reload: 'KeyR',
      squad1: 'Digit1',
      squad2: 'Digit2',
      squad3: 'Digit3',
      squad4: 'Digit4',
      squad5: 'Digit5',
      squad6: 'Digit6',
      squad7: 'Digit7',
      squad8: 'Digit8',
    };
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
        this.gameState = 'PAUSED';
        this.onStateChange('PAUSED');
        this.emitHudSnapshot();
      } else if (this.gameState === 'PAUSED') {
        this.gameState = 'PLAYING';
        this.onStateChange('PLAYING');
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

  public toggleSprintMode() {
    this.sprintModeToggled = !this.sprintModeToggled;
    soundEngine.playOpticCam();
    this.emitHudSnapshot();
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

  public setTacticalWaypoint(x: number, y: number, customLabel?: string) {
    const roomId = this.getRoomAt(x, y);
    const roomObj = this.rooms.find((r) => r.id === roomId);
    const label = customLabel || (roomObj ? roomObj.nameDe : 'PUNTO TÁCTICO');
    this.tacticalWaypoint = {
      x: Math.round(x),
      y: Math.round(y),
      label,
    };
    soundEngine.playOpticCam();
    this.pushRadio(
      'KOBRA-1',
      `EKO-Pad C4I: Navigationspunkt markiert bei [${label}].`,
      'info'
    );
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
      'info'
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

  public isRightDragging: boolean = false;
  public rightClickDragStart: Vec2 = { x: 0, y: 0 };
  public rightClickDragCurrent: Vec2 = { x: 0, y: 0 };

  public startRightClickDrag(clientX: number, clientY: number) {
    if (this.gameState !== 'PLAYING') return;
    const worldPos = this.screenToWorld(clientX, clientY);
    this.isRightDragging = true;
    this.rightClickDragStart = worldPos;
    this.rightClickDragCurrent = worldPos;
  }

  public updateRightClickDrag(clientX: number, clientY: number) {
    if (!this.isRightDragging) return;
    const worldPos = this.screenToWorld(clientX, clientY);
    this.rightClickDragCurrent = worldPos;
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
  }

  private touchActive: boolean = false;
  private touchWorldTarget: Vec2 | null = null;

  public handleTouchStart(clientX: number, clientY: number) {
    this.handleMouseMove(clientX, clientY);
    this.touchActive = true;
    const player = this.getPlayer();
    if (!player || player.state === 'DEAD') return;
    const worldPos = this.screenToWorld(this.mouseScreen.x, this.mouseScreen.y);
    this.touchWorldTarget = worldPos;

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
      this.touchWorldTarget = worldPos;
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
    this.touchWorldTarget = null;
    this.touchMoveX = 0;
    this.touchMoveY = 0;
    this.isDraggingMinimap = false;
  }

  private getPlayer(): ActorEntity | undefined {
    return this.actors.find((a) => a.role === 'PLAYER');
  }

  private getSquadmate(): ActorEntity | undefined {
    return this.actors.find((a) => a.role === 'SQUAD');
  }

  private pushRadio(
    speaker: string,
    text: string,
    tone: 'info' | 'warn' | 'alert' | 'ok' = 'info'
  ) {
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 8);
    const isImportantAlert = tone === 'alert' || tone === 'warn';
    const hasStaticBurst = isImportantAlert || Math.random() < 0.18;

    this.radioFeed = [
      {
        id: `${Date.now()}_${Math.random()}`,
        speaker,
        text,
        time: timeStr,
        tone,
        hasStaticBurst,
      },
      ...this.radioFeed.slice(0, 5),
    ];

    if (this.gameState === 'PLAYING') {
      const nowMs = performance.now();
      this.radioTxTimer = tone === 'alert' ? 2.4 : tone === 'warn' ? 2.0 : 1.75;
      if (hasStaticBurst) {
        this.radioStaticTimer = tone === 'alert' ? 0.95 : 0.65;
      }

      if (nowMs - this.lastRadioAudioStamp > 110) {
        this.lastRadioAudioStamp = nowMs;
        soundEngine.playTetraRadioTransmission(tone, text.length, speaker);
      } else if (isImportantAlert) {
        // Even if two messages arrive nearly simultaneously, ensure tactical alert static crackle is heard
        soundEngine.playTetraStaticBurst(tone === 'alert' ? 0.95 : 0.72);
      }
      this.emitHudSnapshot();
    }
  }

  private awardOperatorXp(xpAmount: number, reason?: string) {
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

  private logCriticalEvent(
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

  private recordRoeEvent(label: string, points: number, lawful: boolean) {
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

  private updateStealthAndNoise(dt: number, player: ActorEntity) {
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
      if (sc.isDestroyed) continue;
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

        soundEngine.playTetraRadioTransmission('info', 30, 'KOBRA-1');
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

  private makeSuspectSurrender(suspect: ActorEntity, reason: string) {
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

  private isPlayerInDarkness(player: ActorEntity): boolean {
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

  private findNearestDoor(x: number, y: number, maxDist = 56): DoorEntity | null {
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

  public handleContextualInteract() {
    const player = this.getPlayer();
    if (!player || player.state === 'DEAD') return;

    this.mirrorDoorId = null;
    this.thermalActive = false;

    for (const actor of this.actors) {
      if (actor.role === 'PLAYER' || actor.role === 'SQUAD') continue;
      const dist = Math.hypot(actor.x - player.x, actor.y - player.y);
      if (dist <= 52) {
        if (
          actor.role === 'SUSPECT' &&
          (actor.state === 'SURRENDERED' ||
            actor.state === 'INCAPACITATED' ||
            actor.state === 'FEIGNING_SURRENDER')
        ) {
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

        if (
          (actor.role === 'HOSTAGE' || actor.role === 'CIVILIAN') &&
          actor.state !== 'ARRESTED' &&
          actor.state !== 'DEAD'
        ) {
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
      }
    }

    for (const ev of this.evidenceList) {
      if (!ev.secured && Math.hypot(ev.x - player.x, ev.y - player.y) <= 50) {
        ev.secured = true;
        soundEngine.playOpticCam();
        this.recordRoeEvent(`Evidencia balística asegurada (${ev.label})`, 75, true);
        this.pushRadio('KOBRA-2', `Beweismittel gesichert: ${ev.label}.`, 'info');
        this.checkMissionCompletion();
        this.emitHudSnapshot();
        return;
      }
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

  private handleDoorBreachKick() {
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

  private handleDoorBreachRam() {
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
    if (!player || player.state === 'DEAD' || this.breachAction) return;
    if (this.c4Count <= 0) {
      this.pushRadio('KOBRA-1', 'Keine Sprengladungen (C4) mehr verfügbar!', 'warn');
      return;
    }

    const door = this.findNearestDoor(player.x, player.y, 65);
    if (door && !door.isOpen) {
      this.c4Count = Math.max(0, this.c4Count - 1);
      soundEngine.playBreachPrep('C4');
      const cx = (door.x1 + door.x2) / 2;
      const cy = (door.y1 + door.y2) / 2;
      this.activeC4Charges.push({
        id: 'c4_' + Math.random().toString(36).substring(2, 9),
        targetName: door.name,
        x: cx,
        y: cy,
        remainingSeconds: 4.0,
        maxSeconds: 4.0,
        doorId: door.id,
        isWindow: false,
      });
      this.pushRadio(
        'KOBRA-1',
        `Sprengladung (C4) an ${door.name} platziert! 4s bis zur Detonation. ¡Deckung suchen!`,
        'warn'
      );
      this.emitHudSnapshot();
      return;
    }

    const extWin = this.findNearestExteriorWindow(player.x, player.y, 68);
    if (extWin && !extWin.isBreached) {
      this.c4Count = Math.max(0, this.c4Count - 1);
      soundEngine.playBreachPrep('C4');
      const cx = (extWin.x1 + extWin.x2) / 2;
      const cy = (extWin.y1 + extWin.y2) / 2;
      this.activeC4Charges.push({
        id: 'c4_' + Math.random().toString(36).substring(2, 9),
        targetName: extWin.label || 'Ventana Exterior',
        x: cx,
        y: cy,
        remainingSeconds: 4.0,
        maxSeconds: 4.0,
        windowId: extWin.id,
        isWindow: true,
      });
      this.pushRadio(
        'KOBRA-1',
        `Sprengladung (C4) an ${extWin.label || 'Ventana'} platziert! 4s bis zur Detonation. ¡Deckung suchen!`,
        'warn'
      );
      this.emitHudSnapshot();
    }
  }

  public detonateActiveC4() {
    if (this.activeC4Charges.length === 0) return;
    for (const charge of [...this.activeC4Charges]) {
      this.triggerC4Explosion(charge);
    }
    this.activeC4Charges = [];
    this.emitHudSnapshot();
  }

  private triggerC4Explosion(charge: ActiveC4Charge) {
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

  private initiateBreach(door: DoorEntity, mode: 'KICK' | 'RAM' | 'C4') {
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

  private executeBreach(door: DoorEntity, mode: 'KICK' | 'RAM' | 'C4') {
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
      this.pushRadio('KOBRA-1', `Dynamischer Tritt (Holzsplitter-Durchbruch) an ${door.name}!`, 'info');
    } else if (mode === 'RAM') {
      this.shakeIntensity = 13;
      this.hitstopTimer = 0.05;
      this.pushRadio('KOBRA-1', `Türramme (Schwerer Metallschlag & Rahmenbruch) an ${door.name}!`, 'warn');
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
      this.pushRadio('KOBRA-1', `Sprengladung (C4 Breaching Charge) gezündet an ${door.name}!`, 'alert');
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

  private initExteriorWindowsAndAmbientDust() {
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

  private findNearestExteriorWindow(
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

  private splitWallSegmentForBreach(win: ExteriorWindowSection) {
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

  private executeExteriorWindowBreach(
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

  private triggerExteriorBreachWeatherSurge(
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
  private getWeatherVisibilityMultiplier(x: number, y: number): number {
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
    let glowColor = 'rgba(245, 158, 11, 0.4)';
    let fillColor = 'rgba(245, 158, 11, 0.14)';

    if (this.plan.gadget === 'CS_GAS') {
      mainColor = '#10B981'; // CS Gas emerald
      glowColor = 'rgba(16, 185, 129, 0.4)';
      fillColor = 'rgba(16, 185, 129, 0.14)';
    } else if (this.plan.gadget === 'PEPPER_SPRAY') {
      mainColor = '#F97316'; // Pepper Spray orange
      glowColor = 'rgba(249, 115, 22, 0.4)';
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

  public issueSquadCommand(cmd: SquadCommand) {
    this.squadCommand = cmd;
    const squad = this.getSquadmate();
    const player = this.getPlayer();
    if (!squad || !player || squad.state === 'DEAD') return;
    squad.commandNodTimer = 0.48;
    this.commandPulseTimer = 1.2;
    soundEngine.playOpticCam();
    if (cmd === 'FOLLOW') {
      squad.gestureKind = 'ADVANCE';
      squad.gestureTimer = 0.65;
      squad.investigateTarget = undefined;
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
      if (!squad.investigateTarget) {
        const breachMarker = this.tacticalMarkers.find((m) => m.type === 'BREACH_ZONE');
        const refX = breachMarker ? breachMarker.x : player.x;
        const refY = breachMarker ? breachMarker.y : player.y;
        const door =
          this.findNearestDoor(refX, refY, 550) || this.findNearestDoor(squad.x, squad.y, 550);
        if (door) {
          const mx = (door.x1 + door.x2) * 0.5;
          const my = (door.y1 + door.y2) * 0.5;
          squad.investigateTarget = { x: mx, y: my };
        } else {
          squad.investigateTarget = {
            x: player.x + Math.cos(player.angle) * 160,
            y: player.y + Math.sin(player.angle) * 160,
          };
        }
      }
    } else if (cmd === 'PIE_DOOR') {
      squad.gestureKind = 'POINT';
      squad.gestureTimer = 0.65;
      squad.speechBubble = { text: 'Sonde & Winkel schneiden!', timer: 2.2, type: 'COMMAND' };
      this.pushRadio('KOBRA-2', '[4] Posicionando para sonda óptica y corte de ángulo.', 'info');
      if (!squad.investigateTarget) {
        const door =
          this.findNearestDoor(player.x, player.y, 550) ||
          this.findNearestDoor(squad.x, squad.y, 550);
        if (door) {
          const mx = (door.x1 + door.x2) * 0.5;
          const my = (door.y1 + door.y2) * 0.5;
          squad.investigateTarget = { x: mx, y: my };
        } else {
          squad.investigateTarget = {
            x: player.x + Math.cos(player.angle) * 130,
            y: player.y + Math.sin(player.angle) * 130,
          };
        }
      }
    } else if (cmd === 'DEPLOY_CS_GAS') {
      squad.gestureKind = 'BREACH';
      squad.gestureTimer = 0.65;
      squad.speechBubble = { text: 'CS-Reizgas bereit!', timer: 2.2, type: 'COMMAND' };
      this.pushRadio('KOBRA-2', '[5] Desplazando para lanzar granada CS.', 'info');
      if (!squad.investigateTarget) {
        const hostileMarker = this.tacticalMarkers.find(
          (m) => m.type === 'HOSTILE' || m.type === 'BREACH_ZONE'
        );
        const tx = hostileMarker
          ? hostileMarker.x
          : player.x + Math.cos(player.angle) * 180;
        const ty = hostileMarker
          ? hostileMarker.y
          : player.y + Math.sin(player.angle) * 180;
        squad.investigateTarget = { x: tx, y: ty };
      }
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
      if (!squad.investigateTarget) {
        const suspect = this.actors.find(
          (a) => a.role === 'SUSPECT' && a.state !== 'DEAD' && a.state !== 'ARRESTED'
        );
        const tx = suspect ? suspect.x : player.x + Math.cos(player.angle) * 160;
        const ty = suspect ? suspect.y : player.y + Math.sin(player.angle) * 160;
        squad.investigateTarget = { x: tx, y: ty };
      }
    } else if (cmd === 'REGROUP_HEAL') {
      squad.gestureKind = 'HALT';
      squad.gestureTimer = 0.65;
      this.tacticalWaypoint = undefined;
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

    // Anchor Kobra-2's base sector angle so he never spins when holding or executing an order
    if (squad.investigateTarget) {
      this.squadHoldAnchorAngle = Math.atan2(
        squad.investigateTarget.y - squad.y,
        squad.investigateTarget.x - squad.x
      );
    } else if (this.tacticalWaypoint) {
      this.squadHoldAnchorAngle = Math.atan2(
        this.tacticalWaypoint.y - squad.y,
        this.tacticalWaypoint.x - squad.x
      );
    } else {
      this.squadHoldAnchorAngle = player.angle;
    }

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

  private castProjectile(
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

  private propagateGunshotAlert(shooter: ActorEntity, shotX: number, shotY: number) {
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
  private registerAcousticEdgeCue(
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

  private spawnSurfaceDebrisEffects(
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

    // 4. Persistent Environmental Bullet Crater, Radial Stress Cracks & Hot Ballistic Ember on Wall/Door/Furniture
    if (this.surfaceImpacts.length > 240) this.surfaceImpacts.shift();
    const crackCount = surfaceKind === 'WALL' ? 4 + Math.floor(Math.random() * 3) : 3;
    const cracks: { angle: number; len: number }[] = [];
    for (let c = 0; c < crackCount; c++) {
      cracks.push({
        angle: (c / crackCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.65,
        len: 4.5 + Math.random() * (surfaceKind === 'WALL' ? 7.5 : 5.5),
      });
    }
    this.surfaceImpacts.push({
      x,
      y,
      bulletAngle,
      surfaceKind,
      surfaceColor,
      craterRadius: surfaceKind === 'WALL' ? 3.2 + Math.random() * 1.4 : 2.6 + Math.random() * 1.2,
      emberTimer: 1.8,
      cracks,
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

  private spawnActorImpactEffects(
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

  private computeBallisticHitZone(
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

  private ensureBodyHealth(actor: ActorEntity): BodyPartHealth {
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

  private setActorSpeech(
    actor: ActorEntity,
    bubble: { text: string; timer: number; type: 'COMMAND' | 'HOSTILE' | 'SURRENDER' | 'PANIC' }
  ) {
    actor.speechBubble = bubble;
    soundEngine.speak(bubble.text, actor.role);
  }

  private resolveProjectileHit(
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

  private detonateGadgetAt(x: number, y: number, type: 'FLASHBANG' | 'CS_GAS' | 'PEPPER_SPRAY') {
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

  private checkMissionCompletion() {
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

  private triggerMissionEnd(
    outcome: 'VICTORY' | 'ROE_TERMINATED' | 'KIA' | 'HOSTAGE_LOST',
    grade: 'S' | 'A' | 'B' | 'C' | 'F',
    title: string,
    subtitle: string
  ) {
    this.missionOutcome = { outcome, grade, title, subtitle };
    this.baseCareerXp += this.sessionXp;
    this.sessionXp = 0;
    this.gameState = 'SUMMARY';
    this.onStateChange('SUMMARY');
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

    // Update active placed C4 charges countdowns & auto-detonation with proximity blast damage check
    for (let i = this.activeC4Charges.length - 1; i >= 0; i--) {
      const charge = this.activeC4Charges[i];
      charge.remainingSeconds -= dt;
      if (charge.remainingSeconds <= 0) {
        this.triggerC4Explosion(charge);
        this.activeC4Charges.splice(i, 1);
      }
    }

    // Audio warning beep & tactical vibration pulse during final 3 seconds
    const active3sC4 = this.activeC4Charges.filter((c) => c.remainingSeconds <= 3.0 && c.remainingSeconds > 0);
    if (active3sC4.length > 0) {
      const minRem = Math.min(...active3sC4.map((c) => c.remainingSeconds));
      const urgencyRatio = Math.min(1.0, Math.max(0, (3.0 - minRem) / 3.0));
      const beepInterval = Math.max(0.08, 0.42 - urgencyRatio * 0.32);
      this.c4WarningBeepTimer += dt;
      if (this.c4WarningBeepTimer >= beepInterval) {
        this.c4WarningBeepTimer = 0;
        soundEngine.playC4WarningBeep(1.0 + urgencyRatio * 0.75);
      }
      this.shakeIntensity = Math.max(this.shakeIntensity, 1.8 + urgencyRatio * 4.5);
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

    const viewW = this.viewWidth;
    const viewH = this.viewHeight;
    this.mouseWorld.x = (this.mouseScreen.x - viewW * 0.5) / CAMERA_ZOOM + this.camX;
    this.mouseWorld.y = (this.mouseScreen.y - viewH * 0.5) / CAMERA_ZOOM + this.camY;

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
      const len = Math.hypot(moveX, moveY);
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
      const nx = player.x + (moveX / len) * baseSpeed * dt;
      const ny = player.y + (moveY / len) * baseSpeed * dt;
      this.moveActorWithCollision(player, nx, ny);

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
            this.c4Count = Math.max(0, this.c4Count - 1);
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

    for (const imp of this.surfaceImpacts) {
      if (imp.emberTimer > 0) {
        imp.emberTimer = Math.max(0, imp.emberTimer - dt);
      }
    }

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
    this.radioTxTimer = Math.max(0, this.radioTxTimer - dt);
    this.radioStaticTimer = Math.max(0, this.radioStaticTimer - dt);

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

  private updateCivilianAi(dt: number) {
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

  private updateActorAnimations(dt: number) {
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
      if (actor.state === 'DEAD') {
        actor.lastSpokenText = undefined;
        continue;
      }

      // Procedural Voice Synthesis Trigger
      if (actor.speechBubble && actor.speechBubble.text !== actor.lastSpokenText) {
        actor.lastSpokenText = actor.speechBubble.text;
        soundEngine.speak(actor.speechBubble.text, actor.role);
      } else if (!actor.speechBubble) {
        actor.lastSpokenText = undefined;
      }

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
  private findBestCoverForActor(
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
  private isTrajectoryBlockedByFriendlies(
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
  private propagateSuspectCombatAlert(sourceSuspect: ActorEntity, threatX: number, threatY: number) {
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
  private findTacticalStackPosition(door: DoorEntity, player: ActorEntity): Vec2 {
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

  private updateSquadmateAI(dt: number, player: ActorEntity) {
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

    // Transit Interruption Check: Detect suspects or civilians in transit
    if ((squad.investigateTarget || this.tacticalWaypoint) && (squad.state as string) !== 'DEAD') {
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
          const doorNear = this.findNearestDoor(squad.x, squad.y, 110);
          if (doorNear && !doorNear.isBreached && !doorNear.isOpen) {
            this.executeBreach(doorNear, 'RAM');
            const mx = (doorNear.x1 + doorNear.x2) * 0.5;
            const my = (doorNear.y1 + doorNear.y2) * 0.5;
            this.detonateGadgetAt(mx, my, 'FLASHBANG');
            squad.speechBubble = { text: 'Zugriff! Raum betreten!', timer: 2.6, type: 'COMMAND' };
            this.pushRadio('KOBRA-2', `[3] ¡Brecha en ${doorNear.name}! Entrando al compartimento.`, 'ok');

            const targetRoomId = squad.roomName === doorNear.roomA ? doorNear.roomB : doorNear.roomA;
            const roomObj = this.rooms.find((r) => r.id === targetRoomId) || this.rooms.find((r) => r.id === doorNear.roomB);
            if (roomObj) {
              squad.investigateTarget = {
                x: roomObj.x + roomObj.w * 0.5,
                y: roomObj.y + roomObj.h * 0.5,
              };
              squad.targetFacingAngle = Math.atan2(
                roomObj.y + roomObj.h * 0.5 - squad.y,
                roomObj.x + roomObj.w * 0.5 - squad.x
              );
              return;
            }
          } else {
            // Only finalize if we are actually at the room center (not just at the door)
            const isAtDoor = doorNear && Math.hypot(squad.x - (doorNear.x1 + doorNear.x2) * 0.5, squad.y - (doorNear.y1 + doorNear.y2) * 0.5) < 20;
            if (!isAtDoor) {
              squad.speechBubble = { text: 'Raum betreten, inspiziert und gesichert!', timer: 2.2, type: 'COMMAND' };
              this.pushRadio('KOBRA-2', '[3] Espacio interior inspeccionado y asegurado con éxito. Sin amenazas.', 'ok');
              this.squadCommand = 'HOLD';
              squad.investigateTarget = undefined;
              return;
            }
          }
        } else if (this.squadCommand === 'PIE_DOOR') {
          const doorNear = this.findNearestDoor(squad.x, squad.y, 90);
          if (doorNear) {
            doorNear.mirrored = true;
            let spotted = 0;
            for (const actor of this.actors) {
              if (
                (actor.roomName === doorNear.roomA || actor.roomName === doorNear.roomB) &&
                actor.role !== 'PLAYER' &&
                actor.role !== 'SQUAD'
              ) {
                actor.spottedByMirror = true;
                spotted++;
              }
            }
            squad.speechBubble = { text: `Optik-Sonde: ${spotted} Kontakte!`, timer: 2.2, type: 'COMMAND' };
            this.pushRadio('KOBRA-2', `[4] Sonda óptica en ${doorNear.name}: ${spotted} contactos detectados.`, 'ok');
          }
          this.squadCommand = 'HOLD';
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
      const arrestCandidate = this.actors.find(
        (a) =>
          ((a.role === 'SUSPECT' && a.state === 'SURRENDERED') ||
            ((a.role === 'HOSTAGE' || a.role === 'CIVILIAN') &&
              a.state !== 'ARRESTED' &&
              a.state !== 'DEAD')) &&
          Math.hypot(a.x - squad.x, a.y - squad.y) < 1200
      );
      const evCandidate = this.evidenceList.find(
        (e) => !e.secured && Math.hypot(e.x - squad.x, e.y - squad.y) < 1200
      );

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
          } else {
            this.recordRoeEvent(
              `Kobra-2 evacuó a salvo a ${arrestCandidate.name}`,
              150,
              true
            );
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
        movementDirectionAngle = ang;
        const squadBh = squad.bodyHealth;
        const legMult = squadBh ? 0.35 + 0.65 * (squadBh.legs / 100) : 1.0;
        const dragMult = squadBh && squadBh.legs < 40 ? 0.45 : 1.0;
        const squadSpeed = (dist > 85 ? 175 : 145) * legMult * dragMult;
        const step = Math.min(dist, squadSpeed * dt);
        this.moveActorWithCollision(
          squad,
          squad.x + Math.cos(ang) * step,
          squad.y + Math.sin(ang) * step
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

  private updateHostagesAI(dt: number, player: ActorEntity) {
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

  private updateSuspectsAI(dt: number, player: ActorEntity) {
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
    this.renderDynamicDarknessAndFlashlights(ctx, player, squad);

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

  /**
   * Renders immersive tactical camera film-grain noise and a deep crimson corner vignette
   * whenever the operator takes ballistic damage, bleeds, or comes under heavy fire.
   */
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

  /**
   * Renders a subtle directional acoustic indicator along the screen border (Peltor ComTac 3D Audio HUD)
   * pointing toward gunshots or suspicious footsteps/noises originating outside the operator's FOV.
   */
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
    ctx.restore();
  }

  private renderC4WarningPulseOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) {
    const active3sC4 = this.activeC4Charges.filter(
      (c) => c.remainingSeconds <= 3.0 && c.remainingSeconds > 0
    );
    if (active3sC4.length === 0) return;

    const minRem = Math.min(...active3sC4.map((c) => c.remainingSeconds));
    const urgencyRatio = Math.min(1.0, Math.max(0, (3.0 - minRem) / 3.0));

    // Pulse frequency scales up from 6Hz at 3s to 24Hz at 0s
    const pulseFreq = 6 + urgencyRatio * 18;
    const pulseSine = 0.5 + 0.5 * Math.sin(this.elapsedSeconds * pulseFreq);

    // Intensity scales from 0.35 at 3s to 0.95 at 0s
    const baseIntensity = 0.35 + urgencyRatio * 0.60;
    const alpha = Math.min(0.95, baseIntensity * (0.5 + 0.5 * pulseSine));

    ctx.save();

    // 1. Full-screen pulsating crimson warning tint overlay
    ctx.fillStyle = `rgba(220, 38, 38, ${(alpha * 0.28).toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);

    // 2. Heavy radial perimeter vignette (dark red edge encroaching inward)
    const innerRadius = Math.min(width, height) * Math.max(0.12, 0.38 - urgencyRatio * 0.22);
    const outerRadius = Math.max(width, height) * (0.75 - urgencyRatio * 0.20);
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
    ctx.lineWidth = 4 + urgencyRatio * 10;
    ctx.strokeRect(0, 0, width, height);

    // 4. Central top emergency C4 detonation banner
    const targetName = active3sC4[0].targetName || 'OBJETIVO';
    const secondsStr = minRem.toFixed(1);
    const bannerText = `⚠ DETONACIÓN C4 EN ${targetName.toUpperCase()} · ${secondsStr}S ⚠`;

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
      const aoGrad = ctx.createLinearGradient(room.x, room.y, room.x + 15, room.y);
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
    } else {
      renderExteriorStreetsAndStairwell(ctx, this.isTrainingMode, this.elapsedSeconds);
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

  /**
   * Casts dynamic 2D umbra shadow volumes behind furniture and actors
   * relative to the weapon-mounted flashlight positions of Kobra-1 and Kobra-2.
   */
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

  /**
   * Renders the offscreen darkness layer and carves out raycasted vision cones,
   * weapon-mounted tactical flashlights (Kobra-1 & Kobra-2), and dynamic muzzle flashes.
   */
  private renderDynamicDarknessAndFlashlights(
    ctx: CanvasRenderingContext2D,
    player: ActorEntity | undefined,
    squad: ActorEntity | undefined
  ) {
    const lCtx = this.lightCtx;
    lCtx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // 1. Base nocturnal darkness over the entire Graz apartment level
    // When Night Vision (NVG) is active, residual light amplification drastically reduces shadow opacity in dark rooms
    lCtx.globalCompositeOperation = 'source-over';
    lCtx.fillStyle =
      this.gameState === 'TITLE'
        ? 'rgba(5, 9, 15, 0.62)'
        : this.nvgActive
          ? 'rgba(2, 16, 9, 0.44)'
          : 'rgba(4, 7, 13, 0.86)';
    lCtx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // 2. Carve out ambient emergency stairwell light & exterior balcony moonlight
    lCtx.globalCompositeOperation = 'destination-out';

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
      if (sconce.isDestroyed) continue;
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
        (this.nvgActive ? 0.92 : 0.58) * weatherVisMult
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

    // 3. Stamp the composite darkness & shadow layer onto the main canvas
    ctx.drawImage(this.lightCanvas, 0, 0);
  }

  private carveLightPolygon(
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

      // Render door handle / agarradera
      const handleX = d.hingeX + Math.cos(d.currentAngle) * len * 0.82;
      const handleY = d.hingeY + Math.sin(d.currentAngle) * len * 0.82;
      ctx.save();
      ctx.fillStyle = '#F59E0B'; // Brass / metallic handle
      ctx.strokeStyle = '#451A03';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(handleX, handleY, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Render Architectural Exterior Windows (with rain streaks, condensation, or shattered wall breach gap)
    this.renderExteriorWindows(ctx);

    // Render Active Placed C4 Charges on doors/windows with flashing LED & countdown badge
    for (const charge of this.activeC4Charges) {
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
      // Countdown text
      ctx.fillStyle = '#FCA5A5';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${charge.remainingSeconds.toFixed(1)}s`, 0, -12);
      ctx.restore();
    }

    // Render persistent bullet craters, radial stress cracks & wood splinters on Walls and Doors
    this.renderSurfaceImpactMarks(ctx, 'WALL');
    this.renderSurfaceImpactMarks(ctx, 'DOOR');

    // Render Wall-Mounted Sconce Lamp Fixtures (Wandlampen) along corridors
    this.renderWallSconceFixtures(ctx);
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

  public cycleThermalPaletteMode() {
    const modes: ('WHITE_HOT' | 'BLACK_HOT' | 'IRONBOW')[] = ['WHITE_HOT', 'BLACK_HOT', 'IRONBOW'];
    const idx = modes.indexOf(this.thermalPaletteMode);
    this.thermalPaletteMode = modes[(idx + 1) % modes.length];
    soundEngine.playUiClick();
    this.emitHudSnapshot();
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

  private updateWeatherAndAmbientDust(dt: number) {
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

  /**
   * Renders suspended indoor ambient dust motes with Tyndall light scattering when illuminated by
   * operator flashlights or wall sconces, plus volumetric dust/mist inflow plumes at breached exterior walls.
   */
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

  /**
   * Renders a subtle screen-space atmospheric dust/rain veil and compact meteorological visibility telemetry
   * that intensifies when an exterior wall, window, or door is breached.
   */
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

  private normalizeAngle(a: number): number {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  private getRoomAt(x: number, y: number): string {
    for (const r of this.rooms) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        return r.id;
      }
    }
    return 'AUSSENBEREICH';
  }

  private moveActorWithCollision(actor: ActorEntity, nextX: number, nextY: number) {
    // El deslizamiento y la colisión viven en simulation.ts, compartidos con los tests.
    deslizarConColision(actor, nextX, nextY, (x, y) => this.collidesAt(x, y, actor.radius));
  }

  private collidesAt(x: number, y: number, radius: number): boolean {
    return colisiona(x, y, radius, this.walls, this.doors, this.furniture);
  }

  private distToSegment(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): number {
    return distanciaASegmento(px, py, x1, y1, x2, y2);
  }

  private computeVisibilityPolygon(
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

  private raycastWallsAndDoors(x1: number, y1: number, x2: number, y2: number): boolean {
    return this.raycastPoint(x1, y1, x2, y2) !== null;
  }

  private raycastPoint(x1: number, y1: number, x2: number, y2: number): Vec2 | null {
    const res = this.raycastSurface(x1, y1, x2, y2);
    return res ? { x: res.x, y: res.y } : null;
  }

  private raycastSurface(
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
      if (!d.isOpen && !d.isDestroyed) {
        checkSeg(d.x1, d.y1, d.x2, d.y2, 'DOOR', '#D97706');
      }
    }
    for (const f of this.furniture) {
      if (f.blocksSight && !f.isDestroyed) {
        checkSeg(f.x, f.y, f.x + f.w, f.y, 'FURNITURE', f.color);
        checkSeg(f.x + f.w, f.y, f.x + f.w, f.y + f.h, 'FURNITURE', f.color);
        checkSeg(f.x + f.w, f.y + f.h, f.x, f.y + f.h, 'FURNITURE', f.color);
        checkSeg(f.x, f.y + f.h, f.x, f.y, 'FURNITURE', f.color);
      }
    }
    for (const sc of this.wallSconces) {
      if (sc.isDestroyed) continue;
      // Simple circular hit box for lamp
      const dist = this.distToSegment(sc.x, sc.y, x1, y1, x2, y2);
      if (dist < 12) {
        sc.isDestroyed = true;
        // Mark as hit but continue if multiple things are hit (actually we want to stop here)
        minT = 0; // Effectively hit
        closest = { x: sc.x, y: sc.y, kind: 'FURNITURE', color: '#000', ax: sc.x, ay: sc.y, bx: sc.x, by: sc.y };
      }
    }

    return closest;
  }

  private rayCircleIntersect(
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

  private computeContextPrompt(player: ActorEntity | undefined): string | null {
    if (!player) return null;

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
        return `${door.name}: [Q] ${sensorLabel} · [F] Patada · [C] C4 (${this.c4Count}) · [X] Ariete`;
      }
      return `${door.name}: [E] Cerrar puerta`;
    }

    const extWin = this.findNearestExteriorWindow(player.x, player.y, 68);
    if (extWin && !extWin.isBreached) {
      return `${extWin.label}: [F] Abrir brecha exterior · [X] Ariete · [C] Carga C4 (${this.c4Count})`;
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

  private getActiveBiometricHudTarget(player: ActorEntity | undefined): BiometricHudTarget | undefined {
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
          isArmed: a.isArmed,
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
      activeC4Charges: this.activeC4Charges.map((c) => ({
        ...c,
        remainingSeconds: Math.max(0, c.remainingSeconds),
      })),
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
      c4Count: this.c4Count,
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
      radioTransmitting: this.radioTxTimer > 0,
      radioStaticActive: this.radioStaticTimer > 0,
      radioFeed: this.radioFeed,
      roeEvents: this.radioFeed ? this.roeEvents : [],
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
  public destroy() {
    this.gameState = 'TITLE';
    this.heldKeys.clear();
    this.isEmittingHudSnapshot = false;
    soundEngine.destroy();
  }

  public screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const cx = this.viewWidth * 0.5;
    const cy = this.viewHeight * 0.5;
    const worldX = (clientX - cx) / CAMERA_ZOOM + this.camX;
    const worldY = (clientY - cy) / CAMERA_ZOOM + this.camY;
    return { x: worldX, y: worldY };
  }

  public worldToScreen(wx: number, wy: number): { x: number; y: number } {
    const cx = this.viewWidth * 0.5;
    const cy = this.viewHeight * 0.5;
    const sx = (wx - this.camX) * CAMERA_ZOOM + cx;
    const sy = (wy - this.camY) * CAMERA_ZOOM + cy;
    return { x: sx, y: sy };
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

  public issueSquadCommandTargeted(
    cmd: SquadCommand,
    target?: { type: 'DOOR' | 'WINDOW' | 'POINT'; id?: string; name: string; x: number; y: number }
  ) {
    if (target) {
      this.tacticalWaypoint = { x: Math.round(target.x), y: Math.round(target.y), label: target.name };
      const squad = this.getSquadmate();
      const player = this.getPlayer();
      if (squad) {
        squad.investigateTarget = { x: target.x, y: target.y };
        if (player) {
          squad.targetFacingAngle = Math.atan2(player.y - target.y, player.x - target.x);
        } else {
          squad.targetFacingAngle = squad.angle;
        }
      }
    }
    this.issueSquadCommand(cmd);
  }

  /** Sizes the backing store for CSS dimensions at the given pixel ratio. */
  public resize(cssWidth: number, cssHeight: number, pixelRatio: number) {
    const ratio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
    this.renderScale = ratio;
    this.canvas.width = Math.max(1, Math.round(cssWidth * ratio));
    this.canvas.height = Math.max(1, Math.round(cssHeight * ratio));
  }

  /** Canvas size in CSS pixels: the space all drawing and hit testing uses. */
  private get viewWidth(): number {
    return this.canvas.width / this.renderScale;
  }

  private get viewHeight(): number {
    return this.canvas.height / this.renderScale;
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
    width: number,
    height: number,
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
    width: number,
    height: number,
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

  /**
   * Renders the Diegetic Smart Reticle (Retícula Inteligente & Estado Diegético)
   * Floats directly beside the mouse screen pointer, reducing ocular travel:
   * - High-precision military reticle with dynamic spread gap (motion, recoil, stance, arm wounds)
   * - Floating Diegetic Ammunition readout (live bullets in mag / reserve mags, low ammo alert, reload arc)
   * - Floating Diegetic Targeting Mode (TORSO vs EXTREMITIES §7 WVG, hotkey [V] feedback)
   * - Hover target friend-or-foe identification (Armed Suspect vs Hostage/Civilian vs Squadmate)
   */
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

