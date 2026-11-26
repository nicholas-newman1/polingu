/**
 * jsdom has no media playback, so this models just enough of HTMLMediaElement for
 * the players: play/pause/load, currentTime, duration, readyState, playbackRate
 * and the events they fire, following the HTML spec's ordering:
 *   - play() on a paused element fires `play`; on a playing one it does nothing.
 *   - pause() on a playing element fires `pause`; on a paused one it does nothing.
 *   - load() silently stops playback (no `pause` event) and resets the element:
 *     position 0, no duration, and playbackRate back to defaultPlaybackRate (step 7
 *     of the spec's media element load algorithm, which browsers implement). Once
 *     the source "arrives" it fires `loadedmetadata`, then `canplay`.
 *   - setting `src` (property or attribute) runs the same load algorithm, as in a
 *     browser. jsdom's `new Audio(url)` sets the attribute internally, so it does not.
 *   - reaching the end fires `timeupdate`, `pause`, then `ended`.
 *   - a paused element keeps its position, readyState and buffered data.
 *
 * Events are dispatched synchronously inside the call that causes them, while a
 * browser queues `play`, `pause`, `seeked` etc. as tasks. So a listener that React
 * would remove before the queued event runs (an effect cleanup after a click) still
 * hears it here: before reporting a bug that hinges on such a listener running,
 * check the order a browser would give.
 *
 * By default a loaded source arrives on the next microtask with a duration of
 * DEFAULT_DURATION seconds. Set `media.autoLoad = false` to deliver it by hand
 * with `media.arrive(el)`, and `media.durations` to give a source another length.
 *
 * Playback only moves when a test says so: `media.play(ms)` advances fake time
 * frame by frame while every playing element's position advances with it.
 */
import { act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

export const DEFAULT_DURATION = 100;
const FRAME_MS = 16;

interface MediaState {
  paused: boolean;
  currentTime: number;
  duration: number;
  readyState: number;
  playbackRate: number;
  defaultPlaybackRate: number;
  ended: boolean;
  /** Calls to load(); setting `src` runs the load algorithm without counting here. */
  loads: number;
  generation: number;
}

const states = new WeakMap<HTMLMediaElement, MediaState>();
const known = new Set<HTMLMediaElement>();

function stateOf(el: HTMLMediaElement): MediaState {
  let s = states.get(el);
  if (!s) {
    s = {
      paused: true,
      currentTime: 0,
      duration: NaN,
      readyState: 0,
      playbackRate: 1,
      defaultPlaybackRate: 1,
      ended: false,
      loads: 0,
      generation: 0,
    };
    states.set(el, s);
  }
  known.add(el);
  return s;
}

const fire = (el: HTMLMediaElement, type: string) => el.dispatchEvent(new Event(type));

const clamp = (s: MediaState, time: number) =>
  Math.max(0, Number.isFinite(s.duration) ? Math.min(time, s.duration) : time);

function reachEnd(el: HTMLMediaElement) {
  const s = stateOf(el);
  s.currentTime = s.duration;
  fire(el, 'timeupdate');
  if (!s.paused) {
    s.paused = true;
    fire(el, 'pause');
  }
  s.ended = true;
  fire(el, 'ended');
}

/** The media element load algorithm: stops and resets the element, then fetches `src`. */
function runLoadAlgorithm(el: HTMLMediaElement) {
  const s = stateOf(el);
  s.generation++;
  s.paused = true;
  s.ended = false;
  s.currentTime = 0;
  s.duration = NaN;
  s.readyState = 0;
  s.playbackRate = s.defaultPlaybackRate;
  const generation = s.generation;
  if (el.getAttribute('src') && media.autoLoad) {
    queueMicrotask(() => {
      if (s.generation === generation) media.arrive(el);
    });
  }
}

const PATCHED = [
  'play',
  'pause',
  'load',
  'src',
  'setAttribute',
  'paused',
  'currentTime',
  'duration',
  'readyState',
  'playbackRate',
  'defaultPlaybackRate',
  'ended',
] as const;

const originals = new Map<string, PropertyDescriptor | undefined>();

function install() {
  const proto = HTMLMediaElement.prototype;
  for (const key of PATCHED) originals.set(key, Object.getOwnPropertyDescriptor(proto, key));
  const src = originals.get('src')!;

  Object.defineProperties(proto, {
    play: {
      configurable: true,
      writable: true,
      value(this: HTMLMediaElement) {
        const s = stateOf(this);
        media.playCalls.push(this);
        if (media.blockPlay) {
          return Promise.reject(new DOMException('play() was blocked', 'NotAllowedError'));
        }
        if (s.ended || (Number.isFinite(s.duration) && s.currentTime >= s.duration)) {
          s.currentTime = 0;
          s.ended = false;
        }
        if (s.paused) {
          s.paused = false;
          fire(this, 'play');
        }
        return Promise.resolve();
      },
    },
    pause: {
      configurable: true,
      writable: true,
      value(this: HTMLMediaElement) {
        const s = stateOf(this);
        if (!s.paused) {
          s.paused = true;
          fire(this, 'pause');
        }
      },
    },
    load: {
      configurable: true,
      writable: true,
      value(this: HTMLMediaElement) {
        stateOf(this).loads++;
        runLoadAlgorithm(this);
      },
    },
    src: {
      configurable: true,
      get(this: HTMLMediaElement) {
        return src.get!.call(this);
      },
      set(this: HTMLMediaElement, value: string) {
        src.set!.call(this, value);
        runLoadAlgorithm(this);
      },
    },
    setAttribute: {
      configurable: true,
      writable: true,
      value(this: HTMLMediaElement, name: string, value: string) {
        Element.prototype.setAttribute.call(this, name, value);
        if (name.toLowerCase() === 'src') runLoadAlgorithm(this);
      },
    },
    paused: {
      configurable: true,
      get(this: HTMLMediaElement) {
        return stateOf(this).paused;
      },
    },
    ended: {
      configurable: true,
      get(this: HTMLMediaElement) {
        return stateOf(this).ended;
      },
    },
    duration: {
      configurable: true,
      get(this: HTMLMediaElement) {
        return stateOf(this).duration;
      },
    },
    readyState: {
      configurable: true,
      get(this: HTMLMediaElement) {
        return stateOf(this).readyState;
      },
    },
    playbackRate: {
      configurable: true,
      get(this: HTMLMediaElement) {
        return stateOf(this).playbackRate;
      },
      set(this: HTMLMediaElement, rate: number) {
        stateOf(this).playbackRate = rate;
      },
    },
    defaultPlaybackRate: {
      configurable: true,
      get(this: HTMLMediaElement) {
        return stateOf(this).defaultPlaybackRate;
      },
      set(this: HTMLMediaElement, rate: number) {
        stateOf(this).defaultPlaybackRate = rate;
      },
    },
    currentTime: {
      configurable: true,
      get(this: HTMLMediaElement) {
        return stateOf(this).currentTime;
      },
      set(this: HTMLMediaElement, time: number) {
        const s = stateOf(this);
        s.currentTime = clamp(s, time);
        s.ended = false;
        fire(this, 'seeking');
        fire(this, 'seeked');
      },
    },
  });
}

function uninstall() {
  const proto = HTMLMediaElement.prototype;
  for (const key of PATCHED) {
    const original = originals.get(key);
    if (original) Object.defineProperty(proto, key, original);
    else delete (proto as unknown as Record<string, unknown>)[key];
  }
  originals.clear();
}

export const media = {
  autoLoad: true,
  blockPlay: false,
  /** Duration in seconds by source URL; others last DEFAULT_DURATION. */
  durations: new Map<string, number>(),
  /** Every element play() was called on, in order. */
  playCalls: [] as HTMLMediaElement[],

  /** Installs the fake for each test of the calling file. */
  setup() {
    beforeEach(() => {
      media.autoLoad = true;
      media.blockPlay = false;
      media.durations.clear();
      media.playCalls.length = 0;
      known.clear();
      install();
    });
    afterEach(() => {
      // Unmount while the fake is still installed: players pause their audio on unmount.
      cleanup();
      uninstall();
    });
  },

  state: (el: HTMLMediaElement) => ({ ...stateOf(el) }),

  /** Every media element the code under test has touched. */
  elements: () => [...known].filter((el) => states.has(el)),

  /** Elements currently playing. */
  playing: () => media.elements().filter((el) => !stateOf(el).paused),

  /** The element whose source is `src`. Throws unless there is exactly one. */
  withSource(src: string): HTMLMediaElement {
    const matches = media.elements().filter((el) => el.getAttribute('src') === src);
    if (matches.length !== 1) {
      throw new Error(`Expected one media element with src ${src}, found ${matches.length}`);
    }
    return matches[0];
  },

  /** The one element that is playing. Throws unless exactly one is. */
  onlyPlaying(): HTMLMediaElement {
    const playing = media.playing();
    if (playing.length !== 1) {
      const srcs = playing.map((el) => el.getAttribute('src')).join(', ');
      throw new Error(`Expected exactly one playing element, found ${playing.length}: ${srcs}`);
    }
    return playing[0];
  },

  /** Delivers the element's source: `loadedmetadata`, then `canplay`. */
  arrive(el: HTMLMediaElement) {
    const s = stateOf(el);
    const src = el.getAttribute('src') ?? '';
    s.duration = media.durations.get(src) ?? DEFAULT_DURATION;
    s.readyState = 1;
    fire(el, 'loadedmetadata');
    s.readyState = 4;
    fire(el, 'loadeddata');
    fire(el, 'canplay');
    fire(el, 'canplaythrough');
  },

  /** Plays to the end of the element's source. */
  finish(el: HTMLMediaElement) {
    act(() => reachEnd(el));
  },

  /** Moves `el`'s position as playback would, without a seek. */
  moveTo(el: HTMLMediaElement, seconds: number) {
    const s = stateOf(el);
    s.currentTime = clamp(s, seconds);
    el.dispatchEvent(new Event('timeupdate'));
  },

  /**
   * Lets `ms` of fake time pass frame by frame. Every playing element moves forward
   * at its playback rate, reaching its end if it gets there.
   */
  play(ms: number) {
    for (let elapsed = 0; elapsed < ms; elapsed += FRAME_MS) {
      const step = Math.min(FRAME_MS, ms - elapsed);
      act(() => {
        for (const el of media.playing()) {
          const s = stateOf(el);
          s.currentTime += (step / 1000) * s.playbackRate;
          if (Number.isFinite(s.duration) && s.currentTime >= s.duration) reachEnd(el);
        }
        vi.advanceTimersByTime(step);
      });
    }
  },
};
