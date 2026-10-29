/**
 * Haptic output: turns the active haptic event into vibration settings.
 */

import type { HapticSettings } from "../../../modules/audiaptic-haptics/src";
import type { SessionEvent } from "../events";

/** Used when an event leaves out `sharpness`: halfway between soft and crisp. */
const DEFAULT_SHARPNESS = 0.5;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * The vibration to play for the active haptic event, with values kept in
 * range. Returns `null` when no haptic event is playing.
 */
export function getHapticSettings(hapticEvent: SessionEvent | null): HapticSettings | null {
  // Checking `type` also tells TypeScript the payload is a HapticPayload.
  if (hapticEvent?.type !== "haptic") return null;

  const { intensity, sharpness, durationMs, transitionMs } = hapticEvent.payload;

  return {
    intensity: clamp01(intensity),
    sharpness: clamp01(sharpness ?? DEFAULT_SHARPNESS),
    durationMs: Math.max(0, durationMs),
    transitionMs: Math.max(0, transitionMs ?? 0),
  };
}

