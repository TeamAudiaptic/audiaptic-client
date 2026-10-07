import { useEffect, useRef, useState } from "react";
import { Animated } from "react-native";

import type { SessionEvent } from "@/lib/events";

export interface TorchTransitionState {
  intensity: number;
  isHardwareTorchOn: boolean;
}

/**
 * Hook to manage torch brightness transitions.
 * Ramps intensity up to target over `transitionMs`, holds for the duration,
 * and fades out when the event completes.
 */
export function useTorchTransition(
  activeTorch: SessionEvent | null,
  isJoined: boolean,
): TorchTransitionState {
  const [animatedIntensity] = useState(() => new Animated.Value(0));
  const [intensity, setIntensity] = useState(0);

  const lastTransitionMs = useRef(0);

  // Subscribe to animated value changes
  useEffect(() => {
    const listenerId = animatedIntensity.addListener(({ value }) => {
      setIntensity(value);
    });

    return () => {
      animatedIntensity.removeListener(listenerId);
    };
  }, [animatedIntensity]);

  useEffect(() => {
    if (!isJoined) {
      animatedIntensity.stopAnimation();
      animatedIntensity.setValue(0);
      return;
    }

    if (activeTorch?.type === "torch") {
      const target = Math.max(0, Math.min(1, activeTorch.payload.intensity ?? 1.0));
      const transitionMs = Math.max(0, activeTorch.payload.transitionMs ?? 0);
      lastTransitionMs.current = transitionMs;

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
        }).start();
      } else {
        animatedIntensity.stopAnimation();
        animatedIntensity.setValue(0);
      }
    }
  }, [activeTorch, isJoined, animatedIntensity]);

  const currentIntensity = isJoined ? intensity : 0;
  const isHardwareTorchOn = isJoined && currentIntensity > 0.05;

  return {
    intensity: currentIntensity,
    isHardwareTorchOn,
  };
}
