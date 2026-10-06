import { useEffect, type RefObject } from 'react';
import type { AudioItem, SystemAudioItem } from '../../types/audio';

export interface PreloadedTrack {
  id: string;
  url: string;
}

type ElementRef = RefObject<HTMLAudioElement | null>;
type TrackRef = RefObject<PreloadedTrack | null>;

/** Three rotating `<audio>` elements: the active one plus buffers for the next and previous tracks. */
export interface PlayerSlots {
  audioRef: ElementRef;
  preloadRef: ElementRef;
  prevPreloadRef: ElementRef;
  preloadedTrackRef: TrackRef;
  prevPreloadedTrackRef: TrackRef;
}

function isBuffered(el: HTMLAudioElement | null): el is HTMLAudioElement {
  return !!el && el.readyState >= 2;
}

/**
 * If `audioId` is already buffered in the next/previous slot, rotates that element into the active
 * slot (the outgoing track becomes the buffer on the opposite side) and returns its URL.
 */
export function promotePreloaded(
  slots: PlayerSlots,
  audioId: string,
  outgoing: PreloadedTrack | null
): string | null {
  const { audioRef, preloadRef, prevPreloadRef, preloadedTrackRef, prevPreloadedTrackRef } = slots;
  const oldActive = audioRef.current;
  const next = preloadedTrackRef.current;
  const prev = prevPreloadedTrackRef.current;

  if (next?.id === audioId && isBuffered(preloadRef.current)) {
    audioRef.current = preloadRef.current;
    preloadRef.current = prevPreloadRef.current;
    prevPreloadRef.current = oldActive;
    prevPreloadedTrackRef.current = outgoing;
    preloadedTrackRef.current = null;
    return next.url;
  }

  if (prev?.id === audioId && isBuffered(prevPreloadRef.current)) {
    audioRef.current = prevPreloadRef.current;
    prevPreloadRef.current = preloadRef.current;
    preloadRef.current = oldActive;
    preloadedTrackRef.current = outgoing;
    prevPreloadedTrackRef.current = null;
    return prev.url;
  }

  return null;
}

interface PreloadTrackOptions {
  trackId: string | null;
  items: AudioItem[];
  systemItems: SystemAudioItem[];
  elementRef: ElementRef;
  trackRef: TrackRef;
  resolveAudioUrl: (audioId: string, storagePath: string) => Promise<string>;
}

/** Buffers `trackId` into the given slot so switching to it can start without a network fetch. */
export function usePreloadTrack({
  trackId,
  items,
  systemItems,
  elementRef,
  trackRef,
  resolveAudioUrl,
}: PreloadTrackOptions) {
  useEffect(() => {
    if (!trackId || trackRef.current?.id === trackId) return;
    const item = items.find((i) => i.id === trackId) ?? systemItems.find((i) => i.id === trackId);
    if (!item?.storagePath || item.status !== 'ready') return;

    let cancelled = false;
    resolveAudioUrl(trackId, item.storagePath)
      .then((url) => {
        const el = elementRef.current;
        if (cancelled || !el) return;
        trackRef.current = { id: trackId, url };
        el.src = url;
        el.load();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [trackId, items, systemItems, elementRef, trackRef, resolveAudioUrl]);
}
