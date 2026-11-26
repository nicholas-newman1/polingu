/**
 * Browser APIs that jsdom lacks or only stubs out with "not implemented" errors.
 * `installBrowser()` runs before each test (see app.tsx); tests steer it through
 * `browser`.
 */
import { vi } from 'vitest';

export const browser = {
  /** Answer to `(prefers-reduced-motion: reduce)`. */
  reducedMotion: false,
  /** Audio URLs passed to HTMLMediaElement.play(), in order. */
  played: [] as string[],
  /** Oscillators started by the Web Audio chimes. */
  chimeNotes: 0,
};

/** Evaluates the media queries MUI and the app use against window.innerWidth. */
function matches(query: string): boolean {
  if (query.includes('prefers-reduced-motion')) return browser.reducedMotion;
  if (query.includes('prefers-color-scheme: dark')) return false;
  const width = window.innerWidth;
  const min = /min-width:\s*([\d.]+)px/.exec(query);
  const max = /max-width:\s*([\d.]+)px/.exec(query);
  if (!min && !max) return false;
  return (!min || width >= Number(min[1])) && (!max || width <= Number(max[1]));
}

function matchMedia(query: string): MediaQueryList {
  return {
    media: query,
    matches: matches(query),
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  };
}

class FakeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

const audioParam = () => ({
  setValueAtTime: () => {},
  linearRampToValueAtTime: () => {},
  exponentialRampToValueAtTime: () => {},
});

class FakeAudioContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  resume() {
    return Promise.resolve();
  }
  createOscillator() {
    return {
      type: 'sine',
      frequency: audioParam(),
      connect: () => {},
      start: () => {
        browser.chimeNotes++;
      },
      stop: () => {},
    };
  }
  createGain() {
    return { gain: audioParam(), connect: () => {} };
  }
}

export function installBrowser() {
  browser.reducedMotion = false;
  browser.played = [];
  browser.chimeNotes = 0;
  window.innerWidth = 1280;

  vi.stubGlobal('matchMedia', matchMedia);
  vi.stubGlobal('ResizeObserver', FakeObserver);
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('scrollTo', () => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
    this: HTMLMediaElement
  ) {
    browser.played.push(this.src);
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
}

// Not in jsdom at all, so they cannot be spied on; define harmless versions once.
if (!('animate' in Element.prototype)) {
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    value: () => ({ cancel: () => {}, finished: Promise.resolve() }),
  });
}
if (!('scrollIntoView' in Element.prototype)) {
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: () => {},
  });
}
if (!('vibrate' in navigator)) {
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: () => true });
}
