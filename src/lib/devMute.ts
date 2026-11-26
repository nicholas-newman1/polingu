/**
 * Development only: opening the app with `?devMute` silences all of its audio in
 * that browser, and `?devMute=off` brings it back. The choice is kept in
 * localStorage, so it survives reloads and navigation. Playback itself still runs
 * (events, timings, progress), only the output is silent, so audio features stay
 * testable in an automated browser without disturbing anyone nearby.
 */

const URL_PARAM = 'devMute';
const STORAGE_KEY = 'polingu.devMute';

export function setUpDevMute(): void {
  const url = new URL(window.location.href);
  const param = url.searchParams.get(URL_PARAM);
  if (param !== null) {
    if (param === 'off') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, '1');
    url.searchParams.delete(URL_PARAM);
    window.history.replaceState(window.history.state, '', url);
  }

  if (localStorage.getItem(STORAGE_KEY) !== '1') return;
  muteMediaElements();
  muteWebAudio();
  console.info(
    '[devMute] App audio is muted in this browser. Open any page with ?devMute=off to hear it again.'
  );
}

/** Every `<audio>`/`new Audio()` is muted as it starts playing. */
function muteMediaElements(): void {
  const originalPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
    this.muted = true;
    return originalPlay.call(this);
  };
}

/** Web Audio graphs (the card chimes) reach the speakers through a zero-gain node. */
function muteWebAudio(): void {
  if (typeof AudioNode === 'undefined' || typeof AudioDestinationNode === 'undefined') return;

  type Connect = (
    this: AudioNode,
    target: AudioNode | AudioParam,
    ...indices: number[]
  ) => AudioNode | void;
  const originalConnect = AudioNode.prototype.connect as Connect;
  const silentInputs = new WeakMap<AudioDestinationNode, GainNode>();

  const silentInputFor = (destination: AudioDestinationNode): GainNode => {
    let silent = silentInputs.get(destination);
    if (!silent) {
      silent = destination.context.createGain();
      silent.gain.value = 0;
      originalConnect.call(silent, destination);
      silentInputs.set(destination, silent);
    }
    return silent;
  };

  const connect: Connect = function (target, ...indices) {
    if (target instanceof AudioDestinationNode) {
      originalConnect.call(this, silentInputFor(target), ...indices);
      return target;
    }
    return originalConnect.call(this, target, ...indices);
  };
  AudioNode.prototype.connect = connect as typeof AudioNode.prototype.connect;
}
