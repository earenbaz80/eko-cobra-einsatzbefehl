export type GameState = 'TITLE' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'DEFEAT';

export type EntryPointId = 'HAUPTEINGANG_A' | 'BALKON_B';
export type EntryDoctrine = 'STEALTH' | 'DYNAMIC';


export type OperatorProfileId = 'AUFKLAERER' | 'BREACHER' | 'VERHANDLUNGSFUEHRER';
export type PrimaryWeaponId = 'AUG_PARA' | 'AUG_A3' | 'MP7A1' | 'GLOCK_SHIELD';
export type WeaponAttachmentId = 'NONE' | 'SUPPRESSOR' | 'RED_DOT_LASER' | 'IR_LASER';
export type AmmoTypeId = 'FMJ_STANDARD' | 'JHP_HOLLOW' | 'AP_PIERCING';
export type InspectionDeviceId = 'MICRO_CAM' | 'THERMAL_CAM' | 'TAC_MIRROR';
export type TacticalGadgetId = 'CS_GAS' | 'FLASHBANG' | 'PEPPER_SPRAY';

export interface WeaponAttachmentSpec {
  id: WeaponAttachmentId;
  nameDe: string;
  nameEs: string;
  soundType: 'SUPPRESSED' | 'STANDARD';
  noiseRadiusMult: number;
  spreadMult: number;
  windupSpeedMult: number;
  hasVisibleLaser: boolean;
  hasIrLaser: boolean;
  description: string;
}

export interface AmmoTypeSpec {
  id: AmmoTypeId;
  nameDe: string;
  nameEs: string;
  damageMult: number;
  armorPenetration: number;
  wallPenetration: boolean;
  overpenetrationRisk: 'ALTO' | 'MEDIO' | 'CERO';
  description: string;
}

export interface OperatorProfileSpec {
  id: OperatorProfileId;
  nameDe: string;
  nameEs: string;
  roleTag: string;
  armorBonus: number;
  speedMultiplier: number;
  shoutMoraleBonus: number;
  extraGadgets: number;
  extraTaser: number;
  sensorRangeMultiplier: number;
  recommendedWeapon: PrimaryWeaponId;
  recommendedInspection: InspectionDeviceId;
  recommendedGadget: TacticalGadgetId;
  description: string;
  perks: string[];
}

export interface WeaponSpec {
  id: PrimaryWeaponId;
  name: string;
  caliber: string;
  origin: string;
  weightKg: number;
  rpm: number;
  damage: number;
  suppressionBonus: number;
  spread: number;
  magSize: number;
  totalMags: number;
  hasShield?: boolean;
  description: string;
}

export interface InspectionDeviceSpec {
  id: InspectionDeviceId;
  nameDe: string;
  nameEs: string;
  weightKg: number;
  rangePx: number;
  fovBoost: number;
  penetratesWalls: boolean;
  spectrumColor: string;
  description: string;
}

export interface TacticalGadgetSpec {
  id: TacticalGadgetId;
  nameDe: string;
  nameEs: string;
  weightKg: number;
  baseCount: number;
  radiusPx: number;
  durationSec: number;
  moraleDrop: number;
  description: string;
}

export type SquadGearId = 'SHIELD' | 'RAM' | 'PROBE_CAM';

export interface MissionPlan {
  profile: OperatorProfileId;
  entryPoint: EntryPointId;
  doctrine: EntryDoctrine;
  primaryWeapon: PrimaryWeaponId;
  attachment?: WeaponAttachmentId;
  ammoType?: AmmoTypeId;
  inspectionDevice: InspectionDeviceId;
  gadget: TacticalGadgetId;
  squadGear: SquadGearId;
  squadOrderInitial: SquadCommand;
  operationId?: 'APARTMENT' | 'STATION' | 'LINZ' | 'TIROL' | 'SCHWECHAT' | 'TRAINING';
}

export type SquadCommand =
  | 'FOLLOW'
  | 'HOLD'
  | 'BREACH_AND_CLEAR'
  | 'PIE_DOOR'
  | 'DEPLOY_CS_GAS'
  | 'RESTRAIN_AND_SECURE'
  | 'SUPPRESS_TARGET'
  | 'REGROUP_HEAL'
  | 'CLEAR_BLAST_AREA'
  | 'FORM_WEDGE'
  | 'FORM_STAGGERED';

export type TacticalMarkerType =
  | 'HOSTILE'
  | 'BREACH_ZONE'
  | 'RALLY_POINT'
  | 'OBSERVE_SECTOR'
  | 'EVIDENCE_LOC'
  | 'DANGER_AREA'
  | 'CLEAR_SECTOR';

export interface TacticalMapMarker {
  id: string;
  type: TacticalMarkerType;
  label: string;
  roomName: string;
  x: number;
  y: number;
  remainingSeconds: number;
  maxSeconds: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface WallSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isWindow?: boolean;
  thickness?: number;
}

export interface DoorEntity {
  id: string;
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  hingeX: number;
  hingeY: number;
  closedAngle: number;
  openAngle: number;
  currentAngle: number;
  isOpen: boolean;
  isLocked: boolean;
  isBreached: boolean;
  mirrored: boolean;
  isDestroyed?: boolean;
  roomA: string;
  roomB: string;
}

export type BattlemapSpriteId =
  | 'WOOD_TABLE_SMOOTH'
  | 'WOOD_TABLE_SLATTED'
  | 'WOOD_CHAIR_A'
  | 'WOOD_CHAIR_B'
  | 'TV_FLAT'
  | 'WOOD_BENCH'
  | 'WOOD_CREDVA'
  | 'NIGHTSTAND_WIDE'
  | 'NIGHTSTAND_SQUARE'
  | 'SOFA_2SEAT'
  | 'ARMCHAIR_GREY'
  | 'OFFICE_CHAIR_BLACK'
  | 'BED_DOUBLE'
  | 'BED_SINGLE'
  | 'SEDAN_CAR_BLUE'
  | 'MILITARY_CRATE'
  | 'KITCHEN_SINK'
  | 'STOVE_COOKTOP'
  | 'TRASH_CAN_METAL'
  | 'CAST_IRON_PAN'
  | 'PROPANE_TANK'
  | 'FIRE_EXTINGUISHER'
  | 'WATER_BUCKET'
  | 'TOASTER'
  | 'COFFEE_CARAFE'
  | 'FRUIT_BOWL'
  | 'DOORMAT_DARK'
  | 'BATH_SINK'
  | 'TOILET_BOWL'
  | 'SHOWER_STALL'
  | 'FRIDGE_UNIT'
  | 'WASHING_MACHINE'
  | 'DISHWASHER_UNIT'
  | 'STONE_STAIRS'
  | 'WOOD_CRATE_X'
  | 'WOOD_BARREL'
  | 'FLOOR_GRATE'
  | 'STREET_TREE'
  | 'SEDAN_CAR_AMBER';

export interface FurnitureItem {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  blocksSight: boolean;
  blocksMovement: boolean;
  spriteId?: BattlemapSpriteId;
  rotation?: number;
  zLayer?: 'FLOOR' | 'BASE' | 'SURFACE';
  isRandomProp?: boolean;
  isDestroyed?: boolean;
  hp?: number;
  maxHp?: number;
}

export interface WallSconceLight {
  id: string;
  x: number;
  y: number;
  normalAngle: number;
  color: string;
  coreColor: string;
  radius: number;
  style: 'WARM_SCONCE' | 'EMERGENCY_LED' | 'EXTERIOR_LANTERN';
  flickerSpeed?: number;
  isDestroyed?: boolean;
  /** undefined/true = encendida; false = apagada desde el interruptor. */
  isOn?: boolean;
}

export interface LightSwitchEntity {
  id: string;
  /** Lámpara principal, para compatibilidad y para el estado visual. */
  sconceId: string;
  /** Lámparas de la misma estancia que acciona este interruptor. */
  sconceIds?: string[];
  x: number;
  y: number;
  /** Normal del muro, orientada hacia el interior de la estancia. */
  normalAngle?: number;
}

export interface RoomZone {
  id: string;
  nameDe: string;
  nameEs: string;
  x: number;
  y: number;
  w: number;
  h: number;
  floorColor: string;
  cleared: boolean;
}

export type ActorRole = 'PLAYER' | 'SQUAD' | 'SUSPECT' | 'HOSTAGE' | 'CIVILIAN';

export type SuspectState =
  | 'UNAWARE'
  | 'ALERTED'
  | 'HESITATING'
  | 'AIMING_WINDUP'
  | 'FIRING'
  | 'FEIGNING_SURRENDER'
  | 'USING_HUMAN_SHIELD'
  | 'BARGAINING'
  | 'SUPPRESSED_COVER'
  | 'SURRENDERED'
  | 'PANIC'
  | 'FLEEING'
  | 'ARRESTED'
  | 'INCAPACITATED'
  | 'DEAD';

export type AlertLevel = 'CALM' | 'READY' | 'COMBAT';

export type HitZone = 'TORSO' | 'ARMS' | 'LEGS';

export interface BodyPartHealth {
  torso: number; // 0..100 - Core vitality, protected by plate carrier
  arms: number; // 0..100 - Affects weapon spread, recoil, and laser/aim sway
  legs: number; // 0..100 - Affects movement speed (limping when damaged)
  bleeding: boolean; // Active untreated hemorrhage causing progressive vision instability & HP loss
  woundsCount: number; // Number of untreated ballistic wounds
  lastHitZone?: HitZone;
}

export interface ActorEntity {
  id: string;
  name: string;
  role: ActorRole;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed?: number;
  animFrame?: number;
  animTimer?: number;
  alertLevel?: AlertLevel;
  recoilTimer?: number;
  hitReactionTimer?: number;
  hitFlashTimer?: number;
  commandNodTimer?: number;
  gestureTimer?: number;
  gestureKind?: 'ADVANCE' | 'HALT' | 'BREACH' | 'SECURE' | 'POINT';
  isCrouched?: boolean;
  isProne?: boolean;
  hitAngle?: number;
  lastHitType?: 'BLOOD' | 'ARMOR' | 'TASER';
  angle: number;
  radius: number;
  hp: number;
  maxHp: number;
  bodyHealth?: BodyPartHealth;
  morale: number;
  stress: number;
  state: SuspectState;
  weaponLabel?: string;
  isArmed: boolean;
  hasPointedWeaponAtPolice: boolean;
  windupProgress: number;
  stunTimer: number;
  shoutReactionTimer: number;
  feignTimer: number;
  inCSGas?: boolean;
  csGasExposure?: number;
  interrogated?: boolean;
  roomName: string;
  visibleToPlayer: boolean;
  visibleToSquad?: boolean;
  spottedByMirror: boolean;
  spottedByThermal?: boolean;
  biometricScanProgress?: number;
  identifiedByRadio?: boolean;
  identifiedCameraSource?: string;
  biometricProfile?: {
    ekisCode: string;
    warrantStatus: string;
    threatLevel: 'EXTREMO' | 'CRÍTICO' | 'ALTO' | 'PROTECCIÓN';
    facialMatchPct: number;
    dossierNote: string;
  };
  inCover?: boolean;
  coverPos?: Vec2;
  coverWaitTimer?: number;
  peekTimer?: number;
  targetFacingAngle?: number;
  burstCount?: number;
  burstTimer?: number;
  isCompliant?: boolean;
  complianceTimer?: number;
  tacticalOverwatchAngle?: number;
  speechBubble?: {
    text: string;
    timer: number;
    type: 'COMMAND' | 'HOSTILE' | 'SURRENDER' | 'PANIC';
  };
  investigateTarget?: Vec2;
  investigateTimer?: number;
  footstepAudioTimer?: number;
  evidenceSecured?: boolean;
  patrolRoute?: Vec2[];
  patrolIndex?: number;
  patrolWaitTimer?: number;
  patrolBaseAngle?: number;
  patrolSweepDir?: number;
  suspicionMeter?: number; // 0..100
  suspicionState?: 'CALM' | 'SUSPICIOUS' | 'INVESTIGATING' | 'ALERTED';
  lastHeardNoiseDesc?: string;
  humanShieldHostageId?: string;
  isShieldedByHostage?: boolean;
  negotiationProgress?: number; // 0..100
  blindFireTimer?: number;
  feignTrapTriggered?: boolean;
}

export type StationAlertLevel = 'CALM' | 'SUSPICIOUS' | 'ALERTED' | 'LOCKDOWN';

export interface NoiseEvent {
  id: string;
  x: number;
  y: number;
  dB: number;
  radius: number;
  source: string;
  timer: number;
  maxTimer: number;
  color?: string;
}

export interface StealthDetectionTelemetry {
  visibilityPct: number; // 0..100
  visibilityState: 'HIDDEN' | 'CONCEALED' | 'EXPOSED' | 'DETECTED';
  noiseDb: number; // 0..140
  noiseState: 'SILENT' | 'WHISPER' | 'AUDIBLE' | 'LOUD' | 'CRITICAL';
  stationAlertScore: number; // 0..100
  stationAlertLevel: StationAlertLevel;
  stationAlertTitle: string;
  nearestPatrolDistance: number;
  activeSuspiciousCount: number;
  recentNoiseReason?: string;
  noiseWaveRadius?: number;
}

export interface ROEEvent {
  id: string;
  timestamp: number;
  label: string;
  points: number;
  lawful: boolean;
}

export interface BiometricHudTarget {
  id: string;
  name: string;
  role: ActorRole;
  ekisCode: string;
  warrantStatus: string;
  threatLevel: 'EXTREMO' | 'CRÍTICO' | 'ALTO' | 'PROTECCIÓN';
  facialMatchPct: number;
  dossierNote: string;
  scanProgress: number;
  identifiedByRadio: boolean;
  cameraSource: string;
  isArmed: boolean;
  weaponLabel?: string;
  state: SuspectState;
}

export interface SquadVitalsTelemetry {
  name: string;
  callsign: string;
  health: number;
  maxHealth: number;
  armor: number;
  fatigue: number;
  pulseBpm: number;
  pulseStabilityPct: number;
  movementGait: 'RESTING' | 'WALKING' | 'SPRINTING';
  bodyHealth: BodyPartHealth;
  roomName: string;
  alertLevel: AlertLevel;
  state: SuspectState;
}

export interface OperatorXpTelemetry {
  totalXp: number;
  sessionXp: number;
  level: number;
  rankDe: string;
  rankEs: string;
  xpInLevel: number;
  xpForNextLevel: number;
  progressPct: number;
}

export interface PlayerMissionRank {
  titleDe: string; // e.g. 'Einsatzleiter', 'Hauptkommissar'
  titleEs: string; // e.g. 'Comandante de Operaciones', 'Comisario Principal'
  score: number;
  prevThreshold: number;
  nextThreshold: number;
  progressPct: number;
  stars: number;
  insignia: string;
  color: string;
  badgeCode: string;
  isMaxRank: boolean;
  isDemoted: boolean;
}

export const COBRA_RANK_TIERS = [
  { threshold: 0, next: 300, titleDe: 'Aspirant', titleEs: 'Aspirante Cobra', stars: 1, insignia: '★', badgeCode: 'ASP', color: '#94A3B8' },
  { threshold: 300, next: 700, titleDe: 'Revierinspektor', titleEs: 'Inspector de Asalto', stars: 2, insignia: '★★', badgeCode: 'REV', color: '#38BDF8' },
  { threshold: 700, next: 1200, titleDe: 'Gruppeninspektor', titleEs: 'Jefe de Binomio', stars: 3, insignia: '★★★', badgeCode: 'GRP', color: '#60A5FA' },
  { threshold: 1200, next: 1800, titleDe: 'Abteilungsinspektor', titleEs: 'Inspector Táctico', stars: 4, insignia: '★★★★', badgeCode: 'ABT', color: '#A78BFA' },
  { threshold: 1800, next: 2600, titleDe: 'Hauptkommissar', titleEs: 'Comisario Principal', stars: 5, insignia: '★★★★★', badgeCode: 'HKM', color: '#F59E0B' },
  { threshold: 2600, next: 3600, titleDe: 'Einsatzleiter', titleEs: 'Comandante de Misión', stars: 6, insignia: '✪ MASTER', badgeCode: 'ELT', color: '#10B981' },
];

export function computePlayerMissionRank(score: number): PlayerMissionRank {
  if (score < 0) {
    return {
      titleDe: 'Suspendiert (§7 WVG)',
      titleEs: 'Suspendido por Exceso de Fuerza',
      score,
      prevThreshold: -1000,
      nextThreshold: 0,
      progressPct: Math.max(0, Math.min(100, Math.round(((score + 1000) / 1000) * 100))),
      stars: 0,
      insignia: '⚠',
      badgeCode: 'SUS',
      color: '#EF4444',
      isMaxRank: false,
      isDemoted: true,
    };
  }

  for (let i = COBRA_RANK_TIERS.length - 1; i >= 0; i--) {
    const tier = COBRA_RANK_TIERS[i];
    if (score >= tier.threshold) {
      const isMax = i === COBRA_RANK_TIERS.length - 1;
      const span = tier.next - tier.threshold;
      const progress = isMax ? 100 : Math.min(100, Math.max(0, Math.round(((score - tier.threshold) / span) * 100)));
      return {
        titleDe: tier.titleDe,
        titleEs: tier.titleEs,
        score,
        prevThreshold: tier.threshold,
        nextThreshold: tier.next,
        progressPct: progress,
        stars: tier.stars,
        insignia: tier.insignia,
        badgeCode: tier.badgeCode,
        color: tier.color,
        isMaxRank: isMax,
        isDemoted: false,
      };
    }
  }

  return {
    titleDe: 'Aspirant',
    titleEs: 'Aspirante Cobra',
    score,
    prevThreshold: 0,
    nextThreshold: 300,
    progressPct: Math.min(100, Math.max(0, Math.round((score / 300) * 100))),
    stars: 1,
    insignia: '★',
    badgeCode: 'ASP',
    color: '#94A3B8',
    isMaxRank: false,
    isDemoted: false,
  };
}

export interface TacticalMapContact {
  id: string;
  name: string;
  role: ActorRole;
  x: number;
  y: number;
  angle: number;
  state: SuspectState;
  roomName: string;
  isKnown: boolean;
  identifiedByRadio: boolean;
  isArmed: boolean;
  weaponLabel?: string;
  ekisCode?: string;
  warrantStatus?: string;
}

export interface TacticalPadData {
  rooms: {
    id: string;
    nameDe: string;
    nameEs: string;
    x: number;
    y: number;
    w: number;
    h: number;
    cleared: boolean;
    hasPlayer: boolean;
    hasSquad: boolean;
    knownHostiles: number;
    knownHostages: number;
  }[];
  doors: {
    id: string;
    name: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    isOpen: boolean;
    isLocked: boolean;
    isBreached: boolean;
    isDestroyed: boolean;
  }[];
  exteriorWindows: {
    id: string;
    label: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    isBreached: boolean;
  }[];
  contacts: TacticalMapContact[];
  evidence: {
    id: string;
    label: string;
    x: number;
    y: number;
    secured: boolean;
  }[];
  waypoint?: {
    x: number;
    y: number;
    label: string;
  };
  markers: TacticalMapMarker[];
}

export interface SecondaryObjective {
  id: string;
  title: string;
  description: string;
  roomName: string;
  x: number;
  y: number;
  discovered: boolean;
  completed: boolean;
  rewardXp: number;
}

export type CriticalEventType =
  | 'SHOT_FIRED'
  | 'SUSPECT_SURRENDER'
  | 'SUSPECT_ARRESTED'
  | 'SUSPECT_INCAPACITATED'
  | 'HOSTAGE_RESCUED'
  | 'ROE_VIOLATION'
  | 'ROE_REWARD'
  | 'DOOR_BREACH'
  | 'EVIDENCE_SECURED'
  | 'RELOAD'
  | 'HUMAN_SHIELD_TAKEN'
  | 'NEGOTIATION_SUCCESS'
  | 'NEGOTIATION_FAILED'
  | 'COUNTER_ATTACK_TRAP';

export interface CriticalEventLogEntry {
  id: string;
  timeStr: string;
  elapsedSeconds: number;
  type: CriticalEventType;
  title: string;
  location: string;
  actorName?: string;
  pointsDelta?: number;
  lawful?: boolean;
  severity: 'INFO' | 'SUCCESS' | 'WARN' | 'VIOLATION';
  details: string;
}

export interface ActiveC4Charge {
  id: string;
  targetName: string;
  x: number;
  y: number;
  /** Tiempo restante de la espoleta; 0 mientras espera la orden de despeje. */
  remainingSeconds: number;
  maxSeconds: number;
  doorId?: string;
  windowId?: string;
  isWindow: boolean;
  phase: 'ARMED' | 'DETONATING';
  /** El motor calcula este valor para la HUD al emitir el snapshot. */
  safeToDetonate: boolean;
}

export interface RadioFeedItem {
  id: string;
  speaker: string;
  text: string;
  time: string;
  tone: 'info' | 'warn' | 'alert' | 'ok';
  hasStaticBurst?: boolean;
  /** Mensaje rutinario: se registra en el feed, pero no se locuta. */
  silent?: boolean;
}

export interface HudSnapshot {
  activeC4Charges?: ActiveC4Charge[];
  c4Planting?: {
    targetName: string;
    progressPct: number;
    executionTime: string;
  };
  profileName: string;
  health: number;
  armor: number;
  bodyHealth: BodyPartHealth;
  ifakCount: number;
  aimZoneMode: 'TORSO' | 'EXTREMITIES';
  moveSpeedPct: number;
  accuracyPct: number;
  visionStabilityPct: number;
  fatigue: number;
  pulseBpm: number;
  pulseStabilityPct: number;
  movementGait: 'RESTING' | 'WALKING' | 'SPRINTING';
  sprintMode: boolean;
  focusedAimActive?: boolean;
  inCover: boolean;
  squadVitals: SquadVitalsTelemetry;
  xpTelemetry: OperatorXpTelemetry;
  tacticalPad: TacticalPadData;
  activeTool: 'PRIMARY' | 'TASER' | 'GADGET';
  grenadeAimingActive?: boolean;
  primaryName: string;
  attachmentName: string;
  attachmentId: WeaponAttachmentId;
  ammoTypeName: string;
  ammoTypeId: AmmoTypeId;
  ammoInMag: number;
  magCount: number;
  taserCharges: number;
  inspectionName: string;
  inspectionId: InspectionDeviceId;
  gadgetName: string;
  gadgetCount: number;
  c4Count: number;
  squadStatus: string;
  squadCommand: SquadCommand;
  suspectsSecured: number;
  suspectsTotal: number;
  hostagesSecured: number;
  hostagesTotal: number;
  evidenceSecured: number;
  evidenceTotal: number;
  identifiedCount: number;
  identifiableTotal: number;
  activeBiometricTarget?: BiometricHudTarget;
  score: number;
  playerMissionRank: PlayerMissionRank;
  roeViolations: number;
  elapsedSeconds: number;
  contextPrompt: string | null;
  mirrorActive: boolean;
  thermalPaletteMode?: 'WHITE_HOT' | 'BLACK_HOT' | 'IRONBOW';
  flashlightOn: boolean;
  nvgActive: boolean;
  nvgKeyCode: string;
  playerStance: 'PARADO' | 'AGACHADO';
  playerHiddenInShadow: boolean;
  darknessTimerPct: number;
  breachAction?: {
    mode: 'KICK' | 'RAM' | 'C4';
    name: string;
    progressPct: number;
    executionTime: string;
    noiseLevel: string;
    stunRisk: string;
  };
  reloadProgress?: {
    isReloading: boolean;
    progressPct: number;
    durationSec: number;
  };
  dangerState?: {
    active: boolean;
    reason: string;
    severity: 'WARN' | 'CRITICAL';
    flashTimerPct: number;
  };
  currentRoom: string;
  playerHeadingDeg: number;
  radioTransmitting?: boolean;
  radioStaticActive?: boolean;
  radioFeed: RadioFeedItem[];
  roeEvents: ROEEvent[];
  criticalEvents: CriticalEventLogEntry[];
  secondaryObjectives: SecondaryObjective[];
  isTrainingMode?: boolean;
  trainingTelemetry?: {
    shotsFired: number;
    targetsHit: number;
    accuracyPct: number;
    currentCaliber: string;
    currentRpm: number;
    currentDamage: number;
    currentSpread: number;
    currentShake: number;
    peakRecordedShake: number;
    lastHitEnergyJoules?: number;
    lastHitZone?: string;
    lastTargetType?: string;
  };
  missionMode: 'APARTMENT' | 'STATION' | 'LINZ' | 'TIROL' | 'SCHWECHAT' | 'TRAINING';
  stealthDetection: StealthDetectionTelemetry;
  missionResult?: {
    outcome: 'VICTORY' | 'ROE_TERMINATED' | 'KIA' | 'HOSTAGE_LOST';
    grade: 'S' | 'A' | 'B' | 'C' | 'F';
    title: string;
    subtitle: string;
  };
}



