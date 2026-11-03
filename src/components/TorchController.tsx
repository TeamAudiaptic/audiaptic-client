import { CameraView } from "expo-camera";
import { cssInterop } from "nativewind";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

import { type TorchTransitionState } from "@/hooks/useTorchTransition";
import {
  hasNativeTorchLevelControl,
  setHardwareTorchLevel,
} from "../../modules/audiaptic-torch/src";

// Styles live in src/styles/torch.css. CameraView isn't a core component, so
// NativeWind has to be told to turn its className into a style.
cssInterop(CameraView, { className: "style" });

interface TorchControllerProps {
  torchState: TorchTransitionState;
}

export function TorchController({ torchState }: TorchControllerProps) {
  const [isCameraReady, setIsCameraReady] = useState(false);
  const { intensity, isHardwareTorchOn } = torchState;

  // Renders nothing visible: it only drives the flashlight.

  // Drive native hardware torch brightness levels when the native module is available
  useEffect(() => {
    if (Platform.OS !== "web" && hasNativeTorchLevelControl) {
      setHardwareTorchLevel(intensity);
    }
  }, [intensity]);

  // Ensure torch turns off if component unmounts
  useEffect(() => {
    return () => {
      if (Platform.OS !== "web" && hasNativeTorchLevelControl) {
        setHardwareTorchLevel(0);
      }
    };
  }, []);

  // Fallback to CameraView boolean torch only when running in Expo Go without the native module
  if (Platform.OS === "web" || hasNativeTorchLevelControl) return null;

  return (
    <CameraView
      facing="back"
      enableTorch={isHardwareTorchOn && isCameraReady}
      onCameraReady={() => setIsCameraReady(true)}
      className="torch-hidden-camera"
    />
  );
}
