import { BattlemapSpriteId, DoorEntity, FurnitureItem, RoomZone, ScenarioId } from './types';
import {
  fillAsphaltSurface,
  renderTacticalAsphaltCrack,
  renderTacticalOilStain,
} from './asphaltTexture';

const ASSET_SHEET_URL =
  `${import.meta.env.BASE_URL}assets/aistudio/Free_Modern_Battlemap_Asset_Pack_from_TC_Modern_b6e73fdb.jpg`;
const GRAZ_STATION_IMAGE_URL =
  `${import.meta.env.BASE_URL}assets/aistudio/Graz_Haupbahof_f53afac4.jpg`;

interface SpriteRegionSpec {
  id: BattlemapSpriteId;
  /** Bounding region [x0, y0, x1, y1] on the 736x736 reference sheet (or [0,0,0,0] for procedural sprites from Basement A / City Roads) */
  rect: [number, number, number, number];
  defaultW: number;
  defaultH: number;
  labelDe: string;
}

// Calibrated to human operator scale: operator shoulder width = 22px, head diameter = 12.5px (~42px = 1m)
export const BATTLEMAP_SPRITE_SPECS: Record<BattlemapSpriteId, SpriteRegionSpec> = {
  WOOD_TABLE_SMOOTH: {
    id: 'WOOD_TABLE_SMOOTH',
    rect: [18, 18, 146, 208],
    defaultW: 44,
    defaultH: 70,
    labelDe: 'HOLZTISCH',
  },
  WOOD_TABLE_SLATTED: {
    id: 'WOOD_TABLE_SLATTED',
    rect: [158, 18, 286, 236],
    defaultW: 42,
    defaultH: 72,
    labelDe: 'BOHLENTISCH',
  },
  WOOD_CHAIR_A: {
    id: 'WOOD_CHAIR_A',
    rect: [16, 218, 88, 302],
    defaultW: 18,
    defaultH: 19,
    labelDe: 'STUHL',
  },
  WOOD_CHAIR_B: {
    id: 'WOOD_CHAIR_B',
    rect: [92, 218, 162, 302],
    defaultW: 18,
    defaultH: 19,
    labelDe: 'HOLZSTUHL',
  },
  TV_FLAT: {
    id: 'TV_FLAT',
    rect: [172, 236, 362, 302],
    defaultW: 54,
    defaultH: 16,
    labelDe: 'FERNSEHER',
  },
  WOOD_BENCH: {
    id: 'WOOD_BENCH',
    rect: [298, 18, 458, 96],
    defaultW: 56,
    defaultH: 22,
    labelDe: 'HOLZBANK',
  },
  WOOD_CREDVA: {
    id: 'WOOD_CREDVA',
    rect: [298, 102, 456, 160],
    defaultW: 62,
    defaultH: 22,
    labelDe: 'ANRICHTE',
  },
  NIGHTSTAND_WIDE: {
    id: 'NIGHTSTAND_WIDE',
    rect: [298, 168, 388, 228],
    defaultW: 36,
    defaultH: 22,
    labelDe: 'KOMMODE',
  },
  NIGHTSTAND_SQUARE: {
    id: 'NIGHTSTAND_SQUARE',
    rect: [394, 168, 458, 232],
    defaultW: 22,
    defaultH: 22,
    labelDe: 'NACHTTISCH',
  },
  SOFA_2SEAT: {
    id: 'SOFA_2SEAT',
    rect: [470, 18, 706, 148],
    defaultW: 84,
    defaultH: 40,
    labelDe: 'POLSTERSOFA',
  },
  ARMCHAIR_GREY: {
    id: 'ARMCHAIR_GREY',
    rect: [474, 158, 602, 266],
    defaultW: 32,
    defaultH: 30,
    labelDe: 'SESSEL',
  },
  OFFICE_CHAIR_BLACK: {
    id: 'OFFICE_CHAIR_BLACK',
    rect: [612, 158, 704, 266],
    defaultW: 20,
    defaultH: 22,
    labelDe: 'BÜROSTUHL',
  },
  BED_DOUBLE: {
    id: 'BED_DOUBLE',
    rect: [16, 312, 182, 526],
    defaultW: 68,
    defaultH: 84,
    labelDe: 'DOPPELBETT',
  },
  BED_SINGLE: {
    id: 'BED_SINGLE',
    rect: [196, 312, 314, 512],
    defaultW: 40,
    defaultH: 74,
    labelDe: 'EINZELBETT',
  },
  SEDAN_CAR_BLUE: {
    id: 'SEDAN_CAR_BLUE',
    rect: [340, 272, 694, 446],
    defaultW: 122,
    defaultH: 58,
    labelDe: 'PKW (BLAU)',
  },
  MILITARY_CRATE: {
    id: 'MILITARY_CRATE',
    rect: [324, 448, 434, 528],
    defaultW: 36,
    defaultH: 25,
    labelDe: 'TRANSPORTKISTE',
  },
  KITCHEN_SINK: {
    id: 'KITCHEN_SINK',
    rect: [444, 456, 552, 528],
    defaultW: 36,
    defaultH: 21,
    labelDe: 'SPÜLBECKEN',
  },
  STOVE_COOKTOP: {
    id: 'STOVE_COOKTOP',
    rect: [558, 448, 720, 534],
    defaultW: 44,
    defaultH: 22,
    labelDe: 'KOCHFELD',
  },
  TRASH_CAN_METAL: {
    id: 'TRASH_CAN_METAL',
    rect: [16, 530, 96, 612],
    defaultW: 19,
    defaultH: 19,
    labelDe: 'MÜLLTONNE',
  },
  CAST_IRON_PAN: {
    id: 'CAST_IRON_PAN',
    rect: [104, 530, 184, 612],
    defaultW: 14,
    defaultH: 14,
    labelDe: 'PFANNE',
  },
  PROPANE_TANK: {
    id: 'PROPANE_TANK',
    rect: [190, 512, 262, 582],
    defaultW: 17,
    defaultH: 17,
    labelDe: 'GASFLASCHE',
  },
  FIRE_EXTINGUISHER: {
    id: 'FIRE_EXTINGUISHER',
    rect: [264, 520, 332, 578],
    defaultW: 15,
    defaultH: 13,
    labelDe: 'FEUERLÖSCHER',
  },
  WATER_BUCKET: {
    id: 'WATER_BUCKET',
    rect: [350, 526, 408, 584],
    defaultW: 15,
    defaultH: 15,
    labelDe: 'EIMER',
  },
  TOASTER: {
    id: 'TOASTER',
    rect: [414, 542, 474, 590],
    defaultW: 13,
    defaultH: 10,
    labelDe: 'TOASTER',
  },
  COFFEE_CARAFE: {
    id: 'COFFEE_CARAFE',
    rect: [480, 538, 524, 592],
    defaultW: 11,
    defaultH: 12,
    labelDe: 'KAFFEEKANNE',
  },
  FRUIT_BOWL: {
    id: 'FRUIT_BOWL',
    rect: [350, 586, 408, 642],
    defaultW: 13,
    defaultH: 13,
    labelDe: 'OBSTSCHALE',
  },
  DOORMAT_DARK: {
    id: 'DOORMAT_DARK',
    rect: [352, 646, 408, 720],
    defaultW: 22,
    defaultH: 32,
    labelDe: 'FUSSMATTE',
  },
  BATH_SINK: {
    id: 'BATH_SINK',
    rect: [22, 624, 104, 690],
    defaultW: 28,
    defaultH: 22,
    labelDe: 'WASCHBECKEN',
  },
  TOILET_BOWL: {
    id: 'TOILET_BOWL',
    rect: [114, 624, 180, 722],
    defaultW: 20,
    defaultH: 27,
    labelDe: 'WC-BECKEN',
  },
  SHOWER_STALL: {
    id: 'SHOWER_STALL',
    rect: [196, 582, 342, 728],
    defaultW: 52,
    defaultH: 52,
    labelDe: 'DUSCHKABINE',
  },
  FRIDGE_UNIT: {
    id: 'FRIDGE_UNIT',
    rect: [416, 614, 496, 722],
    defaultW: 28,
    defaultH: 32,
    labelDe: 'KÜHLSCHRANK',
  },
  WASHING_MACHINE: {
    id: 'WASHING_MACHINE',
    rect: [506, 606, 606, 722],
    defaultW: 28,
    defaultH: 30,
    labelDe: 'WASCHMASCHINE',
  },
  DISHWASHER_UNIT: {
    id: 'DISHWASHER_UNIT',
    rect: [618, 614, 718, 722],
    defaultW: 28,
    defaultH: 28,
    labelDe: 'SPÜLMASCHINE',
  },
  // High-detail procedural sprites modeled directly from Basement A.jpg & City Roads sheet
  STONE_STAIRS: {
    id: 'STONE_STAIRS',
    rect: [0, 0, 0, 0],
    defaultW: 110,
    defaultH: 82,
    labelDe: 'STEINTREPPE',
  },
  WOOD_CRATE_X: {
    id: 'WOOD_CRATE_X',
    rect: [0, 0, 0, 0],
    defaultW: 28,
    defaultH: 28,
    labelDe: 'HOLZKISTE',
  },
  WOOD_BARREL: {
    id: 'WOOD_BARREL',
    rect: [0, 0, 0, 0],
    defaultW: 24,
    defaultH: 24,
    labelDe: 'HOLZFASS',
  },
  FLOOR_GRATE: {
    id: 'FLOOR_GRATE',
    rect: [0, 0, 0, 0],
    defaultW: 32,
    defaultH: 32,
    labelDe: 'BODENGITTER',
  },
  STREET_TREE: {
    id: 'STREET_TREE',
    rect: [0, 0, 0, 0],
    defaultW: 36,
    defaultH: 36,
    labelDe: 'STRASSENBAUM',
  },
  SEDAN_CAR_AMBER: {
    id: 'SEDAN_CAR_AMBER',
    rect: [0, 0, 0, 0],
    defaultW: 120,
    defaultH: 56,
    labelDe: 'PKW (AMBER)',
  },
};

class BattlemapAssetCache {
  private sprites: Partial<Record<BattlemapSpriteId, HTMLCanvasElement>> = {};
  private loading = false;
  private loaded = false;
  private proceduralReady = false;
  private grazStationImg?: HTMLImageElement;
  private grazStationLoading = false;
  /** La referencia de Graz (varios MB) solo se pide si el escenario de estación la usa. */
  private wantGrazStation = false;

  public ensureLoaded() {
    if (typeof window === 'undefined') return;
    if (!this.proceduralReady) {
      this.buildProceduralSprites();
      this.proceduralReady = true;
    }
    if (this.wantGrazStation && !this.grazStationImg && !this.grazStationLoading) {
      this.grazStationLoading = true;
      const stImg = new Image();
      stImg.crossOrigin = 'anonymous';
      stImg.onload = () => {
        this.grazStationImg = stImg;
        this.grazStationLoading = false;
      };
      stImg.onerror = () => {
        this.grazStationLoading = false;
      };
      stImg.src = GRAZ_STATION_IMAGE_URL;
    }
    if (this.loaded || this.loading) return;
    this.loading = true;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        this.processSheet(img);
        this.loaded = true;
      } catch {
        this.loaded = false;
      } finally {
        this.loading = false;
      }
    };
    img.onerror = () => {
      this.loading = false;
    };
    img.src = ASSET_SHEET_URL;
  }

  public getSprite(id: BattlemapSpriteId): HTMLCanvasElement | undefined {
    this.ensureLoaded();
    return this.sprites[id];
  }

  public getGrazStationImage(): HTMLImageElement | undefined {
    this.wantGrazStation = true;
    this.ensureLoaded();
    return this.grazStationImg;
  }

  /**
   * Builds high-resolution offscreen sprites modeled after Basement A.jpg (stone stairs,
   * wooden X-crates, oak barrels, iron floor grates) and City Roads (street trees, amber sedan).
   */
  private buildProceduralSprites() {
    // 1. STONE_STAIRS (Enhanced with rich 3D depth, ambient occlusion shadows, and metallic handrails)
    {
      const w = 160;
      const h = 120;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (ctx) {
        // Deep drop-shadow and ambient occlusion around the stairwell opening
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(0, 0, w, h);

        const railW = 12;
        const stepCount = 10;
        const innerX = railW;
        const innerW = w - railW * 2;
        const stepH = h / stepCount;

        // Draw deep descent shaft gradient (darker at the bottom/end of the stairs)
        const shaftGrad = ctx.createLinearGradient(0, 0, 0, h);
        shaftGrad.addColorStop(0, '#2A3038');
        shaftGrad.addColorStop(1, '#0C1015');
        ctx.fillStyle = shaftGrad;
        ctx.fillRect(innerX, 0, innerW, h);

        for (let i = 0; i < stepCount; i++) {
          const sy = i * stepH;
          const depthProgress = i / (stepCount - 1);
          // Progressive depth darkening down the stairwell with rich stone tones
          const baseR = Math.round(116 - depthProgress * 55);
          const baseG = Math.round(122 - depthProgress * 58);
          const baseB = Math.round(130 - depthProgress * 62);

          ctx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`;
          ctx.fillRect(innerX, sy, innerW, stepH);

          // Stone grain / speckles for high fidelity
          ctx.fillStyle = 'rgba(20, 25, 32, 0.18)';
          for (let sp = 0; sp < innerW; sp += 6) {
            if ((i + sp) % 3 === 0) {
              ctx.fillRect(innerX + sp, sy + 2, 3, stepH - 3);
            }
          }

          // Individual chiseled stone block joints across each step tread
          ctx.strokeStyle = 'rgba(10, 14, 20, 0.65)';
          ctx.lineWidth = 1.2;
          const joints = 5;
          for (let j = 1; j < joints; j++) {
            const jx = innerX + (innerW / joints) * j + ((i % 2) * 8 - 4);
            ctx.beginPath();
            ctx.moveTo(jx, sy);
            ctx.lineTo(jx, sy + stepH);
            ctx.stroke();
          }

          // Top nosing highlight bevel on each step for 3D depth
          ctx.fillStyle = 'rgba(241, 245, 249, 0.35)';
          ctx.fillRect(innerX, sy, innerW, 2.5);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
          ctx.fillRect(innerX, sy + 2.5, innerW, 1);

          // Deep cast shadow below each step riser (giving true 3D depth and layers)
          const shadowGrad = ctx.createLinearGradient(0, sy + stepH - 6, 0, sy + stepH);
          shadowGrad.addColorStop(0, 'rgba(4, 7, 11, 0)');
          shadowGrad.addColorStop(1, 'rgba(4, 7, 11, 0.88)');
          ctx.fillStyle = shadowGrad;
          ctx.fillRect(innerX, sy + stepH - 6, innerW, 6);
        }

        // Left & right reinforced stone balustrade / stringer walls with 3D bevels and handrails
        ctx.fillStyle = '#47515A';
        ctx.fillRect(0, 0, railW, h);
        ctx.fillRect(w - railW, 0, railW, h);

        // Wall interior shadow casting onto steps
        const leftWallShadow = ctx.createLinearGradient(0, 0, railW, 0);
        leftWallShadow.addColorStop(0, 'rgba(5, 8, 12, 0.8)');
        leftWallShadow.addColorStop(1, 'rgba(5, 8, 12, 0)');
        ctx.fillStyle = leftWallShadow;
        ctx.fillRect(0, 0, railW, h);

        const rightWallShadow = ctx.createLinearGradient(w - railW, 0, w, 0);
        rightWallShadow.addColorStop(0, 'rgba(5, 8, 12, 0)');
        rightWallShadow.addColorStop(1, 'rgba(5, 8, 12, 0.8)');
        ctx.fillStyle = rightWallShadow;
        ctx.fillRect(w - railW, 0, railW, h);

        // Metallic handrail running along top of left/right stringer walls
        ctx.fillStyle = '#94A3B8';
        ctx.fillRect(2, 0, 3, h);
        ctx.fillRect(w - 5, 0, 3, h);
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(3, 0, 1, h);
        ctx.fillRect(w - 4, 0, 1, h);

        // Outer border stroke
        ctx.strokeStyle = '#1E242B';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, railW - 2, h - 2);
        ctx.strokeRect(w - railW + 1, 1, railW - 2, h - 2);

        this.sprites.STONE_STAIRS = c;
      }
    }

    // 2. WOOD_CRATE_X (Modeled after Basement A.jpg diagonal-braced wooden storage crate)
    {
      const s = 64;
      const c = document.createElement('canvas');
      c.width = s;
      c.height = s;
      const ctx = c.getContext('2d');
      if (ctx) {
        // Interior planks
        ctx.fillStyle = '#784F2B';
        ctx.fillRect(2, 2, s - 4, s - 4);

        // Plank slats & wood grain lines
        ctx.strokeStyle = '#4A2E16';
        ctx.lineWidth = 1.5;
        for (let i = 1; i < 5; i++) {
          const py = (s / 5) * i;
          ctx.beginPath();
          ctx.moveTo(4, py);
          ctx.lineTo(s - 4, py);
          ctx.stroke();
        }

        // Diagonal X-brace beams
        ctx.strokeStyle = '#9A6B3E';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(6, 6);
        ctx.lineTo(s - 6, s - 6);
        ctx.moveTo(s - 6, 6);
        ctx.lineTo(6, s - 6);
        ctx.stroke();

        ctx.strokeStyle = '#4A2E16';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(2, 2, s - 4, s - 4);

        // Outer raised timber frame
        ctx.strokeStyle = '#A67546';
        ctx.lineWidth = 6;
        ctx.strokeRect(5, 5, s - 10, s - 10);

        ctx.strokeStyle = '#29180B';
        ctx.lineWidth = 2;
        ctx.strokeRect(1.5, 1.5, s - 3, s - 3);

        // Iron corner nails
        ctx.fillStyle = '#1E293B';
        for (const [nx, ny] of [
          [6, 6],
          [s - 6, 6],
          [6, s - 6],
          [s - 6, s - 6],
        ]) {
          ctx.beginPath();
          ctx.arc(nx, ny, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        this.sprites.WOOD_CRATE_X = c;
      }
    }

    // 3. WOOD_BARREL (Modeled after Basement A.jpg oak barrel with iron hoops)
    {
      const s = 64;
      const c = document.createElement('canvas');
      c.width = s;
      c.height = s;
      const ctx = c.getContext('2d');
      if (ctx) {
        const cx = s * 0.5;
        const cy = s * 0.5;
        const r = s * 0.44;

        // Outer dark iron hoop
        ctx.fillStyle = '#27272A';
        ctx.beginPath();
        ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
        ctx.fill();

        // Warm oak barrel top head with radial shading
        const grad = ctx.createRadialGradient(cx - 5, cy - 5, 3, cx, cy, r);
        grad.addColorStop(0, '#9A653A');
        grad.addColorStop(0.7, '#734827');
        grad.addColorStop(1, '#462A14');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
        ctx.fill();

        // Wooden stave lines across top head
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
        ctx.clip();
        ctx.strokeStyle = 'rgba(30, 15, 5, 0.55)';
        ctx.lineWidth = 1.4;
        for (let x = 10; x < s - 10; x += 9) {
          ctx.beginPath();
          ctx.moveTo(x, 6);
          ctx.lineTo(x, s - 6);
          ctx.stroke();
        }
        ctx.restore();

        // Recessed chime rim & bung stopper
        ctx.strokeStyle = '#3B2311';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r - 3.5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#291709';
        ctx.beginPath();
        ctx.arc(cx + 6, cy - 4, 3.6, 0, Math.PI * 2);
        ctx.fill();
        this.sprites.WOOD_BARREL = c;
      }
    }

    // 4. FLOOR_GRATE (Modeled after Basement A.jpg recessed iron floor grate)
    {
      const s = 68;
      const c = document.createElement('canvas');
      c.width = s;
      c.height = s;
      const ctx = c.getContext('2d');
      if (ctx) {
        // Dark recessed drainage shaft
        ctx.fillStyle = '#070A0F';
        ctx.fillRect(3, 3, s - 6, s - 6);

        // Horizontal crossbars
        ctx.strokeStyle = '#4B2E1E';
        ctx.lineWidth = 4;
        for (let i = 1; i <= 4; i++) {
          const y = (s / 5) * i;
          ctx.beginPath();
          ctx.moveTo(5, y);
          ctx.lineTo(s - 5, y);
          ctx.stroke();
        }

        // Vertical main iron bars with metallic highlight
        for (let i = 1; i <= 3; i++) {
          const x = (s / 4) * i;
          ctx.fillStyle = '#5C3A24';
          ctx.fillRect(x - 2.5, 4, 5, s - 8);
          ctx.fillStyle = '#855638';
          ctx.fillRect(x - 1, 4, 1.5, s - 8);
        }

        // Outer riveted iron frame
        ctx.strokeStyle = '#6E452B';
        ctx.lineWidth = 5;
        ctx.strokeRect(4, 4, s - 8, s - 8);
        ctx.strokeStyle = '#1C110A';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(1.5, 1.5, s - 3, s - 3);
        this.sprites.FLOOR_GRATE = c;
      }
    }

    // 5. STREET_TREE (Modeled after circular sidewalk tree planter in City Roads sheet)
    {
      const s = 84;
      const c = document.createElement('canvas');
      c.width = s;
      c.height = s;
      const ctx = c.getContext('2d');
      if (ctx) {
        const cx = s * 0.5;
        const cy = s * 0.5;
        // Concrete circular curb ring
        ctx.fillStyle = '#6B7280';
        ctx.beginPath();
        ctx.arc(cx, cy, 38, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Dark soil bed
        ctx.fillStyle = '#27231F';
        ctx.beginPath();
        ctx.arc(cx, cy, 31, 0, Math.PI * 2);
        ctx.fill();

        // Organic layered green foliage clusters
        const clusters = [
          { dx: 0, dy: 0, r: 27, col: '#2E5A1C' },
          { dx: -10, dy: -8, r: 16, col: '#3B7323' },
          { dx: 11, dy: -7, r: 15, col: '#3B7323' },
          { dx: -8, dy: 10, r: 16, col: '#34661F' },
          { dx: 10, dy: 9, r: 16, col: '#458529' },
          { dx: -2, dy: -2, r: 14, col: '#539B32' },
        ];
        for (const cl of clusters) {
          ctx.fillStyle = cl.col;
          ctx.beginPath();
          ctx.arc(cx + cl.dx, cy + cl.dy, cl.r, 0, Math.PI * 2);
          ctx.fill();
        }
        this.sprites.STREET_TREE = c;
      }
    }

    // 6. SEDAN_CAR_AMBER (Modeled after the top-down amber/orange sedan in City Roads sheet)
    {
      const w = 160;
      const h = 76;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (ctx) {
        // Tires
        ctx.fillStyle = '#111827';
        ctx.fillRect(22, 2, 24, 6);
        ctx.fillRect(112, 2, 24, 6);
        ctx.fillRect(22, h - 8, 24, 6);
        ctx.fillRect(112, h - 8, 24, 6);

        // Main chassis (warm amber-orange metallic gradient)
        const bodyGrad = ctx.createLinearGradient(0, 6, 0, h - 6);
        bodyGrad.addColorStop(0, '#B45309');
        bodyGrad.addColorStop(0.5, '#F59E0B');
        bodyGrad.addColorStop(1, '#B45309');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.roundRect(6, 6, w - 12, h - 12, 14);
        ctx.fill();
        ctx.strokeStyle = '#1F2937';
        ctx.lineWidth = 2.2;
        ctx.stroke();

        // Dark tinted windshield, rear window & side windows
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.roundRect(34, 12, 82, h - 24, 8);
        ctx.fill();

        // Roof panel
        ctx.fillStyle = '#D97706';
        ctx.beginPath();
        ctx.roundRect(50, 15, 46, h - 30, 4);
        ctx.fill();

        // Headlights (right = front) & Taillights (left = rear)
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(w - 10, 12, 4, 11);
        ctx.fillRect(w - 10, h - 23, 4, 11);
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(6, 12, 4, 11);
        ctx.fillRect(6, h - 23, 4, 11);

        this.sprites.SEDAN_CAR_AMBER = c;
      }
    }
  }

  /**
   * Removes the exterior white background via border flood-fill bounded by the dark ink outlines,
   * then extracts and auto-trims each sprite cell into its own transparent offscreen canvas.
   */
  private processSheet(img: HTMLImageElement) {
    const W = img.naturalWidth || 736;
    const H = img.naturalHeight || 736;
    const sheetCanvas = document.createElement('canvas');
    sheetCanvas.width = W;
    sheetCanvas.height = H;
    const ctx = sheetCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0, W, H);
    const imgData = ctx.getImageData(0, 0, W, H);
    const data = imgData.data;

    const visited = new Uint8Array(W * H);
    const queue = new Int32Array(W * H);
    let qHead = 0;
    let qTail = 0;

    const isWhiteBg = (idx: number): boolean => {
      const p = idx * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const lum = (r + g + b) * 0.3333;
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      return lum > 212 && spread < 34;
    };

    const enqueueIfBg = (x: number, y: number) => {
      if (x < 0 || x >= W || y < 0 || y >= H) return;
      const idx = y * W + x;
      if (visited[idx]) return;
      if (isWhiteBg(idx)) {
        visited[idx] = 1;
        queue[qTail++] = idx;
      }
    };

    for (let x = 0; x < W; x++) {
      enqueueIfBg(x, 0);
      enqueueIfBg(x, H - 1);
    }
    for (let y = 0; y < H; y++) {
      enqueueIfBg(0, y);
      enqueueIfBg(W - 1, y);
    }
    for (const spec of Object.values(BATTLEMAP_SPRITE_SPECS)) {
      const [rx0, ry0, rx1, ry1] = spec.rect;
      if (rx1 <= rx0) continue;
      const x0 = Math.round((rx0 / 736) * W);
      const y0 = Math.round((ry0 / 736) * H);
      const x1 = Math.min(W - 1, Math.round((rx1 / 736) * W));
      const y1 = Math.min(H - 1, Math.round((ry1 / 736) * H));
      enqueueIfBg(x0, y0);
      enqueueIfBg(x1, y0);
      enqueueIfBg(x0, y1);
      enqueueIfBg(x1, y1);
    }

    while (qHead < qTail) {
      const curr = queue[qHead++];
      data[curr * 4 + 3] = 0;
      const cx = curr % W;
      const cy = (curr - cx) / W;

      if (cx > 0) enqueueIfBg(cx - 1, cy);
      if (cx + 1 < W) enqueueIfBg(cx + 1, cy);
      if (cy > 0) enqueueIfBg(cx, cy - 1);
      if (cy + 1 < H) enqueueIfBg(cx, cy + 1);
    }

    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = y * W + x;
        if (visited[idx]) continue;
        if (
          visited[idx - 1] ||
          visited[idx + 1] ||
          visited[idx - W] ||
          visited[idx + W]
        ) {
          const p = idx * 4;
          const lum = (data[p] + data[p + 1] + data[p + 2]) * 0.3333;
          if (lum > 145) {
            const alphaFactor = Math.max(0, Math.min(1, (220 - lum) / 75));
            data[p + 3] = Math.round(alphaFactor * 255);
            data[p] = Math.round(data[p] * 0.55);
            data[p + 1] = Math.round(data[p + 1] * 0.55);
            data[p + 2] = Math.round(data[p + 2] * 0.55);
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const scaleX = W / 736;
    const scaleY = H / 736;

    for (const spec of Object.values(BATTLEMAP_SPRITE_SPECS)) {
      if (spec.rect[2] <= spec.rect[0]) continue; // Skip procedural sprites
      const rx0 = Math.max(0, Math.floor(spec.rect[0] * scaleX));
      const ry0 = Math.max(0, Math.floor(spec.rect[1] * scaleY));
      const rx1 = Math.min(W, Math.ceil(spec.rect[2] * scaleX));
      const ry1 = Math.min(H, Math.ceil(spec.rect[3] * scaleY));

      let minX = rx1;
      let minY = ry1;
      let maxX = rx0;
      let maxY = ry0;

      for (let y = ry0; y < ry1; y++) {
        for (let x = rx0; x < rx1; x++) {
          const a = data[(y * W + x) * 4 + 3];
          if (a > 24) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (maxX > minX && maxY > minY) {
        const trimW = maxX - minX + 1;
        const trimH = maxY - minY + 1;
        const c = document.createElement('canvas');
        c.width = trimW;
        c.height = trimH;
        const cCtx = c.getContext('2d');
        if (cCtx) {
          cCtx.drawImage(sheetCanvas, minX, minY, trimW, trimH, 0, 0, trimW, trimH);
          this.sprites[spec.id] = c;
        }
      }
    }
  }
}

export const battlemapAssetCache = new BattlemapAssetCache();

export interface UrbanStreetLamp {
  x: number;
  y: number;
  radius: number;
  color: string;
}

export const URBAN_STREET_LAMPS: UrbanStreetLamp[] = [
  // North street lamps (along opposing buildings & apartment)
  { x: 120, y: -65, radius: 150, color: 'rgba(251, 191, 36, 0.35)' },
  { x: 480, y: -65, radius: 150, color: 'rgba(251, 191, 36, 0.35)' },
  { x: 860, y: -65, radius: 150, color: 'rgba(251, 191, 36, 0.35)' },
  { x: 1240, y: -65, radius: 150, color: 'rgba(251, 191, 36, 0.35)' },
  { x: 210, y: 78, radius: 130, color: 'rgba(251, 191, 36, 0.28)' },
  { x: 580, y: 78, radius: 130, color: 'rgba(251, 191, 36, 0.28)' },
  { x: 920, y: 78, radius: 130, color: 'rgba(251, 191, 36, 0.28)' },

  // South street lamps (along opposing buildings & apartment)
  { x: 130, y: 890, radius: 150, color: 'rgba(251, 191, 36, 0.35)' },
  { x: 490, y: 890, radius: 150, color: 'rgba(251, 191, 36, 0.35)' },
  { x: 870, y: 890, radius: 150, color: 'rgba(251, 191, 36, 0.35)' },
  { x: 1250, y: 890, radius: 150, color: 'rgba(251, 191, 36, 0.35)' },
  { x: 210, y: 738, radius: 130, color: 'rgba(251, 191, 36, 0.28)' },
  { x: 580, y: 738, radius: 130, color: 'rgba(251, 191, 36, 0.28)' },
  { x: 920, y: 738, radius: 130, color: 'rgba(251, 191, 36, 0.28)' },

  // West street lamps (opposing & apartment sidewalk along Stiegenhaus)
  { x: -85, y: 220, radius: 140, color: 'rgba(251, 191, 36, 0.32)' },
  { x: -85, y: 580, radius: 140, color: 'rgba(251, 191, 36, 0.32)' },
  { x: 72, y: 280, radius: 125, color: 'rgba(251, 191, 36, 0.28)' },
  { x: 72, y: 520, radius: 125, color: 'rgba(251, 191, 36, 0.28)' },

  // East street lamps
  { x: 1395, y: 220, radius: 140, color: 'rgba(251, 191, 36, 0.32)' },
  { x: 1395, y: 580, radius: 140, color: 'rgba(251, 191, 36, 0.32)' },
];

/**
 * Renders the urban asphalt streets, sidewalks, and the complete opposing city blocks
 * (edificaciones al otro lado de la calle: Café, Farmacia con cruz verde neón,
 * Comisaría de policía, Panadería tradicional, Supermercado Billa, hotel, quiosco Trafik,
 * fachadas históricas Altbau y azoteas con unidades HVAC e iluminación nocturna).
 */
export function renderExteriorStreetsAndStairwell(
  ctx: CanvasRenderingContext2D,
  isTrainingMode: boolean,
  scenario: ScenarioId = 'GRAZ_LEND_APT',
  elapsedSeconds = 0
) {
  if (isTrainingMode) return;
  if (scenario === 'GRAZ_HAUPTBAHNHOF') {
    renderGrazHauptbahnhofEnvironment(ctx);
    return;
  }

  ctx.save();

  // -------------------------------------------------------------
  // 1. EXTENDED ROADWAYS & ASPHALT SURFACES (TEXTURED WITH OIL & CRACKS)
  // -------------------------------------------------------------
  // Fill all roadways with the high-resolution asphalt texture pattern
  fillAsphaltSurface(ctx, -450, -90, 2200, 178, false); // North roadway (Herrengasse Nord)
  fillAsphaltSurface(ctx, -450, 724, 2200, 161, false); // South roadway (Jakominigürtel Süd)
  fillAsphaltSurface(ctx, -90, -90, 178, 975, false); // West roadway (Lendkai)
  fillAsphaltSurface(ctx, 1150, -90, 240, 975, true); // East roadway & parking bay (Conrad-von-Hötzendorf-Straße)
  fillAsphaltSurface(ctx, 1040, 96, 240, 260, false); // North-East courtyard & access lane

  // Asphalt surface aggregate tinting & ambient road shading
  ctx.fillStyle = 'rgba(2, 6, 14, 0.28)';
  ctx.fillRect(-450, -90, 2200, 178);
  ctx.fillRect(-450, 724, 2200, 161);
  ctx.fillRect(-90, -90, 178, 975);
  ctx.fillRect(1150, -90, 240, 975);

  // -------------------------------------------------------------
  // ROADWAY ASPHALT CRACKS & BITUMEN FISSURES
  // -------------------------------------------------------------
  // North roadway cracks
  renderTacticalAsphaltCrack(ctx, 80, 15, 270, 38, 5.5, 4);
  renderTacticalAsphaltCrack(ctx, 620, -15, 840, 22, 5.0, 3);
  renderTacticalAsphaltCrack(ctx, 1280, 25, 1460, -10, 4.5, 3);

  // South roadway cracks
  renderTacticalAsphaltCrack(ctx, 190, 810, 440, 835, 6.0, 4);
  renderTacticalAsphaltCrack(ctx, 730, 825, 960, 798, 5.5, 4);
  renderTacticalAsphaltCrack(ctx, 1240, 815, 1480, 840, 5.0, 3);

  // West roadway cracks (Lendkai traffic corridor)
  renderTacticalAsphaltCrack(ctx, -25, 140, 15, 330, 6.5, 4);
  renderTacticalAsphaltCrack(ctx, 10, 470, -30, 680, 6.0, 4);

  // East roadway & diagonal parking bay cracks
  renderTacticalAsphaltCrack(ctx, 1210, 210, 1315, 380, 5.5, 3);
  renderTacticalAsphaltCrack(ctx, 1260, 620, 1340, 780, 5.0, 3);

  // -------------------------------------------------------------
  // REALISTIC MOTOR OIL STAINS & IRIDESCENT OIL SLICKS
  // -------------------------------------------------------------
  // Bus stop bay: prominent oily buildup from idling city buses
  renderTacticalOilStain(ctx, 510, 52, 22, 0.65, 0.12);
  renderTacticalOilStain(ctx, 470, 46, 14, 0.78, -0.22);
  renderTacticalOilStain(ctx, 545, 56, 11, 0.70, 0.35);

  // Diagonal parking bays along East road: engine oil drips from parked cars
  renderTacticalOilStain(ctx, 1222, 425, 19, 0.62, 0.38);
  renderTacticalOilStain(ctx, 1226, 518, 22, 0.58, -0.25);
  renderTacticalOilStain(ctx, 1220, 612, 17, 0.68, 0.18);
  renderTacticalOilStain(ctx, 1224, 695, 15, 0.65, -0.15);

  // West roadway traffic lanes (Lendkai): heavy traffic grease spots & braking points
  renderTacticalOilStain(ctx, -15, 780, 24, 0.72, 0.42);
  renderTacticalOilStain(ctx, 22, 205, 16, 0.64, -0.28);
  renderTacticalOilStain(ctx, -20, 440, 18, 0.68, 0.15);

  // South roadway traffic lanes (Jakominigürtel): vehicle drip stains
  renderTacticalOilStain(ctx, 360, 812, 20, 0.66, 0.22);
  renderTacticalOilStain(ctx, 840, 824, 23, 0.60, -0.18);
  renderTacticalOilStain(ctx, 1080, 810, 16, 0.70, 0.30);
  renderTacticalOilStain(ctx, -40, 815, 18, 0.65, -0.12);

  // -------------------------------------------------------------
  // 2. CONCRETE SIDEWALKS & CURB BEVELS
  // -------------------------------------------------------------
  // A. Inner Sidewalks bordering our apartment building (North, West, South, East)
  ctx.fillStyle = '#384353';
  // North sidewalk: spans y: 64..100, x: 54..1076 (36px wide)
  ctx.fillRect(54, 64, 1022, 36);
  // West sidewalk (along Stiegenhaus / Haupteingang A): spans x: 54..90, y: 64..756 (36px wide)
  ctx.fillRect(54, 64, 36, 692);
  // South sidewalk: spans y: 720..756, x: 54..1186 (36px wide)
  ctx.fillRect(54, 720, 1132, 36);
  // North-East sidewalk (along NE bedroom wall): spans x: 1040..1076, y: 64..360 (36px wide)
  ctx.fillRect(1040, 64, 36, 296);
  // East sidewalk connection jog along terrace step: spans x: 1040..1186, y: 360..396
  ctx.fillRect(1040, 360, 146, 36);
  // East sidewalk (along Loggia outer balustrade): spans x: 1150..1186, y: 360..756 (36px wide)
  ctx.fillRect(1150, 360, 36, 396);

  // Granite curb bevel borders around the building sidewalks
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  // North curb edge
  ctx.moveTo(54, 64);
  ctx.lineTo(1076, 64);
  // North-East corner turn & NE curb edge
  ctx.lineTo(1076, 360);
  ctx.lineTo(1186, 360);
  // East Loggia curb edge
  ctx.lineTo(1186, 756);
  // South-East corner turn & South curb edge
  ctx.lineTo(54, 756);
  // South-West corner turn & West curb edge
  ctx.lineTo(54, 64);
  ctx.closePath();
  ctx.stroke();

  // Polished granite outer highlight reflection line
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(54, 64);
  ctx.lineTo(1076, 64);
  ctx.moveTo(54, 64);
  ctx.lineTo(54, 756);
  ctx.moveTo(54, 756);
  ctx.lineTo(1186, 756);
  ctx.moveTo(1186, 360);
  ctx.lineTo(1186, 756);
  ctx.moveTo(1076, 64);
  ctx.lineTo(1076, 360);
  ctx.stroke();

  // Sidewalk slab paving joints around the operation building
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
  ctx.lineWidth = 1;

  // North sidewalk joints (transverse & longitudinal)
  ctx.beginPath();
  ctx.moveTo(54, 82);
  ctx.lineTo(1076, 82);
  for (let px = 78; px < 1070; px += 24) {
    ctx.moveTo(px, 64);
    ctx.lineTo(px, 100);
  }
  // South sidewalk joints
  ctx.moveTo(54, 738);
  ctx.lineTo(1186, 738);
  for (let px = 78; px < 1180; px += 24) {
    ctx.moveTo(px, 720);
    ctx.lineTo(px, 756);
  }
  // West sidewalk joints
  ctx.moveTo(72, 64);
  ctx.lineTo(72, 756);
  for (let py = 88; py < 750; py += 24) {
    ctx.moveTo(54, py);
    ctx.lineTo(90, py);
  }
  // East sidewalk joints
  ctx.moveTo(1058, 64);
  ctx.lineTo(1058, 360);
  ctx.moveTo(1168, 360);
  ctx.lineTo(1168, 756);
  for (let py = 88; py < 360; py += 24) {
    ctx.moveTo(1040, py);
    ctx.lineTo(1076, py);
  }
  for (let py = 372; py < 750; py += 24) {
    ctx.moveTo(1150, py);
    ctx.lineTo(1186, py);
  }
  ctx.stroke();

  // Tactile yellow guidance & warning strip along building curbs (Blindenleitsystem)
  ctx.strokeStyle = 'rgba(234, 179, 8, 0.45)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  // North curb tactile line (3px inside curb)
  ctx.moveTo(57, 67);
  ctx.lineTo(1073, 67);
  // West curb tactile line
  ctx.moveTo(57, 67);
  ctx.lineTo(57, 753);
  // South curb tactile line
  ctx.moveTo(57, 753);
  ctx.lineTo(1183, 753);
  // East Loggia curb tactile line
  ctx.moveTo(1183, 363);
  ctx.lineTo(1183, 753);
  // East NE curb tactile line
  ctx.moveTo(1073, 67);
  ctx.lineTo(1073, 357);
  ctx.stroke();
  ctx.setLineDash([]);

  // Tactile pedestrian drop-curb ramps (Aufmerksamkeitsfelder) where crosswalks meet building sidewalks
  const drawDropCurbPad = (x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = 'rgba(245, 158, 11, 0.48)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    // Tactile blister studs
    ctx.fillStyle = 'rgba(254, 240, 138, 0.8)';
    for (let bx = x + 4; bx <= x + w - 4; bx += 6) {
      for (let by = y + 4; by <= y + h - 4; by += 6) {
        ctx.fillRect(bx, by, 2, 2);
      }
    }
  };

  // Crosswalk drop-curb pads on the building sidewalks
  drawDropCurbPad(135, 64, 30, 10); // North crosswalk 1 landing
  drawDropCurbPad(985, 64, 30, 10); // North crosswalk 2 landing
  drawDropCurbPad(135, 746, 30, 10); // South crosswalk 1 landing
  drawDropCurbPad(920, 746, 30, 10); // South crosswalk 2 landing
  drawDropCurbPad(54, 385, 10, 30); // West crosswalk landing directly to Haupteingang A
  drawDropCurbPad(1176, 385, 10, 30); // East crosswalk landing to parking bay

  // Haupteingang A entrance podest, step & heavy-duty ribbed scraper mat
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(80, 372, 10, 36);
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(80, 372, 10, 36);
  // Ribbed mat slats
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1;
  for (let my = 376; my <= 404; my += 4) {
    ctx.beginPath();
    ctx.moveTo(82, my);
    ctx.lineTo(88, my);
    ctx.stroke();
  }
  // Brass entrance threshold line
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(89, 372, 2, 36);

  // Cast-iron anti-parking bollards (Grazer Stadt-Poller) along building sidewalk curbs
  const drawSidewalkBollard = (bx: number, by: number) => {
    // Drop shadow
    ctx.fillStyle = 'rgba(2, 6, 14, 0.55)';
    ctx.beginPath();
    ctx.arc(bx + 1.5, by + 1.5, 3.8, 0, Math.PI * 2);
    ctx.fill();
    // Anthracite cast iron base
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(bx, by, 3.4, 0, Math.PI * 2);
    ctx.fill();
    // Metallic collar
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Reflective white/red band center core
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(bx, by, 1.4, 0, Math.PI * 2);
    ctx.fill();
  };

  // North curb bollards
  drawSidewalkBollard(115, 66);
  drawSidewalkBollard(180, 66);
  drawSidewalkBollard(965, 66);
  drawSidewalkBollard(1030, 66);

  // South curb bollards
  drawSidewalkBollard(115, 754);
  drawSidewalkBollard(180, 754);
  drawSidewalkBollard(900, 754);
  drawSidewalkBollard(965, 754);
  drawSidewalkBollard(1140, 754);

  // West curb bollards along Stiegenhaus entrance lane
  drawSidewalkBollard(56, 120);
  drawSidewalkBollard(56, 355);
  drawSidewalkBollard(56, 425);
  drawSidewalkBollard(56, 680);

  // Bicycle stands (Grazer Edelstahl-Fahrradbügel)
  const drawBicycleRack = (rx: number, ry: number, vertical: boolean) => {
    ctx.save();
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(rx, ry - 7);
      ctx.lineTo(rx, ry + 7);
      // Foot mounting plates
      ctx.fillStyle = '#334155';
      ctx.fillRect(rx - 2, ry - 8, 4, 2);
      ctx.fillRect(rx - 2, ry + 6, 4, 2);
    } else {
      ctx.moveTo(rx - 7, ry);
      ctx.lineTo(rx + 7, ry);
      ctx.fillStyle = '#334155';
      ctx.fillRect(rx - 8, ry - 2, 2, 4);
      ctx.fillRect(rx + 6, ry - 2, 2, 4);
    }
    ctx.stroke();
    ctx.restore();
  };

  // Near entrance A
  drawBicycleRack(72, 320, false);
  drawBicycleRack(72, 340, false);
  // Along North sidewalk
  drawBicycleRack(210, 82, true);
  drawBicycleRack(232, 82, true);

  // Austrian Post letterbox (Österreichische Post Briefkasten)
  // Yellow mailbox near Haupteingang A
  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 14, 0.45)';
  ctx.fillRect(66, 447, 13, 9);
  ctx.fillStyle = '#EAB308'; // Austrian Post Yellow
  ctx.fillRect(65, 444, 12, 8);
  ctx.strokeStyle = '#CA8A04';
  ctx.lineWidth = 1;
  ctx.strokeRect(65, 444, 12, 8);
  // Mail slot
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(67, 446, 8, 1.5);
  // Post horn emblem
  ctx.fillStyle = '#991B1B';
  ctx.beginPath();
  ctx.arc(71, 449.5, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Municipal waste bins (Grazer Abfallbehälter)
  const drawWasteBin = (bx: number, by: number) => {
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(bx - 3, by - 3, 6, 6);
    ctx.strokeStyle = '#F97316'; // Graz orange trim
    ctx.lineWidth = 1;
    ctx.strokeRect(bx - 3, by - 3, 6, 6);
    ctx.fillStyle = '#10B981';
    ctx.fillRect(bx - 2, by - 2, 4, 4);
  };
  drawWasteBin(68, 475);
  drawWasteBin(610, 82);
  drawWasteBin(620, 738);

  // -------------------------------------------------------------
  // DECORATIVE SIDEWALK VEGETATION (PARTERRES, MACETAS & ÁRBOLES BAJOS)
  // -------------------------------------------------------------

  // Rectangular Parterre / Raised Flowerbed (Jardinera de obra / Blumenbeet)
  const drawRectangularParterre = (
    px: number,
    py: number,
    pw: number,
    ph: number,
    theme: 'lavender' | 'roses' | 'marigold' | 'mixed' | 'evergreen'
  ) => {
    ctx.save();
    // Drop shadow
    ctx.fillStyle = 'rgba(2, 6, 14, 0.45)';
    ctx.fillRect(px + 2, py + 2, pw, ph);

    // Architectural concrete curbstone border
    ctx.fillStyle = '#334155';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#64748B'; // Top-left sunlight highlight
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, pw, ph);
    ctx.strokeStyle = '#1E293B'; // Bottom-right shadow bevel
    ctx.beginPath();
    ctx.moveTo(px, py + ph);
    ctx.lineTo(px + pw, py + ph);
    ctx.lineTo(px + pw, py);
    ctx.stroke();

    // Dark fertile humus / bark mulch soil
    const inset = 2.5;
    ctx.fillStyle = '#171513';
    ctx.fillRect(px + inset, py + inset, pw - inset * 2, ph - inset * 2);

    // Subtle bark mulch & compost speckles
    ctx.fillStyle = '#292524';
    for (let ox = 5; ox < pw - 5; ox += 6) {
      for (let oy = 4; oy < ph - 4; oy += 5) {
        ctx.fillRect(px + ox + ((ox * 7) % 3), py + oy, 1.2, 1.2);
      }
    }

    // Dense base boxwood & perennial foliage mounds
    const isHorizontal = pw >= ph;
    if (isHorizontal) {
      const step = 8;
      const count = Math.max(2, Math.floor((pw - 8) / step));
      for (let i = 0; i < count; i++) {
        const cx = px + 6 + i * step;
        const cy = py + ph * 0.5;
        // Deep foliage base
        ctx.fillStyle = '#14532D';
        ctx.beginPath();
        ctx.arc(cx, cy, 4.2, 0, Math.PI * 2);
        ctx.fill();
        // Mid-tone leaves
        ctx.fillStyle = '#16A34A';
        ctx.beginPath();
        ctx.arc(cx - 0.8, cy - 0.8, 3.2, 0, Math.PI * 2);
        ctx.fill();
        // Sunny foliage highlight
        ctx.fillStyle = '#4ADE80';
        ctx.beginPath();
        ctx.arc(cx - 1.2, cy - 1.2, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Theme-specific blooming flower clusters
        if (theme === 'lavender') {
          // Violet / purple lavender spikes
          ctx.fillStyle = i % 2 === 0 ? '#A855F7' : '#C084FC';
          ctx.beginPath();
          ctx.arc(cx + 1, cy - 1, 1.4, 0, Math.PI * 2);
          ctx.arc(cx - 1, cy + 1, 1.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#E9D5FF';
          ctx.fillRect(cx, cy - 2, 1, 1);
        } else if (theme === 'roses') {
          // Crimson / vermilion rosebuds & geraniums
          ctx.fillStyle = i % 2 === 0 ? '#E11D48' : '#F43F5E';
          ctx.beginPath();
          ctx.arc(cx + 1, cy - 1, 1.5, 0, Math.PI * 2);
          ctx.arc(cx - 1, cy + 1, 1.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FDA4AF';
          ctx.fillRect(cx + 0.5, cy - 1.5, 1, 1);
        } else if (theme === 'marigold') {
          // Golden marigolds & sunburst daisies
          ctx.fillStyle = i % 2 === 0 ? '#F59E0B' : '#FBBF24';
          ctx.beginPath();
          ctx.arc(cx + 0.8, cy - 0.8, 1.4, 0, Math.PI * 2);
          ctx.arc(cx - 1, cy + 0.8, 1.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FEF08A';
          ctx.fillRect(cx - 0.5, cy - 1, 1, 1);
        } else if (theme === 'mixed') {
          // Alternating lively perennials
          const colors = ['#E11D48', '#A855F7', '#F59E0B', '#38BDF8'];
          ctx.fillStyle = colors[i % colors.length];
          ctx.beginPath();
          ctx.arc(cx + 1, cy - 1, 1.4, 0, Math.PI * 2);
          ctx.arc(cx - 1, cy + 1, 1.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Evergreen & ornamental grasses
          ctx.fillStyle = '#84CC16';
          ctx.fillRect(cx - 1, cy - 1.5, 2, 1.2);
          ctx.fillStyle = '#2DD4BF';
          ctx.fillRect(cx + 0.5, cy + 0.5, 1.5, 1);
        }
      }
    } else {
      // Vertical parterre layout
      const step = 8;
      const count = Math.max(2, Math.floor((ph - 8) / step));
      for (let i = 0; i < count; i++) {
        const cx = px + pw * 0.5;
        const cy = py + 6 + i * step;
        ctx.fillStyle = '#14532D';
        ctx.beginPath();
        ctx.arc(cx, cy, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#16A34A';
        ctx.beginPath();
        ctx.arc(cx - 0.8, cy - 0.8, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4ADE80';
        ctx.beginPath();
        ctx.arc(cx - 1.2, cy - 1.2, 1.8, 0, Math.PI * 2);
        ctx.fill();

        if (theme === 'lavender' || theme === 'mixed') {
          ctx.fillStyle = i % 2 === 0 ? '#A855F7' : '#E11D48';
          ctx.beginPath();
          ctx.arc(cx + 1, cy - 1, 1.4, 0, Math.PI * 2);
          ctx.arc(cx - 1, cy + 1, 1.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = '#F59E0B';
          ctx.beginPath();
          ctx.arc(cx, cy - 1, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  };

  // Decorative Planter Pots (Macetas y Jardineras Redondas / Pflanzkübel)
  const drawOrnamentalPlanterPot = (
    cx: number,
    cy: number,
    radius: number,
    potType: 'terracotta' | 'anthracite' | 'stone',
    plantType: 'topiary_ball' | 'flowering_bush' | 'dwarf_conifer',
    flowerColor = '#E11D48'
  ) => {
    ctx.save();
    // Drop shadow
    ctx.fillStyle = 'rgba(2, 6, 14, 0.42)';
    ctx.beginPath();
    ctx.arc(cx + 1.8, cy + 1.8, radius + 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Pot rim material
    if (potType === 'terracotta') {
      ctx.fillStyle = '#C2410C';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#EA580C';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Sunlit rim highlight
      ctx.strokeStyle = '#FB923C';
      ctx.beginPath();
      ctx.arc(cx - 0.6, cy - 0.6, radius - 0.8, -Math.PI * 0.75, -Math.PI * 0.25);
      ctx.stroke();
      // Inner dark compost
      ctx.fillStyle = '#1C1917';
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (potType === 'anthracite') {
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.strokeStyle = '#64748B';
      ctx.beginPath();
      ctx.arc(cx - 0.6, cy - 0.6, radius - 0.8, -Math.PI * 0.75, -Math.PI * 0.25);
      ctx.stroke();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.strokeStyle = '#94A3B8';
      ctx.beginPath();
      ctx.arc(cx - 0.6, cy - 0.6, radius - 0.8, -Math.PI * 0.75, -Math.PI * 0.25);
      ctx.stroke();
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Plant foliage inside
    const plantR = radius * 0.9;
    if (plantType === 'topiary_ball') {
      // Sculpted spherical boxwood ball (Buchsbaumkugel)
      ctx.fillStyle = '#14532D';
      ctx.beginPath();
      ctx.arc(cx, cy, plantR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#15803D';
      ctx.beginPath();
      ctx.arc(cx - 0.8, cy - 0.8, plantR * 0.78, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.arc(cx - 1.4, cy - 1.4, plantR * 0.52, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#86EFAC';
      ctx.beginPath();
      ctx.arc(cx - 1.8, cy - 1.8, plantR * 0.24, 0, Math.PI * 2);
      ctx.fill();
    } else if (plantType === 'flowering_bush') {
      // Cascading bush with bright flower blossoms
      ctx.fillStyle = '#14532D';
      ctx.beginPath();
      ctx.arc(cx, cy, plantR + 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.arc(cx - 0.6, cy - 0.6, plantR * 0.8, 0, Math.PI * 2);
      ctx.fill();
      // Flower blossoms spilling over rim
      ctx.fillStyle = flowerColor;
      ctx.beginPath();
      ctx.arc(cx - 1.2, cy - 1.2, 1.4, 0, Math.PI * 2);
      ctx.arc(cx + 1.2, cy - 0.6, 1.3, 0, Math.PI * 2);
      ctx.arc(cx - 0.4, cy + 1.4, 1.4, 0, Math.PI * 2);
      ctx.arc(cx + 1.4, cy + 1.2, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(cx - 1.5, cy - 1.5, 0.9, 0.9);
      ctx.fillRect(cx + 0.9, cy - 0.9, 0.9, 0.9);
    } else {
      // Dwarf ornamental conifer
      ctx.fillStyle = '#065F46';
      ctx.beginPath();
      ctx.arc(cx, cy, plantR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.arc(cx - 0.8, cy - 0.8, plantR * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6EE7B7';
      ctx.fillRect(cx - 1, cy - 1, 1.5, 1.5);
    }
    ctx.restore();
  };

  // Low Ornamental Street Tree (Árbol bajo ornamental / Zierbaum mit Pflasterkreis)
  const drawLowOrnamentalTree = (
    tx: number,
    ty: number,
    canopyR: number,
    treeStyle: 'maple' | 'cherry_blossom' | 'hornbeam'
  ) => {
    ctx.save();
    // Cobblestone circular curb planter surround
    const pitR = canopyR * 0.85;
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(tx, ty, pitR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Radial curbstone segments
    ctx.strokeStyle = '#475569';
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      ctx.beginPath();
      ctx.moveTo(tx + Math.cos(a) * (pitR - 2.5), ty + Math.sin(a) * (pitR - 2.5));
      ctx.lineTo(tx + Math.cos(a) * pitR, ty + Math.sin(a) * pitR);
      ctx.stroke();
    }

    // Inner organic dark compost mulch
    ctx.fillStyle = '#171513';
    ctx.beginPath();
    ctx.arc(tx, ty, pitR - 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Wooden tree stake support posts
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(tx - 4, ty - 1, 2, 2);
    ctx.fillRect(tx + 2, ty - 1, 2, 2);
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(tx - 3, ty);
    ctx.lineTo(tx + 3, ty);
    ctx.stroke();

    // Central tree trunk
    ctx.fillStyle = '#451A03';
    ctx.beginPath();
    ctx.arc(tx, ty, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#78350F';
    ctx.beginPath();
    ctx.arc(tx - 0.6, ty - 0.6, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Ground canopy drop shadow
    ctx.fillStyle = 'rgba(2, 6, 14, 0.42)';
    ctx.beginPath();
    ctx.arc(tx + 2.5, ty + 2.5, canopyR, 0, Math.PI * 2);
    ctx.fill();

    // Multi-lobed lush organic tree crown
    const lobeCount = 6;
    for (let i = 0; i < lobeCount; i++) {
      const angle = (i * Math.PI * 2) / lobeCount;
      const lx = tx + Math.cos(angle) * (canopyR * 0.45);
      const ly = ty + Math.sin(angle) * (canopyR * 0.45);
      const lobeR = canopyR * 0.55;

      ctx.fillStyle = '#14532D';
      ctx.beginPath();
      ctx.arc(lx, ly, lobeR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#15803D';
      ctx.beginPath();
      ctx.arc(lx - 0.8, ly - 0.8, lobeR * 0.82, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.arc(lx - 1.5, ly - 1.5, lobeR * 0.55, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#86EFAC';
      ctx.beginPath();
      ctx.arc(lx - 2, ly - 2, lobeR * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }

    // Center crown cluster
    ctx.fillStyle = '#16A34A';
    ctx.beginPath();
    ctx.arc(tx - 1, ty - 1, canopyR * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4ADE80';
    ctx.beginPath();
    ctx.arc(tx - 2, ty - 2, canopyR * 0.28, 0, Math.PI * 2);
    ctx.fill();

    // Tree species accents
    if (treeStyle === 'cherry_blossom') {
      // Delicate pink spring blossom dots
      ctx.fillStyle = '#F472B6';
      ctx.beginPath();
      ctx.arc(tx - 4, ty - 3, 1.2, 0, Math.PI * 2);
      ctx.arc(tx + 3, ty - 4, 1.3, 0, Math.PI * 2);
      ctx.arc(tx - 2, ty + 4, 1.2, 0, Math.PI * 2);
      ctx.arc(tx + 4, ty + 2, 1.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FBCFE8';
      ctx.fillRect(tx - 4.5, ty - 3.5, 0.9, 0.9);
      ctx.fillRect(tx + 2.5, ty - 4.5, 0.9, 0.9);
    } else if (treeStyle === 'maple') {
      // Golden/amber autumn leaf tips
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(tx - 5, ty - 1, 1.1, 0, Math.PI * 2);
      ctx.arc(tx + 4, ty - 3, 1.2, 0, Math.PI * 2);
      ctx.arc(tx + 1, ty + 5, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  // Cast-iron tree planting pits with grates (Baumscheiben mit Gitterrost)
  const drawTreePlanterPit = (tx: number, ty: number) => {
    // Permeable cast-iron grate square
    ctx.fillStyle = '#1C1917';
    ctx.fillRect(tx - 11, ty - 11, 22, 22);
    ctx.strokeStyle = '#44403C';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(tx - 11, ty - 11, 22, 22);
    // Radial slotted grate vents
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tx - 8, ty);
    ctx.lineTo(tx + 8, ty);
    ctx.moveTo(tx, ty - 8);
    ctx.lineTo(tx, ty + 8);
    ctx.stroke();
    // Inner planting soil
    ctx.fillStyle = '#143321';
    ctx.beginPath();
    ctx.arc(tx, ty, 6.5, 0, Math.PI * 2);
    ctx.fill();
    // Tree trunk & leafy crown with realistic multi-lobed canopy
    ctx.fillStyle = 'rgba(2, 6, 14, 0.38)';
    ctx.beginPath();
    ctx.arc(tx + 1.8, ty + 1.8, 8.5, 0, Math.PI * 2);
    ctx.fill();

    // 5 foliage lobes
    for (let a = 0; a < Math.PI * 2; a += (Math.PI * 2) / 5) {
      const lx = tx + Math.cos(a) * 3.8;
      const ly = ty + Math.sin(a) * 3.8;
      ctx.fillStyle = '#14532D';
      ctx.beginPath();
      ctx.arc(lx, ly, 4.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#15803D';
      ctx.beginPath();
      ctx.arc(lx - 0.7, ly - 0.7, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.arc(lx - 1.2, ly - 1.2, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Crown center highlight
    ctx.fillStyle = '#4ADE80';
    ctx.beginPath();
    ctx.arc(tx - 1.2, ty - 1.2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#86EFAC';
    ctx.beginPath();
    ctx.arc(tx - 1.8, ty - 1.8, 1.5, 0, Math.PI * 2);
    ctx.fill();
  };

  // -------------------------------------------------------------
  // PLACEMENT: BUILDING SIDEWALK GREENERY & DECORATION
  // -------------------------------------------------------------

  // North Sidewalk (Building perimeter, y = 64..100)
  drawRectangularParterre(270, 75, 42, 12, 'lavender');
  drawTreePlanterPit(360, 80);
  drawRectangularParterre(415, 75, 38, 12, 'roses');
  // Twin terracotta pots flanking the bus stop shelter
  drawOrnamentalPlanterPot(468, 80, 5, 'terracotta', 'flowering_bush', '#E11D48');
  drawOrnamentalPlanterPot(540, 80, 5, 'terracotta', 'flowering_bush', '#E11D48');
  drawRectangularParterre(660, 75, 42, 12, 'marigold');
  drawTreePlanterPit(780, 80);
  drawLowOrnamentalTree(875, 80, 11, 'cherry_blossom');
  drawOrnamentalPlanterPot(1048, 80, 5.5, 'anthracite', 'topiary_ball');

  // West Sidewalk (Stiegenhaus Haupteingang A corridor, x = 54..90)
  drawRectangularParterre(66, 145, 12, 42, 'lavender');
  drawTreePlanterPit(72, 230);
  // Elegant terracotta topiary spheres flanking Haupteingang A entrance podest
  drawOrnamentalPlanterPot(72, 354, 5.5, 'terracotta', 'topiary_ball');
  drawOrnamentalPlanterPot(72, 426, 5.5, 'terracotta', 'topiary_ball');
  // Anthracite modern planter pot near letterbox/bin
  drawOrnamentalPlanterPot(72, 518, 5, 'anthracite', 'flowering_bush', '#F43F5E');
  drawTreePlanterPit(72, 580);
  drawRectangularParterre(66, 640, 12, 42, 'mixed');

  // South Sidewalk (Building perimeter, y = 720..756)
  drawRectangularParterre(245, 734, 42, 12, 'mixed');
  drawOrnamentalPlanterPot(345, 738, 5, 'terracotta', 'topiary_ball');
  drawTreePlanterPit(450, 738);
  drawOrnamentalPlanterPot(545, 738, 5, 'terracotta', 'flowering_bush', '#E11D48');
  drawRectangularParterre(685, 734, 42, 12, 'lavender');
  drawTreePlanterPit(800, 738);
  drawLowOrnamentalTree(1015, 738, 11, 'maple');
  drawOrnamentalPlanterPot(1100, 738, 5, 'anthracite', 'topiary_ball');
  drawOrnamentalPlanterPot(1140, 738, 5, 'anthracite', 'dwarf_conifer');

  // East Sidewalk (Loggia perimeter)
  drawOrnamentalPlanterPot(1058, 140, 5, 'terracotta', 'topiary_ball');
  drawOrnamentalPlanterPot(1168, 695, 5, 'stone', 'topiary_ball');

  // Storm drain grates (Einlaufgitter) in the gutter along building curb
  const drawStormDrain = (sx: number, sy: number, vertical: boolean) => {
    ctx.fillStyle = '#0F172A';
    if (vertical) {
      ctx.fillRect(sx - 2, sy - 6, 4, 12);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(sx - 2, sy - 6, 4, 12);
    } else {
      ctx.fillRect(sx - 6, sy - 2, 12, 4);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(sx - 6, sy - 2, 12, 4);
    }
  };
  drawStormDrain(170, 62, false);
  drawStormDrain(940, 62, false);
  drawStormDrain(170, 758, false);
  drawStormDrain(880, 758, false);
  drawStormDrain(52, 310, true);
  drawStormDrain(52, 510, true);

  // Cast-iron manhole sewer cover (Kanaldeckel "STADT GRAZ")
  const drawManholeCover = (mx: number, my: number) => {
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.arc(mx, my, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = '#64748B';
    ctx.beginPath();
    ctx.arc(mx, my, 4.5, 0, Math.PI * 2);
    ctx.stroke();
  };
  drawManholeCover(175, 82);
  drawManholeCover(1010, 738);

  // Bus stop shelter & transit sign (Haltestelle Lendplatz am Wohnhaus)
  ctx.save();
  // Glass roof canopy
  ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
  ctx.fillRect(485, 74, 38, 14);
  ctx.strokeStyle = '#0284C7';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(485, 74, 38, 14);
  // Schedule vitrine panel
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(486, 75, 14, 12);
  ctx.fillStyle = '#38BDF8';
  ctx.font = '700 6px "JetBrains Mono", monospace';
  ctx.fillText('TIMETABLE', 487, 83);
  // Yellow Grazer Linien stop post
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.arc(482, 81, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 5px "JetBrains Mono", monospace';
  ctx.fillText('H', 480.5, 83);
  ctx.restore();

  // B. Opposing Outer Sidewalks along the new buildings across the street
  // North opposing sidewalk (bordering North buildings at y: -130..-90)
  ctx.fillStyle = '#384353';
  ctx.fillRect(-450, -125, 2200, 35);
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-450, -125, 2200, 35);

  // South opposing sidewalk (bordering South buildings at y: 885..920)
  ctx.fillStyle = '#384353';
  ctx.fillRect(-450, 885, 2200, 35);
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-450, 885, 2200, 35);

  // West opposing sidewalk (bordering West buildings at x: -125..-90)
  ctx.fillStyle = '#384353';
  ctx.fillRect(-125, -125, 35, 1045);
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-125, -125, 35, 1045);

  // East opposing sidewalk (bordering East buildings at x: 1390..1425)
  ctx.fillStyle = '#384353';
  ctx.fillRect(1390, -125, 35, 1045);
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1390, -125, 35, 1045);

  // Sidewalk slab paving lines (Opposing North & South)
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
  ctx.lineWidth = 1;
  for (let px = -440; px < 1740; px += 24) {
    ctx.beginPath();
    ctx.moveTo(px, -125);
    ctx.lineTo(px, -90);
    ctx.moveTo(px, 885);
    ctx.lineTo(px, 920);
    ctx.stroke();
  }
  for (let py = -120; py < 920; py += 24) {
    ctx.beginPath();
    ctx.moveTo(-125, py);
    ctx.lineTo(-90, py);
    ctx.moveTo(1390, py);
    ctx.lineTo(1425, py);
    ctx.stroke();
  }

  // Tactile yellow hazard strip along opposing curbs
  ctx.strokeStyle = 'rgba(234, 179, 8, 0.45)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(-450, -92);
  ctx.lineTo(1750, -92);
  ctx.moveTo(-450, 887);
  ctx.lineTo(1750, 887);
  ctx.moveTo(-92, -125);
  ctx.lineTo(-92, 920);
  ctx.moveTo(1392, -125);
  ctx.lineTo(1392, 920);
  ctx.stroke();
  ctx.setLineDash([]);

  // Opposing sidewalks decorative greenery & planters
  // North opposing sidewalk (y: -125..-90)
  drawRectangularParterre(110, -114, 46, 12, 'roses');
  drawOrnamentalPlanterPot(18, -108, 5, 'terracotta', 'topiary_ball');
  drawOrnamentalPlanterPot(210, -108, 5, 'terracotta', 'flowering_bush', '#F59E0B');
  drawLowOrnamentalTree(340, -108, 10, 'hornbeam');
  drawRectangularParterre(520, -114, 44, 12, 'lavender');
  drawRectangularParterre(780, -114, 44, 12, 'marigold');

  // South opposing sidewalk (y: 885..920)
  drawRectangularParterre(240, 896, 44, 12, 'mixed');
  drawOrnamentalPlanterPot(380, 902, 5, 'terracotta', 'flowering_bush', '#E11D48');
  drawRectangularParterre(520, 896, 42, 12, 'lavender');
  drawOrnamentalPlanterPot(640, 902, 5, 'anthracite', 'topiary_ball');
  drawRectangularParterre(760, 896, 42, 12, 'roses');
  drawLowOrnamentalTree(1020, 902, 10, 'cherry_blossom');

  // West opposing sidewalk (x: -125..-90)
  drawOrnamentalPlanterPot(-108, 260, 5, 'terracotta', 'topiary_ball');
  drawRectangularParterre(-114, 420, 12, 44, 'lavender');
  drawOrnamentalPlanterPot(-108, 600, 5, 'stone', 'flowering_bush', '#A855F7');

  // -------------------------------------------------------------
  // 3. ROADWAY MARKINGS & TRAFFIC LANES (EQUAL WIDTH & TWO-WAY BIDIRECTIONAL)
  // -------------------------------------------------------------
  // Street Lane Geometry (Equal symmetrical widths per direction):
  // - North Street (y: -90..64, total span = 154px):
  //     Centerline at y = -13.0 -> Two equal lanes of 77px width each:
  //     * Upper Westbound Lane (<--): y: -90..-13 (center at y = -51.5)
  //     * Lower Eastbound Lane (-->): y: -13..64 (center at y = 25.5)
  // - South Street (y: 756..885, total span = 129px):
  //     Centerline at y = 820.5 -> Two equal lanes of 64.5px width each:
  //     * Upper Westbound Lane (<--): y: 756..820.5 (center at y = 788.25)
  //     * Lower Eastbound Lane (-->): y: 820.5..885 (center at y = 852.75)
  // - West Street (x: -90..54, total span = 144px):
  //     Centerline at x = -18.0 -> Two equal lanes of 72px width each:
  //     * Left Southbound Lane (|v): x: -90..-18 (center at x = -54.0)
  //     * Right Northbound Lane (|^): x: -18..54 (center at x = 18.0)
  // - East Street (x: 1254..1390, traffic span = 136px):
  //     Centerline at x = 1322.0 -> Two equal lanes of 68px width each:
  //     * Left Southbound Lane (|v): x: 1254..1322 (center at x = 1288.0)
  //     * Right Northbound Lane (|^): x: 1322..1390 (center at x = 1356.0)

  // A. Solid White Road Edge Lines (Fahrbahnbegrenzungslinien)
  ctx.save();
  ctx.strokeStyle = 'rgba(241, 245, 249, 0.45)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  // North street edges
  ctx.moveTo(-450, -86);
  ctx.lineTo(1750, -86);
  ctx.moveTo(-450, 60);
  ctx.lineTo(1750, 60);
  // South street edges
  ctx.moveTo(-450, 760);
  ctx.lineTo(1750, 760);
  ctx.moveTo(-450, 881);
  ctx.lineTo(1750, 881);
  // West street edges
  ctx.moveTo(-86, -90);
  ctx.lineTo(-86, 885);
  ctx.moveTo(50, -90);
  ctx.lineTo(50, 885);
  // East street active edges (separating parking bays & opposing curb)
  ctx.moveTo(1254, -90);
  ctx.lineTo(1254, 885);
  ctx.moveTo(1386, -90);
  ctx.lineTo(1386, 885);
  ctx.stroke();

  // B. Dashed White Centerlines (Leitlinien) separating the two opposing travel directions
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.72)';
  ctx.lineWidth = 2.4;
  ctx.setLineDash([16, 12]);
  ctx.beginPath();
  // North street equal centerline (y = -13.0)
  ctx.moveTo(-450, -13);
  ctx.lineTo(1750, -13);
  // South street equal centerline (y = 820.5)
  ctx.moveTo(-450, 820.5);
  ctx.lineTo(1750, 820.5);
  // West street equal centerline (x = -18.0)
  ctx.moveTo(-18, -90);
  ctx.lineTo(-18, 885);
  // East street equal centerline (x = 1322.0)
  ctx.moveTo(1322, -90);
  ctx.lineTo(1322, 885);
  ctx.stroke();
  ctx.setLineDash([]);

  // C. Solid White Centerline Sections (Sperrlinie) approaching pedestrian crosswalks
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.85)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  // North street crosswalk approaches
  ctx.moveTo(90, -13);
  ctx.lineTo(180, -13);
  ctx.moveTo(940, -13);
  ctx.lineTo(1030, -13);
  // South street crosswalk approaches
  ctx.moveTo(90, 820.5);
  ctx.lineTo(180, 820.5);
  ctx.moveTo(875, 820.5);
  ctx.lineTo(965, 820.5);
  // West street crosswalk approach (Haupteingang A)
  ctx.moveTo(-18, 340);
  ctx.lineTo(-18, 430);
  // East street crosswalk approach
  ctx.moveTo(1322, 340);
  ctx.lineTo(1322, 430);
  ctx.stroke();

  // D. Intersection Turning Guide Dashes (Kreuzungsleitlinien)
  ctx.strokeStyle = 'rgba(241, 245, 249, 0.42)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  // NW Turn (Westbound North street turning Southbound onto Lendkai)
  ctx.arc(-18, -13, 38, Math.PI * 0.5, Math.PI);
  // SW Turn (Eastbound South street turning Northbound onto Lendkai)
  ctx.arc(-18, 820.5, 38, Math.PI, Math.PI * 1.5);
  ctx.stroke();
  ctx.setLineDash([]);

  // E. Pedestrian Crosswalks (Zebrastreifen) spanning seamlessly curb-to-curb
  const drawCrosswalkVertical = (cx: number, startY: number, endY: number, barWidth = 32) => {
    ctx.fillStyle = 'rgba(248, 250, 252, 0.82)';
    const span = endY - startY;
    const stripePitch = 12; // 7px bar + 5px gap
    const count = Math.floor(span / stripePitch);
    for (let i = 0; i < count; i++) {
      ctx.fillRect(cx, startY + i * stripePitch, barWidth, 7);
    }
    // Stop/yield transverse lines
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 10, startY);
    ctx.lineTo(cx - 10, endY);
    ctx.moveTo(cx + barWidth + 10, startY);
    ctx.lineTo(cx + barWidth + 10, endY);
    ctx.stroke();
  };

  const drawCrosswalkHorizontal = (startX: number, endX: number, cy: number, barHeight = 32) => {
    ctx.fillStyle = 'rgba(248, 250, 252, 0.82)';
    const span = endX - startX;
    const stripePitch = 12;
    const count = Math.floor(span / stripePitch);
    for (let i = 0; i < count; i++) {
      ctx.fillRect(startX + i * stripePitch, cy, 7, barHeight);
    }
    // Stop/yield transverse lines
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(startX, cy - 10);
    ctx.lineTo(endX, cy - 10);
    ctx.moveTo(startX, cy + barHeight + 10);
    ctx.lineTo(endX, cy + barHeight + 10);
    ctx.stroke();
  };

  // North street crosswalks (spanning y: -88..62 across both 77px lanes)
  drawCrosswalkVertical(135, -88, 62, 32);
  drawCrosswalkVertical(985, -88, 62, 32);

  // South street crosswalks (spanning y: 758..883 across both 64.5px lanes)
  drawCrosswalkVertical(135, 758, 883, 32);
  drawCrosswalkVertical(920, 758, 883, 32);

  // West street crosswalk (spanning x: -88..52 across both 72px lanes to Haupteingang A)
  drawCrosswalkHorizontal(-88, 52, 372, 32);

  // East street crosswalk (spanning x: 1254..1388 across both 68px lanes)
  drawCrosswalkHorizontal(1254, 1388, 372, 32);

  // F. Directional Road Arrows (Two-Way Traffic Indicators in every lane)
  const drawRoadArrow = (
    ax: number,
    ay: number,
    direction: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN'
  ) => {
    ctx.save();
    ctx.translate(ax, ay);
    let rot = 0;
    if (direction === 'LEFT') rot = Math.PI;
    else if (direction === 'UP') rot = -Math.PI * 0.5;
    else if (direction === 'DOWN') rot = Math.PI * 0.5;
    ctx.rotate(rot);

    ctx.strokeStyle = 'rgba(248, 250, 252, 0.65)';
    ctx.fillStyle = 'rgba(248, 250, 252, 0.65)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(7, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(17, 0);
    ctx.lineTo(7, -5.5);
    ctx.lineTo(7, 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // North Street (Two-Way bidirectional: Upper Lane Westbound <-- / Lower Lane Eastbound -->)
  drawRoadArrow(-180, -51.5, 'LEFT');
  drawRoadArrow(330, -51.5, 'LEFT');
  drawRoadArrow(750, -51.5, 'LEFT');
  drawRoadArrow(1230, -51.5, 'LEFT');

  drawRoadArrow(-180, 25.5, 'RIGHT');
  drawRoadArrow(330, 25.5, 'RIGHT');
  drawRoadArrow(750, 25.5, 'RIGHT');
  drawRoadArrow(1230, 25.5, 'RIGHT');

  // South Street (Two-Way bidirectional: Upper Lane Westbound <-- / Lower Lane Eastbound -->)
  drawRoadArrow(-180, 788.25, 'LEFT');
  drawRoadArrow(380, 788.25, 'LEFT');
  drawRoadArrow(760, 788.25, 'LEFT');
  drawRoadArrow(1230, 788.25, 'LEFT');

  drawRoadArrow(-180, 852.75, 'RIGHT');
  drawRoadArrow(380, 852.75, 'RIGHT');
  drawRoadArrow(760, 852.75, 'RIGHT');
  drawRoadArrow(1230, 852.75, 'RIGHT');

  // West Street (Two-Way bidirectional: Left Lane Southbound |v / Right Lane Northbound |^)
  drawRoadArrow(-54.0, 30, 'DOWN');
  drawRoadArrow(-54.0, 230, 'DOWN');
  drawRoadArrow(-54.0, 520, 'DOWN');
  drawRoadArrow(-54.0, 730, 'DOWN');

  drawRoadArrow(18.0, 30, 'UP');
  drawRoadArrow(18.0, 230, 'UP');
  drawRoadArrow(18.0, 520, 'UP');
  drawRoadArrow(18.0, 730, 'UP');

  // East Street (Two-Way bidirectional: Left Lane Southbound |v / Right Lane Northbound |^)
  drawRoadArrow(1288.0, 110, 'DOWN');
  drawRoadArrow(1288.0, 480, 'DOWN');
  drawRoadArrow(1288.0, 740, 'DOWN');

  drawRoadArrow(1356.0, 110, 'UP');
  drawRoadArrow(1356.0, 480, 'UP');
  drawRoadArrow(1356.0, 740, 'UP');
  ctx.restore();

  // Bus stop bay & diagonal parking bays
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const busX0 = 460;
  const busY = 60;
  ctx.moveTo(busX0, busY);
  for (let i = 0; i <= 10; i++) {
    ctx.lineTo(busX0 + i * 14, i % 2 === 0 ? busY - 8 : busY + 6);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(248, 250, 252, 0.55)';
  ctx.font = '700 10px "JetBrains Mono", monospace';
  ctx.fillText('BUS', busX0 + 58, busY - 12);
  ctx.fillText('STOP', 950, 36);

  // Diagonal parking bays along East road (separated by Loggia sidewalk curb)
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.42)';
  ctx.lineWidth = 1.5;
  for (let py = 385; py <= 695; py += 52) {
    ctx.beginPath();
    ctx.moveTo(1190, py);
    ctx.lineTo(1258, py - 24);
    ctx.stroke();
  }

  // -------------------------------------------------------------
  // 4. EDIFICACIONES NORTE (Across North Street: y = -460 to -125)
  // -------------------------------------------------------------
  const drawRoofHVAC = (rx: number, ry: number, rw: number, rh: number) => {
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.strokeRect(rx, ry, rw, rh);
    // Ventilation fan grill
    ctx.fillStyle = '#0F172A';
    const fanR = Math.min(rw, rh) * 0.35;
    ctx.beginPath();
    ctx.arc(rx + rw * 0.5, ry + rh * 0.5, fanR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#64748B';
    ctx.stroke();
  };

  const drawWindowRow = (
    startX: number,
    y: number,
    count: number,
    spacing: number,
    w: number,
    h: number,
    color: string
  ) => {
    for (let i = 0; i < count; i++) {
      const wx = startX + i * spacing;
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(wx - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = color;
      ctx.fillRect(wx, y, w, h);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(wx, y, w, h);
    }
  };

  // Building N1: "Antiquariat & Wohnungen" (x: -350 to -30, y: -450 to -125)
  // Base & Mansard Roof
  ctx.fillStyle = '#261F1F'; // Brick-tinted dark facade base
  ctx.fillRect(-350, -450, 320, 325);
  ctx.fillStyle = '#1E232F'; // Dark slate pitched roof
  ctx.fillRect(-348, -448, 316, 260);
  ctx.strokeStyle = '#4B3636';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(-350, -450, 320, 325);

  // Roof dormers & chimneys
  for (let dx = -320; dx <= -80; dx += 65) {
    ctx.fillStyle = '#3F2C2C';
    ctx.fillRect(dx, -320, 28, 22);
    ctx.fillStyle = 'rgba(254, 240, 138, 0.32)'; // Warm dormer window
    ctx.fillRect(dx + 4, -316, 20, 14);
  }
  ctx.fillStyle = '#451A03';
  ctx.fillRect(-310, -430, 16, 24);
  ctx.fillRect(-120, -430, 16, 24);

  // Storefront & ground entrance
  ctx.fillStyle = '#3E2723';
  ctx.fillRect(-350, -165, 320, 40);
  ctx.strokeStyle = '#8D6E63';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-350, -165, 320, 40);
  ctx.fillStyle = 'rgba(251, 191, 36, 0.45)'; // Amber vitrine window glow
  ctx.fillRect(-325, -160, 110, 28);
  ctx.fillRect(-175, -160, 110, 28);
  ctx.fillStyle = '#FEF08A';
  ctx.font = '700 9px "JetBrains Mono", monospace';
  ctx.fillText('ANTIQUARIAT & BÜCHER', -305, -142);

  // Building N2: "Café Sacher / Lend & Altbau Residenz" (x: -30 to 330, y: -460 to -125)
  // Classical Austrian Imperial ochre/sandstone Altbau
  ctx.fillStyle = '#2C271E';
  ctx.fillRect(-30, -460, 360, 335);
  ctx.fillStyle = '#21201D';
  ctx.fillRect(-28, -458, 356, 265);
  ctx.strokeStyle = '#78716C';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(-30, -460, 360, 335);

  // Decorative cornices & architectural roof crest
  ctx.fillStyle = '#44403C';
  ctx.fillRect(-30, -172, 360, 8);
  ctx.fillRect(-30, -260, 360, 6);
  ctx.fillRect(-30, -350, 360, 6);

  // Lit apartment windows on upper floors
  drawWindowRow(-10, -340, 6, 56, 26, 18, 'rgba(254, 243, 199, 0.55)');
  drawWindowRow(-10, -250, 6, 56, 26, 18, 'rgba(253, 230, 138, 0.48)');

  // Roof dormers & zinc seams
  for (let dx = -10; dx <= 280; dx += 55) {
    ctx.fillStyle = '#38342D';
    ctx.fillRect(dx, -420, 24, 20);
    ctx.fillStyle = 'rgba(251, 191, 36, 0.28)';
    ctx.fillRect(dx + 3, -417, 18, 14);
  }

  // Café Sacher / Lend: Ground floor awning, cafe tables & glowing chandeliers
  ctx.fillStyle = '#7F1D1D'; // Burgundy canvas canopy
  ctx.fillRect(-25, -164, 350, 38);
  // Gold awning stripes
  ctx.fillStyle = '#D97706';
  for (let ax = -25; ax < 325; ax += 22) {
    ctx.fillRect(ax, -164, 11, 38);
  }
  // Warm glowing cafe glass facade underneath awning
  ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
  ctx.fillRect(-15, -152, 140, 22);
  ctx.fillRect(165, -152, 140, 22);
  // Cafe signage & outdoor tables on sidewalk
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 9.5px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('☕ CAFÉ LEND', 42, -137);
  ctx.fillText('KONDITOREI', 205, -137);

  // Circular cafe tables with chairs outside on the sidewalk
  for (let tx = -5; tx <= 300; tx += 68) {
    ctx.fillStyle = '#451A03';
    ctx.beginPath();
    ctx.arc(tx, -107, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.arc(tx, -107, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Building N3: "Apotheke am Lendplatz" (x: 330 to 700, y: -450 to -125)
  // Modern commercial block with dark granite and sage panels
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(330, -450, 370, 325);
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(332, -448, 366, 260); // Flat gravel roof
  ctx.strokeStyle = '#059669';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(330, -450, 370, 325);

  // Industrial roof chillers & antenna with pulsing red light
  drawRoofHVAC(365, -425, 65, 42);
  drawRoofHVAC(580, -425, 65, 42);
  // Antenna mast with red obstacle strobe
  const redStrobe = Math.sin(elapsedSeconds * 4) > 0;
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(490, -430);
  ctx.lineTo(490, -400);
  ctx.stroke();
  ctx.fillStyle = redStrobe ? '#EF4444' : '#7F1D1D';
  ctx.beginPath();
  ctx.arc(490, -430, redStrobe ? 4 : 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Modernist upper windows
  drawWindowRow(355, -320, 6, 56, 30, 20, 'rgba(56, 189, 248, 0.42)');
  drawWindowRow(355, -240, 6, 56, 30, 20, 'rgba(254, 240, 138, 0.48)');

  // Pharmacy storefront & pulsing Neon Green Cross
  ctx.fillStyle = '#064E3B';
  ctx.fillRect(330, -165, 370, 40);
  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(330, -165, 370, 40);

  // Illuminated glass windows
  ctx.fillStyle = 'rgba(52, 211, 153, 0.45)';
  ctx.fillRect(410, -160, 260, 28);
  ctx.fillStyle = '#ECFDF5';
  ctx.font = '700 9px "JetBrains Mono", monospace';
  ctx.fillText('APOTHEKE AM LENDPLATZ · 24H NOTDIENST', 430, -142);

  // Pulsing Neon Green Pharmacy Cross (+)
  const crossGlow = 0.75 + 0.25 * Math.sin(elapsedSeconds * 3.5);
  ctx.save();
  ctx.fillStyle = `rgba(16, 185, 129, ${crossGlow})`;
  ctx.shadowColor = '#10B981';
  ctx.shadowBlur = 12;
  const crossX = 368;
  const crossY = -145;
  ctx.fillRect(crossX - 3.5, crossY - 11, 7, 22);
  ctx.fillRect(crossX - 11, crossY - 3.5, 22, 7);
  ctx.restore();

  // Building N4: "Bäckerei Sorger / Stadthaus" (x: 700 to 1100, y: -455 to -125)
  // Habsburg ochre stucco facade & terracotta tile roof
  ctx.fillStyle = '#3A2E1A';
  ctx.fillRect(700, -455, 400, 330);
  ctx.fillStyle = '#451A03'; // Terracotta roof
  ctx.fillRect(702, -453, 396, 265);
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(700, -455, 400, 330);

  // Roof tile ridge ribs
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.22)';
  ctx.lineWidth = 1.5;
  for (let ry = -445; ry < -200; ry += 16) {
    ctx.beginPath();
    ctx.moveTo(702, ry);
    ctx.lineTo(1098, ry);
    ctx.stroke();
  }

  // Windows with warm light
  drawWindowRow(730, -325, 6, 60, 28, 20, 'rgba(254, 240, 138, 0.52)');
  drawWindowRow(730, -235, 6, 60, 28, 20, 'rgba(253, 230, 138, 0.45)');

  // Traditional Austrian Bakery storefront
  ctx.fillStyle = '#991B1B';
  ctx.fillRect(700, -165, 400, 40);
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(700, -165, 400, 40);
  ctx.fillStyle = 'rgba(251, 191, 36, 0.75)'; // Golden bakery display glow
  ctx.fillRect(730, -160, 330, 28);
  ctx.fillStyle = '#451A03';
  ctx.font = 'bold 9.5px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('🥨 BÄCKEREI SORGER · FEINBÄCKEREI SEIT 1898', 760, -142);

  // Building N5: "Steiermärkische Bank & Residenz" (x: 1100 to 1600, y: -450 to -125)
  // Dark granite and blue glass facade
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(1100, -450, 500, 325);
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(1102, -448, 496, 260);
  ctx.strokeStyle = '#0284C7';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(1100, -450, 500, 325);

  drawRoofHVAC(1150, -425, 75, 45);
  drawRoofHVAC(1380, -425, 75, 45);
  drawWindowRow(1140, -320, 7, 60, 32, 20, 'rgba(56, 189, 248, 0.52)');
  drawWindowRow(1140, -240, 7, 60, 32, 20, 'rgba(254, 243, 199, 0.42)');

  // Bank branch & ATM kiosk
  ctx.fillStyle = '#0C4A6E';
  ctx.fillRect(1100, -165, 500, 40);
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1100, -165, 500, 40);
  ctx.fillStyle = 'rgba(56, 189, 248, 0.65)';
  ctx.fillRect(1140, -160, 410, 28);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
  ctx.fillText('🏧 BANKOMAT 24H · STEIERMÄRKISCHE SPARKASSE', 1180, -142);

  // -------------------------------------------------------------
  // 5. EDIFICACIONES SUR (Across South Street: y = 885 to 1260)
  // -------------------------------------------------------------
  // Building S1: "Kfz-Werkstatt & Hofeinfahrt" (x: -350 to 60, y: 885 to 1250)
  ctx.fillStyle = '#27201D';
  ctx.fillRect(-350, 885, 410, 365);
  ctx.strokeStyle = '#78350F';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(-350, 885, 410, 365);

  // Garage roller doors with yellow/black hazard chevrons
  for (const gx of [-280, -120]) {
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(gx, 895, 120, 38);
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(gx, 895, 120, 38);
    // Hazard stripes
    ctx.fillStyle = '#EAB308';
    for (let hx = gx; hx < gx + 120; hx += 16) {
      ctx.beginPath();
      ctx.moveTo(hx, 895);
      ctx.lineTo(hx + 8, 895);
      ctx.lineTo(hx, 933);
      ctx.lineTo(hx - 8, 933);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.fillStyle = '#FDE047';
  ctx.font = '700 9px "JetBrains Mono", monospace';
  ctx.fillText('KFZ-MEISTERBETRIEB LEND · EINFARHT FREIHALTEN', -260, 955);

  // Building S2: "Polizeiinspektion Graz-Lend (Wachzimmer)" (x: 60 to 450, y: 885 to 1250)
  ctx.fillStyle = '#1A2333';
  ctx.fillRect(60, 885, 390, 365);
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(62, 940, 386, 305);
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(60, 885, 390, 365);

  // Police Station Front & Blue Illuminated Shield Sign
  ctx.fillStyle = '#075985';
  ctx.fillRect(80, 895, 340, 40);
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2;
  ctx.strokeRect(80, 895, 340, 40);

  // Glowing POLIZEI Emblem
  ctx.fillStyle = '#38BDF8';
  ctx.font = 'bold 11px "JetBrains Mono", monospace';
  ctx.fillText('🛡 POLIZEIINSPEKTION GRAZ-LEND', 115, 920);

  // Parked Police Patrol Vehicle (Polizei-Einsatzwagen) outside on parking bay
  ctx.save();
  ctx.translate(340, 845);
  ctx.fillStyle = '#CBD5E1'; // Silver body
  ctx.fillRect(-22, -11, 44, 22);
  ctx.fillStyle = '#1D4ED8'; // Austrian Blue Police stripes
  ctx.fillRect(-20, -11, 40, 4);
  ctx.fillRect(-20, 7, 40, 4);
  ctx.fillStyle = '#EF4444'; // Red chevron accent
  ctx.fillRect(14, -8, 5, 16);
  // Blue LED lightbar on roof
  const blueFlash = Math.sin(elapsedSeconds * 8) > 0;
  ctx.fillStyle = blueFlash ? '#38BDF8' : '#1D4ED8';
  ctx.fillRect(-6, -4, 12, 8);
  ctx.restore();

  // Building S3: "Tabak-Trafik & Wohnhaus" (x: 450 to 830, y: 885 to 1250)
  ctx.fillStyle = '#2A241F';
  ctx.fillRect(450, 885, 380, 365);
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(450, 885, 380, 365);

  // Trafik Storefront
  ctx.fillStyle = '#991B1B';
  ctx.fillRect(470, 895, 330, 40);
  ctx.strokeStyle = '#F87171';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(470, 895, 330, 40);
  ctx.fillStyle = 'rgba(254, 240, 138, 0.72)';
  ctx.fillRect(490, 900, 290, 28);
  ctx.fillStyle = '#DC2626';
  ctx.font = 'bold 10px "JetBrains Mono", monospace';
  ctx.fillText('TABAK · TRAFIK · ZEITSCHRIFTEN · LOTTO', 505, 918);

  // Upper residential windows with soft TV flicker
  const tvColor =
    Math.sin(elapsedSeconds * 5) > 0 ? 'rgba(147, 197, 253, 0.45)' : 'rgba(196, 181, 253, 0.45)';
  drawWindowRow(480, 960, 5, 65, 28, 20, 'rgba(254, 240, 138, 0.52)');
  drawWindowRow(480, 1030, 5, 65, 28, 20, tvColor);

  // Building S4: "Pension Schlossbergblick" (x: 830 to 1190, y: 885 to 1250)
  ctx.fillStyle = '#2B2625';
  ctx.fillRect(830, 885, 360, 365);
  ctx.strokeStyle = '#A8A29E';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(830, 885, 360, 365);

  // Hotel entrance foyer
  ctx.fillStyle = '#451A03';
  ctx.fillRect(850, 895, 320, 40);
  ctx.fillStyle = 'rgba(251, 191, 36, 0.65)';
  ctx.fillRect(870, 900, 280, 28);
  ctx.fillStyle = '#451A03';
  ctx.font = 'bold 9.5px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('HOTEL PENSION SCHLOSSBERGLICK ★★★', 895, 918);
  drawWindowRow(860, 960, 5, 62, 26, 18, 'rgba(254, 243, 199, 0.45)');
  drawWindowRow(860, 1030, 5, 62, 26, 18, 'rgba(254, 243, 199, 0.45)');

  // Building S5: "BILLA Plus Supermarkt" (x: 1190 to 1600, y: 885 to 1250)
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(1190, 885, 410, 365);
  ctx.strokeStyle = '#EAB308';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(1190, 885, 410, 365);

  // Supermarket storefront & BILLA sign
  ctx.fillStyle = '#CA8A04';
  ctx.fillRect(1210, 895, 360, 40);
  ctx.fillStyle = 'rgba(254, 240, 138, 0.82)';
  ctx.fillRect(1225, 900, 330, 28);
  ctx.fillStyle = '#DC2626';
  ctx.font = '900 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('BILLA', 1245, 919);
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('PLUS · GRAZ LEND', 1290, 918);

  // -------------------------------------------------------------
  // 6. EDIFICACIONES OESTE (Across West Street: x = -420 to -125)
  // -------------------------------------------------------------
  ctx.fillStyle = '#28231E';
  ctx.fillRect(-420, -125, 295, 1010);
  ctx.strokeStyle = '#78716C';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(-420, -125, 295, 1010);

  // Arched carriage gateway (Toreinfahrt) leading into inner cobblestone courtyard
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(-170, 340, 45, 90);
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 2;
  ctx.strokeRect(-170, 340, 45, 90);
  // Lantern in gateway
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(-148, 385, 5, 0, Math.PI * 2);
  ctx.fill();

  // Townhouse windows along West street
  for (let wy = -80; wy <= 820; wy += 68) {
    if (wy > 320 && wy < 440) continue;
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-165, wy, 24, 28);
    ctx.fillStyle = 'rgba(253, 230, 138, 0.42)';
    ctx.fillRect(-163, wy + 2, 20, 24);
  }

  // -------------------------------------------------------------
  // 7. EDIFICACIONES ESTE (Across East Street: x = 1425 to 1720)
  // -------------------------------------------------------------
  ctx.fillStyle = '#1A2333';
  ctx.fillRect(1425, -125, 295, 1010);
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(1425, -125, 295, 1010);

  // Underground garage entry ramp
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(1425, 420, 60, 95);
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1425, 420, 60, 95);
  // Traffic lights at garage ramp
  ctx.fillStyle = '#10B981';
  ctx.beginPath();
  ctx.arc(1435, 440, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(1435, 452, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Modern Parkresidenz panoramic windows
  for (let wy = -80; wy <= 820; wy += 68) {
    if (wy > 400 && wy < 530) continue;
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(1440, wy, 34, 28);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.fillRect(1442, wy + 2, 30, 24);
  }

  // -------------------------------------------------------------
  // 8. STREET LAMPS (Straßenlaternen) & AMBIENT NIGHT GLOW
  // -------------------------------------------------------------
  for (const lamp of URBAN_STREET_LAMPS) {
    // Ambient radial light pool on pavement/street
    const lampGlow = ctx.createRadialGradient(lamp.x, lamp.y, 4, lamp.x, lamp.y, lamp.radius);
    lampGlow.addColorStop(0, 'rgba(253, 230, 138, 0.45)');
    lampGlow.addColorStop(0.35, lamp.color);
    lampGlow.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = lampGlow;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, lamp.radius, 0, Math.PI * 2);
    ctx.fill();

    // Cast-iron pole base & illuminated lamp head fixture
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Glowing filament core
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // -------------------------------------------------------------
  // 9. STIEGENHAUS FLAGSTONE FLOOR (Interior of apartment entrance)
  // -------------------------------------------------------------
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.09)';
  ctx.lineWidth = 1;
  const stX = 92;
  const stY = 102;
  const stW = 156;
  const stH = 616;
  const tileS = 26;
  for (let row = 0; row * tileS < stH; row++) {
    const y = stY + row * tileS;
    ctx.beginPath();
    ctx.moveTo(stX, y);
    ctx.lineTo(stX + stW, y);
    ctx.stroke();
    const offset = (row % 2) * (tileS * 0.5);
    for (let x = stX + offset; x < stX + stW; x += tileS) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, Math.min(stY + stH, y + tileS));
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Renders the complete Graz Hauptbahnhof (Estación Principal de Trenes de Graz) environment
 * modeled directly from /assets/aistudio/Graz_Haupbahof_f53afac4.jpg:
 * - Europaplatz & Iconic "Goldenes Auge" (Golden Eye) oval canopy roof + Tram Loop
 * - SPAR Supermarket (West), Bahnhofshalle Concourse (Center), Gastronomie Lounge (East)
 * - Railway tracks (Gleis 1–9) with sleepers and steel rails
 * - Yellow S-Bahn Regional Train (West) & Hijacked Red-Silver ÖBB Railjet Express (East)
 *   with walkable Passenger Coach (Waggon 1) and Taurus Locomotive Cab (Führerstand)
 * - Mittelbahnsteig 2–7 island platform & pedestrian underpasses
 */
export function renderGrazHauptbahnhofEnvironment(ctx: CanvasRenderingContext2D) {
  ctx.save();

  // 0. Subtle atmospheric underlay from the uploaded Graz Hauptbahnhof reference map
  // (Cropping out the top 21% and bottom 10% so any corner HUD from the reference screenshot is excluded)
  const refImg = battlemapAssetCache.getGrazStationImage();
  if (refImg && refImg.width > 0 && refImg.height > 0) {
    ctx.save();
    ctx.globalAlpha = 0.24;
    const sx = Math.round(refImg.width * 0.02);
    const sy = Math.round(refImg.height * 0.21);
    const sw = Math.round(refImg.width * 0.96);
    const sh = Math.round(refImg.height * 0.68);
    ctx.drawImage(refImg, sx, sy, sw, sh, 40, 50, 1200, 720);
    ctx.restore();
  }

  // 1. NORTH EUROPAPLATZ ROADWAY, PARK LAWN & TRAM TRACKS (y: 0..200)
  ctx.fillStyle = '#181D24';
  ctx.fillRect(0, 0, 1280, 80); // North Gürtel / Europaplatz avenue
  ctx.fillRect(0, 80, 96, 400); // West street lane
  ctx.fillRect(1182, 80, 98, 400); // East street lane (Hotel Daniel side)

  // North-West Park Lawn (from top-left of reference image)
  ctx.fillStyle = '#143321';
  ctx.fillRect(102, 84, 250, 108);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.strokeRect(102, 84, 250, 108);

  // Dashed lane lines on North street
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.42)';
  ctx.lineWidth = 2;
  ctx.setLineDash([16, 14]);
  ctx.beginPath();
  ctx.moveTo(40, 40);
  ctx.lineTo(1240, 40);
  ctx.stroke();
  ctx.setLineDash([]);

  // Zebra Crosswalks at Europaplatz
  ctx.fillStyle = 'rgba(241, 245, 249, 0.68)';
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(365, 10 + i * 10, 26, 5);
    ctx.fillRect(745, 10 + i * 10, 26, 5);
  }

  // Diagonal Tramway Tracks (Straßenbahn Linie 1/4/6/7) entering Goldenes Auge
  ctx.save();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2.2;
  for (const offset of [-6, 6]) {
    ctx.beginPath();
    ctx.moveTo(430, 210 + offset);
    ctx.lineTo(680, 195 + offset);
    ctx.lineTo(980, 110 + offset);
    ctx.stroke();
  }
  // Red-White Graz Variobahn Tram parked at Stop B / A (North-East of Goldenes Auge)
  ctx.translate(855, 122);
  ctx.rotate(-0.22);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(-78, -14, 156, 32);
  ctx.fillStyle = '#DC2626';
  ctx.fillRect(-76, -15, 152, 28);
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(-72, -11, 144, 20);
  ctx.fillStyle = '#1E293B';
  for (let wx = -64; wx <= 52; wx += 24) {
    ctx.fillRect(wx, -9, 18, 16);
  }
  ctx.fillStyle = '#84CC16';
  ctx.font = 'bold 9px "JetBrains Mono", monospace';
  ctx.fillText('TRAM B/A', -24, 3);
  ctx.restore();

  // 2. ICONIC "GOLDENES AUGE" (ORANGE OVAL CANOPY ROOF) AT EUROPAPLATZ (x: 360..760, y: 80..320)
  ctx.save();
  const augeCx = 555;
  const augeCy = 195;
  // Skylight courtyard floor grid inside the oval
  ctx.beginPath();
  ctx.ellipse(augeCx, augeCy, 138, 86, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(30, 58, 95, 0.36)';
  ctx.fill();

  // Outer & Inner Goldenes Auge Ring Canopy (translucent so operators underneath remain visible)
  ctx.beginPath();
  ctx.ellipse(augeCx, augeCy, 152, 98, 0, 0, Math.PI * 2);
  ctx.ellipse(augeCx, augeCy, 102, 58, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(234, 138, 53, 0.34)';
  ctx.fill('evenodd');

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(augeCx, augeCy, 152, 98, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(augeCx, augeCy, 102, 58, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Tram Stop Badges D, E, F, B around the Goldenes Auge (matching uploaded image)
  const drawStopBadge = (bx: number, by: number, letter: string, bg: string) => {
    ctx.fillStyle = bg;
    ctx.fillRect(bx - 9, by - 9, 18, 18);
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(bx - 9, by - 9, 18, 18);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillText(letter, bx - 3.5, by + 3.5);
  };
  drawStopBadge(418, 182, 'E', '#06B6D4');
  drawStopBadge(452, 198, 'D', '#06B6D4');
  drawStopBadge(525, 108, 'F', '#06B6D4');
  drawStopBadge(712, 165, 'B', '#65A30D');
  ctx.restore();

  // 3. SPAR SUPERMARKET FLOOR & SIGNAGE (x: 100..360, y: 200..480)
  ctx.save();
  // Warm supermarket tile stripes
  ctx.fillStyle = 'rgba(245, 158, 11, 0.07)';
  ctx.fillRect(104, 204, 252, 272);
  // Iconic SPAR Red/Green Banner on North Wall
  ctx.fillStyle = '#DC2626';
  ctx.fillRect(122, 208, 114, 22);
  ctx.fillStyle = '#16A34A';
  ctx.beginPath();
  ctx.arc(218, 219, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 12px "JetBrains Mono", monospace';
  ctx.fillText('SPAR', 136, 223);
  ctx.restore();

  // 4. BAHNHOFSHALLE (MAIN CONCOURSE) DETAILS (x: 360..760, y: 320..480)
  ctx.save();
  // Red "Treffpunkt" (Meeting Point) Circle in Center of Concourse
  ctx.beginPath();
  ctx.arc(555, 365, 11, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(239, 68, 68, 0.78)';
  ctx.fill();
  ctx.strokeStyle = '#FECACA';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Blue ÖBB Info & Ticket Kiosk Badges
  ctx.fillStyle = '#1D4ED8';
  ctx.fillRect(465, 438, 22, 16);
  ctx.fillRect(625, 438, 22, 16);
  ctx.fillStyle = '#93C5FD';
  ctx.font = 'bold 8px "JetBrains Mono", monospace';
  ctx.fillText('ÖBB', 468, 449);
  ctx.fillText('INFO', 626, 449);
  ctx.restore();

  // 5. GASTRONOMIE & CAFÉ LOUNGE WOOD PARQUET FLOOR (x: 760..1180, y: 160..355)
  ctx.save();
  ctx.fillStyle = 'rgba(180, 83, 9, 0.18)';
  ctx.fillRect(764, 164, 412, 185);
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.14)';
  ctx.lineWidth = 1;
  for (let py = 172; py < 348; py += 12) {
    ctx.beginPath();
    ctx.moveTo(764, py);
    ctx.lineTo(1176, py);
    ctx.stroke();
  }
  ctx.restore();

  // 6. RAILWAY TRACKS, GRAVEL BALLAST & SLEEPERS (GLEIS 1–9, y: 480..815)
  ctx.save();
  // Crushed dark granite track bed below Mittelbahnsteig and along track corridors
  ctx.fillStyle = '#141820';
  ctx.fillRect(0, 482, 1280, 106);
  ctx.fillRect(0, 730, 1280, 90);

  const drawRailwayTrack = (yCenter: number) => {
    // Wooden/concrete sleepers (Bahnschwellen)
    ctx.fillStyle = '#2B2623';
    for (let tx = 8; tx < 1280; tx += 14) {
      ctx.fillRect(tx, yCenter - 11, 5, 22);
    }
    // Parallel steel rails (Schienen)
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, yCenter - 6);
    ctx.lineTo(1280, yCenter - 6);
    ctx.moveTo(0, yCenter + 6);
    ctx.lineTo(1280, yCenter + 6);
    ctx.stroke();
  };

  drawRailwayTrack(502); // Gleis 1
  drawRailwayTrack(535); // Gleis 2 (Hijacked Railjet main track)
  drawRailwayTrack(568); // Gleis 4
  drawRailwayTrack(748); // Gleis 8 (South freight/regional track)
  drawRailwayTrack(782); // Gleis 9 (South track)

  // 7. WEST TRAIN: YELLOW S-BAHN REGIONAL DOUBLE-DECKER (x: 112..485, y: 500..572)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(114, 504, 372, 70);
  // Yellow train body
  ctx.fillStyle = '#D97706';
  ctx.fillRect(112, 502, 370, 68);
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(118, 508, 358, 56);
  // Roof cooling units & pantograph ribs
  ctx.fillStyle = '#78350F';
  for (let rx = 145; rx <= 435; rx += 58) {
    ctx.fillRect(rx, 520, 34, 32);
  }
  ctx.fillStyle = '#FEF3C7';
  ctx.font = 'bold 9px "JetBrains Mono", monospace';
  ctx.fillText('S-BAHN STEIERMARK (GLEIS 1)', 165, 540);

  // 8. EAST TRAIN (HIJACKED OBJECTIVE): ÖBB RAILJET EXPRESS (x: 560..1180, y: 480..590)
  // Outer crimson & metallic silver Railjet hull stripes along top and bottom of carriage
  ctx.fillStyle = '#991B1B';
  ctx.fillRect(560, 480, 620, 14);
  ctx.fillRect(560, 576, 620, 14);

  // Interior floor of Waggon 1 (x: 560..960) & Führerstand Cab (x: 960..1180)
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(562, 494, 396, 82);
  ctx.fillStyle = '#27171C';
  ctx.fillRect(962, 494, 216, 82);

  // Central blue/grey carpeted aisle running down the train
  ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.fillRect(566, 524, 560, 22);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
  ctx.lineWidth = 1;
  ctx.strokeRect(566, 524, 560, 22);

  // Airline-style passenger seats along North & South windows of Waggon 1
  for (let sx = 582; sx <= 920; sx += 38) {
    // Skip doorway zones (x: 640..710 and x: 815..885)
    if ((sx > 625 && sx < 715) || (sx > 800 && sx < 890)) continue;
    ctx.fillStyle = '#1E3A8A';
    ctx.fillRect(sx, 497, 24, 20);
    ctx.fillRect(sx, 553, 24, 20);
    ctx.fillStyle = '#DC2626'; // Red headrest trim
    ctx.fillRect(sx + 18, 498, 5, 18);
    ctx.fillRect(sx + 18, 554, 5, 18);
  }

  // Locomotive Cab (Führerstand, x: 960..1180) Aerodynamic Nose & Control Console
  ctx.fillStyle = '#DC2626';
  ctx.beginPath();
  ctx.moveTo(1135, 482);
  ctx.lineTo(1178, 502);
  ctx.lineTo(1178, 568);
  ctx.lineTo(1135, 588);
  ctx.closePath();
  ctx.fill();

  // Armored wrap-around locomotive windshield
  ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.beginPath();
  ctx.moveTo(1130, 496);
  ctx.lineTo(1164, 510);
  ctx.lineTo(1164, 560);
  ctx.lineTo(1130, 574);
  ctx.closePath();
  ctx.fill();

  // Illuminated ETCS / Traction Control Desk in Cab
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(1102, 506, 26, 58);
  ctx.fillStyle = '#EF4444';
  ctx.fillRect(1106, 512, 8, 12);
  ctx.fillStyle = '#38BDF8';
  ctx.fillRect(1106, 530, 8, 16);
  ctx.fillStyle = '#10B981';
  ctx.fillRect(1106, 550, 8, 8);

  // Labels on the hijacked train
  ctx.fillStyle = 'rgba(254, 202, 202, 0.72)';
  ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
  ctx.fillText('ÖBB RAILJET 558 · WAGGON 1 (SECUESTRADO)', 585, 539);
  ctx.fillStyle = '#FCA5A5';
  ctx.fillText('FÜHRERSTAND (CABINA)', 978, 539);

  // 9. MITTELBAHNSTEIG 2–7 SAFETY LINES & TRACK BADGES (x: 100..1180, y: 590..730)
  // Yellow tactile safety lines along platform edges
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 6]);
  ctx.beginPath();
  ctx.moveTo(110, 598);
  ctx.lineTo(1170, 598);
  ctx.moveTo(110, 722);
  ctx.lineTo(1170, 722);
  ctx.stroke();
  ctx.setLineDash([]);

  // Purple/Blue Track Number Badges (matching 1, 2, 4, 5, 6, 7 in uploaded image)
  const drawTrackBadge = (bx: number, by: number, num: string) => {
    ctx.fillStyle = '#4338CA';
    ctx.fillRect(bx - 8, by - 8, 16, 16);
    ctx.strokeStyle = '#A5B4FC';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx - 8, by - 8, 16, 16);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillText(num, bx - 3, by + 3);
  };
  drawTrackBadge(755, 468, '1');
  drawTrackBadge(910, 492, '2');
  drawTrackBadge(910, 580, '4');
  drawTrackBadge(910, 608, '5');
  drawTrackBadge(785, 695, '6');
  drawTrackBadge(785, 715, '7');

  ctx.restore();
}

/**
 * Renders a FurnitureItem using its extracted TC Modern Battlemap / Basement / City Road sprite
 */
export function renderBattlemapFurnitureItem(
  ctx: CanvasRenderingContext2D,
  item: FurnitureItem
) {
  if (item.isDestroyed) {
    ctx.save();
    ctx.fillStyle = '#181E29';
    ctx.fillRect(item.x, item.y, item.w, item.h);
    ctx.fillStyle = '#451A03';
    ctx.fillRect(item.x + 3, item.y + 3, item.w - 6, item.h - 6);
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(item.x + 2, item.y + 2);
    ctx.lineTo(item.x + item.w - 2, item.y + item.h - 2);
    ctx.moveTo(item.x + item.w - 2, item.y + 2);
    ctx.lineTo(item.x + 2, item.y + item.h - 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const sprite = item.spriteId ? battlemapAssetCache.getSprite(item.spriteId) : undefined;

  if (!sprite) {
    ctx.fillStyle = item.color;
    ctx.fillRect(item.x, item.y, item.w, item.h);
    ctx.strokeStyle = item.blocksSight ? '#64748B' : 'rgba(148, 163, 184, 0.28)';
    ctx.lineWidth = item.blocksSight ? 2 : 1;
    ctx.strokeRect(item.x, item.y, item.w, item.h);

    if (item.label && item.w >= 32) {
      ctx.fillStyle = 'rgba(226, 232, 240, 0.35)';
      ctx.font = '500 8px "JetBrains Mono", monospace';
      ctx.fillText(item.label, item.x + 4, item.y + item.h * 0.5 + 3);
    }
    return;
  }

  ctx.save();
  const cx = item.x + item.w * 0.5;
  const cy = item.y + item.h * 0.5;
  ctx.translate(cx, cy);

  let rot = item.rotation ?? 0;
  if (item.rotation === undefined) {
    const spriteLandscape = sprite.width > sprite.height * 1.18;
    const spritePortrait = sprite.height > sprite.width * 1.18;
    const boxLandscape = item.w > item.h * 1.18;
    const boxPortrait = item.h > item.w * 1.18;
    if ((spriteLandscape && boxPortrait) || (spritePortrait && boxLandscape)) {
      rot = Math.PI / 2;
    }
  }

  ctx.rotate(rot);

  const swapped = Math.abs(Math.sin(rot)) > 0.707;
  const drawW = swapped ? item.h : item.w;
  const drawH = swapped ? item.w : item.h;

  // Ambient drop shadow under physical props & furniture
  if (item.zLayer !== 'FLOOR') {
    ctx.fillStyle = item.zLayer === 'SURFACE' ? 'rgba(2, 6, 14, 0.32)' : 'rgba(2, 6, 14, 0.5)';
    ctx.beginPath();
    ctx.roundRect(
      -drawW * 0.5 + 1.5,
      -drawH * 0.5 + 2.5,
      drawW,
      drawH,
      Math.min(4, drawW * 0.14)
    );
    ctx.fill();
  }

  ctx.globalAlpha = item.zLayer === 'FLOOR' ? 0.85 : 0.94;

  // For long modular counters (e.g. Küchenzeile 162x28), tile 2 adjacent units so wood texture isn't stretched
  if (item.spriteId === 'WOOD_CREDVA' && drawW > drawH * 4.2) {
    const halfW = drawW * 0.5;
    ctx.drawImage(sprite, -halfW, -drawH * 0.5, halfW, drawH);
    ctx.drawImage(sprite, 0, -drawH * 0.5, halfW, drawH);
  } else {
    ctx.drawImage(sprite, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
  }

  // Subtle night-ops ambient shading tint so the sprite integrates with the apartment lighting
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(11, 18, 30, 0.16)';
  ctx.fillRect(-drawW * 0.5, -drawH * 0.5, drawW, drawH);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  if (item.blocksSight) {
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = 1.1;
    ctx.strokeRect(-drawW * 0.5, -drawH * 0.5, drawW, drawH);
  }

  ctx.restore();

  // Tactical blueprint micro-label on primary furniture
  if (item.label && !item.isRandomProp && item.w >= 44 && item.h >= 24) {
    ctx.save();
    ctx.fillStyle = 'rgba(226, 232, 240, 0.42)';
    ctx.font = '600 7.5px "JetBrains Mono", monospace';
    ctx.fillText(item.label, item.x + 4, item.y + item.h - 4);
    ctx.restore();
  }
}

interface CandidateRandomProp {
  spriteId: BattlemapSpriteId;
  label: string;
  w: number;
  h: number;
  blocksMovement: boolean;
  blocksSight: boolean;
  zLayer: 'FLOOR' | 'BASE' | 'SURFACE';
  rotations: number[];
}

// Human-proportioned room pools including Basement A.jpg stairwell/storage items
const ROOM_RANDOM_POOLS: Record<string, CandidateRandomProp[]> = {
  STIEGENHAUS: [
    {
      spriteId: 'WOOD_CRATE_X',
      label: 'HOLZKISTE',
      w: 26,
      h: 26,
      blocksMovement: true,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0, 0.25, Math.PI / 2],
    },
    {
      spriteId: 'WOOD_BARREL',
      label: 'HOLZFASS',
      w: 22,
      h: 22,
      blocksMovement: true,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0, 0.9, 2.1],
    },
    {
      spriteId: 'FLOOR_GRATE',
      label: 'BODENGITTER',
      w: 28,
      h: 28,
      blocksMovement: false,
      blocksSight: false,
      zLayer: 'FLOOR',
      rotations: [0, Math.PI / 2],
    },
    {
      spriteId: 'FIRE_EXTINGUISHER',
      label: 'FEUERLÖSCHER',
      w: 15,
      h: 13,
      blocksMovement: false,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0, Math.PI / 2, Math.PI],
    },
    {
      spriteId: 'TRASH_CAN_METAL',
      label: 'MÜLLTONNE',
      w: 19,
      h: 19,
      blocksMovement: true,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0, 0.8, 1.9],
    },
    {
      spriteId: 'WOOD_BENCH',
      label: 'FLURBANK',
      w: 22,
      h: 52,
      blocksMovement: true,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [Math.PI / 2],
    },
  ],
  VORRAUM: [
    {
      spriteId: 'DOORMAT_DARK',
      label: 'FUSSMATTE',
      w: 22,
      h: 32,
      blocksMovement: false,
      blocksSight: false,
      zLayer: 'FLOOR',
      rotations: [0, Math.PI / 2],
    },
    {
      spriteId: 'WOOD_CRATE_X',
      label: 'LAGERKISTE',
      w: 25,
      h: 25,
      blocksMovement: true,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0, 0.3],
    },
    {
      spriteId: 'NIGHTSTAND_SQUARE',
      label: 'BEISTELLTISCH',
      w: 22,
      h: 22,
      blocksMovement: true,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0, Math.PI / 2],
    },
    {
      spriteId: 'WOOD_CHAIR_A',
      label: 'HOLZSTUHL',
      w: 18,
      h: 19,
      blocksMovement: true,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0, Math.PI / 2, Math.PI, -Math.PI / 2],
    },
    {
      spriteId: 'FIRE_EXTINGUISHER',
      label: 'FEUERLÖSCHER',
      w: 15,
      h: 13,
      blocksMovement: false,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0, Math.PI / 2],
    },
  ],
  WOHNKUECHE: [
    {
      spriteId: 'DISHWASHER_UNIT',
      label: 'SPÜLMASCHINE',
      w: 28,
      h: 28,
      blocksMovement: true,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0],
    },
    {
      spriteId: 'WOOD_BARREL',
      label: 'WEINFASS',
      w: 22,
      h: 22,
      blocksMovement: true,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0, 0.6],
    },
    {
      spriteId: 'TRASH_CAN_METAL',
      label: 'MÜLLEIMER',
      w: 18,
      h: 18,
      blocksMovement: true,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0, 1.1],
    },
    {
      spriteId: 'PROPANE_TANK',
      label: 'GASFLASCHE',
      w: 17,
      h: 17,
      blocksMovement: true,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0, 0.7],
    },
    {
      spriteId: 'WATER_BUCKET',
      label: 'EIMER',
      w: 15,
      h: 15,
      blocksMovement: false,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0],
    },
  ],
  BADEZIMMER: [
    {
      spriteId: 'TOILET_BOWL',
      label: 'WC',
      w: 20,
      h: 27,
      blocksMovement: true,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0, Math.PI],
    },
    {
      spriteId: 'WASHING_MACHINE',
      label: 'WASCHMASCHINE',
      w: 28,
      h: 30,
      blocksMovement: true,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0, Math.PI / 2, -Math.PI / 2],
    },
    {
      spriteId: 'FLOOR_GRATE',
      label: 'BODENABLAUF',
      w: 22,
      h: 22,
      blocksMovement: false,
      blocksSight: false,
      zLayer: 'FLOOR',
      rotations: [0],
    },
    {
      spriteId: 'WATER_BUCKET',
      label: 'EIMER',
      w: 15,
      h: 15,
      blocksMovement: false,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0, 0.9],
    },
    {
      spriteId: 'DOORMAT_DARK',
      label: 'BADEMATTE',
      w: 30,
      h: 20,
      blocksMovement: false,
      blocksSight: false,
      zLayer: 'FLOOR',
      rotations: [Math.PI / 2],
    },
  ],
  WOHNZIMMER: [
    {
      spriteId: 'MILITARY_CRATE',
      label: 'WAFFENKISTE',
      w: 38,
      h: 26,
      blocksMovement: true,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0, 0.2, Math.PI / 2],
    },
    {
      spriteId: 'WOOD_CRATE_X',
      label: 'SCHMUGGELKISTE',
      w: 28,
      h: 28,
      blocksMovement: true,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0, 0.4],
    },
    {
      spriteId: 'OFFICE_CHAIR_BLACK',
      label: 'DREHSTUHL',
      w: 20,
      h: 22,
      blocksMovement: true,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0, 0.6, -0.5, Math.PI],
    },
    {
      spriteId: 'ARMCHAIR_GREY',
      label: 'LESESESSEL',
      w: 32,
      h: 30,
      blocksMovement: true,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0, Math.PI / 2, Math.PI, -Math.PI / 2],
    },
    {
      spriteId: 'NIGHTSTAND_WIDE',
      label: 'SIDEBOARD',
      w: 38,
      h: 22,
      blocksMovement: true,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0, Math.PI / 2],
    },
    {
      spriteId: 'DOORMAT_DARK',
      label: 'TEPPICH',
      w: 42,
      h: 28,
      blocksMovement: false,
      blocksSight: false,
      zLayer: 'FLOOR',
      rotations: [Math.PI / 2],
    },
  ],
  SCHLAFZIMMER: [
    {
      spriteId: 'NIGHTSTAND_SQUARE',
      label: 'NACHTTISCH',
      w: 22,
      h: 22,
      blocksMovement: true,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0],
    },
    {
      spriteId: 'OFFICE_CHAIR_BLACK',
      label: 'SCHREIBTISCHSTUHL',
      w: 20,
      h: 21,
      blocksMovement: false,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [Math.PI, Math.PI - 0.3, Math.PI + 0.3],
    },
    {
      spriteId: 'MILITARY_CRATE',
      label: 'MUNITIONSKISTE',
      w: 36,
      h: 25,
      blocksMovement: true,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0, 0.35],
    },
    {
      spriteId: 'BED_SINGLE',
      label: 'GÄSTEBETT',
      w: 40,
      h: 72,
      blocksMovement: true,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0],
    },
    {
      spriteId: 'DOORMAT_DARK',
      label: 'BETTVORLEGER',
      w: 22,
      h: 34,
      blocksMovement: false,
      blocksSight: false,
      zLayer: 'FLOOR',
      rotations: [0],
    },
  ],
  LOGGIA: [
    {
      spriteId: 'WOOD_BENCH',
      label: 'BALKONBANK',
      w: 22,
      h: 54,
      blocksMovement: true,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [Math.PI / 2],
    },
    {
      spriteId: 'WOOD_BARREL',
      label: 'REGENFASS',
      w: 22,
      h: 22,
      blocksMovement: true,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0, 0.8],
    },
    {
      spriteId: 'FLOOR_GRATE',
      label: 'ABFLUSSGITTER',
      w: 24,
      h: 24,
      blocksMovement: false,
      blocksSight: false,
      zLayer: 'FLOOR',
      rotations: [0],
    },
    {
      spriteId: 'PROPANE_TANK',
      label: 'PROPANGAS',
      w: 17,
      h: 17,
      blocksMovement: true,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0, 1.1],
    },
    {
      spriteId: 'STREET_TREE',
      label: 'KÜBELPFLANZE',
      w: 26,
      h: 26,
      blocksMovement: true,
      blocksSight: false,
      zLayer: 'BASE',
      rotations: [0],
    },
  ],
};

/**
 * Assigns battlemap asset sprites to existing furniture and generates randomized
 * props across all rooms and exterior streets while keeping doorways unobstructed.
 */
export function populateRandomBattlemapElements(
  rooms: RoomZone[],
  baseFurniture: FurnitureItem[],
  doors: DoorEntity[],
  mode: 'APARTMENT' | 'TRAINING' | 'STATION' = 'APARTMENT'
): FurnitureItem[] {
  battlemapAssetCache.ensureLoaded();

  const items: FurnitureItem[] = baseFurniture.map((f) => ({ ...f }));

  // 1. Map existing fixed furniture to their authentic sprites
  for (const f of items) {
    switch (f.id) {
      case 'f_stairs':
        f.spriteId = 'STONE_STAIRS';
        f.rotation = 0;
        f.zLayer = 'BASE';
        break;
      case 'f_garderobe':
        f.spriteId = 'WOOD_CREDVA';
        f.rotation = 0;
        f.zLayer = 'BASE';
        break;
      case 'f_kitchen_counter':
        f.spriteId = 'WOOD_CREDVA';
        f.rotation = 0;
        f.zLayer = 'BASE';
        break;
      case 'f_dining_table':
        f.spriteId = Math.random() < 0.5 ? 'WOOD_TABLE_SMOOTH' : 'WOOD_TABLE_SLATTED';
        f.rotation = Math.PI / 2;
        f.zLayer = 'BASE';
        break;
      case 'f_bathtub':
        f.spriteId = 'SHOWER_STALL';
        f.rotation = 0;
        f.zLayer = 'BASE';
        break;
      case 'f_washbasin':
        f.spriteId = 'BATH_SINK';
        f.rotation = -Math.PI / 2;
        f.zLayer = 'BASE';
        break;
      case 'f_sofa':
        f.spriteId = 'SOFA_2SEAT';
        f.rotation = Math.PI;
        f.zLayer = 'BASE';
        break;
      case 'f_coffeetable':
        f.spriteId = Math.random() < 0.5 ? 'WOOD_TABLE_SLATTED' : 'WOOD_TABLE_SMOOTH';
        f.rotation = Math.PI / 2;
        f.zLayer = 'BASE';
        break;
      case 'f_schrankwand':
        f.spriteId = 'WOOD_CREDVA';
        f.rotation = 0;
        f.zLayer = 'BASE';
        break;
      case 'f_bed':
        f.spriteId = 'BED_DOUBLE';
        f.rotation = 0;
        f.zLayer = 'BASE';
        break;
      case 'f_wardrobe':
        f.spriteId = 'WOOD_CREDVA';
        f.rotation = Math.PI / 2;
        f.zLayer = 'BASE';
        break;
      case 'f_bookshelf':
        f.spriteId = 'NIGHTSTAND_WIDE';
        f.rotation = Math.PI / 2;
        f.zLayer = 'BASE';
        break;
      case 'f_desk':
        f.spriteId = 'WOOD_TABLE_SMOOTH';
        f.rotation = Math.PI / 2;
        f.zLayer = 'BASE';
        break;
      case 'f_armchair':
        f.spriteId = 'ARMCHAIR_GREY';
        f.rotation = Math.PI / 2;
        f.zLayer = 'BASE';
        break;
      case 'f_fridge':
        f.spriteId = 'FRIDGE_UNIT';
        f.rotation = 0;
        f.zLayer = 'BASE';
        break;
      case 'f_plant':
        f.spriteId = 'STREET_TREE';
        f.rotation = 0;
        f.zLayer = 'BASE';
        break;
      case 'TF_BENCH':
        f.spriteId = 'WOOD_TABLE_SLATTED';
        f.rotation = Math.PI / 2;
        f.zLayer = 'BASE';
        break;
      default:
        break;
    }
  }

  let propCounter = 1;
  const nextId = (prefix: string) => `${prefix}_${propCounter++}`;

  if (mode === 'TRAINING') {
    const trainingProps: FurnitureItem[] = [
      {
        id: nextId('tf_crate'),
        label: 'MUNITIONSKISTE',
        x: 118,
        y: 175 + Math.floor(Math.random() * 40),
        w: 36,
        h: 25,
        color: '#334155',
        blocksSight: false,
        blocksMovement: true,
        spriteId: 'MILITARY_CRATE',
        rotation: 0,
        zLayer: 'BASE',
        isRandomProp: true,
      },
      {
        id: nextId('tf_woodcrate'),
        label: 'HOLZKISTE',
        x: 120,
        y: 380 + Math.floor(Math.random() * 35),
        w: 28,
        h: 28,
        color: '#784F2B',
        blocksSight: false,
        blocksMovement: true,
        spriteId: 'WOOD_CRATE_X',
        rotation: 0.2,
        zLayer: 'BASE',
        isRandomProp: true,
      },
      {
        id: nextId('tf_ext'),
        label: 'FEUERLÖSCHER',
        x: 92,
        y: 455,
        w: 15,
        h: 13,
        color: '#991B1B',
        blocksSight: false,
        blocksMovement: false,
        spriteId: 'FIRE_EXTINGUISHER',
        rotation: 0,
        zLayer: 'BASE',
        isRandomProp: true,
      },
      {
        id: nextId('tf_car'),
        label: 'EINSATZFAHRZEUG (DECKUNG)',
        x: 790 + Math.floor(Math.random() * 80),
        y: 590,
        w: 122,
        h: 58,
        color: '#1E3A8A',
        blocksSight: false,
        blocksMovement: true,
        spriteId: Math.random() < 0.5 ? 'SEDAN_CAR_BLUE' : 'SEDAN_CAR_AMBER',
        rotation: Math.random() < 0.5 ? 0 : Math.PI,
        zLayer: 'BASE',
        isRandomProp: true,
      },
      {
        id: nextId('tf_crate_breach'),
        label: 'DECKUNGSKISTE',
        x: 525 + Math.floor(Math.random() * 60),
        y: 555 + Math.floor(Math.random() * 90),
        w: 38,
        h: 26,
        color: '#334155',
        blocksSight: false,
        blocksMovement: true,
        spriteId: 'MILITARY_CRATE',
        rotation: Math.random() < 0.5 ? 0 : Math.PI / 2,
        zLayer: 'BASE',
        isRandomProp: true,
      },
      {
        id: nextId('tf_barrel'),
        label: 'HOLZFASS',
        x: 468,
        y: 690,
        w: 24,
        h: 24,
        color: '#734827',
        blocksSight: false,
        blocksMovement: true,
        spriteId: 'WOOD_BARREL',
        rotation: 0.4,
        zLayer: 'BASE',
        isRandomProp: true,
      },
    ];
    items.push(...trainingProps);
    return sortFurnitureByZLayer(items);
  }

  if (mode === 'STATION') {
    for (const f of items) {
      if (f.id.startsWith('st_bench')) {
        f.spriteId = 'WOOD_BENCH';
        f.rotation = 0;
        f.zLayer = 'BASE';
      } else if (f.id.startsWith('st_table')) {
        f.spriteId = 'WOOD_TABLE_SMOOTH';
        f.rotation = Math.PI / 2;
        f.zLayer = 'BASE';
      } else if (f.id.startsWith('st_sofa')) {
        f.spriteId = 'SOFA_2SEAT';
        f.rotation = 0;
        f.zLayer = 'BASE';
      } else if (f.id.startsWith('st_shelf') || f.id.startsWith('st_counter')) {
        f.spriteId = 'WOOD_CREDVA';
        f.rotation = 0;
        f.zLayer = 'BASE';
      } else if (f.id.startsWith('st_crate')) {
        f.spriteId = 'MILITARY_CRATE';
        f.rotation = 0;
        f.zLayer = 'BASE';
      } else if (f.id.startsWith('st_stairs')) {
        f.spriteId = 'STONE_STAIRS';
        f.rotation = 0;
        f.zLayer = 'BASE';
      }
    }

    // Add authentic parked cars and trees at Europaplatz & random luggage/crates on platforms
    items.push(
      {
        id: nextId('st_car_ibis'),
        label: 'POLIZEI / TAXI (EUROPAPLATZ)',
        x: 135,
        y: 18,
        w: 116,
        h: 54,
        color: '#1E3A8A',
        blocksSight: false,
        blocksMovement: true,
        spriteId: 'SEDAN_CAR_BLUE',
        rotation: 0,
        zLayer: 'BASE',
        isRandomProp: true,
      },
      {
        id: nextId('st_car_east'),
        label: 'TAXI (HOTEL DANIEL)',
        x: 1015,
        y: 18,
        w: 116,
        h: 54,
        color: '#B45309',
        blocksSight: false,
        blocksMovement: true,
        spriteId: 'SEDAN_CAR_AMBER',
        rotation: Math.PI,
        zLayer: 'BASE',
        isRandomProp: true,
      },
      {
        id: nextId('st_tree_1'),
        label: 'PARKBAUM',
        x: 125,
        y: 105,
        w: 36,
        h: 36,
        color: '#166534',
        blocksSight: false,
        blocksMovement: true,
        spriteId: 'STREET_TREE',
        rotation: 0,
        zLayer: 'BASE',
        isRandomProp: true,
      },
      {
        id: nextId('st_tree_2'),
        label: 'PARKBAUM',
        x: 215,
        y: 118,
        w: 36,
        h: 36,
        color: '#166534',
        blocksSight: false,
        blocksMovement: true,
        spriteId: 'STREET_TREE',
        rotation: 1.2,
        zLayer: 'BASE',
        isRandomProp: true,
      },
      {
        id: nextId('st_tree_3'),
        label: 'PARKBAUM',
        x: 295,
        y: 102,
        w: 36,
        h: 36,
        color: '#166534',
        blocksSight: false,
        blocksMovement: true,
        spriteId: 'STREET_TREE',
        rotation: 2.1,
        zLayer: 'BASE',
        isRandomProp: true,
      }
    );

    return sortFurnitureByZLayer(items);
  }

  // 2. Surface & appliance attachments on top of counters/tables (scaled to 22px human scale)
  const kitchenCounter = items.find((i) => i.id === 'f_kitchen_counter');
  if (kitchenCounter) {
    const swapKitchenLayout = Math.random() < 0.5;
    items.push(
      {
        id: nextId('rnd_sink'),
        label: 'SPÜLE',
        x: kitchenCounter.x + (swapKitchenLayout ? 10 : 72),
        y: kitchenCounter.y + 3,
        w: 36,
        h: 21,
        color: '#475569',
        blocksSight: false,
        blocksMovement: false,
        spriteId: 'KITCHEN_SINK',
        rotation: 0,
        zLayer: 'SURFACE',
        isRandomProp: true,
      },
      {
        id: nextId('rnd_stove'),
        label: 'KOCHFELD',
        x: kitchenCounter.x + (swapKitchenLayout ? 64 : 10),
        y: kitchenCounter.y + 3,
        w: 44,
        h: 22,
        color: '#1E293B',
        blocksSight: false,
        blocksMovement: false,
        spriteId: 'STOVE_COOKTOP',
        rotation: 0,
        zLayer: 'SURFACE',
        isRandomProp: true,
      }
    );

    const counterSmallPool: BattlemapSpriteId[] = ['TOASTER', 'COFFEE_CARAFE', 'CAST_IRON_PAN'];
    const chosenSmall =
      counterSmallPool[Math.floor(Math.random() * counterSmallPool.length)];
    const smallSpec = BATTLEMAP_SPRITE_SPECS[chosenSmall];
    items.push({
      id: nextId('rnd_ksmall'),
      label: smallSpec.labelDe,
      x: kitchenCounter.x + 128 + Math.floor(Math.random() * 14),
      y: kitchenCounter.y + 7,
      w: smallSpec.defaultW,
      h: smallSpec.defaultH,
      color: '#334155',
      blocksSight: false,
      blocksMovement: false,
      spriteId: chosenSmall,
      rotation: (Math.random() - 0.5) * 0.4,
      zLayer: 'SURFACE',
      isRandomProp: true,
    });
  }

  // Dining table surface prop + randomized dining chairs around it
  const diningTable = items.find((i) => i.id === 'f_dining_table');
  if (diningTable) {
    const tableTopSprites: BattlemapSpriteId[] = ['FRUIT_BOWL', 'COFFEE_CARAFE', 'CAST_IRON_PAN'];
    const tableProp = tableTopSprites[Math.floor(Math.random() * tableTopSprites.length)];
    const propSpec = BATTLEMAP_SPRITE_SPECS[tableProp];
    items.push({
      id: nextId('rnd_dining_top'),
      label: propSpec.labelDe,
      x: diningTable.x + 16 + Math.floor(Math.random() * 32),
      y: diningTable.y + 12 + Math.floor(Math.random() * 16),
      w: propSpec.defaultW,
      h: propSpec.defaultH,
      color: '#7F1D1D',
      blocksSight: false,
      blocksMovement: false,
      spriteId: tableProp,
      rotation: Math.random() * Math.PI * 2,
      zLayer: 'SURFACE',
      isRandomProp: true,
    });

    const chairPositions = [
      { x: diningTable.x + 10, y: diningTable.y - 18, rot: 0 },
      { x: diningTable.x + 42, y: diningTable.y - 18, rot: 0 },
      { x: diningTable.x + 10, y: diningTable.y + diningTable.h + 1, rot: Math.PI },
      { x: diningTable.x + 42, y: diningTable.y + diningTable.h + 1, rot: Math.PI },
    ];
    for (const cp of chairPositions) {
      if (Math.random() < 0.78) {
        items.push({
          id: nextId('rnd_dchair'),
          label: 'STUHL',
          x: cp.x + Math.floor((Math.random() - 0.5) * 5),
          y: cp.y,
          w: 18,
          h: 18,
          color: '#452719',
          blocksSight: false,
          blocksMovement: false,
          spriteId: Math.random() < 0.5 ? 'WOOD_CHAIR_A' : 'WOOD_CHAIR_B',
          rotation: cp.rot + (Math.random() - 0.5) * 0.25,
          zLayer: 'BASE',
          isRandomProp: true,
        });
      }
    }
  }

  // Coffee table in Wohnzimmer: random fruit bowl or coffee carafe + TV on Schrankwand
  const coffeeTable = items.find((i) => i.id === 'f_coffeetable');
  if (coffeeTable && Math.random() < 0.85) {
    const pick: BattlemapSpriteId = Math.random() < 0.55 ? 'FRUIT_BOWL' : 'COFFEE_CARAFE';
    const pickSpec = BATTLEMAP_SPRITE_SPECS[pick];
    items.push({
      id: nextId('rnd_ctable_top'),
      label: pickSpec.labelDe,
      x: coffeeTable.x + 12 + Math.floor(Math.random() * 22),
      y: coffeeTable.y + 7 + Math.floor(Math.random() * 8),
      w: pickSpec.defaultW,
      h: pickSpec.defaultH,
      color: '#334155',
      blocksSight: false,
      blocksMovement: false,
      spriteId: pick,
      rotation: Math.random() * Math.PI * 2,
      zLayer: 'SURFACE',
      isRandomProp: true,
    });
  }

  const schrankwand = items.find((i) => i.id === 'f_schrankwand');
  if (schrankwand) {
    items.push({
      id: nextId('rnd_tv'),
      label: 'TV-GERÄT',
      x: schrankwand.x + 22 + Math.floor(Math.random() * 18),
      y: schrankwand.y + 5,
      w: 54,
      h: 16,
      color: '#0F172A',
      blocksSight: false,
      blocksMovement: false,
      spriteId: 'TV_FLAT',
      rotation: Math.PI,
      zLayer: 'SURFACE',
      isRandomProp: true,
    });
  }

  // 3. Exterior City Road Props (from City Roads sheet: parked cars, street trees, grates, crates)
  // Parked cars on East diagonal parking bay & North/South streets
  const eastCarModel: BattlemapSpriteId =
    Math.random() < 0.5 ? 'SEDAN_CAR_BLUE' : 'SEDAN_CAR_AMBER';
  items.push({
    id: nextId('rnd_ext_car_e'),
    label: 'PKW (PARKBUCHT)',
    x: 1175,
    y: 410 + Math.floor(Math.random() * 130),
    w: 56,
    h: 118,
    color: '#1E3A8A',
    blocksSight: false,
    blocksMovement: true,
    spriteId: eastCarModel,
    rotation: Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2,
    zLayer: 'BASE',
    isRandomProp: true,
  });

  // Second vehicle on North or South avenue
  const northCarModel: BattlemapSpriteId =
    eastCarModel === 'SEDAN_CAR_BLUE' ? 'SEDAN_CAR_AMBER' : 'SEDAN_CAR_BLUE';
  items.push({
    id: nextId('rnd_ext_car_n'),
    label: 'PKW (HERRENGASSE)',
    x: 240 + Math.floor(Math.random() * 160),
    y: 12,
    w: 116,
    h: 54,
    color: '#B45309',
    blocksSight: false,
    blocksMovement: true,
    spriteId: northCarModel,
    rotation: Math.PI,
    zLayer: 'BASE',
    isRandomProp: true,
  });

  // Circular Street Tree Planters along the sidewalks & NE plaza (from City Roads sheet)
  const treeSpots = [
    { x: 1068, y: 125 },
    { x: 1172, y: 195 },
    { x: 1075, y: 275 },
    { x: 615, y: 734 },
    { x: 820, y: 734 },
  ];
  for (const ts of treeSpots) {
    if (Math.random() < 0.75) {
      items.push({
        id: nextId('rnd_street_tree'),
        label: 'STRASSENBAUM',
        x: ts.x + Math.floor((Math.random() - 0.5) * 10),
        y: ts.y,
        w: 36,
        h: 36,
        color: '#166534',
        blocksSight: false,
        blocksMovement: true,
        spriteId: 'STREET_TREE',
        rotation: Math.random() * Math.PI * 2,
        zLayer: 'BASE',
        isRandomProp: true,
      });
    }
  }

  // Protected zones (actors' initial positions and doorway swing radii)
  const protectedPoints: { x: number; y: number; r: number }[] = [
    { x: 185, y: 410, r: 46 }, // Kobra-1 Entry A
    { x: 145, y: 455, r: 46 }, // Kobra-2 Entry A
    { x: 1045, y: 535, r: 46 }, // Kobra-1 Entry B
    { x: 1085, y: 585, r: 46 }, // Kobra-2 Entry B
    { x: 430, y: 205, r: 40 }, // Suspect Lukas
    { x: 825, y: 530, r: 40 }, // Suspect Milan
    { x: 815, y: 200, r: 40 }, // Suspect Markus
    { x: 945, y: 265, r: 38 }, // Hostage Julia
    { x: 325, y: 605, r: 38 }, // Civilian Hanna
  ];

  for (const d of doors) {
    const mx = (d.x1 + d.x2) * 0.5;
    const my = (d.y1 + d.y2) * 0.5;
    protectedPoints.push({ x: mx, y: my, r: 62 });
  }

  const overlapsExisting = (x: number, y: number, w: number, h: number, pad = 9): boolean => {
    const cx = x + w * 0.5;
    const cy = y + h * 0.5;
    for (const pt of protectedPoints) {
      const nearX = Math.max(x, Math.min(pt.x, x + w));
      const nearY = Math.max(y, Math.min(pt.y, y + h));
      if (Math.hypot(pt.x - nearX, pt.y - nearY) < pt.r) {
        return true;
      }
    }
    for (const other of items) {
      if (other.zLayer === 'SURFACE') continue;
      if (
        x < other.x + other.w + pad &&
        x + w + pad > other.x &&
        y < other.y + other.h + pad &&
        y + h + pad > other.y
      ) {
        return true;
      }
    }
    if (cx > 335 && cx < 445 && cy > 340 && cy < 485) return true;
    return false;
  };

  // 4. Procedural per-room random scatter from ROOM_RANDOM_POOLS
  for (const room of rooms) {
    const pool = ROOM_RANDOM_POOLS[room.id];
    if (!pool || pool.length === 0) continue;

    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const targetCount = 2 + Math.floor(Math.random() * 2); // 2 to 3 random props per room
    let placedInRoom = 0;

    for (const candidate of shuffled) {
      if (placedInRoom >= targetCount) break;

      const rot =
        candidate.rotations[Math.floor(Math.random() * candidate.rotations.length)];
      const margin = 12;

      for (let attempt = 0; attempt < 24; attempt++) {
        const minX = room.x + margin;
        const maxX = room.x + room.w - candidate.w - margin;
        const minY = room.y + margin;
        const maxY = room.y + room.h - candidate.h - margin;
        if (maxX <= minX || maxY <= minY) break;

        let px: number;
        let py: number;
        const snapEdge = attempt % 4;
        if (snapEdge === 0) {
          px = minX + Math.floor(Math.random() * (maxX - minX));
          py = minY;
        } else if (snapEdge === 1) {
          px = minX + Math.floor(Math.random() * (maxX - minX));
          py = maxY;
        } else if (snapEdge === 2) {
          px = minX;
          py = minY + Math.floor(Math.random() * (maxY - minY));
        } else {
          px = maxX;
          py = minY + Math.floor(Math.random() * (maxY - minY));
        }

        if (!overlapsExisting(px, py, candidate.w, candidate.h, 10)) {
          items.push({
            id: nextId(`rnd_${room.id.toLowerCase()}`),
            label: candidate.label,
            x: px,
            y: py,
            w: candidate.w,
            h: candidate.h,
            color: '#293548',
            blocksSight: candidate.blocksSight,
            blocksMovement: candidate.blocksMovement,
            spriteId: candidate.spriteId,
            rotation: rot,
            zLayer: candidate.zLayer,
            isRandomProp: true,
          });
          placedInRoom++;
          break;
        }
      }
    }
  }

  return sortFurnitureByZLayer(items);
}

function sortFurnitureByZLayer(items: FurnitureItem[]): FurnitureItem[] {
  const order: Record<'FLOOR' | 'BASE' | 'SURFACE', number> = {
    FLOOR: 0,
    BASE: 1,
    SURFACE: 2,
  };
  return [...items].sort(
    (a, b) => order[a.zLayer ?? 'BASE'] - order[b.zLayer ?? 'BASE']
  );
}
