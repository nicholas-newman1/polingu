import { beforeEach, describe, expect, test, vi } from 'vitest';

// The shared AudioContext and the quiet window live in module state, so every test
// loads a fresh copy.
async function loadFeedback() {
  vi.resetModules();
  return import('../../src/lib/cardFeedback');
}

type Automation = [method: string, value: number, time: number];

class FakeParam {
  readonly automation: Automation[] = [];
  setValueAtTime(value: number, time: number) {
    this.automation.push(['set', value, time]);
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.automation.push(['linear', value, time]);
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.automation.push(['exponential', value, time]);
  }
}

class FakeNode {
  readonly outputs: unknown[] = [];
  connect(target: unknown) {
    this.outputs.push(target);
  }
}

class FakeOscillator extends FakeNode {
  type = '';
  readonly frequency = new FakeParam();
  startAt: number | null = null;
  stopAt: number | null = null;
  start(time: number) {
    this.startAt = time;
  }
  stop(time: number) {
    this.stopAt = time;
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
}

/** Web Audio stand-in: records the oscillators each chime schedules. */
class FakeAudioContext {
  static created: FakeAudioContext[] = [];
  static initialState: 'running' | 'suspended' = 'running';
  state: 'running' | 'suspended' | 'closed' = FakeAudioContext.initialState;
  currentTime = 4;
  readonly destination = { kind: 'speakers' };
  readonly oscillators: FakeOscillator[] = [];
  readonly gains: FakeGain[] = [];
  resume = vi.fn(async () => {
    this.state = 'running';
  });

  constructor() {
    FakeAudioContext.created.push(this);
  }

  createOscillator() {
    const osc = new FakeOscillator();
    this.oscillators.push(osc);
    return osc;
  }

  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }

  /** The audible notes: the sine oscillators, in the order they were scheduled. */
  get notes() {
    return this.oscillators
      .filter((o) => o.type === 'sine')
      .map((o) => ({
        freq: o.frequency.automation[0][1],
        start: o.startAt,
        glideTo: o.frequency.automation.find(([m]) => m === 'exponential')?.[1],
      }));
  }
}

const close = (value: number) => expect.closeTo(value, 6);

beforeEach(() => {
  FakeAudioContext.created = [];
  FakeAudioContext.initialState = 'running';
  vi.stubGlobal('AudioContext', FakeAudioContext);
});

describe('rating chimes', () => {
  test('“good” plays two rising notes, the second just after the first', async () => {
    const { playCardChime } = await loadFeedback();

    playCardChime('good');

    const [ctx] = FakeAudioContext.created;
    expect(ctx.notes).toEqual([
      { freq: 523.25, start: 4, glideTo: undefined },
      { freq: 659.25, start: close(4.055), glideTo: undefined },
    ]);
  });

  test('“easy” plays a three-note rising arpeggio', async () => {
    const { playCardChime } = await loadFeedback();

    playCardChime('easy');

    const freqs = FakeAudioContext.created[0].notes.map((n) => n.freq);
    expect(freqs).toEqual([523.25, 659.25, 783.99]);
  });

  test('“hard” and “next” each play a single note', async () => {
    const { playCardChime } = await loadFeedback();

    playCardChime('hard');
    playCardChime('next');

    expect(FakeAudioContext.created[0].notes.map((n) => n.freq)).toEqual([587.33, 659.25]);
  });

  test('“again” plays one low note that falls in pitch', async () => {
    const { playCardChime } = await loadFeedback();

    playCardChime('again');

    expect(FakeAudioContext.created[0].notes).toEqual([{ freq: 233.08, start: 4, glideTo: 196 }]);
  });

  test('each note has a quiet octave overtone and is routed to the speakers', async () => {
    const { playCardChime } = await loadFeedback();

    playCardChime('good');

    const ctx = FakeAudioContext.created[0];
    const overtones = ctx.oscillators.filter((o) => o.type === 'triangle');
    expect(overtones.map((o) => o.frequency.automation[0][1])).toEqual([523.25 * 2, 659.25 * 2]);
    const envelopes = ctx.gains.filter((g) => g.outputs.includes(ctx.destination));
    expect(envelopes).toHaveLength(2);
    for (const osc of ctx.oscillators) {
      expect(osc.outputs).toHaveLength(1);
    }
  });

  test('every note stops shortly after it starts, so no tone keeps sounding', async () => {
    const { playCardChime, playSessionCompleteChime } = await loadFeedback();

    playCardChime('easy');
    playSessionCompleteChime();

    const ctx = FakeAudioContext.created[0];
    // Three notes plus four, each a tone and its overtone.
    expect(ctx.oscillators).toHaveLength(2 * (3 + 4));
    for (const osc of ctx.oscillators) {
      expect(osc.startAt).not.toBeNull();
      expect(osc.stopAt! - osc.startAt!).toBeGreaterThan(0);
      expect(osc.stopAt! - osc.startAt!).toBeLessThan(0.5);
    }
  });

  test('a finished session plays four rising notes ending an octave above the start', async () => {
    const { playSessionCompleteChime } = await loadFeedback();

    playSessionCompleteChime();

    const notes = FakeAudioContext.created[0].notes;
    expect(notes.map((n) => n.freq)).toEqual([523.25, 659.25, 783.99, 1046.5]);
    expect(notes.map((n) => n.start)).toEqual([4, close(4.07), close(4.14), close(4.22)]);
  });

  test('all chimes share one audio context', async () => {
    const { playCardChime, playSessionCompleteChime } = await loadFeedback();

    playCardChime('good');
    playCardChime('again');
    playSessionCompleteChime();

    expect(FakeAudioContext.created).toHaveLength(1);
  });

  test('a context the browser suspended is resumed before playing', async () => {
    FakeAudioContext.initialState = 'suspended';
    const { playCardChime } = await loadFeedback();

    playCardChime('good');

    expect(FakeAudioContext.created[0].resume).toHaveBeenCalledTimes(1);
  });

  test('a refused resume is ignored', async () => {
    FakeAudioContext.initialState = 'suspended';
    const { playCardChime } = await loadFeedback();
    playCardChime('good');
    const ctx = FakeAudioContext.created[0];
    ctx.state = 'suspended';
    ctx.resume.mockRejectedValueOnce(new DOMException('Not allowed', 'NotAllowedError'));

    expect(() => playCardChime('good')).not.toThrow();
    await Promise.resolve();
    expect(ctx.resume).toHaveBeenCalledTimes(2);
  });

  test('falls back to the prefixed webkitAudioContext on older Safari', async () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', FakeAudioContext);
    const { playCardChime } = await loadFeedback();

    playCardChime('hard');

    expect(FakeAudioContext.created[0].notes.map((n) => n.freq)).toEqual([587.33]);
  });

  test('without Web Audio, chimes are silently skipped', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const { playCardChime, playSessionCompleteChime } = await loadFeedback();

    expect(() => playCardChime('good')).not.toThrow();
    expect(() => playSessionCompleteChime()).not.toThrow();
  });

  test('a device that refuses to synthesise sound does not break rating', async () => {
    vi.spyOn(FakeAudioContext.prototype, 'createOscillator').mockImplementation(() => {
      throw new DOMException('Audio output disabled', 'NotSupportedError');
    });
    const { playCardChime, playSessionCompleteChime } = await loadFeedback();

    expect(() => playCardChime('easy')).not.toThrow();
    expect(() => playSessionCompleteChime()).not.toThrow();
  });
});

describe('quiet window after a chime', () => {
  test('is zero before any chime', async () => {
    const { getChimeRemainingMs } = await loadFeedback();

    expect(getChimeRemainingMs()).toBe(0);
  });

  test('lasts 230 ms after a rating chime and counts down to zero', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-26T18:00:00Z'));
    const { getChimeRemainingMs, playCardChime } = await loadFeedback();

    playCardChime('good');
    expect(getChimeRemainingMs()).toBe(230);

    vi.setSystemTime(Date.now() + 100);
    expect(getChimeRemainingMs()).toBe(130);

    vi.setSystemTime(Date.now() + 500);
    expect(getChimeRemainingMs()).toBe(0);
  });

  test('is not started by the session-complete chime', async () => {
    const { getChimeRemainingMs, playSessionCompleteChime } = await loadFeedback();

    playSessionCompleteChime();

    expect(getChimeRemainingMs()).toBe(0);
  });
});
