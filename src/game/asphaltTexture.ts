/**
 * Tactical Battlemap Asphalt & Roadway Texture Engine
 * Generates and caches high-definition seamless asphalt patterns with realistic
 * bitumen aggregate, branching fissures/cracks, and iridescent motor oil puddle stains.
 */

class AsphaltTextureManager {
  private primaryPattern: CanvasPattern | null = null;
  private secondaryPattern: CanvasPattern | null = null;
  private imgCracks: HTMLImageElement | null = null;
  private imgOil: HTMLImageElement | null = null;
  private proceduralCanvas: HTMLCanvasElement | null = null;
  private isInitialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;

    // 1. Generate high-resolution procedural fallback canvas immediately (synchronous, 0ms lag)
    this.proceduralCanvas = this.createProceduralAsphaltCanvas();

    // 2. Load SVG texture assets asynchronously
    try {
      const img1 = new Image();
      img1.src = '/assets/asphalt_dark_cracks.svg';
      img1.onload = () => {
        this.imgCracks = img1;
        this.primaryPattern = null; // Recreate with image
      };

      const img2 = new Image();
      img2.src = '/assets/asphalt_oil_stain.svg';
      img2.onload = () => {
        this.imgOil = img2;
        this.secondaryPattern = null; // Recreate with image
      };
    } catch {
      // Procedural canvas will serve as fallback
    }

    this.isInitialized = true;
  }

  /**
   * Pre-renders a 512x512 tileable asphalt canvas with granular bitumen,
   * realistic crack networks, and viscous iridescent motor oil stains.
   */
  private createProceduralAsphaltCanvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');
    if (!ctx) return c;

    // A. Base dark asphalt tone (European urban asphalt)
    ctx.fillStyle = '#141820';
    ctx.fillRect(0, 0, 512, 512);

    // B. Bitumen aggregate & gravel speckles
    // Dark aggregate stones
    ctx.fillStyle = 'rgba(7, 10, 15, 0.45)';
    for (let i = 0; i < 2800; i++) {
      const x = (i * 137.5) % 512;
      const y = (i * 269.3) % 512;
      const sz = 1 + (i % 3) * 0.7;
      ctx.fillRect(x, y, sz, sz);
    }

    // Light mineral aggregate / quartzite flecks
    ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
    for (let i = 0; i < 1400; i++) {
      const x = (i * 311.7) % 512;
      const y = (i * 419.1) % 512;
      const sz = 1 + (i % 2);
      ctx.fillRect(x, y, sz, sz);
    }

    // C. Tar repair bands (black bitumen seam lines)
    ctx.strokeStyle = 'rgba(10, 14, 20, 0.75)';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(0, 160);
    ctx.bezierCurveTo(140, 180, 320, 140, 512, 170);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(30, 41, 59, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 159);
    ctx.bezierCurveTo(140, 179, 320, 139, 512, 169);
    ctx.stroke();

    // D. Realistic branching fissures & frost cracks
    this.drawProceduralCrack(ctx, 40, 60, 290, 220, 4);
    this.drawProceduralCrack(ctx, 480, 320, 260, 460, 3);
    this.drawProceduralCrack(ctx, 180, 440, 80, 500, 2);

    // E. Viscous iridescent motor oil puddle
    this.drawProceduralOilPuddle(ctx, 220, 280, 58, 38);
    this.drawProceduralOilPuddle(ctx, 390, 140, 32, 22);

    // Minor oil splatter spots
    ctx.fillStyle = 'rgba(6, 8, 11, 0.85)';
    const drips = [
      [140, 250, 4.2],
      [152, 238, 2.5],
      [295, 345, 3.8],
      [310, 355, 2.2],
      [430, 185, 3.5],
      [445, 195, 2.0],
    ];
    for (const [dx, dy, dr] of drips) {
      ctx.beginPath();
      ctx.arc(dx, dy, dr, 0, Math.PI * 2);
      ctx.fill();
    }

    return c;
  }

  private drawProceduralCrack(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    branches: number
  ) {
    ctx.save();
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(5, Math.floor(dist / 16));
    let curX = x1;
    let curY = y1;

    // Shadow line
    ctx.strokeStyle = 'rgba(4, 6, 9, 0.92)';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(curX, curY);

    const pathPts: [number, number][] = [[curX, curY]];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const baseX = x1 + (x2 - x1) * t;
      const baseY = y1 + (y2 - y1) * t;
      const perpAngle = Math.atan2(y2 - y1, x2 - x1) + Math.PI * 0.5;
      const jitter = (Math.sin(i * 12.3) * 6 + Math.cos(i * 7.7) * 4);
      curX = baseX + Math.cos(perpAngle) * jitter;
      curY = baseY + Math.sin(perpAngle) * jitter;
      ctx.lineTo(curX, curY);
      pathPts.push([curX, curY]);
    }
    ctx.stroke();

    // Highlight line (sunlit asphalt lip)
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 0; i < pathPts.length; i++) {
      const [px, py] = pathPts[i];
      if (i === 0) ctx.moveTo(px + 0.8, py - 0.8);
      else ctx.lineTo(px + 0.8, py - 0.8);
    }
    ctx.stroke();

    // Secondary sub-branches
    if (branches > 0 && pathPts.length > 4) {
      ctx.strokeStyle = 'rgba(5, 7, 11, 0.82)';
      ctx.lineWidth = 1.4;
      for (let b = 0; b < branches; b++) {
        const idx = Math.min(pathPts.length - 2, 2 + b * 2);
        const [bx, by] = pathPts[idx];
        const bAng = Math.atan2(y2 - y1, x2 - x1) + (b % 2 === 0 ? 0.85 : -0.85);
        const bLen = 14 + (b * 7) % 18;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(bAng) * bLen, by + Math.sin(bAng) * bLen);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawProceduralOilPuddle(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    rx: number,
    ry: number
  ) {
    ctx.save();
    // 1. Bitumen absorption dark halo
    ctx.fillStyle = 'rgba(8, 10, 14, 0.72)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 1.25, ry * 1.25, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // 2. Iridescent multi-spectral sheen gradient
    const grad = ctx.createRadialGradient(
      cx - rx * 0.15,
      cy - ry * 0.15,
      rx * 0.1,
      cx,
      cy,
      rx
    );
    grad.addColorStop(0.0, '#040404');
    grad.addColorStop(0.32, 'rgba(12, 16, 24, 0.95)');
    grad.addColorStop(0.55, 'rgba(6, 182, 212, 0.45)'); // Cyan
    grad.addColorStop(0.70, 'rgba(139, 92, 246, 0.48)'); // Purple
    grad.addColorStop(0.82, 'rgba(236, 72, 153, 0.44)'); // Magenta
    grad.addColorStop(0.92, 'rgba(245, 158, 11, 0.38)'); // Amber
    grad.addColorStop(1.0, 'rgba(16, 185, 129, 0)'); // Emerald falloff

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // 3. Dense core black motor oil
    ctx.fillStyle = 'rgba(2, 2, 2, 0.92)';
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy + 2, rx * 0.52, ry * 0.52, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // 4. Wet specular reflections
    ctx.fillStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.beginPath();
    ctx.arc(cx - rx * 0.25, cy - ry * 0.25, 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(244, 63, 94, 0.45)';
    ctx.beginPath();
    ctx.arc(cx + rx * 0.22, cy + ry * 0.2, 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Retrieves or creates the primary asphalt pattern for CanvasRenderingContext2D
   */
  public getPrimaryPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
    if (this.primaryPattern) return this.primaryPattern;

    const source = this.imgCracks || this.proceduralCanvas;
    if (source) {
      try {
        this.primaryPattern = ctx.createPattern(source, 'repeat');
      } catch {
        // Fallback to null
      }
    }
    return this.primaryPattern;
  }

  /**
   * Retrieves or creates the secondary (oil heavy) asphalt pattern
   */
  public getSecondaryPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
    if (this.secondaryPattern) return this.secondaryPattern;

    const source = this.imgOil || this.proceduralCanvas;
    if (source) {
      try {
        this.secondaryPattern = ctx.createPattern(source, 'repeat');
      } catch {
        // Fallback to null
      }
    }
    return this.secondaryPattern;
  }
}

export const asphaltTexture = new AsphaltTextureManager();

/**
 * Convenience helper to fill any canvas polygon or rectangle with the asphalt texture.
 */
export function fillAsphaltSurface(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  useSecondary = false
) {
  const pattern = useSecondary
    ? asphaltTexture.getSecondaryPattern(ctx)
    : asphaltTexture.getPrimaryPattern(ctx);

  if (pattern) {
    ctx.save();
    ctx.fillStyle = pattern;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  } else {
    // Pure fallback
    ctx.fillStyle = '#141820';
    ctx.fillRect(x, y, w, h);
  }
}

/**
 * Draws an organic, iridescent oil stain with thin-film rainbow reflection
 */
export function renderTacticalOilStain(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  aspect = 0.72,
  angle = 0
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  const rx = radius;
  const ry = radius * aspect;

  // Dark porous seepage shadow
  ctx.fillStyle = 'rgba(6, 8, 12, 0.75)';
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 1.3, ry * 1.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Thin-film iridescent interference spectrum
  const grad = ctx.createRadialGradient(-rx * 0.2, -ry * 0.2, rx * 0.08, 0, 0, rx);
  grad.addColorStop(0.0, '#020202');
  grad.addColorStop(0.28, 'rgba(10, 12, 18, 0.95)');
  grad.addColorStop(0.50, 'rgba(6, 182, 212, 0.52)'); // Vivid Cyan
  grad.addColorStop(0.68, 'rgba(168, 85, 247, 0.50)'); // Purple
  grad.addColorStop(0.80, 'rgba(244, 63, 94, 0.46)'); // Crimson/Pink
  grad.addColorStop(0.90, 'rgba(245, 158, 11, 0.38)'); // Amber
  grad.addColorStop(1.0, 'rgba(16, 185, 129, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // Dense black viscous engine core
  ctx.fillStyle = 'rgba(1, 1, 1, 0.95)';
  ctx.beginPath();
  ctx.ellipse(1, 1, rx * 0.48, ry * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wet specular reflection highlights
  ctx.fillStyle = 'rgba(56, 189, 248, 0.65)';
  ctx.beginPath();
  ctx.arc(-rx * 0.22, -ry * 0.22, Math.max(1.5, rx * 0.08), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(251, 113, 133, 0.55)';
  ctx.beginPath();
  ctx.arc(rx * 0.2, ry * 0.18, Math.max(1.2, rx * 0.06), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draws a sharp, realistic asphalt fracture/crack with depth shading and sunlit edge
 */
export function renderTacticalAsphaltCrack(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  jitterAmp = 5,
  branches = 3
) {
  ctx.save();
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const segments = Math.max(4, Math.floor(dist / 14));
  const perp = Math.atan2(y2 - y1, x2 - x1) + Math.PI * 0.5;

  const points: [number, number][] = [[x1, y1]];
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const bx = x1 + (x2 - x1) * t;
    const by = y1 + (y2 - y1) * t;
    const wave = Math.sin(i * 17.1) * jitterAmp + Math.cos(i * 9.3) * (jitterAmp * 0.6);
    points.push([bx + Math.cos(perp) * wave, by + Math.sin(perp) * wave]);
  }

  // Deep fracture line
  ctx.strokeStyle = '#05070A';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.stroke();

  // Sunlit edge highlight
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(points[0][0] + 0.8, points[0][1] - 0.8);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0] + 0.8, points[i][1] - 0.8);
  }
  ctx.stroke();

  // Lateral fissures / branches
  if (branches > 0 && points.length > 3) {
    ctx.strokeStyle = '#07090E';
    ctx.lineWidth = 1.3;
    for (let b = 0; b < branches; b++) {
      const pIdx = 1 + (b * 2) % (points.length - 2);
      const [px, py] = points[pIdx];
      const bAng = Math.atan2(y2 - y1, x2 - x1) + (b % 2 === 0 ? 0.75 : -0.75);
      const bLen = 10 + (b * 6) % 16;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(bAng) * bLen, py + Math.sin(bAng) * bLen);
      ctx.stroke();
    }
  }

  ctx.restore();
}
