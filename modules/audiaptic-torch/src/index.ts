import { requireOptionalNativeModule } from "expo-modules-core";

interface AudiapticTorchNativeModule {
  setTorchLevel(level: number): void;
}

const nativeModule =
  requireOptionalNativeModule<AudiapticTorchNativeModule>("AudiapticTorch");

/**
 * Sets the hardware flashlight brightness level (0.0 to 1.0).
 * Returns `true` if the native module handled the update, or `false` if unavailable (e.g., in Expo Go or web).
 */
export function setHardwareTorchLevel(level: number): boolean {
  if (!nativeModule) {
    return false;
  }
  nativeModule.setTorchLevel(level);
  return true;
}

export const hasNativeTorchLevelControl = nativeModule != null;

