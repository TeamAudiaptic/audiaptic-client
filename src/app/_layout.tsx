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
      <View className="flex-1 items-center justify-center bg-slate-900">
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  // 2. Render permission block if not granted
  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900 px-6">
        <View className="w-full max-w-sm rounded-2xl bg-slate-800 p-6 shadow-xl border border-slate-700">
          <Text className="text-xl font-bold text-white text-center mb-2">
            Camera Access Required
          </Text>
          <Text className="text-slate-400 text-center text-sm mb-6 leading-relaxed">
            We need camera access so you can use the flashlight feature.
          </Text>
          
          <TouchableOpacity 
            className="w-full bg-teal-500 active:bg-teal-600 py-3 rounded-xl"
            onPress={requestPermission}
          >
            <Text className="text-center font-semibold text-white text-base">
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
