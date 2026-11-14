import { describe, expect, it } from 'vitest';
import { soundEngine } from './soundEngine';

describe('soundEngine.destroy', () => {
  it('can run repeatedly without a live audio graph', () => {
    expect(() => {
      soundEngine.destroy();
      soundEngine.destroy();
      soundEngine.destroy();
    }).not.toThrow();
  });

  it('leaves playback as a no-op when there is no browser audio context', () => {
    soundEngine.destroy();
    expect(() => soundEngine.playUiClick()).not.toThrow();
  });
});
