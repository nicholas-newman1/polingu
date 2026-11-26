import { describe, expect, test, vi } from 'vitest';

// Listeners live in module state, so every test loads a fresh copy.
async function loadBus() {
  vi.resetModules();
  return import('../../src/lib/audio/audioModeBus');
}

describe('audio mode bus', () => {
  test('an event reaches every listener for that event and no others', async () => {
    const { emitAudioModeEvent, subscribeAudioModeEvent } = await loadBus();
    const first = vi.fn();
    const second = vi.fn();
    const otherEvent = vi.fn();
    subscribeAudioModeEvent('audio-started', first);
    subscribeAudioModeEvent('audio-started', second);
    subscribeAudioModeEvent('listening-started', otherEvent);

    emitAudioModeEvent('audio-started');

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(otherEvent).not.toHaveBeenCalled();
  });

  test('an unsubscribed listener is no longer called, while the others still are', async () => {
    const { emitAudioModeEvent, subscribeAudioModeEvent } = await loadBus();
    const leaving = vi.fn();
    const staying = vi.fn();
    const unsubscribe = subscribeAudioModeEvent('listening-started', leaving);
    subscribeAudioModeEvent('listening-started', staying);

    unsubscribe();
    emitAudioModeEvent('listening-started');

    expect(leaving).not.toHaveBeenCalled();
    expect(staying).toHaveBeenCalledTimes(1);
  });

  test('a listener that throws is logged and does not stop the rest', async () => {
    const { emitAudioModeEvent, subscribeAudioModeEvent } = await loadBus();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('player not ready');
    const after = vi.fn();
    subscribeAudioModeEvent('audio-started', () => {
      throw failure;
    });
    subscribeAudioModeEvent('audio-started', after);

    expect(() => emitAudioModeEvent('audio-started')).not.toThrow();

    expect(after).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('audioModeBus listener error', failure);
  });

  test('emitting with nobody listening does nothing', async () => {
    const { emitAudioModeEvent, subscribeAudioModeEvent } = await loadBus();

    expect(() => emitAudioModeEvent('audio-started')).not.toThrow();

    const unsubscribe = subscribeAudioModeEvent('audio-started', () => {});
    unsubscribe();
    expect(() => emitAudioModeEvent('audio-started')).not.toThrow();
  });
});
