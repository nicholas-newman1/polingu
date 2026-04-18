type AudioModeEvent = 'audio-started' | 'listening-started';

type Listener = () => void;

const listeners = new Map<AudioModeEvent, Set<Listener>>();

function getSet(event: AudioModeEvent): Set<Listener> {
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  return set;
}

export function emitAudioModeEvent(event: AudioModeEvent): void {
  const set = listeners.get(event);
  if (!set) return;
  for (const listener of set) {
    try {
      listener();
    } catch (e) {
      console.error('audioModeBus listener error', e);
    }
  }
}

export function subscribeAudioModeEvent(event: AudioModeEvent, listener: Listener): () => void {
  const set = getSet(event);
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}
