import { useCallback, useEffect, useRef, useState } from "react";
import { Animated } from "react-native";

import type { SessionEvent } from "@/lib/events";

export interface TorchTransitionState {
  intensity: number;
  isHardwareTorchOn: boolean;
}

/** Upper bound for iOS/Android camera LED hardware before flashes blur together. */
const MAX_STROBE_HZ = 20;
const DEFAULT_DUTY_CYCLE = 0.5;

/**
 * Hook to manage torch brightness transitions and strobing.
 * Ramps intensity up to target over `transitionMs`, holds for the duration,
 * and fades out when the event completes. When `strobeHz` is set, gates the
 * brightness on and off at the requested frequency.
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
      const onMs = periodMs * dutyCycle;
      const startTime = Date.now();

      const scheduleFlip = (delayMs: number) => {
        strobeTimer.current = setTimeout(() => {
          const elapsed = Date.now() - startTime;
          const cyclePos = elapsed % periodMs;
          const on = cyclePos < onMs;

          isStrobeOnRef.current = on;
          setIntensity(on ? envelopeRef.current : 0);

          const nextDelayMs = on ? onMs - cyclePos : periodMs - cyclePos;
          scheduleFlip(Math.max(1, nextDelayMs));
        }, delayMs);
      };

      // Cycle starts ON at t = 0; schedule the first flip to OFF at `onMs`.
      scheduleFlip(Math.max(1, onMs));
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
      const strobeHz = Math.max(0, Math.min(MAX_STROBE_HZ, activeTorch.payload.strobeHz ?? 0));
      const dutyCycle = Math.max(
        0.05,
        Math.min(0.95, activeTorch.payload.dutyCycle ?? DEFAULT_DUTY_CYCLE),
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
