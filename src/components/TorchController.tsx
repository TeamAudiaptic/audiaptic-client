import { CameraView } from "expo-camera";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { type TorchTransitionState } from "@/hooks/useTorchTransition";
import {
  hasNativeTorchLevelControl,
  setHardwareTorchLevel,
} from "../../modules/audiaptic-torch/src";

interface TorchControllerProps {
  torchState: TorchTransitionState;
}

export function TorchController({ torchState }: TorchControllerProps) {
  const [isCameraReady, setIsCameraReady] = useState(false);
  const { intensity, isHardwareTorchOn } = torchState;

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

  return (
    <View className="items-center">
      {/* Fallback to CameraView boolean torch only when running in Expo Go without the native module */}
      {Platform.OS !== "web" && !hasNativeTorchLevelControl && (
        <CameraView
          facing="back"
          enableTorch={isHardwareTorchOn && isCameraReady}
          onCameraReady={() => setIsCameraReady(true)}
          style={styles.hiddenCamera}
        />
      )}

      <Text className="text-xl font-bold text-white">
        Flashlight: {Math.round(intensity * 100)}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hiddenCamera: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    bottom: 0,
    right: 0,
  },
});
