import { Pressable, Text, View } from "react-native";

import { ActiveEventList, EventLog } from "@/components/EventDebugView";
import { TorchController } from "@/components/TorchController";
import { useEventProcessor } from "@/hooks/useEventProcessor";
import { useTorchTransition } from "@/hooks/useTorchTransition";

export default function Index() {
  const { active, log, isJoined, join, leave } = useEventProcessor();
  const torchState = useTorchTransition(active.torch, isJoined);

  return (
    <View className="flex-1 items-center gap-6 bg-teal-500 px-4 pb-8 pt-20">
      <Pressable
        accessibilityRole="button"
        onPress={isJoined ? leave : join}
        className="rounded-full bg-white px-8 py-4 active:opacity-70"
      >
        <Text className="text-lg font-bold text-teal-600">
          {isJoined ? "Leave Event" : "Join Event"}
        </Text>
      </Pressable>

      <TorchController torchState={torchState} />
      <ActiveEventList active={active} />
      <EventLog entries={log} />
    </View>
  );
}
