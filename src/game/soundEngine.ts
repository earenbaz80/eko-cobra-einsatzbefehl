// Procedural Web Audio Synthesizer for EKO COBRA - EINSATZBEFEHL

class TacticalSoundEngine {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;
  private rainNode: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private ambientNodes: AudioNode[] = [];
  private ambientGain: GainNode | null = null;
  private lastHeartbeatTimestamp: number = 0;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    if (this.rainGain && this.ctx) {
      this.rainGain.gain.setTargetAtTime(mute ? 0 : 0.035, this.ctx.currentTime, 0.1);
    }
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(mute ? 0 : 0.018, this.ctx.currentTime, 0.1);
    }
  }

  public playC4WarningBeep(pitchMult: number = 1.0) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1450 * pitchMult, now);
    osc.frequency.exponentialRampToValueAtTime(880 * pitchMult, now + 0.08);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public startRainAmbience() {
    const ctx = this.ensureContext();
    if (!ctx || this.rainNode) return;

    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 950;
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.value = this.muted ? 0 : 0.035;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();

    this.rainNode = noise;
    this.rainGain = gain;
  }

  public startAmbientDrone() {
    const ctx = this.ensureContext();
    if (!ctx || this.ambientNodes.length > 0) return;

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.018;
    master.connect(ctx.destination);
    this.ambientGain = master;

    const freqs = [55, 82.5, 110];
    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.35;
      osc.connect(g);
      g.connect(master);
      osc.start();
      this.ambientNodes.push(osc, g);
    }
  }

  public stopAmbientDrone() {
    for (const n of this.ambientNodes) {
      try {
        (n as OscillatorNode).stop?.();
      } catch {
        // ignore
      }
      try {
        n.disconnect();
      } catch {
        // ignore
      }
    }
    this.ambientNodes = [];
    if (this.ambientGain) {
      this.ambientGain.disconnect();
      this.ambientGain = null;
    }
  }

  private stopRainAmbience() {
    if (this.rainNode) {
      try {
        this.rainNode.stop();
      } catch {
        // already stopped
      }
      try {
        this.rainNode.disconnect();
      } catch {
        // ignore
      }
      this.rainNode = null;
    }
    if (this.rainGain) {
      this.rainGain.disconnect();
      this.rainGain = null;
    }
  }

  /**
   * Releases every long-lived audio resource (ambient loops, speech queue and the
   * AudioContext itself). The engine stays usable: the next playback call creates
   * a fresh AudioContext.
   */
  public destroy() {
    this.stopRainAmbience();
    this.stopAmbientDrone();
    this.lastHeartbeatTimestamp = 0;

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }

    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) {
      try {
        void ctx.close().catch(() => {});
      } catch {
        // already closed
      }
    }
  }

  public playGunshot(type: 'AUG' | 'PISTOL' | 'SUPPRESSED' | 'HOSTILE', output?: AudioNode) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const destination = output ?? ctx.destination;

    const now = ctx.currentTime;

    // White noise burst for propellant crack
    const bufferSize = Math.floor(ctx.sampleRate * 0.16);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.035));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(type === 'SUPPRESSED' ? 1100 : 3200, now);
    filter.frequency.exponentialRampToValueAtTime(240, now + 0.14);

    const gain = ctx.createGain();
    const peak = type === 'SUPPRESSED' ? 0.22 : type === 'AUG' ? 0.42 : 0.36;
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    noise.start(now);

    // Low punch oscillator
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(type === 'AUG' ? 150 : 125, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.09);

    oscGain.gain.setValueAtTime(type === 'SUPPRESSED' ? 0.15 : 0.35, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(oscGain);
    oscGain.connect(destination);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  public playGunshotSpatial(
    type: 'AUG' | 'PISTOL' | 'SUPPRESSED' | 'HOSTILE',
    sourceX: number,
    sourceY: number,
    listenerX: number,
    listenerY: number
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const dx = sourceX - listenerX;
    const dy = sourceY - listenerY;
    const dist = Math.hypot(dx, dy);
    const pan = Math.max(-1, Math.min(1, dx / 400));
    const atten = Math.max(0.25, 1 - dist / 900);
    const bus = ctx.createGain();
    bus.gain.value = atten;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    bus.connect(panner);
    panner.connect(ctx.destination);
    this.playGunshot(type, bus);
  }

  public playSteelTargetPing() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1850, now);
    osc.frequency.exponentialRampToValueAtTime(1180, now + 0.45);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.55);
  }

  public playTaser() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    for (let i = 0; i < 6; i++) {
      const t = now + i * 0.032;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1800 + Math.random() * 900, t);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.005, t + 0.025);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.028);
    }
  }

  public playFlashbang(output?: AudioNode) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const destination = output ?? ctx.destination;
    const now = ctx.currentTime;

    // Deep concussion boom
    const bufferSize = Math.floor(ctx.sampleRate * 0.55);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.12));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(90, now + 0.5);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.54);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    noise.start(now);

    // Subtle high-pitch ringing (tinnitus cue)
    const ring = ctx.createOscillator();
    const ringGain = ctx.createGain();
    ring.type = 'sine';
    ring.frequency.setValueAtTime(3950, now);
    ringGain.gain.setValueAtTime(0.06, now);
    ringGain.gain.exponentialRampToValueAtTime(0.0005, now + 1.1);
    ring.connect(ringGain);
    ringGain.connect(destination);
    ring.start(now);
    ring.stop(now + 1.15);
  }

  public playDoorAction(breach: boolean) {
    if (breach) {
      this.playDoorBreach('KICK', false);
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Quiet tactical door handle latch click + soft hinge sweep
    const latchOsc = ctx.createOscillator();
    const latchGain = ctx.createGain();
    latchOsc.type = 'triangle';
    latchOsc.frequency.setValueAtTime(1450, now);
    latchOsc.frequency.exponentialRampToValueAtTime(420, now + 0.028);
    latchGain.gain.setValueAtTime(0.065, now);
    latchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);
    latchOsc.connect(latchGain);
    latchGain.connect(ctx.destination);
    latchOsc.start(now);
    latchOsc.stop(now + 0.035);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(165, now + 0.02);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.11);
    gain.gain.setValueAtTime(0.11, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + 0.02);
    osc.stop(now + 0.13);
  }

  /**
   * Plays distinct preparation audio when an operator initiates a KICK, RAM, or C4 breach.
   */
  public playBreachPrep(mode: 'KICK' | 'RAM' | 'C4') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (mode === 'KICK') {
      // Tactical boot brace & gear rustle before dynamic kick
      this.playFootstep({ isRunning: true, distanceRatio: 0.15, isAgent: true });
      return;
    }

    if (mode === 'RAM') {
      // Heavy 16kg steel battering ram heft + metallic handle clack
      const heftOsc = ctx.createOscillator();
      const heftGain = ctx.createGain();
      heftOsc.type = 'triangle';
      heftOsc.frequency.setValueAtTime(115, now);
      heftOsc.frequency.exponentialRampToValueAtTime(44, now + 0.09);
      heftGain.gain.setValueAtTime(0.16, now);
      heftGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      heftOsc.connect(heftGain);
      heftGain.connect(ctx.destination);
      heftOsc.start(now);
      heftOsc.stop(now + 0.11);

      // Metallic steel tube grip clack
      const clackOsc = ctx.createOscillator();
      const clackGain = ctx.createGain();
      clackOsc.type = 'square';
      clackOsc.frequency.setValueAtTime(580, now + 0.045);
      clackOsc.frequency.exponentialRampToValueAtTime(240, now + 0.095);
      clackGain.gain.setValueAtTime(0.09, now + 0.045);
      clackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      clackOsc.connect(clackGain);
      clackGain.connect(ctx.destination);
      clackOsc.start(now + 0.045);
      clackOsc.stop(now + 0.105);
      return;
    }

    if (mode === 'C4') {
      // Adhesive C4 frame placement thud + dual electronic detonator arming beeps
      const placeOsc = ctx.createOscillator();
      const placeGain = ctx.createGain();
      placeOsc.type = 'sine';
      placeOsc.frequency.setValueAtTime(140, now);
      placeOsc.frequency.exponentialRampToValueAtTime(48, now + 0.065);
      placeGain.gain.setValueAtTime(0.14, now);
      placeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      placeOsc.connect(placeGain);
      placeGain.connect(ctx.destination);
      placeOsc.start(now);
      placeOsc.stop(now + 0.075);

      const freqs = [2350, 3150];
      freqs.forEach((f, idx) => {
        const t = now + 0.08 + idx * 0.085;
        const beep = ctx.createOscillator();
        const bGain = ctx.createGain();
        beep.type = 'sine';
        beep.frequency.setValueAtTime(f, t);
        bGain.gain.setValueAtTime(0.085, t);
        bGain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
        beep.connect(bGain);
        bGain.connect(ctx.destination);
        beep.start(t);
        beep.stop(t + 0.06);
      });
    }
  }

  /**
   * Synthesizes multi-layered door/window breach acoustics:
   * - KICK: Kinetic boot thud + brass lock snap + sharp wooden splintering cracks
   * - RAM: Heavy 16kg forged-steel metallic thud & clang resonance + violent wooden doorframe splintering
   * - C4: Explosive blast wave + heavy metal hinge shear thud + cascading timber/masonry splintering
   */
  public playDoorBreach(mode: 'KICK' | 'RAM' | 'C4' | 'BALLISTIC', isExteriorWindow: boolean = false, output?: AudioNode) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const destination = output ?? ctx.destination;
    const now = ctx.currentTime;

    if (mode === 'C4') {
      // 1. Explosive concussion blast & tinnitus
      this.playFlashbang();
      // 2. Heavy metal hinge/lock shear thud right behind the blast front
      this.scheduleHeavyMetalThud(ctx, now + 0.018, 0.95);
      // 3. Cascading wooden doorframe splintering & flying timber shards
      this.scheduleWoodenSplinters(ctx, now + 0.04, 8, 1.0);
    } else if (mode === 'RAM') {
      // 1. Dominant heavy 16kg steel battering ram impact thud & metallic body resonance
      this.scheduleHeavyMetalThud(ctx, now, 1.0);
      // 2. Violent wooden doorframe & jamb splintering as the steel ram shears the lock
      this.scheduleWoodenSplinters(ctx, now + 0.032, 7, 0.92);
      // 3. Secondary heavy door slab slam against interior stop
      const slamOsc = ctx.createOscillator();
      const slamGain = ctx.createGain();
      slamOsc.type = 'triangle';
      slamOsc.frequency.setValueAtTime(92, now + 0.21);
      slamOsc.frequency.exponentialRampToValueAtTime(26, now + 0.35);
      slamGain.gain.setValueAtTime(0.28, now + 0.21);
      slamGain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      slamOsc.connect(slamGain);
      slamGain.connect(destination);
      slamOsc.start(now + 0.21);
      slamOsc.stop(now + 0.37);
    } else {
      // KICK or BALLISTIC breach:
      // 1. Hollow wooden panel kinetic kick thud
      const kickOsc = ctx.createOscillator();
      const kickGain = ctx.createGain();
      kickOsc.type = 'triangle';
      kickOsc.frequency.setValueAtTime(134, now);
      kickOsc.frequency.exponentialRampToValueAtTime(32, now + 0.14);
      kickGain.gain.setValueAtTime(0.42, now);
      kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      kickOsc.connect(kickGain);
      kickGain.connect(destination);
      kickOsc.start(now);
      kickOsc.stop(now + 0.16);

      // 2. Sharp metallic deadbolt / latch shear snap
      const latchSnap = ctx.createOscillator();
      const latchGain = ctx.createGain();
      latchSnap.type = 'sawtooth';
      latchSnap.frequency.setValueAtTime(2650, now + 0.012);
      latchSnap.frequency.exponentialRampToValueAtTime(680, now + 0.055);
      latchGain.gain.setValueAtTime(0.16, now + 0.012);
      latchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      latchSnap.connect(latchGain);
      latchGain.connect(destination);
      latchSnap.start(now + 0.012);
      latchSnap.stop(now + 0.065);

      // 3. Distinct wooden splintering & dry timber cracking cluster
      this.scheduleWoodenSplinters(ctx, now + 0.018, 5, 0.82);
    }

    // 4. Play randomized procedural variation of wood splintering & impacted metal hardware
    this.playRandomBreachMaterialImpact(mode);

    // Optional crystalline glass shatter layer when breaching exterior windows / glazed balcony doors
    if (isExteriorWindow) {
      for (let i = 0; i < 6; i++) {
        const t = now + 0.02 + i * 0.032 + Math.random() * 0.02;
        const shardOsc = ctx.createOscillator();
        const shardGain = ctx.createGain();
        shardOsc.type = 'sine';
        shardOsc.frequency.setValueAtTime(3200 + Math.random() * 2400, t);
        shardOsc.frequency.exponentialRampToValueAtTime(1800 + Math.random() * 900, t + 0.045);
        shardGain.gain.setValueAtTime(0.075, t);
        shardGain.gain.exponentialRampToValueAtTime(0.0008, t + 0.05);
        shardOsc.connect(shardGain);
        shardGain.connect(destination);
        shardOsc.start(t);
        shardOsc.stop(t + 0.055);
      }
    }
  }

  /**
   * Plays randomized acoustic variations of wood splintering (oak/pine frame fracture,
   * twisting timber fibers, falling wood debris) and impacted metal (sheared brass deadbolt,
   * warped steel hinge clang, ringing strike plate) whenever a breach (KICK, RAM, C4) is triggered.
   */
  public playDoorBreachSpatial(
    mode: 'KICK' | 'RAM' | 'C4' | 'BALLISTIC',
    isExteriorWindow: boolean = false,
    sourceX: number = 0,
    sourceY: number = 0,
    listenerX: number = 0,
    listenerY: number = 0
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const dx = sourceX - listenerX;
    const dist = Math.hypot(dx, sourceY - listenerY);
    const pan = Math.max(-1, Math.min(1, dx / 400));
    const atten = Math.max(0.3, 1 - dist / 1000);
    const bus = ctx.createGain();
    bus.gain.value = atten;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    bus.connect(panner);
    panner.connect(ctx.destination);
    this.playDoorBreach(mode, isExteriorWindow, bus);
  }

  public playFlashbangSpatial(sourceX: number = 0, sourceY: number = 0, listenerX: number = 0, listenerY: number = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const dx = sourceX - listenerX;
    const dist = Math.hypot(dx, sourceY - listenerY);
    const pan = Math.max(-1, Math.min(1, dx / 400));
    const atten = Math.max(0.3, 1 - dist / 1000);
    const bus = ctx.createGain();
    bus.gain.value = atten;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    bus.connect(panner);
    panner.connect(ctx.destination);
    this.playFlashbang(bus);
  }

  public playRandomBreachMaterialImpact(
    mode: 'KICK' | 'RAM' | 'C4' | 'BALLISTIC' = 'KICK'
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const intensity = mode === 'C4' ? 1.0 : mode === 'RAM' ? 0.92 : 0.78;
    // Choose a random acoustic variation archetype (0: Deep Oak Fracture, 1: Sharp Pine Splinter Burst, 2: Heavy Steel Hinge & Lock Shear)
    const variationIndex = Math.floor(Math.random() * 3);

    // A. RANDOMIZED WOOD SPLINTERING & TIMBER TORSION VARIATION
    const woodSplinterBursts =
      variationIndex === 0
        ? 4 + Math.floor(Math.random() * 3) // Deep heavy snaps
        : variationIndex === 1
          ? 7 + Math.floor(Math.random() * 4) // Rapid high-density crackles
          : 5 + Math.floor(Math.random() * 3);

    const baseWoodFormant =
      variationIndex === 0
        ? 640 + Math.random() * 220
        : variationIndex === 1
          ? 1120 + Math.random() * 380
          : 880 + Math.random() * 280;

    for (let i = 0; i < woodSplinterBursts; i++) {
      const delay = 0.015 + i * (0.024 + Math.random() * 0.028);
      const t = now + delay;
      const dur = 0.025 + Math.random() * 0.04;
      const bufLen = Math.max(64, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);

      const grainMod = 11 + Math.floor(Math.random() * 14);
      for (let s = 0; s < bufLen; s++) {
        const env = Math.exp(-s / (ctx.sampleRate * (0.008 + Math.random() * 0.008)));
        const fiberSpike = s % grainMod < 3 ? 1.65 : 0.65;
        data[s] = (Math.random() * 2 - 1) * env * fiberSpike;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buf;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(
        baseWoodFormant + i * (110 + Math.random() * 90),
        t
      );
      bp.Q.value = 2.0 + Math.random() * 2.2;

      const gain = ctx.createGain();
      const amp = Math.max(0.04, (0.21 - i * 0.016) * intensity * (0.85 + Math.random() * 0.3));
      gain.gain.setValueAtTime(amp, t);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + dur);

      noise.connect(bp);
      bp.connect(gain);
      gain.connect(ctx.destination);
      noise.start(t);
    }

    // Low-frequency timber beam groan / frame torsion creak
    const groanOsc = ctx.createOscillator();
    const groanGain = ctx.createGain();
    groanOsc.type = 'sawtooth';
    const groanStartFreq = 185 + Math.random() * 95;
    const groanDur = 0.09 + Math.random() * 0.06;
    groanOsc.frequency.setValueAtTime(groanStartFreq, now + 0.025);
    groanOsc.frequency.exponentialRampToValueAtTime(52 + Math.random() * 25, now + 0.025 + groanDur);
    groanGain.gain.setValueAtTime(0.095 * intensity, now + 0.025);
    groanGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.025 + groanDur);
    groanOsc.connect(groanGain);
    groanGain.connect(ctx.destination);
    groanOsc.start(now + 0.025);
    groanOsc.stop(now + 0.03 + groanDur);

    // B. RANDOMIZED IMPACTED METAL / LOCK-BOLT SHEAR & RINGING VARIATION
    const metalWeight = mode === 'RAM' ? 1.15 : mode === 'C4' ? 1.05 : variationIndex === 2 ? 0.95 : 0.7;
    const fundamentalMetal = 260 + Math.random() * 240;
    const harmonicRatios =
      variationIndex === 2
        ? [1.0, 1.41, 1.93, 2.67] // Heavy steel plate & hinge shear
        : [1.0, 1.58, 2.24, 3.05]; // Brass/steel lock cylinder & strike plate clang

    harmonicRatios.forEach((ratio, idx) => {
      const mStart = now + 0.008 + Math.random() * 0.018;
      const mDur = (0.09 + Math.random() * 0.08) / (1 + idx * 0.25);
      const mOsc = ctx.createOscillator();
      const mFilter = ctx.createBiquadFilter();
      const mGain = ctx.createGain();

      mOsc.type = idx % 2 === 0 ? 'square' : 'sawtooth';
      const freq = fundamentalMetal * ratio;
      mOsc.frequency.setValueAtTime(freq, mStart);
      mOsc.frequency.exponentialRampToValueAtTime(
        freq * (0.86 + Math.random() * 0.08),
        mStart + mDur
      );

      mFilter.type = 'bandpass';
      mFilter.frequency.value = freq;
      mFilter.Q.value = 3.5 + Math.random() * 2.5;

      const peak = (0.12 / (idx + 1)) * intensity * metalWeight;
      mGain.gain.setValueAtTime(peak, mStart);
      mGain.gain.exponentialRampToValueAtTime(0.0006, mStart + mDur);

      mOsc.connect(mFilter);
      mFilter.connect(mGain);
      mGain.connect(ctx.destination);
      mOsc.start(mStart);
      mOsc.stop(mStart + mDur + 0.005);
    });

    // Scatter of falling wood/metal debris ticks hitting the floor after breach
    const debrisCount = 3 + Math.floor(Math.random() * 3);
    for (let d = 0; d < debrisCount; d++) {
      const dtTick = now + 0.14 + d * 0.045 + Math.random() * 0.04;
      const dOsc = ctx.createOscillator();
      const dGain = ctx.createGain();
      dOsc.type = d % 2 === 0 ? 'triangle' : 'sine';
      dOsc.frequency.setValueAtTime(1250 + Math.random() * 1650, dtTick);
      dOsc.frequency.exponentialRampToValueAtTime(380 + Math.random() * 320, dtTick + 0.024);
      dGain.gain.setValueAtTime(0.045 * intensity, dtTick);
      dGain.gain.exponentialRampToValueAtTime(0.0005, dtTick + 0.026);
      dOsc.connect(dGain);
      dGain.connect(ctx.destination);
      dOsc.start(dtTick);
      dOsc.stop(dtTick + 0.03);
    }
  }

  /**
   * Synthesizes a heavy, resonant forged-steel battering ram / reinforced door thud
   * combining a sub-bass kinetic impact with inharmonic damped steel partials.
   */
  private scheduleHeavyMetalThud(
    ctx: AudioContext,
    startTime: number,
    intensity: number = 1.0
  ) {
    // 1. Sub-bass kinetic steel-on-doorframe mass impact (78 Hz -> 22 Hz)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(82, startTime);
    subOsc.frequency.exponentialRampToValueAtTime(22, startTime + 0.22);
    subGain.gain.setValueAtTime(0.54 * intensity, startTime);
    subGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.24);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(startTime);
    subOsc.stop(startTime + 0.25);

    // 2. Low-mid steel body punch (165 Hz -> 46 Hz)
    const punchOsc = ctx.createOscillator();
    const punchGain = ctx.createGain();
    punchOsc.type = 'triangle';
    punchOsc.frequency.setValueAtTime(165, startTime);
    punchOsc.frequency.exponentialRampToValueAtTime(46, startTime + 0.13);
    punchGain.gain.setValueAtTime(0.38 * intensity, startTime);
    punchGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.14);
    punchOsc.connect(punchGain);
    punchGain.connect(ctx.destination);
    punchOsc.start(startTime);
    punchOsc.stop(startTime + 0.15);

    // 3. Inharmonic forged-steel clang & hollow metal cylinder resonance partials
    const metalPartials = [
      { freq: 295, endFreq: 260, dur: 0.19, amp: 0.18 },
      { freq: 448, endFreq: 415, dur: 0.16, amp: 0.14 },
      { freq: 712, endFreq: 660, dur: 0.13, amp: 0.11 },
      { freq: 1180, endFreq: 980, dur: 0.09, amp: 0.08 },
    ];
    for (const p of metalPartials) {
      const mOsc = ctx.createOscillator();
      const mGain = ctx.createGain();
      mOsc.type = 'square';
      mOsc.frequency.setValueAtTime(p.freq, startTime);
      mOsc.frequency.exponentialRampToValueAtTime(p.endFreq, startTime + p.dur);

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = p.freq;
      bp.Q.value = 3.2;

      mGain.gain.setValueAtTime(p.amp * intensity, startTime);
      mGain.gain.exponentialRampToValueAtTime(0.0008, startTime + p.dur);

      mOsc.connect(bp);
      bp.connect(mGain);
      mGain.connect(ctx.destination);
      mOsc.start(startTime);
      mOsc.stop(startTime + p.dur + 0.01);
    }

    // 4. Broadband metallic transient anvil strike burst
    const bufLen = Math.floor(ctx.sampleRate * 0.045);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.012));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 920;
    filter.Q.value = 1.6;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.28 * intensity, startTime);
    nGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.045);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(startTime);
  }

  /**
   * Synthesizes realistic dry timber cracking and wooden doorframe splintering
   * using staggered high-Q bandpass noise bursts paired with sharp sawtooth fiber snaps.
   */
  private scheduleWoodenSplinters(
    ctx: AudioContext,
    startTime: number,
    splinterCount: number = 5,
    intensity: number = 0.85
  ) {
    for (let i = 0; i < splinterCount; i++) {
      const offset = i * 0.036 + Math.random() * 0.022;
      const t = startTime + offset;
      const dur = 0.035 + Math.random() * 0.035;
      const bufLen = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);

      // Sharp crack envelope with micro-grain spikes emulating tearing wood fibers
      for (let s = 0; s < bufLen; s++) {
        const env = Math.exp(-s / (ctx.sampleRate * 0.011));
        const grain = s % 19 < 4 ? 1.45 : 0.75;
        data[s] = (Math.random() * 2 - 1) * env * grain;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buf;

      // Formant bandpass in the dry wood resonance range (780 Hz - 2450 Hz)
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(820 + i * 240 + Math.random() * 320, t);
      bp.Q.value = 2.4;

      const gain = ctx.createGain();
      const snapAmp = (0.24 - i * 0.02) * intensity;
      gain.gain.setValueAtTime(Math.max(0.06, snapAmp), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

      noise.connect(bp);
      bp.connect(gain);
      gain.connect(ctx.destination);
      noise.start(t);

      // Woody pitch snap transient
      const woodOsc = ctx.createOscillator();
      const woodGain = ctx.createGain();
      woodOsc.type = 'sawtooth';
      const startFreq = 460 + Math.random() * 380;
      woodOsc.frequency.setValueAtTime(startFreq, t);
      woodOsc.frequency.exponentialRampToValueAtTime(110, t + 0.028);
      woodGain.gain.setValueAtTime(0.11 * intensity, t);
      woodGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      woodOsc.connect(woodGain);
      woodGain.connect(ctx.destination);
      woodOsc.start(t);
      woodOsc.stop(t + 0.032);
    }
  }

  public playPoliceShout() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Radio squelch click + authoritative command cadence
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.setValueAtTime(680, now + 0.045);
    osc.frequency.setValueAtTime(440, now + 0.09);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playArrestCuffs() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Metallic zip-tie / ratchet clicks
    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2400 + i * 220, t);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.035);
    }
  }

  public playUiClick() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1480, now);
    osc.frequency.exponentialRampToValueAtTime(960, now + 0.032);
    gain.gain.setValueAtTime(0.038, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.036);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  public playOpticCam() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.09);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playRoePenalty() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.setValueAtTime(135, now + 0.12);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.34);
  }

  public playFootstep(options?: {
    isRunning?: boolean;
    distanceRatio?: number;
    isAgent?: boolean;
  }) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const isRunning = options?.isRunning ?? false;
    const isAgent = options?.isAgent ?? false;
    const distRatio = Math.max(0, Math.min(1, options?.distanceRatio ?? 0));
    const attenuation = Math.max(0.14, 1 - distRatio * 0.8);

    if (!isRunning) {
      // WALKING: Controlled heel-to-toe tactical step (low-profile, muted sole roll)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const baseFreq = isAgent ? 82 + Math.random() * 14 : 92 + Math.random() * 18;
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.055);

      const walkGain = (isAgent ? 0.052 : 0.042) * attenuation;
      gain.gain.setValueAtTime(walkGain, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.065);

      // Subtle sole brush / cloth movement on walking step
      const bufLen = Math.floor(ctx.sampleRate * 0.032);
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.012));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = isAgent ? 620 : 780;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.022 * attenuation, now + 0.012);
      nGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.045);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now + 0.01);
      return;
    }

    // RUNNING / SPRINTING: Heavy double-transient combat boot strike + sole scuff + tactical gear rustle
    // 1. Primary heel impact thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const baseFreq = isAgent ? 142 + Math.random() * 26 : 128 + Math.random() * 32;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.08);

    const peakGain = (isAgent ? 0.115 : 0.095) * attenuation;
    gain.gain.setValueAtTime(peakGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);

    // 2. Secondary toe push-off transient (distinct running cadence feel)
    const toeOsc = ctx.createOscillator();
    const toeGain = ctx.createGain();
    toeOsc.type = 'triangle';
    toeOsc.frequency.setValueAtTime(baseFreq * 1.25, now + 0.038);
    toeOsc.frequency.exponentialRampToValueAtTime(48, now + 0.085);
    toeGain.gain.setValueAtTime(peakGain * 0.55, now + 0.038);
    toeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    toeOsc.connect(toeGain);
    toeGain.connect(ctx.destination);
    toeOsc.start(now + 0.038);
    toeOsc.stop(now + 0.095);

    // 3. Crisp parquet/boot scuff noise burst when running
    const bufLen = Math.floor(ctx.sampleRate * 0.055);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.018));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = isAgent ? 1380 + Math.random() * 280 : 1150 + Math.random() * 300;
    filter.Q.value = 1.35;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime((isAgent ? 0.068 : 0.055) * attenuation, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.052);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);

    // 4. Tactical plate-carrier & magazine rig metallic/nylon rustle for EKO Cobra agents running
    if (isAgent) {
      const rigOsc = ctx.createOscillator();
      const rigGain = ctx.createGain();
      rigOsc.type = 'sine';
      rigOsc.frequency.setValueAtTime(2150 + Math.random() * 380, now + 0.02);
      rigOsc.frequency.exponentialRampToValueAtTime(1450, now + 0.055);
      rigGain.gain.setValueAtTime(0.018 * attenuation, now + 0.02);
      rigGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.058);
      rigOsc.connect(rigGain);
      rigGain.connect(ctx.destination);
      rigOsc.start(now + 0.02);
      rigOsc.stop(now + 0.06);
    }
  }

  public playBreathing(fatigueRatio: number = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const clampedFatigue = Math.max(0, Math.min(1, fatigueRatio));
    const duration = 0.34 + clampedFatigue * 0.14;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 320 + clampedFatigue * 260;
    filter.Q.value = 1.2 - clampedFatigue * 0.3;
    const gain = ctx.createGain();
    const peakGain = 0.015 + clampedFatigue * 0.048;
    gain.gain.setValueAtTime(peakGain, now);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + duration);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  public playRadioEcho() {
    this.playTetraRadioTransmission('info', 28, 'KOBRA-1');
  }

  /**
   * Builds a non-linear WaveShaper transfer curve with ACELP vocoder quantization steps
   * and hard-knee saturation to emulate Austrian BOS-TETRA digital radio distortion.
   */
  private makeTetraDistortionCurve(drive: number): Float32Array<ArrayBuffer> {
    const samples = 4096;
    const buffer = new ArrayBuffer(samples * 4);
    const curve = new Float32Array(buffer);
    const quantSteps = drive > 22 ? 18 : 28; // Coarser quantization on high-stress alerts
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      const saturated = Math.tanh(x * (drive * 0.14));
      // Subtle digital vocoder step quantization
      const quantized = Math.round(saturated * quantSteps) / quantSteps;
      curve[i] = saturated * 0.72 + quantized * 0.28;
    }
    return curve;
  }

  /**
   * Creates the narrowband TETRA radio filter chain:
   * Highpass (340Hz) -> Bandpass (1280Hz) -> WaveShaper Distortion -> Lowpass (2850Hz) -> Output Gain
   */
  private createTetraDistortionFilter(
    ctx: AudioContext,
    drive: number,
    outputGainValue: number
  ): { input: AudioNode; output: GainNode } {
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 340;
    hp.Q.value = 0.8;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1280;
    bp.Q.value = 1.55;

    const shaper = ctx.createWaveShaper();
    shaper.curve = this.makeTetraDistortionCurve(drive);
    shaper.oversample = '2x';

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2850;
    lp.Q.value = 0.9;

    const outGain = ctx.createGain();
    outGain.gain.value = outputGainValue;

    hp.connect(bp);
    bp.connect(shaper);
    shaper.connect(lp);
    lp.connect(outGain);
    outGain.connect(ctx.destination);

    return { input: hp, output: outGain };
  }

  /**
   * Generates randomized RF static bursts, electromagnetic crackles, and carrier interference
   * through the TETRA radio distortion filter when important tactical alerts arrive.
   */
  public playTetraStaticBurst(
    intensity: number = 0.85,
    customDuration?: number
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duration = customDuration ?? 0.22 + Math.random() * 0.18;
    this.scheduleTetraStaticBurstInternal(ctx, now, duration, intensity);
  }

  private scheduleTetraStaticBurstInternal(
    ctx: AudioContext,
    startTime: number,
    duration: number,
    intensity: number
  ) {
    const tetraChain = this.createTetraDistortionFilter(
      ctx,
      28 + intensity * 18,
      0.16 * intensity
    );

    const sampleCount = Math.max(128, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Generate erratic RF static: white/pink noise gated by random electromagnetic crackle spikes
    let gate = 1.0;
    let lastSample = 0;
    for (let i = 0; i < sampleCount; i++) {
      if (i % Math.floor(ctx.sampleRate * (0.008 + Math.random() * 0.016)) === 0) {
        // Random static dropout or high-amplitude RF crackle spike
        const roll = Math.random();
        gate = roll < 0.28 ? 0.12 : roll < 0.65 ? 0.85 : 1.75;
      }
      const white = Math.random() * 2 - 1;
      // Slight high-frequency emphasis for sharp radio crackle
      const crackle = white - lastSample * 0.45;
      lastSample = white;
      const env = Math.sin((i / sampleCount) * Math.PI);
      data[i] = Math.max(-1, Math.min(1, crackle * gate * env));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Sweeping RF interference notch/bandpass modulation
    const rfFilter = ctx.createBiquadFilter();
    rfFilter.type = 'bandpass';
    rfFilter.frequency.setValueAtTime(950 + Math.random() * 1100, startTime);
    rfFilter.frequency.linearRampToValueAtTime(
      1650 + Math.random() * 900,
      startTime + duration
    );
    rfFilter.Q.value = 1.8;

    noise.connect(rfFilter);
    rfFilter.connect(tetraChain.input);
    noise.start(startTime);
    noise.stop(startTime + duration + 0.01);

    // Random heterodyne RF whistle / carrier interference micro-glitch on high-intensity alerts
    if (intensity >= 0.75 && Math.random() < 0.85) {
      const glitchOsc = ctx.createOscillator();
      const glitchGain = ctx.createGain();
      glitchOsc.type = 'sawtooth';
      const glitchStart = startTime + Math.random() * (duration * 0.45);
      const glitchLen = 0.035 + Math.random() * 0.04;
      glitchOsc.frequency.setValueAtTime(2150 + Math.random() * 550, glitchStart);
      glitchOsc.frequency.exponentialRampToValueAtTime(
        680 + Math.random() * 400,
        glitchStart + glitchLen
      );
      glitchGain.gain.setValueAtTime(0.08 * intensity, glitchStart);
      glitchGain.gain.exponentialRampToValueAtTime(0.001, glitchStart + glitchLen);

      glitchOsc.connect(glitchGain);
      glitchGain.connect(tetraChain.input);
      glitchOsc.start(glitchStart);
      glitchOsc.stop(glitchStart + glitchLen + 0.005);
    }
  }

  /**
   * Synthesizes a full Austrian BOS-TETRA digital radio transmission with:
   * 1. PTT digital trunking chirp
   * 2. Distorted narrowband vocoder syllabic cadence
   * 3. Random RF static bursts on important tactical alerts ('alert' / 'warn')
   * 4. Classic squelch tail ("Ksshh-krrt")
   */
  public playTetraRadioTransmission(
    tone: 'info' | 'warn' | 'alert' | 'ok' = 'info',
    textLength: number = 40,
    speaker: string = 'KOBRA-1'
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const isCriticalAlert = tone === 'alert';
    const isTacticalWarning = tone === 'warn';
    const isImportantAlert = isCriticalAlert || isTacticalWarning;

    const drive = isCriticalAlert ? 36 : isTacticalWarning ? 26 : 18;
    const masterLevel = isCriticalAlert ? 0.14 : isTacticalWarning ? 0.115 : 0.085;
    const tetraChain = this.createTetraDistortionFilter(ctx, drive, masterLevel);

    // 1. TETRA PTT (Push-To-Talk) Trunking Permit & Priority Chirp
    const pttOsc = ctx.createOscillator();
    const pttGain = ctx.createGain();
    pttOsc.type = isImportantAlert ? 'square' : 'sine';

    if (isCriticalAlert) {
      // Emergency TETRA priority interrupt tri-tone (1950Hz -> 2520Hz -> 1780Hz)
      pttOsc.frequency.setValueAtTime(1950, now);
      pttOsc.frequency.setValueAtTime(2520, now + 0.028);
      pttOsc.frequency.setValueAtTime(1780, now + 0.056);
      pttGain.gain.setValueAtTime(0.24, now);
      pttGain.gain.exponentialRampToValueAtTime(0.005, now + 0.088);
      pttOsc.connect(pttGain);
      pttGain.connect(tetraChain.input);
      pttOsc.start(now);
      pttOsc.stop(now + 0.092);
    } else if (isTacticalWarning) {
      // Tactical warning dual-tone (1680Hz -> 2220Hz)
      pttOsc.frequency.setValueAtTime(1680, now);
      pttOsc.frequency.setValueAtTime(2220, now + 0.03);
      pttGain.gain.setValueAtTime(0.19, now);
      pttGain.gain.exponentialRampToValueAtTime(0.005, now + 0.068);
      pttOsc.connect(pttGain);
      pttGain.connect(tetraChain.input);
      pttOsc.start(now);
      pttOsc.stop(now + 0.072);
    } else {
      // Standard BOS-Austria TETRA PTT grant chirp (1560Hz -> 1980Hz)
      pttOsc.frequency.setValueAtTime(1560, now);
      pttOsc.frequency.setValueAtTime(1980, now + 0.022);
      pttGain.gain.setValueAtTime(0.15, now);
      pttGain.gain.exponentialRampToValueAtTime(0.004, now + 0.052);
      pttOsc.connect(pttGain);
      pttGain.connect(tetraChain.input);
      pttOsc.start(now);
      pttOsc.stop(now + 0.056);
    }

    // 2. Distorted TETRA Vocoder Syllabic Cadence (simulates compressed voice packets over radio)
    const syllableCount = Math.max(3, Math.min(6, Math.round(textLength / 15)));
    const basePitch =
      speaker.includes('LEITSTELLE')
        ? 142
        : speaker.includes('KOBRA-2')
          ? 122
          : speaker.includes('EKIS') || speaker.includes('SENSOR')
            ? 158
            : 130;

    let cursor = now + (isCriticalAlert ? 0.09 : 0.06);
    for (let s = 0; s < syllableCount; s++) {
      const sylDur = 0.038 + Math.random() * 0.028;
      const gap = 0.014 + Math.random() * 0.018;

      const vOsc = ctx.createOscillator();
      const vFormant = ctx.createBiquadFilter();
      const vGain = ctx.createGain();

      vOsc.type = s % 2 === 0 ? 'sawtooth' : 'square';
      const pitchShift = (Math.random() - 0.45) * (isImportantAlert ? 36 : 22);
      vOsc.frequency.setValueAtTime(basePitch + pitchShift, cursor);
      vOsc.frequency.linearRampToValueAtTime(
        basePitch + pitchShift * 0.4,
        cursor + sylDur
      );

      vFormant.type = 'bandpass';
      vFormant.frequency.setValueAtTime(850 + ((s * 330 + Math.random() * 280) % 1100), cursor);
      vFormant.Q.value = 2.4;

      vGain.gain.setValueAtTime(0.001, cursor);
      vGain.gain.linearRampToValueAtTime(0.18, cursor + 0.008);
      vGain.gain.exponentialRampToValueAtTime(0.003, cursor + sylDur);

      vOsc.connect(vFormant);
      vFormant.connect(vGain);
      vGain.connect(tetraChain.input);

      vOsc.start(cursor);
      vOsc.stop(cursor + sylDur + 0.004);
      cursor += sylDur + gap;
    }

    // 3. Continuous low-level TETRA carrier background hiss during the transmission window
    const txDuration = Math.max(0.16, cursor - now + 0.04);
    const hissSamples = Math.floor(ctx.sampleRate * txDuration);
    const hissBuf = ctx.createBuffer(1, hissSamples, ctx.sampleRate);
    const hissData = hissBuf.getChannelData(0);
    for (let i = 0; i < hissSamples; i++) {
      hissData[i] = (Math.random() * 2 - 1) * (isImportantAlert ? 0.36 : 0.2);
    }
    const hissNode = ctx.createBufferSource();
    hissNode.buffer = hissBuf;
    const hissGain = ctx.createGain();
    hissGain.gain.setValueAtTime(isImportantAlert ? 0.14 : 0.08, now);
    hissGain.gain.setValueAtTime(isImportantAlert ? 0.14 : 0.08, now + txDuration - 0.02);
    hissGain.gain.exponentialRampToValueAtTime(0.001, now + txDuration);
    hissNode.connect(hissGain);
    hissGain.connect(tetraChain.input);
    hissNode.start(now);

    // 4. Classic TETRA Squelch Tail ("Ksshh-krrt") at transmission release
    const squelchStart = now + txDuration;
    const squelchDur = isImportantAlert ? 0.095 : 0.065;
    this.scheduleTetraStaticBurstInternal(
      ctx,
      squelchStart,
      squelchDur,
      isCriticalAlert ? 0.95 : isTacticalWarning ? 0.75 : 0.45
    );

    // 5. Random Static & RF Interference Bursts when receiving important tactical alerts!
    if (isImportantAlert) {
      // Immediate random static crackle overlapping the alert transmission
      const burstOffset = 0.02 + Math.random() * 0.06;
      const burstDur = (isCriticalAlert ? 0.18 : 0.12) + Math.random() * 0.14;
      this.scheduleTetraStaticBurstInternal(
        ctx,
        now + burstOffset,
        burstDur,
        isCriticalAlert ? 1.0 : 0.78
      );

      // Secondary random multipath static after-burst on high-priority alerts
      if (isCriticalAlert || Math.random() < 0.65) {
        const afterOffset = txDuration + squelchDur + 0.035 + Math.random() * 0.08;
        const afterDur = 0.09 + Math.random() * 0.11;
        this.scheduleTetraStaticBurstInternal(
          ctx,
          now + afterOffset,
          afterDur,
          isCriticalAlert ? 0.88 : 0.62
        );
      }
    }
  }

  public playBiometricLock(isHostile: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Digital camera shutter + telemetry double-chirp
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(isHostile ? 1320 : 1180, now);
    osc1.frequency.setValueAtTime(isHostile ? 1760 : 1580, now + 0.055);
    osc1.frequency.setValueAtTime(isHostile ? 2240 : 1980, now + 0.11);
    gain1.gain.setValueAtTime(0.07, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.2);
  }

  /**
   * Heavy ballistic impact thud when a bullet strikes Kevlar plate or ceramic body armor carrier.
   */
  public playArmorImpactThud() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(125, now);
    osc.frequency.exponentialRampToValueAtTime(26, now + 0.18);
    gain.gain.setValueAtTime(0.72, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);

    const bufLen = Math.floor(ctx.sampleRate * 0.12);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.025));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1100, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.12);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.48, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
  }

  /**
   * Sharp breath intake / groan of pain when operator receives health trauma.
   */
  public playPainGasp() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + 0.015;

    const bufLen = Math.floor(ctx.sampleRate * 0.28);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      const env = Math.sin((i / bufLen) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(550, now);
    filter.frequency.linearRampToValueAtTime(1450, now + 0.12);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.28);
    filter.Q.value = 2.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.38, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(175, now + 0.02);
    osc.frequency.exponentialRampToValueAtTime(115, now + 0.22);
    oscGain.gain.setValueAtTime(0.18, now + 0.02);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    const vFilter = ctx.createBiquadFilter();
    vFilter.type = 'lowpass';
    vFilter.frequency.value = 680;

    osc.connect(vFilter);
    vFilter.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now + 0.02);
    osc.stop(now + 0.25);
  }

  /**
   * Distorted TETRA emergency radio static burst when taking fire and health damage.
   */
  public playDistortedRadioStatic() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + 0.035;

    const bufLen = Math.floor(ctx.sampleRate * 0.22);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      const raw = (Math.random() * 2 - 1) * 1.8;
      data[i] = Math.max(-1, Math.min(1, raw)) * Math.exp(-i / (ctx.sampleRate * 0.12));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(3400, now + 0.1);
    filter.frequency.exponentialRampToValueAtTime(900, now + 0.22);
    filter.Q.value = 3.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  /**
   * Plays full tactical damage sequence: armor thud, operator pain gasp & distorted radio static burst.
   */
  public playPlayerDamageSequence() {
    this.playArmorImpactThud();
    this.playPainGasp();
    this.playDistortedRadioStatic();
  }

  /**
   * Triggers a realistic anatomical double-beat ("lub-dub") thud for high fatigue/trauma.
   */
  public playHeartbeatThud(intensity: number = 1.0) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. First beat ("Lub") - Deep cardiac muscle contraction
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const filter1 = ctx.createBiquadFilter();

    osc1.type = 'sine';
    const baseFreq = 58 + intensity * 18; // 58Hz -> 76Hz
    osc1.frequency.setValueAtTime(baseFreq, now);
    osc1.frequency.exponentialRampToValueAtTime(24, now + 0.11);

    filter1.type = 'lowpass';
    filter1.frequency.value = 140;

    const vol1 = Math.min(0.85, 0.28 + intensity * 0.38);
    gain1.gain.setValueAtTime(vol1, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.13);

    // 2. Second beat ("Dub") - Valve closure (~105ms later)
    const dubDelay = 0.105 - Math.min(0.035, intensity * 0.03); // Shorter gap at higher BPM
    const now2 = now + dubDelay;

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    const filter2 = ctx.createBiquadFilter();

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(baseFreq * 1.18, now2);
    osc2.frequency.exponentialRampToValueAtTime(28, now2 + 0.09);

    filter2.type = 'lowpass';
    filter2.frequency.value = 160;

    const vol2 = Math.min(0.75, 0.20 + intensity * 0.32);
    gain2.gain.setValueAtTime(vol2, now2);
    gain2.gain.exponentialRampToValueAtTime(0.001, now2 + 0.10);

    osc2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now2);
    osc2.stop(now2 + 0.11);

    // Sub-bass physical chest cavity vibration on extreme distress (intensity > 0.70)
    if (intensity > 0.7) {
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(45, now);
      sub.frequency.exponentialRampToValueAtTime(18, now + 0.16);
      subGain.gain.setValueAtTime(0.22 * intensity, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      sub.connect(subGain);
      subGain.connect(ctx.destination);
      sub.start(now);
      sub.stop(now + 0.17);
    }
  }

  /**
   * Plays material-specific impact sound (wood, metal, glass, wall) for projectiles and breach actions.
   */
  public playMaterialImpact(material: 'WOOD' | 'METAL' | 'GLASS' | 'WALL' | 'DEFAULT' = 'WALL') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    let baseFreq = 180;
    let duration = 0.15;
    let noiseFilterFreq = 1200;
    let noiseVol = 0.3;

    if (material === 'WOOD') {
      baseFreq = 140;
      duration = 0.18;
      noiseFilterFreq = 1800;
      noiseVol = 0.42;
    } else if (material === 'METAL') {
      baseFreq = 650;
      duration = 0.22;
      noiseFilterFreq = 3400;
      noiseVol = 0.25;
    } else if (material === 'GLASS') {
      baseFreq = 2200;
      duration = 0.12;
      noiseFilterFreq = 5500;
      noiseVol = 0.55;
    } else if (material === 'WALL') {
      baseFreq = 95;
      duration = 0.14;
      noiseFilterFreq = 800;
      noiseVol = 0.35;
    }

    osc.type = material === 'METAL' ? 'square' : material === 'GLASS' ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.3, now + duration);

    filter.type = 'lowpass';
    filter.frequency.value = noiseFilterFreq;

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);

    // Noise burst for debris / shattering
    const bufLen = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * (duration * 0.4)));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const nFilter = ctx.createBiquadFilter();
    nFilter.type = material === 'GLASS' ? 'highpass' : 'bandpass';
    nFilter.frequency.value = noiseFilterFreq;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(noiseVol, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
  }

  /**
   * Updates tactical heartbeat state according to operator fatigue and health trauma.
   * Accelerates heart rate (BPM) up to 185 BPM when fatigue > 70% or health < 40%.
   */
  public updateHeartbeat(fatigue: number, hp: number, maxHp: number, _dt: number) {
    if (this.muted) return;

    const hpRatio = maxHp > 0 ? hp / maxHp : 1.0;
    const isFatigued = fatigue > 70;
    const isLowHealth = hpRatio < 0.40;

    if (!isFatigued && !isLowHealth) {
      this.lastHeartbeatTimestamp = 0;
      return;
    }

    // Compute fatigue severity (0..1) for fatigue > 70
    const fatigueSeverity = isFatigued ? Math.min(1.0, (fatigue - 70) / 30) : 0;
    // Compute trauma severity (0..1) for HP < 40%
    const traumaSeverity = isLowHealth ? Math.min(1.0, (0.40 - hpRatio) / 0.40) : 0;

    const combinedSeverity = Math.max(fatigueSeverity, traumaSeverity, (fatigueSeverity + traumaSeverity) * 0.7);

    // Heart rate scaling: 100 BPM at threshold up to 185 BPM at maximum severity
    const targetBpm = 100 + combinedSeverity * 85;
    const beatIntervalSec = 60 / targetBpm;

    const now = performance.now() / 1000;
    if (this.lastHeartbeatTimestamp === 0 || now - this.lastHeartbeatTimestamp >= beatIntervalSec) {
      this.lastHeartbeatTimestamp = now;
      this.playHeartbeatThud(combinedSeverity);
    }
  }

  /**
   * Synthesizes the mechanical switch click and high-frequency image-intensifier
   * capacitor whine of Gen-3 Night Vision Goggles (GPNVG-18 / PVS-31).
   */
  public playNvgToggle(turningOn: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Crisp mechanical rotary switch click
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(turningOn ? 1400 : 950, now);
    clickOsc.frequency.exponentialRampToValueAtTime(220, now + 0.032);
    clickGain.gain.setValueAtTime(0.18, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.038);

    // 2. High-pitched phosphor tube capacitor whine sweep
    const whineOsc = ctx.createOscillator();
    const whineGain = ctx.createGain();
    whineOsc.type = 'sine';
    if (turningOn) {
      whineOsc.frequency.setValueAtTime(1650, now + 0.02);
      whineOsc.frequency.exponentialRampToValueAtTime(5400, now + 0.34);
      whineOsc.frequency.setValueAtTime(5400, now + 0.34);
      whineGain.gain.setValueAtTime(0.001, now);
      whineGain.gain.linearRampToValueAtTime(0.085, now + 0.07);
      whineGain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
      whineOsc.connect(whineGain);
      whineGain.connect(ctx.destination);
      whineOsc.start(now + 0.02);
      whineOsc.stop(now + 0.55);
    } else {
      whineOsc.frequency.setValueAtTime(4600, now + 0.01);
      whineOsc.frequency.exponentialRampToValueAtTime(780, now + 0.24);
      whineGain.gain.setValueAtTime(0.065, now + 0.01);
      whineGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      whineOsc.connect(whineGain);
      whineGain.connect(ctx.destination);
      whineOsc.start(now + 0.01);
      whineOsc.stop(now + 0.28);
    }
  }

  public playSuspicionPing() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.18);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playDetectionWarningStinger() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.linearRampToValueAtTime(260, now + 0.22);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  public playFootstepSound(isSprinting: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.04);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.012));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = isSprinting ? 650 : 380;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(isSprinting ? 0.045 : 0.018, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  public playStationAlarmSiren() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    // Industrial European train station alarm wail
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.linearRampToValueAtTime(940, now + 0.35);
    osc.frequency.linearRampToValueAtTime(680, now + 0.7);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.78);
  }

  /**
   * Spoken voices using Web Speech API (speechSynthesis).
   * Differentiates pitch and rate for Kobra agents, Suspects, and Hostages.
   */
  public speak(text: string, role: 'PLAYER' | 'SQUAD' | 'SUSPECT' | 'HOSTAGE' | 'CIVILIAN') {
    if (this.muted || !window.speechSynthesis) return;

    // Optional: Only cancel if it's a priority shout
    // window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    
    // Heuristic for language detection (German vs Spanish/English)
    const hasGermanKeywords = /POLIZEI|WAFFE|HAND|BODEN|GIB|AUF/i.test(text);
    utter.lang = hasGermanKeywords ? 'de-DE' : 'es-ES';

    if (role === 'PLAYER' || role === 'SQUAD') {
      utter.pitch = 0.9;
      utter.rate = 1.0;
    } else if (role === 'SUSPECT') {
      utter.pitch = 0.7;
      utter.rate = 0.9;
    } else if (role === 'HOSTAGE' || role === 'CIVILIAN') {
      utter.pitch = 1.2;
      utter.rate = 1.1;
    }

    window.speechSynthesis.speak(utter);
  }

  public playRadioChatterEffect(text: string = '') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Radio Squelch Click (Start)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2200, now);
    osc.frequency.exponentialRampToValueAtTime(450, now + 0.035);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);

    // 2. Subtle Bandpass White Noise (Radio static crackle)
    const duration = 0.4;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.12));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1450;
    filter.Q.value = 1.5;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.08, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);

    // 3. Spoken text via SpeechSynthesis with radio voice effect
    if (text && typeof window !== 'undefined' && window.speechSynthesis) {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = /POLIZEI|WAFFE|HAND|BODEN|GIB|AUF|ACHTUNG/i.test(text) ? 'de-DE' : 'es-ES';
      utter.pitch = 0.88;
      utter.rate = 1.02;
      window.speechSynthesis.speak(utter);
    }
  }
}

export const soundEngine = new TacticalSoundEngine();


