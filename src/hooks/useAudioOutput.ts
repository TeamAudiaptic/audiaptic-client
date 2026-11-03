/**
 * Audio output: plays the active audio event's downloaded file.
 *
 * One player is reused for every audio event. When the active event changes
 * (or ends) the previous clip is paused, and the new one is loaded, seeked to
 * `startOffsetMs` and played, fading its volume in over `transitionMs`.
 */

import { type AudioPlayer, setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { useEffect } from "react";

import type { AssetUris } from "@/lib/concertAssets";
import type { SessionEvent } from "@/lib/events";

/** How often the fade-in raises the volume. */
const FADE_STEP_MS = 50;

// Player changes live in plain functions: React's lint rules don't allow
// changing a hook's returned object directly in hook code.

/** Loads a file into the player, ready to seek and play at `volume`. */
function load(player: AudioPlayer, uri: string, volume: number) {
  player.replace({ uri });
  player.loop = false;
  player.volume = volume;
}

/** Raises the volume by `step` (capped at 1) and returns the new volume. */
function raiseVolume(player: AudioPlayer, step: number): number {
  player.volume = Math.min(1, player.volume + step);
  return player.volume;
}

export function useAudioOutput(audioEvent: SessionEvent | null, assets: AssetUris) {
  // Starts empty; released automatically when the screen unmounts.
  const player = useAudioPlayer(null);

  // Play even when an iPhone's silent switch is on: it's a performance.
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch((e) =>
      console.warn("Couldn't set audio mode", e),
    );
  }, []);

  useEffect(() => {
    if (audioEvent?.type !== "audio") return;
    const uri = assets[audioEvent.payload.assetAlias];
    if (!uri) return;

    const { startOffsetMs = 0, transitionMs = 0 } = audioEvent.payload;
    let fadeTimer: ReturnType<typeof setInterval> | undefined;
    let begun = false;

    // Seeking only works once the file is loaded, so wait for that.
    function begin() {
      if (begun) return;
      begun = true;
      player
        .seekTo(startOffsetMs / 1000)
        .catch((e) => console.warn("Couldn't seek audio", e))
        .finally(() => {
          player.play();
          if (transitionMs > 0) fadeIn(transitionMs);
        });
    }

    function fadeIn(durationMs: number) {
      const step = FADE_STEP_MS / durationMs;
      fadeTimer = setInterval(() => {
        if (raiseVolume(player, step) >= 1) clearInterval(fadeTimer);
      }, FADE_STEP_MS);
    }

    load(player, uri, transitionMs > 0 ? 0 : 1);

    // Status updates arrive asynchronously, so none are missed by subscribing
    // right after replace().
    const subscription = player.addListener("playbackStatusUpdate", (status) => {
      if (status.isLoaded) begin();
    });

    // Runs when the event ends, is replaced, or the screen goes away.
    return () => {
      subscription.remove();
      clearInterval(fadeTimer);
      player.pause();
    };
  }, [audioEvent, assets, player]);
}
