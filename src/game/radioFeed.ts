import { soundEngine } from './soundEngine';
import type { GameState, RadioFeedItem } from './types';

export class RadioFeed {
  items: RadioFeedItem[] = [];
  txTimer = 0;
  staticTimer = 0;
  lastAudioStamp = 0;

  push(
    speaker: string,
    text: string,
    tone: RadioFeedItem['tone'] = 'info',
    options: { silent?: boolean } = {},
    deps: { gameState: GameState; emitHudSnapshot: () => void }
  ): void {
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 8);
    const isSilent = options.silent === true;
    const isImportantAlert = tone === 'alert' || tone === 'warn';
    const hasStaticBurst = !isSilent && (isImportantAlert || Math.random() < 0.18);

    this.items = [
      {
        id: `${Date.now()}_${Math.random()}`,
        speaker,
        text,
        time: timeStr,
        tone,
        hasStaticBurst,
        silent: isSilent,
      },
      ...this.items.slice(0, 5),
    ];

    if (deps.gameState === 'PLAYING') {
      if (isSilent) {
        this.txTimer = 0.35;
        soundEngine.playTetraStaticBurst(0.35, 0.12);
        deps.emitHudSnapshot();
        return;
      }

      const nowMs = performance.now();
      this.txTimer = tone === 'alert' ? 2.4 : tone === 'warn' ? 2.0 : 1.75;
      if (hasStaticBurst) {
        this.staticTimer = tone === 'alert' ? 0.95 : 0.65;
      }

      if (nowMs - this.lastAudioStamp > 110) {
        this.lastAudioStamp = nowMs;
        soundEngine.playTetraRadioTransmission(tone, text.length);
      } else if (isImportantAlert) {
        soundEngine.playTetraStaticBurst(tone === 'alert' ? 0.95 : 0.72);
      }
      deps.emitHudSnapshot();
    }
  }

  tick(dt: number): void {
    this.txTimer = Math.max(0, this.txTimer - dt);
    this.staticTimer = Math.max(0, this.staticTimer - dt);
  }
}