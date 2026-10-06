import { useFullscreen, useMagicKeys, whenever } from '@vueuse/core';
import { watch } from 'vue';
import { router } from '#/plugins/router/index.ts';
import { mediaElementRef } from '#/store/index.ts';
import { playbackManager } from '#/store/playback-manager.ts';

/**
 * Watchers and handlers that are common to fullscreen music and video playback
 * pages
 */
export function usePlayback() {
  watch(playbackManager.currentItem, () => {
    if (!playbackManager.currentItem.value) {
      router.back();
    }
  }, { flush: 'sync' });

  /**
   * - iOS's Safari fullscreen API is only available for the video element
   */
  const fullscreen = useFullscreen().isSupported.value
    ? useFullscreen(document.body, { autoExit: true })
    : useFullscreen(mediaElementRef, { autoExit: true });

  const keys = useMagicKeys();

  const shortcuts: Record<string, () => void | Promise<void>> = {
    space: playbackManager.playPause, k: playbackManager.playPause,
    right: playbackManager.skipForward, l: playbackManager.skipForward,
    left: playbackManager.skipBackward, j: playbackManager.skipBackward,
    f: () => fullscreen.toggle(), m: playbackManager.toggleMute,
    MediaPause: playbackManager.pause, Pause: playbackManager.pause,
    MediaPlay: playbackManager.unpause, MediaPlayPause: playbackManager.playPause,
    MediaStop: playbackManager.stop, Exit: playbackManager.stop,
    MediaTrackNext: playbackManager.setNextItem,
    MediaTrackPrevious: () => playbackManager.setPreviousItem(),
    MediaFastForward: playbackManager.skipForward, MediaRewind: playbackManager.skipBackward,
    AudioVolumeMute: playbackManager.toggleMute,
    AudioVolumeUp: playbackManager.volumeUp, AudioVolumeDown: playbackManager.volumeDown
  };
  for (const [key, action] of Object.entries(shortcuts)) {
    whenever(() => keys[key]?.value ?? false, () => action());
  }

  return { fullscreen };
}
