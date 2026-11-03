import { useCallback, useEffect, useRef, useState } from "react";
import { Animated } from "react-native";

import type { SessionEvent } from "@/lib/events";

export interface TorchTransitionState {
  intensity: number;
  isHardwareTorchOn: boolean;
}

/**
 * Strobe bounds so both ON and OFF phases stay >= 50ms (~3 frames at 60fps),
 * giving the physical camera LED enough time to switch cleanly and evenly.
 */
const MIN_STROBE_HZ = 1;
const MAX_STROBE_HZ = 8;
const MIN_DUTY_CYCLE = 0.4;
const MAX_DUTY_CYCLE = 0.6;
const DEFAULT_DUTY_CYCLE = 0.5;

/**
 * Hook to manage torch brightness transitions and strobing.
 * Ramps intensity up to target over `transitionMs`, holds for the duration,
 * and fades out when the event completes. When `payload.strobe` is set, gates
 * the brightness on and off at the requested frequency.
 */
export function useTorchTransition(
  activeTorch: SessionEvent | null,
  isJoined: boolean,
): TorchTransitionState {
  const [animatedIntensity] = useState(() => new Animated.Value(0));
  const [intensity, setIntensity] = useState(0);

  const envelopeRef = useRef(0);
  const isStrobeOnRef = useRef(true);
  const lastTransitionMs = useRef(0);
  const strobeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopStrobe = useCallback(() => {
    if (strobeTimer.current !== null) {
      clearTimeout(strobeTimer.current);
      strobeTimer.current = null;
    }
    isStrobeOnRef.current = true;
  }, []);

  const startStrobe = useCallback(
    (strobeHz: number, dutyCycle: number) => {
      stopStrobe();

      const periodMs = 1000 / strobeHz;
      const onMs = Math.round(periodMs * dutyCycle);
      const offMs = Math.round(periodMs - onMs);

      const scheduleFlip = (delayMs: number) => {
        strobeTimer.current = setTimeout(() => {
          const on = !isStrobeOnRef.current;
          isStrobeOnRef.current = on;
          setIntensity(on ? envelopeRef.current : 0);

          scheduleFlip(on ? onMs : offMs);
        }, delayMs);
      };

      // Cycle starts ON at t = 0; schedule the first flip to OFF at `onMs`.
      scheduleFlip(onMs);
    },
    [stopStrobe],
  );

  // Subscribe to animated value changes
  useEffect(() => {
    const listenerId = animatedIntensity.addListener(({ value }) => {
      envelopeRef.current = value;
      setIntensity(isStrobeOnRef.current ? value : 0);
    });

    return () => {
      animatedIntensity.removeListener(listenerId);
    };
  }, [animatedIntensity]);

  useEffect(() => {
    if (!isJoined) {
      stopStrobe();
      animatedIntensity.stopAnimation();
      animatedIntensity.setValue(0);
      return;
    }

    if (activeTorch?.type === "torch") {
      const target = Math.max(0, Math.min(1, activeTorch.payload.intensity ?? 1.0));
      const transitionMs = Math.max(0, activeTorch.payload.transitionMs ?? 0);
      const strobe = activeTorch.payload.strobe;
      const rawStrobeHz = strobe?.strobeHz ?? 0;
      const strobeHz =
        rawStrobeHz > 0
          ? Math.max(MIN_STROBE_HZ, Math.min(MAX_STROBE_HZ, rawStrobeHz))
          : 0;
      const dutyCycle = Math.max(
        MIN_DUTY_CYCLE,
        Math.min(MAX_DUTY_CYCLE, strobe?.dutyCycle ?? DEFAULT_DUTY_CYCLE),
      );
      lastTransitionMs.current = transitionMs;

      if (strobeHz > 0) {
        startStrobe(strobeHz, dutyCycle);
      } else {
        stopStrobe();
        animatedIntensity.setValue(envelopeRef.current);
      }

      if (transitionMs > 0) {
        Animated.timing(animatedIntensity, {
          toValue: target,
          duration: transitionMs,
          useNativeDriver: false,
        }).start();
      } else {
        animatedIntensity.setValue(target);
      }
    } else {
      const fadeOutMs = lastTransitionMs.current;

      if (fadeOutMs > 0) {
        Animated.timing(animatedIntensity, {
          toValue: 0,
          duration: fadeOutMs,
          useNativeDriver: false,
        }).start(({ finished }) => {
          if (finished) stopStrobe();
        });
      } else {
        stopStrobe();
        animatedIntensity.stopAnimation();
        animatedIntensity.setValue(0);
      }
    }
  }, [activeTorch, isJoined, animatedIntensity, startStrobe, stopStrobe]);

  // Clean up strobe timer on unmount
  useEffect(() => stopStrobe, [stopStrobe]);

  const currentIntensity = isJoined ? intensity : 0;
  const isHardwareTorchOn = isJoined && currentIntensity > 0.05;

  return {
    intensity: currentIntensity,
    isHardwareTorchOn,
  };
}
