import type { CardCompletionOutcome } from '../hooks/useCardCompletion';

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioContext) {
    sharedAudioContext = new AudioCtx();
  }
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().catch(() => {});
  }
  return sharedAudioContext;
}

interface ToneNote {
  freq: number;
  endFreq?: number;
  delay: number;
  duration: number;
  gain: number;
}

const CHIME_NOTES: Record<CardCompletionOutcome, ToneNote[]> = {
  good: [
    { freq: 523.25, delay: 0, duration: 0.16, gain: 0.07 },
    { freq: 659.25, delay: 0.055, duration: 0.2, gain: 0.075 },
  ],
  easy: [
    { freq: 523.25, delay: 0, duration: 0.14, gain: 0.065 },
    { freq: 659.25, delay: 0.048, duration: 0.16, gain: 0.07 },
    { freq: 783.99, delay: 0.096, duration: 0.22, gain: 0.075 },
  ],
  hard: [{ freq: 587.33, delay: 0, duration: 0.17, gain: 0.065 }],
  again: [{ freq: 233.08, endFreq: 196.0, delay: 0, duration: 0.15, gain: 0.055 }],
  next: [{ freq: 659.25, delay: 0, duration: 0.09, gain: 0.045 }],
};

const SESSION_COMPLETE_NOTES: ToneNote[] = [
  { freq: 523.25, delay: 0, duration: 0.22, gain: 0.065 },
  { freq: 659.25, delay: 0.07, duration: 0.24, gain: 0.07 },
  { freq: 783.99, delay: 0.14, duration: 0.28, gain: 0.075 },
  { freq: 1046.5, delay: 0.22, duration: 0.42, gain: 0.08 },
];

function playNotes(notes: ToneNote[]): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    for (const note of notes) {
      const start = now + note.delay;
      const stop = start + note.duration;

      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const env = ctx.createGain();
      const overtoneGain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, start);
      if (note.endFreq) {
        osc.frequency.exponentialRampToValueAtTime(note.endFreq, stop);
      }

      overtone.type = 'triangle';
      overtone.frequency.setValueAtTime(note.freq * 2, start);
      if (note.endFreq) {
        overtone.frequency.exponentialRampToValueAtTime(note.endFreq * 2, stop);
      }
      overtoneGain.gain.setValueAtTime(0.14, start);

      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(note.gain, start + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, stop);

      osc.connect(env);
      overtone.connect(overtoneGain);
      overtoneGain.connect(env);
      env.connect(ctx.destination);

      osc.start(start);
      overtone.start(start);
      osc.stop(stop + 0.01);
      overtone.stop(stop + 0.01);
    }
  } catch {
    // Ignore audio synthesis failures on restricted devices
  }
}

let chimeQuietUntil = 0;

export function getChimeRemainingMs(): number {
  return Math.max(0, chimeQuietUntil - Date.now());
}

export function playCardChime(outcome: CardCompletionOutcome): void {
  chimeQuietUntil = Date.now() + 230;
  playNotes(CHIME_NOTES[outcome]);
}

export function playSessionCompleteChime(): void {
  playNotes(SESSION_COMPLETE_NOTES);
}

const HAPTIC_PATTERNS: Record<CardCompletionOutcome, number | number[]> = {
  good: 12,
  easy: [10, 26, 14],
  hard: 10,
  again: 18,
  next: 8,
};

function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore unsupported or blocked haptics
  }
}

export function triggerCardHaptic(outcome: CardCompletionOutcome): void {
  vibrate(HAPTIC_PATTERNS[outcome]);
}

export function triggerSessionCompleteHaptic(): void {
  vibrate([14, 38, 14, 38, 24]);
}
