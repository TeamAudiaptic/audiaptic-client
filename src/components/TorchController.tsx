import { CameraView } from "expo-camera";
import { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { type TorchTransitionState } from "@/hooks/useTorchTransition";

interface TorchControllerProps {
  torchState: TorchTransitionState;
}

export function TorchController({ torchState }: TorchControllerProps) {
  const [isCameraReady, setIsCameraReady] = useState(false);
  const { intensity, isHardwareTorchOn } = torchState;

  return (
    <View className="items-center">
      {Platform.OS !== "web" && (
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
