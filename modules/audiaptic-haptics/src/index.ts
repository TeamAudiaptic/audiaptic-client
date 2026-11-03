import * as Haptics from "expo-haptics";
import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

interface AudiapticHapticsNativeModule {
  isSupported: boolean;
  play(intensity: number, sharpness: number, durationMs: number, transitionMs: number): void;
  stop(): void;
}

/** What to play, with every value already in range (see lib/outputs/hapticEvent.ts). */
export interface HapticSettings {
  /** Strength from 0 to 1. */
  intensity: number;
  /** Feel from soft (0) to crisp (1). */
  sharpness: number;
  /** 0 means "until stopHaptic() or the next playHaptic()". */
  durationMs: number;
  /** Fade-in time from the previous vibration, and fade-out time after `durationMs`. */
  transitionMs: number;
}

const nativeModule =
  requireOptionalNativeModule<AudiapticHapticsNativeModule>("AudiapticHaptics");

/** `true` in a development build on iOS; `false` in Expo Go, on web and on Android. */
export const hasNativeHaptics = nativeModule != null;

/**
 * Starts a continuous vibration, replacing any that's playing.
 *
 * Without the native module (Expo Go on iOS) this falls back to a single
 * expo-haptics tap, since expo-haptics can't hold a vibration for a duration.
 */
export function playHaptic({ intensity, sharpness, durationMs, transitionMs }: HapticSettings) {
  if (nativeModule) {
    nativeModule.play(intensity, sharpness, durationMs, transitionMs);
    return;
  }

  if (Platform.OS !== "ios") return;

  const style =
    intensity >= 0.67 ? Haptics.ImpactFeedbackStyle.Heavy
    : intensity >= 0.34 ? Haptics.ImpactFeedbackStyle.Medium
    : Haptics.ImpactFeedbackStyle.Light;

  Haptics.impactAsync(style).catch(() => {});
}

/** Stops the current vibration right away, skipping any fade-out. */
export function stopHaptic() {
  nativeModule?.stop();
}

