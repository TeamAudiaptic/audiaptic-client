import { useEffect } from "react";

import type { SessionEvent } from "@/lib/events";
import { getHapticSettings } from "@/lib/outputs/hapticEvent";
import { playHaptic, stopHaptic } from "../../modules/audiaptic-haptics/src";

/**
 * Plays the active haptic event on the phone's vibration motor.
 *
 * The processor already picks the winning event and clears it when it ends,
 * so this only has to follow `activeHaptic`: play when a new event arrives,
 * and stop right away when the session is left.
 *
 * When an event simply ends, nothing is called: the native side already knows
 * the duration and fades out over `transitionMs` on its own (like the torch).
 */
export function useHapticOutput(activeHaptic: SessionEvent | null, isJoined: boolean) {
  // `activeHaptic` keeps the same object while it's playing (the processor
  // only replaces it on a haptic change), so this runs once per event.
  useEffect(() => {
    if (!isJoined) {
      stopHaptic();
      return;
    }

    const settings = getHapticSettings(activeHaptic);
    if (settings) playHaptic(settings);
  }, [activeHaptic, isJoined]);

  // Stop if the screen goes away mid-vibration.
  useEffect(() => stopHaptic, []);
}
