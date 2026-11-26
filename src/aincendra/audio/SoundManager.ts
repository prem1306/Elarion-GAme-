export class SoundManager {
  private ctx: AudioContext | null = null;
  private muted = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType = 'triangle',
    gainPeak = 0.12,
    delay = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, freqStart), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playSwordSwing(heavy = false): void {
    const jitter = 0.92 + Math.random() * 0.16;
    if (heavy) {
      this.playTone(210 * jitter, 75, 0.28, 'sawtooth', 0.13);
      this.playTone(420 * jitter, 140, 0.22, 'triangle', 0.08, 0.03);
    } else {
      this.playTone(340 * jitter, 130, 0.14, 'triangle', 0.09);
    }
  }

  public playHitImpact(critical = false): void {
    const jitter = 0.92 + Math.random() * 0.16;
    if (critical) {
      this.playTone(170 * jitter, 52, 0.22, 'square', 0.14);
      this.playTone(620 * jitter, 220, 0.16, 'sawtooth', 0.08);
    } else {
      this.playTone(145 * jitter, 58, 0.14, 'triangle', 0.12);
    }
  }

  public playParryClang(): void {
    this.playTone(980, 740, 0.22, 'triangle', 0.14);
    this.playTone(1480, 1120, 0.18, 'sine', 0.1, 0.02);
  }

  public playSidearmShot(): void {
    const jitter = 0.94 + Math.random() * 0.12;
    this.playTone(720 * jitter, 180, 0.16, 'sawtooth', 0.1);
    this.playTone(1120 * jitter, 320, 0.1, 'sine', 0.07);
  }

  public playSpellCast(school: 'Voltaic' | 'Pyre' | 'Chrono' | 'Aether'): void {
    if (school === 'Voltaic') {
      this.playTone(880, 260, 0.2, 'sawtooth', 0.11);
      this.playTone(1320, 440, 0.14, 'sine', 0.08, 0.03);
    } else if (school === 'Pyre') {
      this.playTone(220, 68, 0.36, 'sawtooth', 0.14);
      this.playTone(440, 120, 0.28, 'triangle', 0.1, 0.02);
    } else if (school === 'Chrono') {
      this.playTone(520, 780, 0.28, 'sine', 0.1);
      this.playTone(780, 1040, 0.26, 'triangle', 0.07, 0.06);
    } else {
      this.playTone(660, 330, 0.28, 'sine', 0.11);
      this.playTone(990, 495, 0.24, 'triangle', 0.08, 0.04);
    }
  }

  public playVentBlast(): void {
    this.playTone(280, 48, 0.42, 'sawtooth', 0.16);
    this.playTone(640, 120, 0.32, 'triangle', 0.11, 0.03);
  }

  public playCraftSuccess(): void {
    this.playTone(520, 520, 0.1, 'triangle', 0.12);
    this.playTone(780, 780, 0.14, 'sine', 0.11, 0.09);
    this.playTone(1040, 1040, 0.22, 'sine', 0.1, 0.18);
  }

  public playPickup(): void {
    this.playTone(640, 880, 0.12, 'sine', 0.09);
    this.playTone(880, 1180, 0.14, 'sine', 0.08, 0.06);
  }

  public playQuestAdvance(completed = false): void {
    if (completed) {
      this.playTone(440, 440, 0.16, 'triangle', 0.1);
      this.playTone(554, 554, 0.16, 'triangle', 0.1, 0.12);
      this.playTone(659, 659, 0.22, 'triangle', 0.11, 0.24);
      this.playTone(880, 880, 0.35, 'sine', 0.12, 0.36);
    } else {
      this.playTone(523, 659, 0.18, 'sine', 0.09);
    }
  }

  public playPlayerHurt(): void {
    this.playTone(150, 62, 0.2, 'sawtooth', 0.14);
  }

  public playFootstep(sprinting = false): void {
    const jitter = 0.88 + Math.random() * 0.24;
    this.playTone(sprinting ? 105 * jitter : 84 * jitter, 42, 0.055, 'triangle', sprinting ? 0.045 : 0.028);
  }

  public playStanceBreak(): void {
    this.playTone(620, 180, 0.34, 'square', 0.14);
    this.playTone(1240, 880, 0.28, 'triangle', 0.11, 0.03);
  }

  public playRiposteBoom(): void {
    this.playTone(160, 44, 0.38, 'sawtooth', 0.16);
    this.playTone(960, 480, 0.24, 'triangle', 0.12, 0.02);
  }

  public dispose(): void {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
