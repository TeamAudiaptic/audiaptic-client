import { Camera } from "expo-camera";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import "../global.css"; // Ensure your Tailwind global styles are imported here

export default function RootLayout() {
  const [permission, setPermission] = useState<Awaited<
    ReturnType<typeof Camera.getCameraPermissionsAsync>
  > | null>(null);

  useEffect(() => {
    Camera.getCameraPermissionsAsync().then(setPermission);
  }, []);

  const requestPermission = async () => {
    const result = await Camera.requestCameraPermissionsAsync();
    setPermission(result);
  };

  // 1. Wait for system state to resolve
  if (!permission) {
    return (
      <View className="permission-loading">
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  // 2. Render permission block if not granted
  if (!permission.granted) {
    return (
      <View className="permission-screen">
        <View className="permission-card">
          <Text className="permission-title">
            Camera Access Required
          </Text>
          <Text className="permission-body">
            We need camera access so you can use the flashlight feature.
          </Text>
          
          <TouchableOpacity 
            className="permission-button"
            onPress={requestPermission}
          >
            <Text className="permission-button-text">
              Grant Permission
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 3. Render your actual screens once access is verified
  return (
    <SafeAreaProvider>
      <PaperProvider>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
        </Stack>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
