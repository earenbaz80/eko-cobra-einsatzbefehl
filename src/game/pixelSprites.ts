import { ActorEntity, AlertLevel, PrimaryWeaponId } from './types';

// Multi-Frame Pixel Art Sprite Sheet Engine for EKO COBRA - EINSATZBEFEHL
// Supports 4-frame walk/stance cycles driven by movement velocity and alert state (CALM | READY | COMBAT)

let ekoSpriteImage: HTMLImageElement | null = null;
let ekoSpriteLoaded = false;

function getEkoSpriteImage(): HTMLImageElement | null {
  if (typeof window === 'undefined') return null;
  if (!ekoSpriteImage) {
    const img = new Image();
    img.src = `${import.meta.env.BASE_URL}assets/aistudio/BLOQUE1_EKO_agente_8dir_15b5068c.png`;
    img.onload = () => {
      ekoSpriteLoaded = true;
    };
    ekoSpriteImage = img;
  }
  if (ekoSpriteLoaded || (ekoSpriteImage && ekoSpriteImage.complete && ekoSpriteImage.naturalWidth > 0)) {
    return ekoSpriteImage;
  }
  return null;
}

// 8-Direction Frame Map for the original EKO Cobra operator sprite sheet
// (4 cols x 2 rows, 560x560 per frame)
// Row 0: Col 0 = South (Down), Col 1 = West (Left), Col 2 = East (Right), Col 3 = North (Up)
// Row 1: Col 0 = South-West, Col 1 = South-East, Col 2 = North-West, Col 3 = North-East
const EKO_8DIR_FRAMES: Record<number, { row: number; col: number; baseAngle: number }> = {
  0: { row: 0, col: 2, baseAngle: 0 },                  // East (0 rad) -> gun pointing Right
  1: { row: 1, col: 1, baseAngle: Math.PI / 4 },        // South-East (45 deg) -> gun pointing Down-Right
  2: { row: 0, col: 0, baseAngle: Math.PI / 2 },        // South (90 deg) -> gun pointing Down
  3: { row: 1, col: 0, baseAngle: (3 * Math.PI) / 4 },  // South-West (135 deg) -> gun pointing Down-Left
  4: { row: 0, col: 1, baseAngle: Math.PI },            // West (180 deg) -> gun pointing Left
  5: { row: 1, col: 2, baseAngle: (5 * Math.PI) / 4 },  // North-West (225 deg) -> gun pointing Up-Left
  6: { row: 0, col: 3, baseAngle: (3 * Math.PI) / 2 },  // North (270 deg) -> gun pointing Up
  7: { row: 1, col: 3, baseAngle: (7 * Math.PI) / 4 },  // North-East (315 deg) -> gun pointing Up-Right
};

type PaletteMap = Record<string, string>;

const PALETTE: PaletteMap = {
  '.': 'transparent',
  '#': '#06090E', // Crisp dark pixel outline
  // EKO Cobra Operator Colors
  'H': '#1E293B', // Ops-Core Helmet base (Anthracite Slate)
  'h': '#334155', // Helmet top highlight
  'N': '#0F172A', // NVG mount / visor rim
  'G': '#10B981', // Night vision / READY state tactical optic green
  'O': '#F59E0B', // COMBAT alert visor / active strobe amber
  'F': '#FEF08A', // Muzzle flash / firing pixel spark
  'U': '#27303F', // EKO Cobra Uniform Grey-Black shoulders
  'u': '#1B222D', // Uniform shadow
  'V': '#0F141C', // Tactical Plate Carrier Vest
  'P': '#F8FAFC', // White 'POLIZEI' chest/back pixel patch
  'B': '#0284C7', // Kobra-1 Blue Identifier Patch
  'b': '#38BDF8', // Kobra-2 Cyan Identifier Patch
  'S': '#D6A78A', // Skin tone
  's': '#B58366', // Skin shadow
  // Weapons & Gear
  'W': '#475569', // Gunmetal barrel/receiver
  'w': '#94A3B8', // Metallic highlight / Shield viewport
  'A': '#3F4A3C', // Steyr AUG Olive/Black polymer stock
  'T': '#FACC15', // Taser X2 Yellow housing
  'L': '#EF4444', // Hostile Red accent / Combat laser emitter
  // Suspects & Hostages clothing
  'M': '#7F1D1D', // Markus K. dark crimson jacket
  'm': '#991B1B', // Markus highlight
  'C': '#365314', // Milan V. olive jacket
  'c': '#4D7C0F', // Milan highlight
  'K': '#374151', // Lukas K. grey hoodie
  'k': '#4B5563', // Lukas highlight
  'J': '#0369A1', // Julia M. (Hostage) sweater blue
  'j': '#38BDF8', // Julia highlight
  'Z': '#701A75', // Hanna S. (Civilian) plum cardigan
  'z': '#A21CAF', // Hanna highlight
  'D': '#92400E', // Brown hair
  'd': '#1F2937', // Dark hair
  'Y': '#FDE047', // Blonde hair / Cuffs gold
  'E': '#34D399', // Optic Sonar Green
};

// Base 16x16 grids for Kobra Operators with Alert State & Frame variations
function buildKobraGrid(
  weaponType: 'AUG' | 'MP7' | 'SHIELD' | 'TASER',
  isSquadmate: boolean,
  alertLevel: AlertLevel,
  frame: number,
  isFiring: boolean
): string[] {
  const patch = isSquadmate ? 'b' : 'B';
  // Alert state changes visor/laser pixel: CALM = 'N', READY = 'G' (emerald NVG), COMBAT = 'O' (amber combat strobe)
  const optic = alertLevel === 'COMBAT' ? 'O' : alertLevel === 'READY' ? 'G' : 'N';
  // Frame 0..3 shifts shoulder/arm stance slightly for dynamic CQB movement
  const leftShoulderShift = frame === 1 ? 'u' : 'U';
  const rightShoulderShift = frame === 3 ? 'u' : 'U';

  if (weaponType === 'SHIELD') {
    return [
      '....#####...###.',
      `...#${leftShoulderShift}UUUU#.#wV#.`,
      '..#UU###UU##wV#.',
      '..#U#VVV#UU#wV#.',
      '.#U#VhhhV###wV#.',
      `.#U#hHHHh${optic}.#wV#.`,
      `.#U#hH${patch}${patch}h${optic}.#wV#.`,
      `.#U#hHHHh${optic}.#wV#.`,
      '.#U#VhhhV#S#wV#.',
      isFiring ? '.#U#VVPVV#WWWWF.' : '.#U#VVPVV#WWWW#.',
      '..#U#VVV#U##wV#.',
      '..#UU###UU##wV#.',
      `...#${rightShoulderShift}UUUU#.#wV#.`,
      '....#####...###.',
      '................',
      '................',
    ];
  }

  if (weaponType === 'TASER') {
    return [
      '....#####.......',
      `...#${leftShoulderShift}UUUU#......`,
      '..#UU###UU#.....',
      '..#U#VVV#U#.....',
      '.#U#VhhhV#U#....',
      '.#U#hHHHh#S#....',
      `.#U#hH${patch}${patch}h${optic}#TTT#.`,
      isFiring ? `.#U#hHHHh${optic}#TTTF.` : `.#U#hHHHh${optic}#TTTG.`,
      '.#U#VhhhV#S####.',
      '.#U#VVPVV#......',
      '..#U#VVV#U#.....',
      '..#UU###UU#.....',
      `...#${rightShoulderShift}UUUU#......`,
      '....#####.......',
      '................',
      '................',
    ];
  }

  if (weaponType === 'MP7') {
    // Low-ready when CALM, shouldered high-ready when READY or COMBAT
    const barrelRow = isFiring ? `.#U#hHHHh${optic}#WWWWF` : `.#U#hHHHh${optic}#WWWW.`;
    return [
      '....#####.......',
      `...#${leftShoulderShift}UUUU#......`,
      '..#UU###UU#.....',
      '..#U#VVV#U##....',
      '.#U#VhhhV#UU#...',
      '.#U#hHHHh####...',
      `.#U#hH${patch}${patch}h${optic}#WW#..`,
      barrelRow,
      '.#U#VhhhV#S##...',
      '.#U#VVPVV#......',
      '..#U#VVV#U#.....',
      '..#UU###UU#.....',
      `...#${rightShoulderShift}UUUU#......`,
      '....#####.......',
      '................',
      '................',
    ];
  }

  // Default: Steyr AUG A3 / AUG Para
  // In COMBAT or READY, rifle is shouldered tight; when firing, muzzle spark 'F' appears
  const augBarrel = isFiring
    ? `.#U#hHHHh${optic}#AAWWF`
    : alertLevel === 'CALM'
      ? `.#U#hHHHh${optic}#AAWW.`
      : `.#U#hHHHh${optic}#AAWWW`;

  return [
    '....#####.......',
    `...#${leftShoulderShift}UUUU#......`,
    '..#UU###UU#.....',
    '..#U#VVV#U##....',
    '.#U#VhhhV#UU#...',
    '.#U#hHHHh####...',
    `.#U#hH${patch}${patch}h${optic}#AA###`,
    augBarrel,
    '.#U#VhhhV#S#W###',
    '.#U#VVPVV#S#....',
    '..#U#VVV#U#.....',
    '..#UU###UU#.....',
    `...#${rightShoulderShift}UUUU#......`,
    '....#####.......',
    '................',
    '................',
  ];
}

// Suspect Armed (with CALM patrol stance vs READY/COMBAT aiming stance)
function buildSuspectArmedGrid(
  coatMain: string,
  coatHi: string,
  hair: string,
  alertLevel: AlertLevel,
  frame: number
): string[] {
  const sL = frame === 1 ? coatHi : coatMain;
  const sR = frame === 3 ? coatHi : coatMain;
  // When suspect is in COMBAT (AIMING_WINDUP / FIRING), arms extend forward with red laser pixel 'L'
  const weaponRow1 =
    alertLevel === 'COMBAT' ? '.#${M}#${H}${H}${H}SS#SWWWL.' : '.#${M}#${H}${H}${H}SS#SWWW#.';
  const weaponRow2 =
    alertLevel === 'COMBAT' ? '.#${M}#${H}${H}${H}SS#SWWW#.' : '.#${M}#${H}${H}${H}SS#SWW##.';

  return [
    '....#####.......',
    `...#${sL}\${M}\${M}\${M}\${M}#......`,
    '..#${M}${m}###${m}${M}#.....',
    '..#${M}#${H}${H}${H}#${M}#.....',
    '.#${M}#${H}${H}${H}S#${M}##....',
    '.#${M}#${H}${H}${H}SS#${M}S#...',
    weaponRow1,
    weaponRow2,
    '.#${M}#${H}${H}${H}S#${M}S##...',
    '..#${M}#${H}${H}${H}#${M}#.....',
    '..#${M}${m}###${m}${M}#.....',
    `...#${sR}\${M}\${M}\${M}\${M}#......`,
    '....#####.......',
    '................',
    '................',
    '................',
  ].map((row) =>
    row
      .replace(/\$\{M\}/g, coatMain)
      .replace(/\$\{m\}/g, coatHi)
      .replace(/\$\{H\}/g, hair)
  );
}

// Surrendered / Hands Up Pose (4-frame trembling/breathing hands animation)
function buildSurrenderedGrid(
  coatMain: string,
  coatHi: string,
  hair: string,
  frame: number
): string[] {
  const handOffset = frame % 2 === 0 ? '......#SSS#.....' : '.....#SSS#......';
  return [
    '.......###......',
    handOffset,
    '....###S#S###...',
    '...#${M}${M}${m}${M}${M}#......',
    '..#${M}#${H}${H}${H}#${M}#.....',
    '..#${M}#${H}${H}${H}S#${M}#....',
    '..#${M}#${H}${H}${H}SS#${M}#....',
    '..#${M}#${H}${H}${H}SS#${M}#....',
    '..#${M}#${H}${H}${H}S#${M}#....',
    '..#${M}#${H}${H}${H}#${M}#.....',
    '...#${M}${M}${m}${M}${M}#......',
    '....###S#S###...',
    handOffset,
    '.......###......',
    '................',
    '................',
  ].map((row) =>
    row
      .replace(/\$\{M\}/g, coatMain)
      .replace(/\$\{m\}/g, coatHi)
      .replace(/\$\{H\}/g, hair)
  );
}

// Arrested / Cuffed Pose (Hands behind back with yellow zip-tie pixels)
function buildArrestedGrid(coatMain: string, coatHi: string, hair: string): string[] {
  return [
    '................',
    '....#####.......',
    '...#${M}${M}${m}${M}#.......',
    '..#S#${H}${H}${H}#${M}#.....',
    '.#SY#${H}${H}${H}S#${M}#....',
    '.#SY#${H}${H}${H}SS#${M}#...',
    '.#SY#${H}${H}${H}SS#${M}#...',
    '.#S##${H}${H}${H}S#${M}#....',
    '..#${M}#${H}${H}${H}#${M}#.....',
    '...#${M}${M}${m}${M}#.......',
    '....#####.......',
    '................',
    '................',
    '................',
    '................',
    '................',
  ].map((row) =>
    row
      .replace(/\$\{M\}/g, coatMain)
      .replace(/\$\{m\}/g, coatHi)
      .replace(/\$\{H\}/g, hair)
  );
}

// Night-Vision Optic Sonar & FLIR Thermal Heat-Map Silhouette Sprites
function buildSonarSpriteGrid(isHostile: boolean, isThermal: boolean): string[] {
  if (isThermal) {
    // Thermal signature: outer magenta/purple 'z', warm orange 'O', hot yellow/white core 'F'
    const rim = isHostile ? 'L' : 'z';
    const mid = 'O';
    const core = 'F';
    return [
      '....#####.......',
      `...#${rim}${rim}${rim}${rim}${rim}#......`,
      `..#${rim}${mid}${mid}${mid}${mid}${mid}#.....`,
      `..#${rim}${mid}${core}${core}${core}${mid}#.....`,
      `.#${rim}${mid}${core}${core}${core}${core}${mid}#....`,
      `.#${rim}${mid}${core}${core}${core}${core}${mid}##...`,
      `.#${rim}${mid}${core}${core}${core}${core}${mid}${mid}${mid}#..`,
      `.#${rim}${mid}${core}${core}${core}${core}${mid}${mid}${mid}#..`,
      `.#${rim}${mid}${core}${core}${core}${core}${mid}##...`,
      `..#${rim}${mid}${core}${core}${core}${mid}#.....`,
      `..#${rim}${mid}${mid}${mid}${mid}${mid}#.....`,
      `...#${rim}${rim}${rim}${rim}${rim}#......`,
      '....#####.......',
      '................',
      '................',
      '................',
    ];
  }

  const c = isHostile ? 'L' : 'E';
  return [
    '....#####.......',
    `...#${c}${c}${c}${c}${c}#......`,
    `..#${c}#...#${c}#.....`,
    `..#${c}#.${c}.#${c}#.....`,
    `.#${c}#..${c}..#${c}#....`,
    `.#${c}#.${c}${c}${c}.#${c}#....`,
    `.#${c}#..${c}..#${c}###..`,
    `.#${c}#.....#${c}${c}${c}#..`,
    `.#${c}#..${c}..#${c}#....`,
    `..#${c}#.${c}.#${c}#.....`,
    `..#${c}#...#${c}#.....`,
    `...#${c}${c}${c}${c}${c}#......`,
    '....#####.......',
    '................',
    '................',
    '................',
  ];
}

const spriteCache = new Map<string, HTMLCanvasElement>();

function getCachedGridCanvas(key: string, grid: string[]): HTMLCanvasElement {
  const existing = spriteCache.get(key);
  if (existing) return existing;

  const size = 16;
  const scale = 2; // 32x32 crisp pixel canvas
  const off = document.createElement('canvas');
  off.width = size * scale;
  off.height = size * scale;
  const octx = off.getContext('2d');
  if (octx) {
    octx.imageSmoothingEnabled = false;
    for (let y = 0; y < grid.length; y++) {
      const row = grid[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        const color = PALETTE[ch];
        if (color && color !== 'transparent') {
          octx.fillStyle = color;
          octx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }
  }
  spriteCache.set(key, off);
  return off;
}

export function drawPixelArtSonarActor(
  ctx: CanvasRenderingContext2D,
  actor: ActorEntity,
  pulseTime: number,
  isThermal: boolean = false
) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const isHostile = actor.role === 'SUSPECT';
  const grid = buildSonarSpriteGrid(isHostile, isThermal);
  const sprite = getCachedGridCanvas(
    `SONAR_${isThermal ? 'FLIR' : 'OPTIC'}_${isHostile ? 'H' : 'C'}`,
    grid
  );

  ctx.save();
  ctx.rotate(actor.angle);
  ctx.globalAlpha = 0.78 + Math.sin(pulseTime * 6) * 0.18;
  ctx.drawImage(sprite, -16, -16, 32, 32);
  ctx.restore();

  ctx.fillStyle = isThermal ? (isHostile ? '#FDBA74' : '#FDE047') : isHostile ? '#FCA5A5' : '#A7F3D0';
  ctx.font = '600 9px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  const tag = isThermal
    ? isHostile
      ? 'FLIR 37.8°C · TÄTER'
      : 'FLIR 36.9°C · GEISEL'
    : isHostile
      ? 'SONDE: TÄTER'
      : 'SONDE: GEISEL';
  ctx.fillText(tag, 0, -20);
  ctx.restore();
}

export function drawPixelArtActor(
  ctx: CanvasRenderingContext2D,
  actor: ActorEntity,
  primaryWeapon: PrimaryWeaponId,
  activeTool: 'PRIMARY' | 'TASER' | 'GADGET',
  elapsedTime: number
) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  const speed = actor.speed ?? 0;
  const frame = (actor.animFrame ?? 0) % 4;
  const alertLevel: AlertLevel = actor.alertLevel ?? 'READY';
  const isFiring = (actor.recoilTimer ?? 0) > 0;

  // 1. Pixel-art drop shadow under operator/suspect
  ctx.fillStyle = 'rgba(4, 7, 12, 0.58)';
  ctx.fillRect(-12, -10, 24, 20);

  // 2. Multi-Frame Animated Pixel Boots (4-frame walk cycle scaled by movement velocity)
  if (actor.state !== 'DEAD' && actor.state !== 'ARRESTED') {
    const isMoving = speed > 6;
    // Frame 0: neutral, Frame 1: left forward / right back, Frame 2: neutral, Frame 3: right forward / left back
    let leftOffset = 0;
    let rightOffset = 0;
    if (isMoving) {
      if (frame === 1) {
        leftOffset = 5;
        rightOffset = -5;
      } else if (frame === 3) {
        leftOffset = -5;
        rightOffset = 5;
      } else if (frame === 2) {
        leftOffset = 2;
        rightOffset = -2;
      }
    } else if (alertLevel === 'COMBAT') {
      // Wide combat stance when stationary in combat alert state
      leftOffset = 3;
      rightOffset = -3;
    }

    ctx.fillStyle = '#06090E';
    ctx.fillRect(-4 + leftOffset, -11, 6, 4);
    ctx.fillRect(-4 + rightOffset, 7, 6, 4);
  }

  // 3. Select 16x16 pixel sprite frame based on Role, Weapon, AlertLevel, and Frame index
  let spriteKey = '';
  let grid: string[] = [];

  if (actor.role === 'PLAYER' || actor.role === 'SQUAD') {
    const ekoImg = getEkoSpriteImage();
    if (ekoImg) {
      const normAngle = (actor.angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const dirIndex = Math.floor(((normAngle + Math.PI / 8) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
      const frameData = EKO_8DIR_FRAMES[dirIndex] || { row: 0, col: 2, baseAngle: 0 };
      const sw = 560;
      const sh = 560;
      const sx = frameData.col * sw;
      const sy = frameData.row * sh;
      const baseAngle = frameData.baseAngle;

      // Micro-angle rotation so the weapon barrel precisely matches actor.angle at 360 degrees
      let deltaAngle = actor.angle - baseAngle;
      while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
      while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
      ctx.rotate(deltaAngle);

      if (actor.state === 'DEAD') {
        ctx.globalAlpha = 0.65;
      }

      // Dynamic leg-trauma limp tilt
      const bh = actor.bodyHealth;
      if (bh && bh.legs < 75 && speed > 5 && actor.state !== 'DEAD' && actor.state !== 'ARRESTED') {
        const limpSeverity = (75 - bh.legs) / 75;
        const limpTilt = Math.sin(elapsedTime * 11) * (0.14 + limpSeverity * 0.18);
        ctx.rotate(limpTilt);
      }

      // Ballistic hit reaction
      const hitTimer = actor.hitReactionTimer ?? 0;
      if (hitTimer > 0) {
        const hitNorm = Math.min(1, hitTimer / 0.28);
        const relHitAngle = (actor.hitAngle ?? actor.angle) - actor.angle;
        const joltMag = Math.sin(hitNorm * Math.PI) * 6.5;
        const hitJoltX = Math.cos(relHitAngle) * joltMag;
        const hitJoltY = Math.sin(relHitAngle) * joltMag;
        const flinchRot = Math.sin(hitNorm * Math.PI * 3) * 0.26 * hitNorm;
        ctx.translate(hitJoltX, hitJoltY);
        ctx.rotate(flinchRot);
        const squash = Math.sin(hitNorm * Math.PI) * 0.16;
        ctx.scale(1 - squash, 1 + squash * 0.85);
      }

      // Subtle breathing idle animation
      if (actor.state !== 'DEAD' && actor.state !== 'ARRESTED') {
        const breathCycle = Math.sin(elapsedTime * 2.5) * 0.035;
        ctx.scale(1 + breathCycle * 0.5, 1 + breathCycle);
      }

      const recoilShift = isFiring ? -3 : 0;
      const size = 52;
      ctx.drawImage(ekoImg, sx, sy, sw, sh, -size / 2 + recoilShift, -size / 2, size, size);

      // Distinct Call-sign Patch on Operator Shoulder
      const isSquad = actor.role === 'SQUAD';
      const patchColor = isSquad ? '#38BDF8' : '#0284C7';
      ctx.fillStyle = patchColor;
      ctx.fillRect(-size / 2 + 13, -size / 2 + 12, 4, 3);

      // Dynamic Muzzle Spark when firing
      if (isFiring) {
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(size / 2 - 4, -2, 6, 4);
      }

      // Hit Flash Overlay
      const flashTimer = actor.hitFlashTimer ?? 0;
      if (flashTimer > 0) {
        const flashRatio = Math.min(1, flashTimer / 0.14);
        const hitType = actor.lastHitType ?? 'BLOOD';
        ctx.save();
        const primaryFlash = hitType === 'TASER' ? '#38BDF8' : hitType === 'ARMOR' ? '#FBBF24' : '#EF4444';
        const coreFlash = hitType === 'TASER' ? '#E0F2FE' : hitType === 'ARMOR' ? '#FEF08A' : '#FCA5A5';
        ctx.globalAlpha = Math.min(0.95, flashRatio * 0.95);
        ctx.fillStyle = primaryFlash;
        ctx.fillRect(-10, -2, 20, 4);
        ctx.fillRect(-2, -10, 4, 20);
        ctx.fillRect(-6, -6, 12, 12);
        ctx.fillStyle = coreFlash;
        ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();
      }

      // Tactical Cover Badge
      if (actor.inCover && actor.state !== 'DEAD' && actor.state !== 'ARRESTED') {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.88)';
        ctx.fillRect(-14, -26, 28, 5);
        ctx.fillStyle = '#06090E';
        ctx.font = '700 7px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('🛡️ COBERTURA', 0, -21);
      }

      // Stun Stars
      if (actor.stunTimer > 0 && actor.state !== 'DEAD') {
        const step = Math.floor(elapsedTime * 8) % 2;
        ctx.fillStyle = step === 0 ? '#FACC15' : '#38BDF8';
        ctx.fillRect(-10, -18, 4, 4);
        ctx.fillRect(6, -18, 4, 4);
        ctx.fillRect(-2, 14, 4, 4);
      }

      ctx.restore();
      return;
    }

    // Procedural Fallback if asset is still loading
    ctx.rotate(actor.angle);
    const isSquad = actor.role === 'SQUAD';
    const wType: 'AUG' | 'MP7' | 'SHIELD' | 'TASER' = isSquad
      ? 'MP7'
      : activeTool === 'TASER'
        ? 'TASER'
        : primaryWeapon === 'GLOCK_SHIELD'
          ? 'SHIELD'
          : primaryWeapon === 'MP7A1'
            ? 'MP7'
            : 'AUG';

    spriteKey = `KOBRA_${isSquad ? '2' : '1'}_${wType}_${alertLevel}_F${frame}_${isFiring ? 'FIRE' : 'IDLE'}`;
    grid = buildKobraGrid(wType, isSquad, alertLevel, frame, isFiring);
  } else if (actor.id.startsWith('TARGET_')) {
    // Custom Shooting Range Targets
    if (actor.id.includes('PAPER')) {
      // Paper Silhouette Target
      ctx.fillStyle = '#E2E8F0';
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-15, -20, 30, 40);
      ctx.strokeRect(-15, -20, 30, 40);

      // Dark silhouette torso & head
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(0, -10, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-9, -4, 18, 20);

      // Concentric target score rings
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 5, 4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(0, 5, 8, 0, Math.PI * 2);
      ctx.stroke();
    } else if (actor.id.includes('STEEL') || actor.id.includes('GONG')) {
      // Steel Popper / Gong
      ctx.fillStyle = '#64748B';
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Steel center bullseye
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (actor.id.includes('DUMMY')) {
      // Ballistic Gel Dummy with Level IV Armor
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(0, -12, 6, 0, Math.PI * 2);
      ctx.fill();

      // Ceramic Armor Plate Carrier
      ctx.fillStyle = '#0F172A';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-12, -5, 24, 26);
      ctx.strokeRect(-12, -5, 24, 26);

      ctx.fillStyle = '#38BDF8';
      ctx.font = '700 6px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('NIVEL IV', 0, 10);
    }
    ctx.restore();
    return;
  } else if (actor.role === 'SUSPECT') {
    const isMarkus = actor.id.includes('MARKUS');
    const isMilan = actor.id.includes('MILAN');
    const cMain = isMarkus ? 'M' : isMilan ? 'C' : 'K';
    const cHi = isMarkus ? 'm' : isMilan ? 'c' : 'k';
    const hair = isMarkus ? 'd' : isMilan ? 'D' : 'd';

    if (actor.state === 'ARRESTED') {
      spriteKey = `SUSPECT_ARREST_${actor.id}`;
      grid = buildArrestedGrid(cMain, cHi, hair);
    } else if (
      actor.state === 'SURRENDERED' ||
      actor.state === 'FEIGNING_SURRENDER' ||
      actor.state === 'INCAPACITATED'
    ) {
      spriteKey = `SUSPECT_SURRENDER_${actor.id}_F${frame}`;
      grid = buildSurrenderedGrid(cMain, cHi, hair, frame);
    } else {
      spriteKey = `SUSPECT_ARMED_${actor.id}_${alertLevel}_F${frame}`;
      grid = buildSuspectArmedGrid(cMain, cHi, hair, alertLevel, frame);
    }
  } else {
    // Hostage or Civilian
    const isJulia = actor.id.includes('JULIA');
    const cMain = isJulia ? 'J' : 'Z';
    const cHi = isJulia ? 'j' : 'z';
    const hair = isJulia ? 'Y' : 'D';

    if (actor.state === 'ARRESTED') {
      spriteKey = `CIV_SAFE_${actor.id}`;
      grid = buildArrestedGrid(cMain, cHi, hair);
    } else {
      spriteKey = `CIV_PANIC_${actor.id}_F${frame}`;
      grid = buildSurrenderedGrid(cMain, cHi, hair, frame);
    }
  }

  const spriteCanvas = getCachedGridCanvas(spriteKey, grid);

  if (actor.state === 'DEAD') {
    ctx.globalAlpha = 0.65;
  } else if (actor.isProne) {
    ctx.scale(1.18, 0.72);
  } else if (actor.isCrouched) {
    ctx.scale(0.92, 0.88);
  }

  // Dynamic leg-trauma limp tilt when moving with injured legs
  const bh = actor.bodyHealth;
  if (bh && bh.legs < 75 && speed > 5 && actor.state !== 'DEAD' && actor.state !== 'ARRESTED') {
    const limpSeverity = (75 - bh.legs) / 75;
    const limpTilt = Math.sin(elapsedTime * 11) * (0.14 + limpSeverity * 0.18);
    ctx.rotate(limpTilt);
  }

  // Ballistic Hit Reaction Animation (jolt along bullet vector + torso flinch + squash/stretch)
  const hitTimer = actor.hitReactionTimer ?? 0;
  let hitJoltX = 0;
  let hitJoltY = 0;
  if (hitTimer > 0) {
    const hitNorm = Math.min(1, hitTimer / 0.28); // 1.0 at impact -> 0.0 at end
    const relHitAngle = (actor.hitAngle ?? actor.angle) - actor.angle;
    const joltMag = Math.sin(hitNorm * Math.PI) * 6.5;
    hitJoltX = Math.cos(relHitAngle) * joltMag;
    hitJoltY = Math.sin(relHitAngle) * joltMag;

    // Sharp rotational flinch away from impact
    const flinchRot = Math.sin(hitNorm * Math.PI * 3) * 0.26 * hitNorm;
    ctx.translate(hitJoltX, hitJoltY);
    ctx.rotate(flinchRot);

    // Ballistic impact squash-and-stretch
    const squash = Math.sin(hitNorm * Math.PI) * 0.16;
    ctx.scale(1 - squash, 1 + squash * 0.85);
  }

  // Subtle breathing idle animation (chest expansion pulse) for active living actors
  if (actor.state !== 'DEAD' && actor.state !== 'ARRESTED') {
    const breathCycle = Math.sin(elapsedTime * 2.5) * 0.035;
    ctx.scale(1 + breathCycle * 0.5, 1 + breathCycle);
  }

  // Slight weapon recoil kickback when firing
  const recoilShift = isFiring ? -2.5 : 0;
  ctx.drawImage(spriteCanvas, -24 + recoilShift, -24, 48, 48);

  // 4. High-Detail Tactical & Anatomical Character Overlay (Helmets, Comms, Plate Carriers, Facial Features & Detailed Weapons)
  renderHighDetailCharacterLayers(
    ctx,
    actor,
    primaryWeapon,
    activeTool,
    alertLevel,
    isFiring,
    recoilShift,
    elapsedTime
  );

  // High-contrast pixel-art impact flash & localized wound burst when taking fire
  const flashTimer = actor.hitFlashTimer ?? 0;
  if (flashTimer > 0) {
    const flashRatio = Math.min(1, flashTimer / 0.14);
    const hitType = actor.lastHitType ?? 'BLOOD';
    const hitZone = bh?.lastHitZone ?? 'TORSO';

    // Zone offset in local actor coordinates
    const zoneOffsetX = hitZone === 'ARMS' ? 7 : hitZone === 'LEGS' ? -5 : 0;
    const zoneOffsetY = hitZone === 'ARMS' ? 8 : hitZone === 'LEGS' ? -8 : 0;

    // Pixelated impact flash ring & cross-burst on the struck body part
    ctx.save();
    ctx.translate(zoneOffsetX, zoneOffsetY);

    const primaryFlash =
      hitType === 'TASER'
        ? '#38BDF8'
        : hitType === 'ARMOR'
          ? '#FBBF24'
          : '#EF4444';
    const coreFlash =
      hitType === 'TASER'
        ? '#E0F2FE'
        : hitType === 'ARMOR'
          ? '#FEF08A'
          : '#FCA5A5';

    ctx.globalAlpha = Math.min(0.95, flashRatio * 0.95);
    ctx.fillStyle = primaryFlash;
    ctx.fillRect(-10, -2, 20, 4);
    ctx.fillRect(-2, -10, 4, 20);
    ctx.fillRect(-6, -6, 12, 12);

    ctx.fillStyle = coreFlash;
    ctx.fillRect(-4, -4, 8, 8);

    // Pixel splatter / armor spark droplets around the impact site
    const burstDist = (1 - flashRatio) * 14 + 4;
    ctx.fillStyle = hitType === 'BLOOD' ? '#991B1B' : primaryFlash;
    ctx.fillRect(burstDist, -3, 3, 3);
    ctx.fillRect(-burstDist - 2, 2, 3, 3);
    ctx.fillRect(2, burstDist, 3, 3);
    ctx.fillRect(-3, -burstDist - 2, 3, 3);
    ctx.restore();
  }

  // Tactical Prone & Cover Indicator Badges
  if (actor.isProne && actor.state !== 'DEAD' && actor.state !== 'ARRESTED') {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.88)';
    ctx.fillRect(-18, -22, 36, 5);
    ctx.fillStyle = '#06090E';
    ctx.font = '700 6.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⬇️ AL SUELO', 0, -17.5);
  } else if (actor.inCover && actor.state !== 'DEAD' && actor.state !== 'ARRESTED') {
    ctx.fillStyle = 'rgba(16, 185, 129, 0.88)';
    ctx.fillRect(-14, -22, 28, 5);
    ctx.fillStyle = '#06090E';
    ctx.font = '700 7px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🛡️ COBERTURA', 0, -17);
  }

  // If stunned by Flashbang or Taser, render pixel stun stars above helmet/head
  if (actor.stunTimer > 0 && actor.state !== 'DEAD') {
    const step = Math.floor(elapsedTime * 8) % 2;
    ctx.fillStyle = step === 0 ? '#FACC15' : '#38BDF8';
    ctx.fillRect(-10, -14, 4, 4);
    ctx.fillRect(6, -14, 4, 4);
    ctx.fillRect(-2, 12, 4, 4);
  }

  ctx.restore();
}

/**
 * Renders crisp high-detail character anatomy, tactical gear, MOLLE pouches,
 * Peltor headsets, GPNVG-18 quad nods, facial features, and detailed weaponry
 * in local rotated actor coordinates (+X = forward facing direction).
 */
function renderHighDetailCharacterLayers(
  ctx: CanvasRenderingContext2D,
  actor: ActorEntity,
  primaryWeapon: PrimaryWeaponId,
  activeTool: 'PRIMARY' | 'TASER' | 'GADGET',
  alertLevel: AlertLevel,
  isFiring: boolean,
  recoilShift: number,
  elapsedTime: number
) {
  ctx.save();
  ctx.translate(recoilShift, 0);

  if (actor.role === 'PLAYER' || actor.role === 'SQUAD') {
    const isSquad = actor.role === 'SQUAD';
    const patchColor = isSquad ? '#38BDF8' : '#0284C7';
    const nvgColor =
      alertLevel === 'COMBAT' ? '#F59E0B' : alertLevel === 'READY' ? '#10B981' : '#38BDF8';

    // 1. Rear Hydration / Breaching Pack & Radio Whip Antenna on Back
    ctx.fillStyle = '#0B0F17';
    ctx.fillRect(-13, -7, 5, 14);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(-13, -7, 5, 14);
    // TETRA Radio antenna whip extending slightly back-left
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-11, -6);
    ctx.lineTo(-18, -11);
    ctx.stroke();

    // 2. Shoulder Pads with Austrian EKO Cobra Patch & Callsign Insignia
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(-6, -13, 9, 5);
    ctx.fillRect(-6, 8, 9, 5);
    // Red-White-Red Austrian tactical subdued flag micro-stripe on left shoulder
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(-3, -12.5, 4, 1);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(-3, -11.5, 4, 1);
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(-3, -10.5, 4, 1);
    // Unit callsign color tab on right shoulder
    ctx.fillStyle = patchColor;
    ctx.fillRect(-3, 9.5, 4, 2.5);

    // 3. Mehler Plate Carrier Vest & Spare Magazine MOLLE Pouches
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-7, -8, 12, 16);
    // 3 Front Magazine Pouches
    ctx.fillStyle = '#334155';
    ctx.fillRect(3, -6, 2.5, 3.2);
    ctx.fillRect(3, -1.6, 2.5, 3.2);
    ctx.fillRect(3, 2.8, 2.5, 3.2);

    // 4. Ops-Core FAST Ballistic Helmet with Arc Rails, Velcro Panels & Strobe
    let nodOffsetX = 0;
    let nodRot = 0;
    if (actor.commandNodTimer && actor.commandNodTimer > 0) {
      const nodNorm = actor.commandNodTimer / 0.48; // 1.0 -> 0.0
      nodOffsetX = Math.sin(nodNorm * Math.PI * 2) * 3.2; // Tactical head nod forward
      nodRot = Math.sin(nodNorm * Math.PI * 2) * 0.18; // Pitch tilt
    }

    ctx.save();
    ctx.translate(nodOffsetX, 0);
    ctx.rotate(nodRot);

    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.arc(-1, 0, 7.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#090D16';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // Side Arc Rails & Peltor ComTac Tactical Ear-Pro Cups
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-3, -8.2, 5, 2.2); // Left ear cup
    ctx.fillRect(-3, 6.0, 5, 2.2); // Right ear cup
    ctx.fillStyle = '#475569';
    ctx.fillRect(-4, -6.5, 7, 1.2); // Left rail
    ctx.fillRect(-4, 5.3, 7, 1.2); // Right rail

    // Helmet Top Callsign Patch & Hel-Star IR/Visible Strobe
    ctx.fillStyle = patchColor;
    ctx.fillRect(-4.5, -2.5, 4, 5);
    const strobeBlink = Math.sin(elapsedTime * 7) > 0.65;
    ctx.fillStyle = strobeBlink ? nvgColor : '#334155';
    ctx.fillRect(-6.5, -1.2, 2, 2.4);

    // 5. Helmet Side Camera (EKIS Biometric Feed Cam) on right rail
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, 6.2, 4.5, 2.2);
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(4, 6.6, 1.2, 1.4);

    // 6. Front Wilcox Mount & Dual-Tube / Quad NVG Optics
    ctx.fillStyle = '#090D16';
    ctx.fillRect(4.2, -4.5, 3.5, 9);
    ctx.fillStyle = nvgColor;
    ctx.fillRect(6.5, -4.0, 2.0, 2.6);
    ctx.fillRect(6.5, 1.4, 2.0, 2.6);
    ctx.restore();

    // 7. High-Detail Weapon Assembly & Tactical Gloves
    const wType = isSquad
      ? 'MP7'
      : activeTool === 'TASER'
        ? 'TASER'
        : primaryWeapon === 'GLOCK_SHIELD'
          ? 'SHIELD'
          : primaryWeapon === 'MP7A1'
            ? 'MP7'
            : 'AUG';

    if (wType === 'SHIELD') {
      // Heavy Ballistic Shield (Mehler IIIA) with armored viewport & side bolts
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(8, -13, 5, 26);
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(8, -13, 5, 26);
      // Armored polycarbonate viewport slit
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(9.5, -8, 2.2, 16);
      // Glock 17 Gen5 extending around right side of shield
      ctx.fillStyle = '#334155';
      ctx.fillRect(7, 6, 11, 3.2);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(5, 5.5, 3.5, 3); // Gloved right hand
    } else if (wType === 'TASER') {
      // Axon Taser X2 Dual-Cartridge Yellow Housing
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(5, 1, 4, 3.5); // Gloved hand
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(8, 0.5, 9, 4);
      ctx.fillStyle = '#090D16';
      ctx.fillRect(15, 0.8, 2.5, 3.4); // Black cartridge bay
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(17, 1.5, 1.5, 2); // Laser/arc lens
    } else if (wType === 'MP7') {
      // HK MP7A1 PDW with Suppressor, EOTech Optic & AN/PEQ Laser Box
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(4, 3.5, 4, 3.2); // Rear gloved firing hand
      ctx.fillRect(10, -1, 3.5, 3); // Forward support hand on foregrip
      // Receiver & Top Picatinny Rail
      ctx.fillStyle = '#334155';
      ctx.fillRect(5, 0.5, 13, 3.6);
      ctx.fillStyle = '#090D16';
      ctx.fillRect(8, 1.1, 4.5, 2.4); // Holo sight hood
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(10, 1.8, 1.2, 1.2); // Red dot reticle glint
      // Suppressor tube
      ctx.fillStyle = '#475569';
      ctx.fillRect(18, 1.2, 5.5, 2.2);
    } else {
      // Steyr AUG A3 CQB Bullpup Rifle (Olive-Drab Stock, Scope, AN/PEQ & Suppressor)
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(4, 4, 4, 3.2); // Firing hand
      ctx.fillRect(11, -0.8, 3.5, 3); // Foregrip support hand
      // Bullpup polymer stock
      ctx.fillStyle = '#3F4A3C';
      ctx.fillRect(2, 0.5, 11, 4.2);
      // Receiver & Aimpoint optic
      ctx.fillStyle = '#334155';
      ctx.fillRect(8, 0.8, 10, 3.2);
      ctx.fillStyle = '#090D16';
      ctx.fillRect(9, 1.0, 5, 2.6);
      // AN/PEQ laser module on side rail
      ctx.fillStyle = '#475569';
      ctx.fillRect(14, -0.6, 3.5, 1.8);
      // Barrel & Suppressor
      ctx.fillStyle = '#64748B';
      ctx.fillRect(18, 1.4, 6.5, 2.0);
    }

    if (isFiring) {
      // Crisp muzzle flash star at barrel tip
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(23, -1, 5, 6);
      ctx.fillStyle = '#F97316';
      ctx.fillRect(25, 0.5, 4, 3);
    }

    // Tactical Arm/Hand Gestures on Squad Command Accept (ADVANCE / HALT / BREACH / SECURE)
    if (actor.gestureTimer && actor.gestureTimer > 0) {
      const gKind = actor.gestureKind || 'ADVANCE';
      const maxDur = 0.65;
      const prog = Math.sin((1 - actor.gestureTimer / maxDur) * Math.PI);

      ctx.save();
      if (gKind === 'ADVANCE') {
        const armX = 6 + prog * 16;
        const armY = -12 - prog * 4;

        ctx.fillStyle = '#1E293B';
        ctx.fillRect(0, -11, armX, 3.5);
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(armX, armY, 4.5, 4.5);

        ctx.fillStyle = '#34D399';
        ctx.font = '700 8px "JetBrains Mono", monospace';
        ctx.fillText('AVANCE', armX + 6, armY + 3);

        ctx.strokeStyle = '#34D399';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(armX, armY + 2);
        ctx.lineTo(armX + 10, armY + 2);
        ctx.lineTo(armX + 6, armY - 2);
        ctx.moveTo(armX + 10, armY + 2);
        ctx.lineTo(armX + 6, armY + 6);
        ctx.stroke();
      } else if (gKind === 'HALT') {
        const armX = -1 + prog * 4;
        const armY = -14 - prog * 12;

        ctx.fillStyle = '#1E293B';
        ctx.fillRect(-2, -10, 4, -armY - 10);
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(armX - 2, armY - 2, 6, 6);
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(armX - 2, armY - 2, 6, 6);

        ctx.fillStyle = '#FBBF24';
        ctx.font = '700 8px "JetBrains Mono", monospace';
        ctx.fillText('ALTO ✋', armX + 6, armY);
      } else if (gKind === 'BREACH' || gKind === 'POINT') {
        const armX = 10 + prog * 14;
        const armY = -9 - prog * 3;

        ctx.fillStyle = '#1E293B';
        ctx.fillRect(0, -10, armX, 3.5);
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(armX, armY, 5, 4);

        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(armX + 5, armY + 2);
        ctx.lineTo(armX + 22, armY + 2);
        ctx.stroke();

        ctx.fillStyle = '#38BDF8';
        ctx.font = '700 8px "JetBrains Mono", monospace';
        ctx.fillText('OBJETIVO 👉', armX + 8, armY - 3);
      } else if (gKind === 'SECURE') {
        const armX = 4 + prog * 8;
        const armY = -12 + prog * 8;

        ctx.fillStyle = '#1E293B';
        ctx.fillRect(0, -10, armX, 3.5);
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(armX, armY, 4.5, 4.5);

        ctx.fillStyle = '#A7F3D0';
        ctx.font = '700 8px "JetBrains Mono", monospace';
        ctx.fillText('ESPOSAR 👇', armX + 6, armY + 3);
      }
      ctx.restore();
    }
  } else if (actor.role === 'SUSPECT') {
    const isMarkus = actor.id.includes('MARKUS');
    const isMilan = actor.id.includes('MILAN');

    // Detailed Jacket / Tactical Rig & Collar
    const jacketColor = isMarkus ? '#7F1D1D' : isMilan ? '#365314' : '#374151';
    const rigColor = isMarkus ? '#1E293B' : isMilan ? '#1F2937' : '#111827';

    // Chest rig / Webbing straps on suspects
    ctx.fillStyle = rigColor;
    ctx.fillRect(-5, -9, 10, 18);
    ctx.fillStyle = jacketColor;
    ctx.fillRect(-6, -12, 8, 5);
    ctx.fillRect(-6, 7, 8, 5);

    // Suspect Head, Hair & Facial Detail (Balaclava for Markus, Beard/Stubble for Milan, Hoodie for Lukas)
    ctx.fillStyle = '#D6A78A';
    ctx.beginPath();
    ctx.arc(0, 0, 6.4, 0, Math.PI * 2);
    ctx.fill();

    if (isMarkus) {
      // Dark tactical balaclava with exposed eye slit
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(-0.5, 0, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#D6A78A';
      ctx.fillRect(2.5, -3.8, 3.0, 7.6); // Eye opening
      ctx.fillStyle = '#090D16';
      ctx.fillRect(4.0, -2.8, 1.4, 1.6);
      ctx.fillRect(4.0, 1.2, 1.4, 1.6);
    } else {
      // Hair crown & directional eyes
      ctx.fillStyle = isMilan ? '#78350F' : '#1F2937';
      ctx.beginPath();
      ctx.arc(-1.5, 0, 6.2, Math.PI * 0.45, Math.PI * 1.55);
      ctx.fill();
      // Eyes & expression brows
      ctx.fillStyle = '#090D16';
      ctx.fillRect(3.8, -3.0, 1.5, 1.5);
      ctx.fillRect(3.8, 1.5, 1.5, 1.5);
    }

    // Armed vs Surrendered vs Arrested hand & weapon details
    if (actor.state === 'ARRESTED') {
      // Hands bound behind back with high-visibility yellow police zip-ties
      ctx.fillStyle = '#D6A78A';
      ctx.fillRect(-9.5, -3.5, 3.5, 7);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(-10, -1.8, 2.5, 3.6);
    } else if (
      actor.state === 'SURRENDERED' ||
      actor.state === 'FEIGNING_SURRENDER' ||
      actor.state === 'INCAPACITATED'
    ) {
      // Open palms raised to sides
      ctx.fillStyle = '#D6A78A';
      ctx.fillRect(3, -13, 4.5, 4);
      ctx.fillRect(3, 9, 4.5, 4);
    } else {
      // Armed firearm detail (AKM / Zastava / Pistol)
      ctx.fillStyle = '#D6A78A';
      ctx.fillRect(5, 2.5, 3.5, 3);
      ctx.fillRect(10, -1, 3.5, 2.8);
      // Wood handguard & steel barrel for Markus/Milan rifle, or compact SMG/pistol for Lukas
      ctx.fillStyle = isMarkus || isMilan ? '#78350F' : '#334155';
      ctx.fillRect(6, 0.5, 8, 3.2);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(13, 1.0, 8, 2.2);
    }
  } else {
    // Hostage (Julia M.) or Civilian (Hanna S.) — detailed clothing, collar, hair & expressive hands
    const isJulia = actor.id.includes('JULIA');
    const outfitMain = isJulia ? '#0284C7' : '#86198F';
    const outfitCollar = isJulia ? '#E0F2FE' : '#F5D0FE';
    const hairColor = isJulia ? '#FACC15' : '#92400E';

    // Shoulders & Layered Collar/Cardigan
    ctx.fillStyle = outfitMain;
    ctx.fillRect(-6, -11, 10, 22);
    ctx.fillStyle = outfitCollar;
    ctx.fillRect(1, -5, 3.5, 10);

    // Head & Detailed Hairstyle
    ctx.fillStyle = '#E2B89B';
    ctx.beginPath();
    ctx.arc(0, 0, 6.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(-1.6, 0, 6.5, Math.PI * 0.38, Math.PI * 1.62);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#090D16';
    ctx.fillRect(3.6, -2.8, 1.4, 1.4);
    ctx.fillRect(3.6, 1.4, 1.4, 1.4);

    if (actor.state === 'ARRESTED') {
      // Escorted / Secured posture with protective green evacuate wristband
      ctx.fillStyle = '#10B981';
      ctx.fillRect(-8.5, -2.5, 2.5, 5);
    } else {
      // Raised trembling hands
      ctx.fillStyle = '#E2B89B';
      ctx.fillRect(3, -12.5, 4, 3.8);
      ctx.fillRect(3, 8.7, 4, 3.8);
    }
  }

  ctx.restore();
}

// Helper for UI Preview Cards & Blueprint Map Icons (renders a crisp scaled pixel sprite onto a data URL)
export function getPixelPreviewCanvas(
  type: 'KOBRA1' | 'KOBRA2' | 'KOBRA_SHIELD' | 'MARKUS' | 'JULIA'
): string {
  let grid = buildKobraGrid('AUG', false, 'READY', 0, false);
  const key = `PREVIEW_${type}`;
  if (type === 'KOBRA2') {
    grid = buildKobraGrid('MP7', true, 'READY', 0, false);
  } else if (type === 'KOBRA_SHIELD') {
    grid = buildKobraGrid('SHIELD', false, 'COMBAT', 0, false);
  } else if (type === 'MARKUS') {
    grid = buildSuspectArmedGrid('M', 'm', 'd', 'COMBAT', 0);
  } else if (type === 'JULIA') {
    grid = buildSurrenderedGrid('J', 'j', 'Y', 0);
  }
  const c = getCachedGridCanvas(key, grid);
  return c.toDataURL();
}
